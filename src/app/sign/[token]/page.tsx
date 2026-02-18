"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import { SignatureCanvasComponent } from "@/components/signing/signature-canvas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { SignaturePosition } from "@/types/database";

// Dynamically import PDF viewer (client-only, react-pdf requires browser APIs)
const PdfSignatureViewer = dynamic(
  () =>
    import("@/components/signing/pdf-signature-viewer").then(
      (mod) => mod.PdfSignatureViewer
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    ),
  }
);

interface SignerData {
  id: string;
  email: string;
  full_name: string;
  signing_order: number;
}

interface DocumentData {
  id: string;
  title: string;
  file_path: string;
  signing_mode: "simple" | "positioned";
}

export default function SignPage() {
  const params = useParams();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [signer, setSigner] = useState<SignerData | null>(null);
  const [document, setDocument] = useState<DocumentData | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [alreadySigned, setAlreadySigned] = useState(false);
  const [notYourTurn, setNotYourTurn] = useState(false);
  const [currentSignerInfo, setCurrentSignerInfo] = useState<{
    order: number;
    name: string;
  } | null>(null);

  useEffect(() => {
    verifyToken();
  }, [token]);

  const verifyToken = async () => {
    setVerifying(true);
    try {
      const response = await fetch(`/api/sign/verify?token=${token}`);
      const data = await response.json();

      if (!response.ok) {
        if (data.alreadySigned) {
          setAlreadySigned(true);
        } else if (data.notYourTurn) {
          setNotYourTurn(true);
          setCurrentSignerInfo({
            order: data.currentSignerOrder,
            name: data.currentSignerName,
          });
        }
        throw new Error(data.error || "Failed to verify signing link");
      }

      setSigner(data.signer);
      setDocument(data.document);

      // If positioned mode, fetch the PDF URL
      if (data.document.signing_mode === "positioned") {
        fetchPdfUrl();
      }
    } catch (error: any) {
      setError(error.message);
      toast.error(error.message);
    } finally {
      setVerifying(false);
      setLoading(false);
    }
  };

  const fetchPdfUrl = async () => {
    try {
      const response = await fetch(`/api/sign/pdf-url?token=${token}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load PDF");
      }

      setPdfUrl(data.url);
    } catch (error: any) {
      toast.error("Failed to load document PDF");
      console.error("PDF URL error:", error);
    }
  };

  // Simple mode: just signature data
  const handleSimpleSignatureSubmit = async (signatureData: string) => {
    if (!document || !signer) return;

    setSubmitting(true);

    try {
      const response = await fetch(`/api/sign/${document.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          signature_data: signatureData,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit signature");
      }

      toast.success("Document signed successfully!");
      setAlreadySigned(true);
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  // Positioned mode: signature data + position on PDF
  const handlePositionedSignatureSubmit = async (
    signatureData: string,
    position: SignaturePosition
  ) => {
    if (!document || !signer) return;

    setSubmitting(true);

    try {
      const response = await fetch(`/api/sign/${document.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          signature_data: signatureData,
          signature_position: position,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit signature");
      }

      toast.success("Document signed successfully!");
      setAlreadySigned(true);
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verifying signing link...</p>
        </div>
      </div>
    );
  }

  if (error && !alreadySigned && !notYourTurn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <AlertCircle className="h-8 w-8 text-red-500" />
              <CardTitle>Invalid Signing Link</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">{error}</p>
            <p className="text-sm text-gray-500">
              This link may have expired or is no longer valid. Please contact the document
              sender for a new link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (alreadySigned) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <CardTitle>Document Signed</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              You have successfully signed this document. Thank you!
            </p>
            {document && (
              <div className="bg-gray-50 rounded-lg p-4 mt-4">
                <p className="text-sm font-medium text-gray-700">Document:</p>
                <p className="text-sm text-gray-600 mt-1">{document.title}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (notYourTurn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center space-x-3">
              <Clock className="h-8 w-8 text-yellow-500" />
              <CardTitle>Not Your Turn Yet</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              This document requires sequential signing. It's currently waiting for another
              signer to complete their signature first.
            </p>
            {currentSignerInfo && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm font-medium text-yellow-800">Current Signer:</p>
                <p className="text-sm text-yellow-700 mt-1">
                  Signer #{currentSignerInfo.order} - {currentSignerInfo.name}
                </p>
              </div>
            )}
            <p className="text-sm text-gray-500 mt-4">
              You'll receive an email notification when it's your turn to sign.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!signer || !document) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex items-start space-x-4">
              <FileText className="h-10 w-10 text-neutral-700 mt-1" />
              <div className="flex-1">
                <CardTitle className="text-2xl">{document.title}</CardTitle>
                <p className="text-gray-600 mt-2">
                  You've been invited to sign this document as signer #{signer.signing_order}
                </p>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Signer Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-sm font-medium text-gray-500">Name</p>
              <p className="text-sm mt-1">{signer.full_name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Email</p>
              <p className="text-sm mt-1">{signer.email}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Signing Order</p>
              <p className="text-sm mt-1">Signer #{signer.signing_order}</p>
            </div>
          </CardContent>
        </Card>

        {/* Signing UI - based on mode */}
        {document.signing_mode === "positioned" ? (
          // Positioned Mode: PDF viewer with click-to-place
          pdfUrl ? (
            <PdfSignatureViewer
              pdfUrl={pdfUrl}
              signerName={signer.full_name}
              onSubmit={handlePositionedSignatureSubmit}
              submitting={submitting}
            />
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                  <p className="mt-4 text-gray-600">Loading document...</p>
                </div>
              </CardContent>
            </Card>
          )
        ) : (
          // Simple Mode: just the signature canvas
          <>
            {submitting ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neutral-900 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Submitting your signature...</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <SignatureCanvasComponent
                onSave={handleSimpleSignatureSubmit}
                signerName={signer.full_name}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
