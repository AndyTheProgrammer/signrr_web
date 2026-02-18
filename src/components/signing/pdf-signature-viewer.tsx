"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  MousePointerClick,
} from "lucide-react";
import { SignatureCanvasComponent } from "./signature-canvas";
import { SignaturePosition } from "@/types/database";

// Set up the PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfSignatureViewerProps {
  pdfUrl: string;
  signerName: string;
  onSubmit: (signatureData: string, position: SignaturePosition) => void;
  submitting: boolean;
}

export function PdfSignatureViewer({
  pdfUrl,
  signerName,
  onSubmit,
  submitting,
}: PdfSignatureViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signaturePosition, setSignaturePosition] =
    useState<SignaturePosition | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  // Measure container width for responsive PDF rendering
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const handlePageClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!signatureData || !pageRef.current) return;

      const rect = pageRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      setSignaturePosition({
        x: Math.max(0, Math.min(x, 100)),
        y: Math.max(0, Math.min(y, 100)),
        page: currentPage,
      });
    },
    [signatureData, currentPage]
  );

  const handleSignatureCapture = (data: string) => {
    setSignatureData(data);
    setSignaturePosition(null);
  };

  const handleReset = () => {
    setSignatureData(null);
    setSignaturePosition(null);
  };

  const handleConfirm = () => {
    if (!signatureData || !signaturePosition) return;
    onSubmit(signatureData, signaturePosition);
  };

  const pageWidth = Math.min(containerWidth - 32, 800) * scale;

  return (
    <div className="space-y-6" ref={containerRef}>
      {/* Step 1: Draw signature if not done yet */}
      {!signatureData && (
        <SignatureCanvasComponent
          onSave={handleSignatureCapture}
          signerName={signerName}
        />
      )}

      {/* Step 2: Place signature on PDF */}
      {signatureData && (
        <>
          {/* Instructions */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center space-x-3">
                <MousePointerClick className="h-5 w-5 text-neutral-700 flex-shrink-0" />
                <p className="text-sm text-gray-700">
                  {signaturePosition
                    ? "Signature placed! You can click elsewhere to reposition, or confirm to submit."
                    : "Click on the document where you want to place your signature."}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* PDF Viewer Controls */}
          <div className="flex items-center justify-between bg-gray-100 rounded-lg px-4 py-2">
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-gray-700">
                Page {currentPage} of {numPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                disabled={currentPage >= numPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm text-gray-700">
                {Math.round(scale * 100)}%
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setScale((s) => Math.min(2, s + 0.25))}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* PDF Document */}
          <div className="flex justify-center overflow-auto">
            <div
              className="relative border shadow-lg bg-white"
              ref={pageRef}
              onClick={handlePageClick}
              style={{ cursor: signatureData ? "crosshair" : "default" }}
            >
              <Document
                file={pdfUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={
                  <div className="flex items-center justify-center h-96">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                  </div>
                }
              >
                <Page
                  pageNumber={currentPage}
                  width={pageWidth}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
              </Document>

              {/* Signature overlay on current page */}
              {signaturePosition &&
                signaturePosition.page === currentPage && (
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      left: `${signaturePosition.x}%`,
                      top: `${signaturePosition.y}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    <div className="border-2 border-neutral-900 rounded bg-white/80 p-1">
                      <img
                        src={signatureData}
                        alt="Your signature"
                        className="h-16 w-auto"
                      />
                    </div>
                  </div>
                )}
            </div>
          </div>

          {/* Signature Preview and Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Your Signature</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="border rounded p-2 bg-white">
                    <img
                      src={signatureData}
                      alt="Your signature"
                      className="h-12 w-auto"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{signerName}</p>
                    {signaturePosition && (
                      <p className="text-xs text-gray-500">
                        Placed on page {signaturePosition.page}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button variant="outline" onClick={handleReset}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Redraw
                  </Button>
                  <Button
                    onClick={handleConfirm}
                    disabled={!signaturePosition || submitting}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    {submitting ? "Submitting..." : "Confirm & Submit"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
