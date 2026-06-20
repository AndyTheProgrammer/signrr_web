import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import { createServiceClient } from "@/lib/supabase/server";

export interface Annotation {
  type: "text" | "date";
  content: string;
  x: number; // percentage of page width (0–100)
  y: number; // percentage of page height (0–100)
  page: number; // 1-indexed
  fontSize?: number; // display px; converted to PDF points on render
}

interface SignerSignature {
  signature_data: string;
  signature_position: { x: number; y: number; page: number; width?: number } | null;
  annotations?: Annotation[];
  signing_order: number;
  full_name: string | null;
}

/**
 * Converts viewer-space percentage coordinates to the native PDF center point.
 *
 * pdfjs (react-pdf) renders the CropBox region and applies the page's /Rotate
 * flag, so the viewer's (xPct, yPct) are in post-rotation visual space. This
 * function maps them back to the native (pre-rotation) PDF coordinate system
 * that pdf-lib uses when drawing.
 *
 * Rotation mappings (viewer % → native PDF coordinates):
 *   R=0:   cx = ox + xPct*pw,         cy = oy + (1-yPct)*ph
 *   R=90:  cx = ox + (1-yPct)*pw,     cy = oy + (1-xPct)*ph
 *   R=180: cx = ox + (1-xPct)*pw,     cy = oy + yPct*ph
 *   R=270: cx = ox + yPct*pw,         cy = oy + xPct*ph
 */
function viewerPctToNativeCenter(
  xPct: number,
  yPct: number,
  box: { x: number; y: number; width: number; height: number },
  rotation: number
): { cx: number; cy: number; visualW: number; visualH: number } {
  const { x: ox, y: oy, width: pw, height: ph } = box;
  const x = xPct / 100;
  const y = yPct / 100;

  switch (rotation) {
    case 90:  // 90° CW display: viewer x-axis = native y-axis, viewer y-axis = native x-axis
      return { cx: ox + pw * y,       cy: oy + ph * x,       visualW: ph, visualH: pw };
    case 180: // 180° CW display: both axes inverted
      return { cx: ox + pw * (1 - x), cy: oy + ph * y,       visualW: pw, visualH: ph };
    case 270: // 270° CW (=90° CCW) display: both viewer axes map to inverted native axes
      return { cx: ox + pw * (1 - y), cy: oy + ph * (1 - x), visualW: ph, visualH: pw };
    default:  // 0: straightforward
      return { cx: ox + pw * x,       cy: oy + ph * (1 - y), visualW: pw, visualH: ph };
  }
}

/**
 * Computes the pdf-lib draw origin (bottom-left of the element before rotation)
 * so that a W×H element drawn with `rotate: degrees(rotDeg)` is visually
 * centered at (cx, cy) in native PDF space.
 *
 * pdf-lib rotates around the element's own bottom-left corner (x, y), so we
 * back-calculate (x, y) from the desired center:
 *   x = cx - W/2·cos(θ) + H/2·sin(θ)
 *   y = cy - W/2·sin(θ) - H/2·cos(θ)
 */
