"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SignatureCanvasComponent } from "./signature-canvas";
import { SignaturePosition } from "@/types/database";
import { Annotation } from "@/lib/pdf/signer";
import { toast } from "sonner";

// PDF viewer is client-only
const PdfSignatureViewer = dynamic(
  () =>
    import("./pdf-signature-viewer").then((mod) => mod.PdfSignatureViewer),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    ),
  }
);

interface SelfSignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  documentTitle: string;
  signingMode: "simple" | "positioned";
  signerName: string;
  onSuccess: () => void;
}

export function SelfSignDialog({
  open,
  onOpenChange,
  documentId,
  documentTitle,
  signingMode,
  signerName,
  onSuccess,
}: SelfSignDialogProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && signingMode === "positioned" && !pdfUrl) {
      setLoadingPdf(true);
      fetch(`/api/documents/${documentId}/pdf-url?version=original`)
        .then((r) => r.json())
        .then((data) => {
          if (data.url) setPdfUrl(data.url);
          else toast.error("Failed to load document");
        })
        .catch(() => toast.error("Failed to load document"))
        .finally(() => setLoadingPdf(false));
    }
  }, [open, signingMode, documentId, pdfUrl]);

  // Reset PDF URL when dialog closes so it reloads fresh next time
  const handleOpenChange = (val: boolean) => {
    if (!val) setPdfUrl(null);
    onOpenChange(val);
  };

  const submitSignature = async (
    signatureData: string,
    position?: SignaturePosition,
    annotations?: Annotation[]
  ) => {
    setSubmitting(true);
    try {
      const response = await fetch(`/api/documents/${documentId}/self-sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature_data: signatureData,
          ...(position ? { signature_position: position } : {}),
          ...(annotations && annotations.length > 0 ? { annotations } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to sign document");
      toast.success("Document signed successfully!");
      handleOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={
          signingMode === "positioned"
            ? "sm:max-w-4xl max-h-[92vh] overflow-y-auto"
            : "sm:max-w-lg"
        }
      >
        <DialogHeader>
          <DialogTitle>Sign Document</DialogTitle>
          <DialogDescription>
            Signing <span className="font-medium text-gray-900">&ldquo;{documentTitle}&rdquo;</span> as yourself
          </DialogDescription>
        </DialogHeader>

        {signingMode === "simple" && (
          <SignatureCanvasComponent
            signerName={signerName}
            onSave={(data) => submitSignature(data)}
          />
        )}

        {signingMode === "positioned" && (
          <>
            {loadingPdf && (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
              </div>
            )}
            {!loadingPdf && pdfUrl && (
              <PdfSignatureViewer
                pdfUrl={pdfUrl}
                signerName={signerName}
                onSubmit={(sig, pos, ann) => submitSignature(sig, pos, ann)}
                submitting={submitting}
              />
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
