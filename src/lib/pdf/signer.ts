import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
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

export async function mergeSignaturesOntoPdf(
  originalFilePath: string,
  signers: SignerSignature[]
): Promise<string> {
  const supabase = createServiceClient();

  // Download original PDF
  const { data: fileData, error: downloadError } = await supabase.storage
    .from("documents")
    .download(originalFilePath);

  if (downloadError || !fileData) {
    throw new Error(`Failed to download PDF: ${downloadError?.message}`);
  }

  const pdfBytes = await fileData.arrayBuffer();
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();

  // Embed Helvetica once for all text annotations
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const signer of signers) {
    if (!signer.signature_data) continue;

    // ── Embed signature image ──
    const base64Data = signer.signature_data.split(",")[1];
    if (base64Data) {
      const imageBytes = Uint8Array.from(atob(base64Data), (c) =>
        c.charCodeAt(0)
      );
      const signatureImage = await pdfDoc.embedPng(imageBytes);
      const sigWidth = 150;
      const sigHeight =
        (signatureImage.height / signatureImage.width) * sigWidth;

      if (signer.signature_position) {
        const pageIndex = signer.signature_position.page - 1;
        if (pageIndex >= 0 && pageIndex < pages.length) {
          const page = pages[pageIndex];
          // Use CropBox when available — pdfjs (react-pdf) renders the CropBox,
          // so percentages from the viewer are relative to that region, not the full MediaBox.
          const cropBox = page.getCropBox();
          const mediaBox = page.getMediaBox();
          const box = cropBox ?? mediaBox;
          const originX = box.x;   // lower-left x of the visible region in PDF space
          const originY = box.y;   // lower-left y of the visible region in PDF space
          const pw = box.width;
          const ph = box.height;
          // Use the user-set width (% of page) if provided, else default 150pt
          const resolvedSigWidth = signer.signature_position.width
            ? (signer.signature_position.width / 100) * pw
            : sigWidth;
          const resolvedSigHeight =
            (signatureImage.height / signatureImage.width) * resolvedSigWidth;
          // Convert viewer percentages (origin top-left) → PDF coordinate space (origin bottom-left of box)
          const x = originX + (signer.signature_position.x / 100) * pw - resolvedSigWidth / 2;
          const y = originY + ph - (signer.signature_position.y / 100) * ph - resolvedSigHeight / 2;
          page.drawImage(signatureImage, {
            x: Math.max(originX, Math.min(x, originX + pw - resolvedSigWidth)),
            y: Math.max(originY, Math.min(y, originY + ph - resolvedSigHeight)),
            width: resolvedSigWidth,
            height: resolvedSigHeight,
          });
        }
      } else {
        // Simple mode — stack at bottom-right of page 1
        const page = pages[0];
        const { width: pw, height: ph } = page.getSize();
        const xPos = pw - sigWidth - 40;
        const yPos = 40 + (signer.signing_order - 1) * (sigHeight + 20);
        page.drawImage(signatureImage, {
          x: xPos,
          y: Math.min(yPos, ph - sigHeight - 10),
          width: sigWidth,
          height: sigHeight,
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
        const originX = box.x;
        const originY = box.y;
        const pw = box.width;
        const ph = box.height;
        // Convert display px → PDF points (approx 0.75 ratio)
        const fontSize = annotation.fontSize ? Math.round(annotation.fontSize * 0.75) : 11;

        const textWidth = helvetica.widthOfTextAtSize(annotation.content, fontSize);
        const cx = originX + (annotation.x / 100) * pw - textWidth / 2;
        const cy = originY + ph - (annotation.y / 100) * ph - fontSize / 2;

        page.drawText(annotation.content, {
          x: Math.max(originX + 4, Math.min(cx, originX + pw - textWidth - 4)),
          y: Math.max(originY + 4, cy),
          size: fontSize,
          font: helvetica,
          color: rgb(0, 0, 0),
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
    x: number,
    y: number,
    widthPct: number = 20
  ) => {
    const { width: pw, height: ph } = page.getSize();
    const sigWidth = (widthPct / 100) * pw;
    const sigHeight = (signatureImage.height / signatureImage.width) * sigWidth;
    const drawX = (x / 100) * pw - sigWidth / 2;
    const drawY = ph - (y / 100) * ph - sigHeight / 2;
    page.drawImage(signatureImage, {
      x: Math.max(0, Math.min(drawX, pw - sigWidth)),
      y: Math.max(0, Math.min(drawY, ph - sigHeight)),
      width: sigWidth,
      height: sigHeight,
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