function centeredDrawOrigin(
  cx: number,
  cy: number,
  W: number,
  H: number,
  rotDeg: number
): { x: number; y: number } {
  const rad = (rotDeg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return {
    x: cx - (W / 2) * c + (H / 2) * s,
    y: cy - (W / 2) * s - (H / 2) * c,
  };
}

export async function mergeSignaturesOntoPdf(
  originalFilePath: string,
  signers: SignerSignature[]
): Promise<string> {
  const supabase = createServiceClient();

  const { data: fileData, error: downloadError } = await supabase.storage
    .from("documents")
    .download(originalFilePath);

  if (downloadError || !fileData) {
    throw new Error(`Failed to download PDF: ${downloadError?.message}`);
  }

  const pdfBytes = await fileData.arrayBuffer();
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const signer of signers) {
    if (!signer.signature_data) continue;

    // ── Embed signature image ──
    const base64Data = signer.signature_data.split(",")[1];
    if (base64Data) {
      const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      const signatureImage = await pdfDoc.embedPng(imageBytes);

      if (signer.signature_position) {
        const pageIndex = signer.signature_position.page - 1;
        if (pageIndex >= 0 && pageIndex < pages.length) {
          const page = pages[pageIndex];
          // pdfjs renders the CropBox with the page's /Rotate applied, so
          // percentages from the viewer are in post-rotation visual space.
          const cropBox = page.getCropBox();
          const mediaBox = page.getMediaBox();
          const box = cropBox ?? mediaBox;
          const rotation = page.getRotation().angle; // 0 | 90 | 180 | 270

          const { cx, cy, visualW } = viewerPctToNativeCenter(
            signer.signature_position.x,
            signer.signature_position.y,
            box,
            rotation
          );

          // Signature width is stored as % of visual page width
          const sigW = signer.signature_position.width
            ? (signer.signature_position.width / 100) * visualW
            : 150;
          const sigH = (signatureImage.height / signatureImage.width) * sigW;

          // Counter-rotate the image so it appears upright after the viewer
          // applies the page's own rotation.
          const compDeg = rotation;
          const { x: drawX, y: drawY } = centeredDrawOrigin(cx, cy, sigW, sigH, compDeg);

          page.drawImage(signatureImage, {
            x: drawX,
            y: drawY,
            width: sigW,
            height: sigH,
            rotate: degrees(compDeg),
          });
        }
      } else {
        // Simple mode — stack at bottom-right of page 1 (no viewer positioning)
        const page = pages[0];
        const { width: pw, height: ph } = page.getSize();
        const sigW = 150;
        const sigH = (signatureImage.height / signatureImage.width) * sigW;
        const xPos = pw - sigW - 40;
        const yPos = 40 + (signer.signing_order - 1) * (sigH + 20);
        page.drawImage(signatureImage, {
          x: xPos,
          y: Math.min(yPos, ph - sigH - 10),
          width: sigW,
          height: sigH,
        });
      }
    }

    // ── Embed text / date annotations ──
    if (signer.annotations && signer.annotations.length > 0) {
      for (const annotation of signer.annotations) {
        const pageIndex = annotation.page - 1;
        if (pageIndex < 0 || pageIndex >= pages.length) continue;

        const page = pages[pageIndex];
        const cropBox = page.getCropBox();
        const mediaBox = page.getMediaBox();
        const box = cropBox ?? mediaBox;
        const rotation = page.getRotation().angle;

        // Convert display px → PDF points (approx 0.75 ratio)
        const fontSize = annotation.fontSize ? Math.round(annotation.fontSize * 0.75) : 11;
        const textWidth = helvetica.widthOfTextAtSize(annotation.content, fontSize);

        const { cx, cy } = viewerPctToNativeCenter(
          annotation.x,
          annotation.y,
          box,
          rotation
        );

        const compDeg = rotation;
        const { x: drawX, y: drawY } = centeredDrawOrigin(
          cx,
          cy,
          textWidth,
          fontSize,
          compDeg
        );

        page.drawText(annotation.content, {
          x: drawX,
          y: drawY,
          size: fontSize,
          font: helvetica,
          color: rgb(0, 0, 0),
          rotate: degrees(compDeg),
        });
      }
    }
  }

  const signedPdfBytes = await pdfDoc.save();
  const signedPath = originalFilePath.replace(".pdf", "_signed.pdf");

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(signedPath, signedPdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Failed to upload signed PDF: ${uploadError.message}`);
  }

  return signedPath;
}

export interface BulkPlacementConfig {
  mode: "all-pages" | "specific-pages";
  position?: { x: number; y: number; width?: number };
  placements?: { page: number; x: number; y: number; width?: number }[];
}

export async function bulkMergeSignatureOnPages(
  originalFilePath: string,
  signatureData: string,
  config: BulkPlacementConfig
): Promise<string> {
  const supabase = createServiceClient();

  const { data: fileData, error: downloadError } = await supabase.storage
    .from("documents")
    .download(originalFilePath);

  if (downloadError || !fileData) {
    throw new Error(`Failed to download PDF: ${downloadError?.message}`);
  }

  const pdfBytes = await fileData.arrayBuffer();
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();

  const base64Data = signatureData.split(",")[1];
  if (!base64Data) throw new Error("Invalid signature data");

  const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
  const signatureImage = await pdfDoc.embedPng(imageBytes);

  const drawOnPage = (
    page: ReturnType<typeof pdfDoc.getPage>,
    xPct: number,
    yPct: number,
    widthPct: number = 20
  ) => {
    const cropBox = page.getCropBox();
    const mediaBox = page.getMediaBox();
    const box = cropBox ?? mediaBox;
    const rotation = page.getRotation().angle;

    const { cx, cy, visualW } = viewerPctToNativeCenter(xPct, yPct, box, rotation);
    const sigW = (widthPct / 100) * visualW;
    const sigH = (signatureImage.height / signatureImage.width) * sigW;

    const compDeg = rotation;
    const { x: drawX, y: drawY } = centeredDrawOrigin(cx, cy, sigW, sigH, compDeg);

    page.drawImage(signatureImage, {
      x: drawX,
      y: drawY,
      width: sigW,
      height: sigH,
      rotate: degrees(compDeg),
    });
  };

  if (config.mode === "all-pages") {
    if (!config.position) throw new Error("Position required for all-pages mode");
    const { x, y, width } = config.position;
    for (const page of pages) {
      drawOnPage(page, x, y, width ?? 20);
    }
  } else {
    for (const placement of config.placements ?? []) {
      const pageIndex = placement.page - 1;
      if (pageIndex >= 0 && pageIndex < pages.length) {
        drawOnPage(pages[pageIndex], placement.x, placement.y, placement.width ?? 20);
      }
    }
  }

  const signedPdfBytes = await pdfDoc.save();
  const signedPath = originalFilePath.replace(/\.pdf$/i, "_bulk_signed.pdf");

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(signedPath, signedPdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Failed to upload signed PDF: ${uploadError.message}`);
  }

  return signedPath;
}
