"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft,
  ChevronRight,
  Check,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  PenLine,
  Type,
  CalendarDays,
  X,
} from "lucide-react";
import { SignatureCanvasComponent } from "./signature-canvas";
import { SignaturePosition } from "@/types/database";
import { Annotation } from "@/lib/pdf/signer";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type ActiveTool = "signature" | "text" | "date";

interface PlacedItem {
  id: string;
  type: "signature" | "text" | "date";
  signatureData?: string;
  content?: string;
  x: number;        // % from left, center anchor
  y: number;        // % from top, center anchor
  page: number;
  width?: number;   // % of page width (signature only)
  fontSize?: number; // display px (text / date)
}

interface PdfSignatureViewerProps {
  pdfUrl: string;
  signerName: string;
  onSubmit: (
    signatureData: string,
    position: SignaturePosition,
    annotations: Annotation[]
  ) => void;
  submitting: boolean;
}

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

function getTodayDDMMYYYY(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function PdfSignatureViewer({
  pdfUrl,
  signerName,
  onSubmit,
  submitting,
}: PdfSignatureViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [scale, setScale] = useState(1);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  const [activeTool, setActiveTool] = useState<ActiveTool>("signature");
  const [drawnSignature, setDrawnSignature] = useState<string | null>(null);
  const [pendingText, setPendingText] = useState("");
  const [placedItems, setPlacedItems] = useState<PlacedItem[]>([]);

  // Drag state (ref avoids stale closure in pointer handlers)
  const dragRef = useRef<{
    id: string;
    startPX: number;
    startPY: number;
    origX: number;
    origY: number;
  } | null>(null);

  // Resize state
  const resizeRef = useRef<{
    id: string;
    startPX: number;
    origVal: number;
    isWidth: boolean; // true = signature width, false = font size
  } | null>(null);

  const today = getTodayDDMMYYYY();
  const placedSignature = placedItems.find((i) => i.type === "signature");
  const canSubmit = !!placedSignature && !submitting;
  const canPlace =
    (activeTool === "signature" && !!drawnSignature) ||
    (activeTool === "text" && pendingText.trim().length > 0) ||
    activeTool === "date";

  useEffect(() => {
    const update = () => {
      if (containerRef.current)
        setContainerWidth(containerRef.current.clientWidth);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Keep page input in sync when page changes via buttons
  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const goToPage = useCallback(
    (page: number) => {
      setCurrentPage(clamp(page, 1, numPages || 1));
    },
    [numPages]
  );

  const commitPageInput = useCallback(
    (raw: string) => {
      const p = parseInt(raw, 10);
      if (!isNaN(p)) goToPage(p);
      else setPageInput(String(currentPage));
    },
    [goToPage, currentPage]
  );

  // Click-to-place new items on the PDF
  const handlePageClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!canPlace || !pageRef.current) return;
      const rect = pageRef.current.getBoundingClientRect();
      const x = clamp(((e.clientX - rect.left) / rect.width) * 100, 2, 98);
      const y = clamp(((e.clientY - rect.top) / rect.height) * 100, 2, 98);

      if (activeTool === "signature" && drawnSignature) {
        setPlacedItems((prev) => [
          ...prev.filter((i) => i.type !== "signature"),
          {
            id: "sig",
            type: "signature",
            signatureData: drawnSignature,
            x,
            y,
            page: currentPage,
            width: 20,
          },
        ]);
      } else if (activeTool === "text" && pendingText.trim()) {
        setPlacedItems((prev) => [
          ...prev,
          {
            id: `text-${Date.now()}`,
            type: "text",
            content: pendingText.trim(),
            x,
            y,
            page: currentPage,
            fontSize: 13,
          },
        ]);
      } else if (activeTool === "date") {
        setPlacedItems((prev) => [
          ...prev,
          {
            id: `date-${Date.now()}`,
            type: "date",
            content: today,
            x,
            y,
            page: currentPage,
            fontSize: 13,
          },
        ]);
      }
    },
    [activeTool, canPlace, drawnSignature, pendingText, currentPage, today]
  );

  // ── Drag handlers (pointer capture keeps tracking outside element bounds) ──
  const startDrag = useCallback((e: React.PointerEvent, item: PlacedItem) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = {
      id: item.id,
      startPX: e.clientX,
      startPY: e.clientY,
      origX: item.x,
      origY: item.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    document.body.style.cursor = "grabbing";
  }, []);

  const onDragMove = useCallback((e: React.PointerEvent, item: PlacedItem) => {
    if (!dragRef.current || dragRef.current.id !== item.id || !pageRef.current)
      return;
    const rect = pageRef.current.getBoundingClientRect();
    const dx = ((e.clientX - dragRef.current.startPX) / rect.width) * 100;
    const dy = ((e.clientY - dragRef.current.startPY) / rect.height) * 100;
    setPlacedItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? {
              ...i,
              x: clamp(dragRef.current!.origX + dx, 2, 98),
              y: clamp(dragRef.current!.origY + dy, 2, 98),
            }
          : i
      )
    );
  }, []);

  const endDrag = useCallback(() => {
    dragRef.current = null;
    document.body.style.cursor = "";
  }, []);

  // ── Resize handlers ──
  const startResize = useCallback(
    (e: React.PointerEvent, item: PlacedItem) => {
      e.stopPropagation();
      e.preventDefault();
      const isWidth = item.type === "signature";
      resizeRef.current = {
        id: item.id,
        startPX: e.clientX,
        origVal: isWidth ? (item.width ?? 20) : (item.fontSize ?? 13),
        isWidth,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      document.body.style.cursor = isWidth ? "ew-resize" : "se-resize";
    },
    []
  );

  const onResizeMove = useCallback(
    (e: React.PointerEvent, item: PlacedItem) => {
      if (
        !resizeRef.current ||
        resizeRef.current.id !== item.id ||
        !pageRef.current
      )
        return;
      const { startPX, origVal, isWidth } = resizeRef.current;
      if (isWidth) {
        const rect = pageRef.current.getBoundingClientRect();
        const dx = ((e.clientX - startPX) / rect.width) * 100;
        setPlacedItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, width: clamp(origVal + dx, 5, 70) }
              : i
          )
        );
      } else {
        // font size: ~0.3pt per pixel of horizontal drag
        const dx = e.clientX - startPX;
        setPlacedItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, fontSize: clamp(origVal + dx * 0.3, 8, 48) }
              : i
          )
        );
      }
    },
    []
  );

  const endResize = useCallback(() => {
    resizeRef.current = null;
    document.body.style.cursor = "";
  }, []);

  const removeItem = (id: string) =>
    setPlacedItems((prev) => prev.filter((i) => i.id !== id));

  const handleConfirm = () => {
    if (!placedSignature?.signatureData) return;
    const position: SignaturePosition = {
      x: placedSignature.x,
      y: placedSignature.y,
      page: placedSignature.page,
      width: placedSignature.width,
    };
    const annotations: Annotation[] = placedItems
      .filter((i) => i.type !== "signature")
      .map((i) => ({
        type: i.type as "text" | "date",
        content: i.content!,
        x: i.x,
        y: i.y,
        page: i.page,
        fontSize: i.fontSize,
      }));
    onSubmit(placedSignature.signatureData, position, annotations);
  };

  const pageWidth = Math.min(containerWidth - 32, 800) * scale;

  return (
    <div className="space-y-4" ref={containerRef}>
      {/* Tool Selector */}
      <div className="flex items-center space-x-1 bg-white border border-gray-200 rounded-xl p-1.5">
        {(
          [
            { key: "signature", label: "Signature", Icon: PenLine },
            { key: "text", label: "Add Text", Icon: Type },
            { key: "date", label: "Add Date", Icon: CalendarDays },
          ] as const
        ).map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTool(key)}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-1 justify-center ${
              activeTool === key
                ? "bg-neutral-900 text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Tool Panel */}
      {activeTool === "signature" && !drawnSignature && (
        <SignatureCanvasComponent
          onSave={(data) => setDrawnSignature(data)}
          signerName={signerName}
        />
      )}
      {activeTool === "signature" && drawnSignature && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <img
                  src={drawnSignature}
                  alt="signature"
                  className="h-10 w-auto border rounded bg-white"
                />
                <p className="text-sm text-gray-600">
                  {placedSignature
                    ? `Page ${placedSignature.page} — drag to move · drag right edge to resize`
                    : "Click on the PDF to place your signature"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDrawnSignature(null);
                  setPlacedItems((p) => p.filter((i) => i.type !== "signature"));
                }}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Redraw
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      {activeTool === "text" && (
        <Card>
          <CardContent className="py-3 space-y-2">
            <p className="text-sm font-medium text-gray-700">
              Type your text, then click the document to place it
            </p>
            <Input
              value={pendingText}
              onChange={(e) => setPendingText(e.target.value)}
              placeholder="Enter your text..."
            />
            {pendingText.trim() && (
              <p className="text-xs text-gray-500">
                Drag to move · drag bottom-right corner to resize
              </p>
            )}
          </CardContent>
        </Card>
      )}
      {activeTool === "date" && (
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center space-x-3">
              <CalendarDays className="h-5 w-5 text-neutral-600" />
              <div>
                <p className="text-sm font-medium text-gray-700">
                  Today&apos;s date:{" "}
                  <span className="font-mono tracking-wide">{today}</span>
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Click to place · drag to move · drag bottom-right corner to resize
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* PDF Controls */}
      <div className="flex items-center justify-between bg-gray-100 rounded-lg px-4 py-2">
        {/* Page navigation */}
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center space-x-1.5 text-sm text-gray-700">
            <span>Page</span>
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
              className="w-10 text-center border border-gray-300 rounded px-1 py-0.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-neutral-400"
            />
            <span>of {numPages}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= numPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {/* Zoom */}
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-700 w-12 text-center">
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

      {/* PDF canvas with overlays */}
      <div className="flex justify-center overflow-auto">
        <div
          className="relative border shadow-lg bg-white select-none"
          ref={pageRef}
          onClick={handlePageClick}
          style={{ cursor: canPlace ? "crosshair" : "default" }}
        >
          <Document
            file={pdfUrl}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            loading={
              <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
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

          {/* Placed items overlay */}
          {placedItems
            .filter((item) => item.page === currentPage)
            .map((item) => (
              <div
                key={item.id}
                className="absolute group"
                style={{
                  left: `${item.x}%`,
                  top: `${item.y}%`,
                  transform: "translate(-50%, -50%)",
                  ...(item.type === "signature"
                    ? { width: `${item.width ?? 20}%` }
                    : {}),
                  cursor: "grab",
                  touchAction: "none",
                  zIndex: 10,
                }}
                onPointerDown={(e) => startDrag(e, item)}
                onPointerMove={(e) => onDragMove(e, item)}
                onPointerUp={endDrag}
                onClick={(e) => e.stopPropagation()}
              >
                {/* ── Signature ── */}
                {item.type === "signature" && item.signatureData && (
                  <div className="relative rounded outline outline-1 outline-transparent group-hover:outline-blue-400 group-hover:outline-dashed">
                    <img
                      src={item.signatureData}
                      alt="signature"
                      draggable={false}
                      style={{
                        width: "100%",
                        height: "auto",
                        background: "transparent",
                        display: "block",
                      }}
                    />
                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeItem(item.id);
                      }}
                      className="absolute -top-2.5 -right-2.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    {/* Width resize handle — right edge */}
                    <div
                      className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-7 bg-blue-500 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity z-20 flex items-center justify-center"
                      style={{ cursor: "ew-resize", touchAction: "none" }}
                      title="Drag to resize"
                      onPointerDown={(e) => startResize(e, item)}
                      onPointerMove={(e) => onResizeMove(e, item)}
                      onPointerUp={endResize}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="text-white text-[9px] leading-none select-none">
                        ⟺
                      </span>
                    </div>
                  </div>
                )}

                {/* ── Text / Date ── */}
                {(item.type === "text" || item.type === "date") && (
                  <div
                    className="relative bg-white/90 border border-dashed border-blue-400 rounded px-2 py-0.5 whitespace-nowrap"
                    style={{
                      fontSize: `${item.fontSize ?? 13}px`,
                      color: "#1f2937",
                      lineHeight: 1.4,
                    }}
                  >
                    {item.content}
                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeItem(item.id);
                      }}
                      className="absolute -top-2.5 -right-2.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    {/* Font size resize handle — bottom-right corner */}
                    <div
                      className="absolute -right-1.5 -bottom-1.5 w-3 h-3 bg-blue-500 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity z-20"
                      style={{ cursor: "se-resize", touchAction: "none" }}
                      title="Drag to resize text"
                      onPointerDown={(e) => startResize(e, item)}
                      onPointerMove={(e) => onResizeMove(e, item)}
                      onPointerUp={endResize}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>

      {/* Submit bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              {placedSignature ? (
                <p className="text-sm text-gray-700">
                  ✓ Signature on page {placedSignature.page}
                  {placedItems.filter((i) => i.type !== "signature").length >
                    0 &&
                    ` · ${placedItems.filter((i) => i.type !== "signature").length} annotation(s)`}
                </p>
              ) : (
                <p className="text-sm text-gray-500">
                  Place your signature on the document to continue
                </p>
              )}
            </div>
            <Button onClick={handleConfirm} disabled={!canSubmit}>
              <Check className="h-4 w-4 mr-2" />
              {submitting ? "Submitting..." : "Confirm & Submit"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
