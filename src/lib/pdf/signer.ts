import { PDFDocument } from "pdf-lib";
import { createServiceClient } from "@/lib/supabase/server";

interface SignerSignature {
  signature_data: string; // base64 PNG data URL
  signature_position: { x: number; y: number; page: number } | null;
  signing_order: number;
  full_name: string | null;
}

/**
 * Merges all signer signatures onto the original PDF and uploads the result.
 * Returns the storage path of the signed PDF.
 */
export async function mergeSignaturesOntoPdf(
  originalFilePath: string,
  signers: SignerSignature[]
): Promise<string> {
  const supabase = createServiceClient();

  // 1. Download original PDF from storage
  const { data: fileData, error: downloadError } = await supabase.storage
    .from("documents")
    .download(originalFilePath);

  if (downloadError || !fileData) {
    throw new Error(`Failed to download PDF: ${downloadError?.message}`);
  }

  const pdfBytes = await fileData.arrayBuffer();
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();

  // 2. Embed each signer's signature onto the PDF
  for (const signer of signers) {
    if (!signer.signature_data) continue;

    // Extract base64 data from the data URL (data:image/png;base64,...)
    const base64Data = signer.signature_data.split(",")[1];
    if (!base64Data) continue;

    const imageBytes = Uint8Array.from(atob(base64Data), (c) =>
      c.charCodeAt(0)
    );
    const signatureImage = await pdfDoc.embedPng(imageBytes);

    // Signature dimensions (scale to reasonable size)
    const sigWidth = 150;
    const sigHeight =
      (signatureImage.height / signatureImage.width) * sigWidth;

    if (signer.signature_position) {
      // Positioned mode: place at the exact coordinates the signer clicked
      const pageIndex = signer.signature_position.page - 1;
      if (pageIndex < 0 || pageIndex >= pages.length) continue;

      const page = pages[pageIndex];
      const { width: pageWidth, height: pageHeight } = page.getSize();

      // Convert percentage-based position to PDF coordinates
      // PDF origin is bottom-left, browser origin is top-left
      const x = (signer.signature_position.x / 100) * pageWidth - sigWidth / 2;
      const y =
        pageHeight -
        (signer.signature_position.y / 100) * pageHeight -
        sigHeight / 2;

      page.drawImage(signatureImage, {
        x: Math.max(0, Math.min(x, pageWidth - sigWidth)),
        y: Math.max(0, Math.min(y, pageHeight - sigHeight)),
        width: sigWidth,
        height: sigHeight,
      });
    } else {
      // Simple mode: stack signatures at bottom of first page
      const page = pages[0];
      const { width: pageWidth, height: pageHeight } = page.getSize();

      const xPos = pageWidth - sigWidth - 40;
      const yPos = 40 + (signer.signing_order - 1) * (sigHeight + 20);

      page.drawImage(signatureImage, {
        x: xPos,
        y: yPos,
        width: sigWidth,
        height: sigHeight,
      });
    }
  }

  // 3. Save modified PDF
  const signedPdfBytes = await pdfDoc.save();

  // 4. Upload signed PDF to storage
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
