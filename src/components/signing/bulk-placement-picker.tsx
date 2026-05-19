"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Layers,
  FileText,
  X,
  MousePointerClick,
} from "lucide-react";
import { SignatureCanvasComponent } from "./signature-canvas";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export interface BulkPlacementResult {
  signatureData: string;
  mode: "all-pages" | "specific-pages";
  position?: { x: number; y: number; width: number };
  placements?: { page: number; x: number; y: number; width: number }[];
}

interface Placement {
  x: number; // % of page width, center anchor
  y: number; // % of page height, center anchor
  width: number; // % of page width
}

interface BulkPlacementPickerProps {
  pdfUrl: string;
  onComplete: (result: BulkPlacementResult) => void;
}

type SubStep = "draw" | "place";

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export function BulkPlacementPicker({ pdfUrl, onComplete }: BulkPlacementPickerProps) {
  const [subStep, setSubStep] = useState<SubStep>("draw");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [mode, setMode] = useState<"all-pages" | "specific-pages">("all-pages");

  // Placement state
  const [allPagesPlacement, setAllPagesPlacement] = useState<Placement | null>(null);
  const [specificPlacements, setSpecificPlacements] = useState<Map<number, Placement>>(
    new Map()
  );

  // PDF viewer state
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [containerWidth, setContainerWidth] = useState(700);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  // Interaction refs — store mode/page at interaction start to avoid stale closures
  const dragRef = useRef<{
    startPX: number;
    startPY: number;
    origX: number;
    origY: number;
    mode: "all-pages" | "specific-pages";
    page: number;
  } | null>(null);

  const resizeRef = useRef<{
    startPX: number;
    origWidth: number;
    mode: "all-pages" | "specific-pages";
    page: number;
  } | null>(null);

  // Measure container width with ResizeObserver so the PDF fills the available space
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const currentPlacement: Placement | null =
    mode === "all-pages" ? allPagesPlacement : (specificPlacements.get(currentPage) ?? null);

  // Click-to-place on the PDF page
  const handlePageClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!pageRef.current || !signatureData) return;
      if (dragRef.current || resizeRef.current) return;
      const rect = pageRef.current.getBoundingClientRect();
      const x = clamp(((e.clientX - rect.left) / rect.width) * 100, 5, 95);
      const y = clamp(((e.clientY - rect.top) / rect.height) * 100, 5, 95);
      const p: Placement = { x, y, width: 22 };
      if (mode === "all-pages") {
        setAllPagesPlacement(p);
      } else {
        setSpecificPlacements((prev) => new Map(prev).set(currentPage, p));
      }
    },
    [signatureData, mode, currentPage]
  );

  // ── Drag (pointer events are on the overlay element — pointer capture keeps
  //    them firing even when cursor moves outside the element) ──
  const handleDragStart = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0 || !currentPlacement) return;
      e.stopPropagation();
      e.preventDefault();
      dragRef.current = {
        startPX: e.clientX,
        startPY: e.clientY,
        origX: currentPlacement.x,
        origY: currentPlacement.y,
        mode,
        page: currentPage,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      document.body.style.cursor = "grabbing";
    },
    [currentPlacement, mode, currentPage]
  );

  const handleDragMove = useCallback((e: React.PointerEvent) => {
    const dr = dragRef.current;
    if (!dr || !pageRef.current) return;
    const rect = pageRef.current.getBoundingClientRect();
    const newX = clamp(dr.origX + ((e.clientX - dr.startPX) / rect.width) * 100, 5, 95);
    const newY = clamp(dr.origY + ((e.clientY - dr.startPY) / rect.height) * 100, 5, 95);
    if (dr.mode === "all-pages") {
      setAllPagesPlacement((prev) => (prev ? { ...prev, x: newX, y: newY } : prev));
    } else {
      setSpecificPlacements((prev) => {
        const next = new Map(prev);
        const ex = next.get(dr.page);
        if (ex) next.set(dr.page, { ...ex, x: newX, y: newY });
        return next;
      });
    }
  }, []);

  const handleDragEnd = useCallback(() => {
    dragRef.current = null;
    document.body.style.cursor = "";
  }, []);

  // ── Resize (right-edge handle on the overlay) ──
  const handleResizeStart = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (!currentPlacement) return;
      resizeRef.current = {
        startPX: e.clientX,
        origWidth: currentPlacement.width,
        mode,
        page: currentPage,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      document.body.style.cursor = "ew-resize";
    },
    [currentPlacement, mode, currentPage]
  );

  const handleResizeMove = useCallback((e: React.PointerEvent) => {
    const rr = resizeRef.current;
    if (!rr || !pageRef.current) return;
    const rect = pageRef.current.getBoundingClientRect();
    const newWidth = clamp(
      rr.origWidth + ((e.clientX - rr.startPX) / rect.width) * 100,
      5,
      70
    );
    if (rr.mode === "all-pages") {
      setAllPagesPlacement((prev) => (prev ? { ...prev, width: newWidth } : prev));
    } else {
      setSpecificPlacements((prev) => {
        const next = new Map(prev);
        const ex = next.get(rr.page);
        if (ex) next.set(rr.page, { ...ex, width: newWidth });
        return next;
      });
    }
  }, []);

  const handleResizeEnd = useCallback(() => {
    resizeRef.current = null;
    document.body.style.cursor = "";
  }, []);

  const removePlacement = () => {
    if (mode === "all-pages") {
      setAllPagesPlacement(null);
    } else {
      setSpecificPlacements((prev) => {
        const next = new Map(prev);
        next.delete(currentPage);
        return next;
      });
    }
  };

  const handleModeChange = (newMode: "all-pages" | "specific-pages") => {
    setMode(newMode);
    setAllPagesPlacement(null);
    setSpecificPlacements(new Map());
  };

  const canConfirm =
    mode === "all-pages" ? !!allPagesPlacement : specificPlacements.size > 0;

  const handleConfirm = () => {
    if (!signatureData) return;
    if (mode === "all-pages" && allPagesPlacement) {
      onComplete({ signatureData, mode: "all-pages", position: allPagesPlacement });
    } else if (mode === "specific-pages" && specificPlacements.size > 0) {
      onComplete({
        signatureData,
        mode: "specific-pages",
        placements: Array.from(specificPlacements.entries()).map(([page, p]) => ({
          page,
          ...p,
        })),
      });
    }
  };

  // Clamp page width between 400 and 960px so the PDF is always readable
  const pageWidth = Math.min(Math.max(containerWidth - 48, 400), 960) * scale;

  // ── Step 1: Draw signature ──
  if (subStep === "draw") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-500 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-blue-700">
          Draw your signature below. In the next step you&apos;ll choose where it should
          appear on your documents.
        </p>
        <SignatureCanvasComponent
          onSave={(data) => {
            setSignatureData(data);
            setSubStep("place");
          }}
          signerName="Your signature"
        />
      </div>
    );
  }

  // ── Step 2: Place signature ──
  return (
    <div className="space-y-5" ref={containerRef}>
      {/* Signature preview + redraw */}
      <div className="flex items-center justify-between border rounded-lg px-4 py-2.5 bg-gray-50">
        <div className="flex items-center space-x-3">
          <img
            src={signatureData!}
            alt="signature"
            className="h-8 w-auto border rounded bg-white px-1"
          />
          <span className="text-sm text-gray-600">Signature ready — place it on the document</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSignatureData(null);
            setAllPagesPlacement(null);
            setSpecificPlacements(new Map());
            setSubStep("draw");
          }}
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Redraw
        </Button>
      </div>

      {/* Mode selector */}
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            {
              key: "all-pages" as const,
              Icon: Layers,
              label: "All Pages",
              desc: "Same position on every page",
            },
            {
              key: "specific-pages" as const,
              Icon: FileText,
              label: "Specific Pages",
              desc: "Choose which pages to sign",
            },
          ] as const
        ).map(({ key, Icon, label, desc }) => (
          <button
            key={key}
            onClick={() => handleModeChange(key)}
            className={`flex items-center space-x-3 px-4 py-3 rounded-xl border-2 text-left transition-colors ${
              mode === key
                ? "border-neutral-900 bg-neutral-50"
                : "border-gray-200 hover:border-gray-300 bg-white"
            }`}
          >
            <Icon
              className={`h-5 w-5 flex-shrink-0 ${
                mode === key ? "text-neutral-900" : "text-gray-400"
              }`}
            />
            <div>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Instruction */}
      <div className="flex items-start space-x-2 px-3 py-2.5 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-800">
        <MousePointerClick className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        <span>
          {mode === "all-pages"
            ? "Click the document to set the signature position. It will be placed at the same location on every page. Drag to reposition · drag the right edge to resize."
            : "Navigate pages using the controls below and click each page where you want a signature. Drag to reposition · drag the right edge to resize."}
        </span>
      </div>

      {/* Specific-pages chip list */}
      {mode === "specific-pages" && specificPlacements.size > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500">Signed pages:</span>
          {Array.from(specificPlacements.keys())
            .sort((a, b) => a - b)
            .map((page) => (
              <span
                key={page}
                className="inline-flex items-center gap-1 bg-neutral-900 text-white text-xs px-2.5 py-1 rounded-full"
              >
                Page {page}
                <button
                  onClick={() =>
                    setSpecificPlacements((prev) => {
                      const next = new Map(prev);
                      next.delete(page);
                      return next;
                    })
                  }
                  className="ml-0.5 hover:text-red-300"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
        </div>
      )}

      {/* PDF controls bar */}
      <div className="flex items-center justify-between bg-gray-100 rounded-lg px-4 py-2">
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-700 px-2 min-w-[90px] text-center">
            Page {currentPage} of {numPages || "–"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
            disabled={!numPages || currentPage >= numPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-600 w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setScale((s) => Math.min(2.5, s + 0.25))}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* PDF canvas */}
      <div className="flex justify-center overflow-auto rounded-xl bg-gray-200 p-4 min-h-[400px]">
        <div
          ref={pageRef}
          className="relative border shadow-xl bg-white select-none"
          style={{ cursor: "crosshair" }}
          onClick={handlePageClick}
        >
          <Document
            file={pdfUrl}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            loading={
              <div
                className="flex flex-col items-center justify-center bg-white"
                style={{ width: pageWidth, minHeight: 560 }}
              >
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900" />
                <p className="mt-3 text-sm text-gray-500">Loading PDF…</p>
              </div>
            }
            error={
              <div
                className="flex items-center justify-center bg-white"
                style={{ width: pageWidth, minHeight: 400 }}
              >
                <p className="text-sm text-red-500">Failed to load PDF. Try refreshing.</p>
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

          {/* Signature placement overlay */}
          {signatureData && currentPlacement && (
            <div
              className="absolute group"
              style={{
                left: `${currentPlacement.x}%`,
                top: `${currentPlacement.y}%`,
                transform: "translate(-50%, -50%)",
                width: `${currentPlacement.width}%`,
                cursor: "grab",
                touchAction: "none",
                zIndex: 10,
                userSelect: "none",
              }}
              onPointerDown={handleDragStart}
              onPointerMove={handleDragMove}
              onPointerUp={handleDragEnd}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative rounded outline outline-1 outline-transparent group-hover:outline-blue-400 group-hover:outline-dashed">
                {mode === "all-pages" && (
                  <span className="absolute -top-5 left-0 text-[9px] text-blue-600 font-medium whitespace-nowrap bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                    All pages
                  </span>
                )}
                <img
                  src={signatureData}
                  alt="signature"
                  draggable={false}
                  style={{ width: "100%", height: "auto", display: "block" }}
                />
                {/* Delete */}
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    removePlacement();
                  }}
                  className="absolute -top-2.5 -right-2.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20"
                >
                  <X className="h-3 w-3" />
                </button>
                {/* Resize handle */}
                <div
                  className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-7 bg-blue-500 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity z-20 flex items-center justify-center"
                  style={{ cursor: "ew-resize", touchAction: "none" }}
                  onPointerDown={handleResizeStart}
                  onPointerMove={handleResizeMove}
                  onPointerUp={handleResizeEnd}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-white text-[9px] leading-none select-none">⟺</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between pt-1">
        <p className="text-sm text-gray-600">
          {mode === "all-pages"
            ? allPagesPlacement
              ? "✓ Position set — will apply to every page"
              : "Click the document to place your signature"
            : specificPlacements.size > 0
            ? `✓ ${specificPlacements.size} page${specificPlacements.size > 1 ? "s" : ""} configured`
            : "Click on pages to place your signature"}
        </p>
        <Button onClick={handleConfirm} disabled={!canConfirm} size="lg">
          Apply to All Documents →
        </Button>
      </div>
    </div>
  );
}
