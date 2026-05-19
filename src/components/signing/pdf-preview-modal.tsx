"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ZoomIn,
  ZoomOut,
  X,
  Loader2,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfPreviewModalProps {
  documentId: string;
  title: string;
  open: boolean;
  onClose: () => void;
}

async function fetchSignedUrl(documentId: string): Promise<string> {
  const res = await fetch(`/api/documents/${documentId}/pdf-url`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load PDF");
  return data.url as string;
}

async function triggerDownload(url: string, filename: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}

export function PdfPreviewModal({
  documentId,
  title,
  open,
  onClose,
}: PdfPreviewModalProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [scale, setScale] = useState(1);
  const [downloading, setDownloading] = useState(false);
  const [containerWidth, setContainerWidth] = useState(720);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch the signed PDF URL whenever the modal opens
  useEffect(() => {
    if (!open || !documentId) return;
    setPdfUrl(null);
    setLoadError(false);
    setCurrentPage(1);
    setPageInput("1");
    setNumPages(0);
    fetchSignedUrl(documentId)
      .then(setPdfUrl)
      .catch(() => setLoadError(true));
  }, [open, documentId]);

  // Keep page input in sync with current page
  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  // Measure container for responsive page width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  const goToPage = (p: number) =>
    setCurrentPage(Math.max(1, Math.min(numPages || 1, p)));

  const commitPageInput = (raw: string) => {
    const n = parseInt(raw, 10);
    if (!isNaN(n)) goToPage(n);
    else setPageInput(String(currentPage));
  };

  const handleDownload = async () => {
    if (!pdfUrl) return;
    setDownloading(true);
    try {
      const safeTitle = title.replace(/[^a-z0-9]/gi, "_");
      await triggerDownload(pdfUrl, `${safeTitle}_signed.pdf`);
    } catch {
      toast.error("Download failed — try again");
    } finally {
      setDownloading(false);
    }
  };

  const pageWidth = Math.min(Math.max(containerWidth - 32, 300), 860) * scale;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-4xl w-full p-0 overflow-hidden flex flex-col"
        style={{ maxHeight: "92vh" }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b bg-white flex-shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
              <FileText className="h-4 w-4 text-red-500" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-sm font-semibold truncate">{title}</DialogTitle>
              <p className="text-xs text-gray-400">Signed document</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 ml-4 flex-shrink-0">
            {/* Page navigation */}
            {numPages > 0 && (
              <div className="hidden sm:flex items-center space-x-1 bg-gray-100 rounded-lg px-2 py-1">
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="text-gray-500 hover:text-gray-900 disabled:opacity-30 p-0.5"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="flex items-center space-x-1 text-sm text-gray-700">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={pageInput}
                    onChange={(e) => setPageInput(e.target.value)}
                    onBlur={(e) => commitPageInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        commitPageInput(pageInput);
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    className="w-8 text-center border border-gray-300 rounded px-1 py-0.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-neutral-400"
                  />
                  <span className="text-gray-400">/</span>
                  <span>{numPages}</span>
                </div>
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage >= numPages}
                  className="text-gray-500 hover:text-gray-900 disabled:opacity-30 p-0.5"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Zoom */}
            <div className="hidden sm:flex items-center space-x-1">
              <button
                onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
                className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="text-xs text-gray-500 w-10 text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={() => setScale((s) => Math.min(2.5, s + 0.25))}
                className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>

            {/* Download */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={!pdfUrl || downloading}
              className="flex-shrink-0"
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <Download className="h-4 w-4 mr-1.5" />
              )}
              {downloading ? "Downloading…" : "Download"}
            </Button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── PDF canvas ── */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto bg-gray-200 flex justify-center py-4"
        >
          {loadError ? (
            <div className="flex flex-col items-center justify-center text-center py-24 px-8">
              <FileText className="h-10 w-10 text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">Failed to load the PDF.</p>
              <p className="text-xs text-gray-400 mt-1">
                The signed URL may have expired — go back and try again.
              </p>
            </div>
          ) : !pdfUrl ? (
            <div className="flex flex-col items-center justify-center py-24">
              <Loader2 className="h-10 w-10 animate-spin text-gray-400 mb-3" />
              <p className="text-sm text-gray-500">Loading document…</p>
            </div>
          ) : (
            <div className="shadow-2xl">
              <Document
                file={pdfUrl}
                onLoadSuccess={({ numPages: n }) => setNumPages(n)}
                onLoadError={() => setLoadError(true)}
                loading={
                  <div
                    className="flex items-center justify-center bg-white"
                    style={{ width: pageWidth, minHeight: 600 }}
                  >
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
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
            </div>
          )}
        </div>

        {/* ── Mobile page navigation ── */}
        {numPages > 0 && (
          <div className="flex sm:hidden items-center justify-center space-x-4 border-t bg-white px-4 py-3 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => goToPage(currentPage - 1)}
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
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= numPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
