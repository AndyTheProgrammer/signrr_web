"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  RotateCcw,
  Check,
  PenLine,
  ImageUp,
  X,
  Eraser,
  Loader2,
  Bookmark,
  BookmarkCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  type SavedSignature,
  loadSavedSignatures,
  persistSignature,
  removeSavedSignature,
} from "@/lib/utils/saved-signatures";

// ── Types ─────────────────────────────────────────────────────────────────
interface SignatureCanvasComponentProps {
  onSave: (signatureData: string) => void;
  signerName: string;
}

type Tab = "draw" | "upload";
type DragHandle = "nw" | "ne" | "se" | "sw" | "move";

interface CropBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ── Canvas processing helpers ──────────────────────────────────────────────

function removeBackground(canvas: HTMLCanvasElement): void {
  const HIGH = 175;
  const LOW = 30;

  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imageData.data;

  for (let i = 0; i < d.length; i += 4) {
    const brightness = Math.max(d[i], d[i + 1], d[i + 2]);
    if (brightness >= HIGH) {
      d[i + 3] = 0;
    } else if (brightness > LOW) {
      const ratio = (brightness - LOW) / (HIGH - LOW);
      d[i + 3] = Math.round(Math.pow(1 - ratio, 2) * d[i + 3]);
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

function cropToCanvas(
  src: HTMLImageElement,
  crop: CropBox,
  displayW: number,
  displayH: number
): HTMLCanvasElement {
  const sx = src.naturalWidth / displayW;
  const sy = src.naturalHeight / displayH;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(crop.w * sx));
  canvas.height = Math.max(1, Math.round(crop.h * sy));
  canvas
    .getContext("2d")!
    .drawImage(src, crop.x * sx, crop.y * sy, crop.w * sx, crop.h * sy, 0, 0, canvas.width, canvas.height);
  return canvas;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const MIN_CROP_PX = 20;

// ── Component ──────────────────────────────────────────────────────────────
export function SignatureCanvasComponent({
  onSave,
  signerName,
}: SignatureCanvasComponentProps) {
  const [tab, setTab] = useState<Tab>("draw");

  // ── Saved signatures ─────────────────────────────────────────────────────
  const [savedSigs, setSavedSigs] = useState<SavedSignature[]>([]);

  // Save-for-later dialog state
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [pendingDataUrl, setPendingDataUrl] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("");

  useEffect(() => {
    setSavedSigs(loadSavedSignatures());
  }, []);

  const openSaveDialog = (dataUrl: string) => {
    setPendingDataUrl(dataUrl);
    setSaveName(`Signature ${loadSavedSignatures().length + 1}`);
    setSaveDialogOpen(true);
  };

  const confirmSave = () => {
    if (!pendingDataUrl) return;
    try {
      const entry = persistSignature(pendingDataUrl, saveName);
      setSavedSigs((prev) => [entry, ...prev].slice(0, 10));
      toast.success("Signature saved for future use");
    } catch {
      toast.error("Could not save — storage may be full");
    }
    setSaveDialogOpen(false);
    setPendingDataUrl(null);
  };

  const handleDeleteSaved = (id: string) => {
    setSavedSigs(removeSavedSignature(id));
  };

  // ── Draw tab state ────────────────────────────────────────────────────────
  const sigCanvasRef = useRef<SignatureCanvas>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  const handleClear = () => {
    sigCanvasRef.current?.clear();
    setIsEmpty(true);
  };

  const getDrawnDataUrl = (): string | null => {
    if (sigCanvasRef.current?.isEmpty()) return null;
    return sigCanvasRef.current!.toDataURL("image/png");
  };

  const handleDrawConfirm = () => {
    const dataUrl = getDrawnDataUrl();
    if (dataUrl) onSave(dataUrl);
  };

  const handleDrawSaveForLater = () => {
    const dataUrl = getDrawnDataUrl();
    if (dataUrl) openSaveDialog(dataUrl);
  };

  // ── Upload tab state ──────────────────────────────────────────────────────
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [bgRemovedUrl, setBgRemovedUrl] = useState<string | null>(null);
  const [isProcessingBg, setIsProcessingBg] = useState(false);
  const [crop, setCrop] = useState<CropBox | null>(null);
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });
  const [dropActive, setDropActive] = useState(false);

  const imgRef = useRef<HTMLImageElement>(null);

  const dragRef = useRef<{
    handle: DragHandle;
    startX: number;
    startY: number;
    origCrop: CropBox;
    displayW: number;
    displayH: number;
  } | null>(null);

  // Run background removal whenever a new image is uploaded
  useEffect(() => {
    if (!originalUrl) return;
    setIsProcessingBg(true);
    setBgRemovedUrl(null);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      removeBackground(canvas);
      setBgRemovedUrl(canvas.toDataURL("image/png"));
      setIsProcessingBg(false);
    };
    img.onerror = () => setIsProcessingBg(false);
    img.src = originalUrl;
  }, [originalUrl]);

  // The URL shown in the preview — bg-removed version once ready
  const previewUrl = bgRemovedUrl ?? originalUrl;

  const handleImageLoad = useCallback(() => {
    const el = imgRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    if (!width || !height) return;
    setDisplaySize({ w: width, h: height });
    setCrop((prev) => prev ?? { x: 0, y: 0, w: width, h: height });
  }, []);

  const acceptFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setOriginalUrl(e.target?.result as string);
      setCrop(null);
    };
    reader.readAsDataURL(file);
  };

  const resetUpload = () => {
    setOriginalUrl(null);
    setBgRemovedUrl(null);
    setCrop(null);
  };

  // ── Crop pointer handlers ─────────────────────────────────────────────────
  const startCropDrag = useCallback(
    (handle: DragHandle) => (e: React.PointerEvent) => {
      if (!crop) return;
      e.preventDefault();
      e.stopPropagation();
      const { width, height } = imgRef.current?.getBoundingClientRect() ?? {
        width: displaySize.w,
        height: displaySize.h,
      };
      dragRef.current = {
        handle,
        startX: e.clientX,
        startY: e.clientY,
        origCrop: { ...crop },
        displayW: width,
        displayH: height,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [crop, displaySize]
  );

  const handleCropMove = useCallback((e: React.PointerEvent) => {
    const dr = dragRef.current;
    if (!dr) return;
    const dx = e.clientX - dr.startX;
    const dy = e.clientY - dr.startY;
    const { x, y, w, h } = dr.origCrop;
    const { displayW: dw, displayH: dh } = dr;
    let next: CropBox;

    switch (dr.handle) {
      case "move":
        next = { x: clamp(x + dx, 0, dw - w), y: clamp(y + dy, 0, dh - h), w, h };
        break;
      case "nw":
        next = {
          x: clamp(x + dx, 0, x + w - MIN_CROP_PX),
          y: clamp(y + dy, 0, y + h - MIN_CROP_PX),
          w: clamp(w - dx, MIN_CROP_PX, x + w),
          h: clamp(h - dy, MIN_CROP_PX, y + h),
        };
        break;
      case "ne":
        next = {
          x,
          y: clamp(y + dy, 0, y + h - MIN_CROP_PX),
          w: clamp(w + dx, MIN_CROP_PX, dw - x),
          h: clamp(h - dy, MIN_CROP_PX, y + h),
        };
        break;
      case "se":
        next = { x, y, w: clamp(w + dx, MIN_CROP_PX, dw - x), h: clamp(h + dy, MIN_CROP_PX, dh - y) };
        break;
      case "sw":
        next = {
          x: clamp(x + dx, 0, x + w - MIN_CROP_PX),
          y,
          w: clamp(w - dx, MIN_CROP_PX, x + w),
          h: clamp(h + dy, MIN_CROP_PX, dh - y),
        };
        break;
      default:
        return;
    }

    setCrop(next);
  }, []);

  const endCropDrag = useCallback(() => {
    dragRef.current = null;
  }, []);

  // Build the processed signature canvas from the current imgRef + crop
  const buildUploadCanvas = (): HTMLCanvasElement | null => {
    const el = imgRef.current;
    if (!el || !crop) return null;
    const { width, height } = el.getBoundingClientRect();
    const canvas = cropToCanvas(el, crop, width || displaySize.w, height || displaySize.h);
    if (!bgRemovedUrl) removeBackground(canvas);
    return canvas;
  };

  const handleUploadConfirm = () => {
    const canvas = buildUploadCanvas();
    if (canvas) onSave(canvas.toDataURL("image/png"));
  };

  const handleUploadSaveForLater = () => {
    const canvas = buildUploadCanvas();
    if (canvas) openSaveDialog(canvas.toDataURL("image/png"));
  };

  // ── Corner handle positions ───────────────────────────────────────────────
  const handles: { handle: DragHandle; style: React.CSSProperties }[] = [
    { handle: "nw", style: { top: -6, left: -6, cursor: "nw-resize" } },
    { handle: "ne", style: { top: -6, right: -6, cursor: "ne-resize" } },
    { handle: "se", style: { bottom: -6, right: -6, cursor: "se-resize" } },
    { handle: "sw", style: { bottom: -6, left: -6, cursor: "sw-resize" } },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Card>
      <CardHeader className="space-y-3">
        {/* ── Saved signatures row ─────────────────────────────────────── */}
        {savedSigs.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2 flex items-center space-x-1">
              <BookmarkCheck className="h-3.5 w-3.5" />
              <span>Saved signatures — click to use</span>
            </p>
            <div className="flex space-x-2 overflow-x-auto pb-1">
              {savedSigs.map((sig) => (
                <div key={sig.id} className="relative flex-shrink-0 group/saved">
                  <button
                    onClick={() => onSave(sig.dataUrl)}
                    title={sig.name}
                    className="w-24 h-14 border-2 border-gray-200 rounded-lg hover:border-neutral-900 transition-colors overflow-hidden flex items-center justify-center"
                    style={{
                      background:
                        "repeating-conic-gradient(#e5e7eb 0% 25%, #f9fafb 0% 50%) 0 0 / 10px 10px",
                    }}
                  >
                    <img
                      src={sig.dataUrl}
                      alt={sig.name}
                      className="max-w-full max-h-full object-contain p-1"
                    />
                  </button>
                  {/* Delete saved signature */}
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => handleDeleteSaved(sig.id)}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/saved:opacity-100 transition-opacity z-10"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                  <p className="text-xs text-gray-500 truncate w-24 mt-0.5 text-center leading-tight">
                    {sig.name}
                  </p>
                </div>
              ))}
            </div>
            <div className="h-px bg-gray-100 mt-3" />
          </div>
        )}

        <CardTitle>
          {/* Tab switcher */}
          <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1 w-fit">
            {(
              [
                { key: "draw" as Tab, Icon: PenLine, label: "Draw" },
                { key: "upload" as Tab, Icon: ImageUp, label: "Upload" },
              ] as const
            ).map(({ key, Icon, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex items-center space-x-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  tab === key
                    ? "bg-white shadow-sm text-neutral-900"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </CardTitle>
        <p className="text-sm text-gray-600">
          {tab === "draw"
            ? "Sign below using your mouse or touch screen"
            : "Upload a photo or scan of your handwritten signature"}
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ── Draw tab ─────────────────────────────────────────────────── */}
        {tab === "draw" && (
          <>
            <div className="border-2 border-dashed border-gray-300 rounded-lg bg-white">
              <SignatureCanvas
                ref={sigCanvasRef}
                canvasProps={{
                  className: "w-full h-48 rounded-lg",
                  style: { touchAction: "none", background: "white" },
                }}
                penColor="black"
                onBegin={() => setIsEmpty(false)}
              />
            </div>

            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Signing as:{" "}
                <span className="font-medium text-gray-900">{signerName}</span>
              </p>
              <div className="flex items-center space-x-2">
                <Button variant="outline" onClick={handleClear} disabled={isEmpty}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Clear
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDrawSaveForLater}
                  disabled={isEmpty}
                  title="Save this signature for future use"
                >
                  <Bookmark className="h-4 w-4 mr-2" />
                  Save
                </Button>
                <Button onClick={handleDrawConfirm} disabled={isEmpty}>
                  <Check className="h-4 w-4 mr-2" />
                  Confirm Signature
                </Button>
              </div>
            </div>

            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3">
              <p className="text-sm text-neutral-700">
                <strong>Note:</strong> By signing this document you agree that your
                electronic signature is legally binding.
              </p>
            </div>
          </>
        )}

        {/* ── Upload tab ───────────────────────────────────────────────── */}
        {tab === "upload" && (
          <>
            {!originalUrl ? (
              /* Drop zone */
              <div
                className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
                  dropActive
                    ? "border-neutral-900 bg-neutral-50"
                    : "border-gray-300 hover:border-gray-400"
                }`}
                onDragEnter={(e) => { e.preventDefault(); setDropActive(true); }}
                onDragLeave={(e) => { e.preventDefault(); setDropActive(false); }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  setDropActive(false);
                  const file = e.dataTransfer.files[0];
                  if (file) acceptFile(file);
                }}
              >
                <ImageUp className="mx-auto h-10 w-10 text-gray-300 mb-3" />
                <p className="text-sm font-medium text-gray-700">
                  Drop your signature image here
                </p>
                <p className="text-xs text-gray-400 mt-1 mb-3">or</p>
                <label className="cursor-pointer">
                  <span className="text-sm font-semibold text-neutral-900 underline hover:text-neutral-700">
                    Browse files
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => {
                      if (e.target.files?.[0]) acceptFile(e.target.files[0]);
                    }}
                  />
                </label>
                <p className="text-xs text-gray-400 mt-2">PNG, JPG, JPEG, WebP</p>
              </div>
            ) : (
              /* Image editor */
              <div className="space-y-4">
                {/* Toolbar */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    {isProcessingBg ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Removing background…</span>
                      </>
                    ) : bgRemovedUrl ? (
                      <>
                        <Eraser className="h-3.5 w-3.5 text-green-600" />
                        <span className="text-green-700 font-medium">Background removed</span>
                      </>
                    ) : (
                      <span className="text-gray-400 text-xs">Background removal unavailable</span>
                    )}
                  </div>
                  <button
                    onClick={resetUpload}
                    className="flex items-center space-x-1.5 text-sm text-gray-500 hover:text-gray-700"
                  >
                    <X className="h-3.5 w-3.5" />
                    <span>Remove</span>
                  </button>
                </div>

                {/* Image + crop overlay */}
                <div className="flex justify-center">
                  <div
                    className="relative inline-block rounded-lg overflow-hidden border border-gray-200"
                    style={{
                      background:
                        "repeating-conic-gradient(#d1d5db 0% 25%, #f9fafb 0% 50%) 0 0 / 14px 14px",
                      maxWidth: "100%",
                    }}
                  >
                    <img
                      ref={imgRef}
                      key={previewUrl ?? ""}
                      src={previewUrl!}
                      alt="signature preview"
                      className="block"
                      style={{ maxHeight: "260px", maxWidth: "100%", height: "auto" }}
                      onLoad={handleImageLoad}
                      draggable={false}
                    />

                    {crop && displaySize.w > 0 && (
                      <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute inset-x-0 top-0 bg-black/40" style={{ height: crop.y }} />
                        <div className="absolute inset-x-0 bg-black/40" style={{ top: crop.y + crop.h, bottom: 0 }} />
                        <div className="absolute bg-black/40" style={{ top: crop.y, height: crop.h, left: 0, width: crop.x }} />
                        <div className="absolute bg-black/40" style={{ top: crop.y, height: crop.h, left: crop.x + crop.w, right: 0 }} />

                        <div
                          className="absolute border-2 border-white pointer-events-auto"
                          style={{ left: crop.x, top: crop.y, width: crop.w, height: crop.h, cursor: "move" }}
                          onPointerDown={startCropDrag("move")}
                          onPointerMove={handleCropMove}
                          onPointerUp={endCropDrag}
                        >
                          {/* Rule-of-thirds lines */}
                          <div className="absolute inset-0 pointer-events-none">
                            {[33.3, 66.6].map((p) => (
                              <div key={`h${p}`} className="absolute inset-x-0 border-b border-white/25" style={{ top: `${p}%` }} />
                            ))}
                            {[33.3, 66.6].map((p) => (
                              <div key={`v${p}`} className="absolute inset-y-0 border-r border-white/25" style={{ left: `${p}%` }} />
                            ))}
                          </div>

                          {handles.map(({ handle, style }) => (
                            <div
                              key={handle}
                              className="absolute w-3 h-3 bg-white rounded-sm border border-gray-400 shadow-sm"
                              style={{ ...style, zIndex: 10 }}
                              onPointerDown={(e) => { e.stopPropagation(); startCropDrag(handle)(e); }}
                              onPointerMove={handleCropMove}
                              onPointerUp={endCropDrag}
                              onClick={(e) => e.stopPropagation()}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <p className="text-xs text-gray-400 text-center">
                  Drag corner handles to crop · drag inside box to reposition
                </p>

                {/* Footer actions */}
                <div className="flex items-center justify-between pt-1">
                  <p className="text-sm text-gray-500">
                    Signing as:{" "}
                    <span className="font-medium text-gray-900">{signerName}</span>
                  </p>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      onClick={handleUploadSaveForLater}
                      disabled={!crop || isProcessingBg}
                      title="Save this signature for future use"
                    >
                      <Bookmark className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                    <Button
                      onClick={handleUploadConfirm}
                      disabled={!crop || isProcessingBg}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Use as Signature
                    </Button>
                  </div>
                </div>

                <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3">
                  <p className="text-sm text-neutral-700">
                    <strong>Note:</strong> By signing this document you agree that your
                    electronic signature is legally binding.
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Save-for-later dialog (shared between tabs) ────────────────── */}
        {saveDialogOpen && (
          <div className="border rounded-xl p-4 bg-gray-50 space-y-3 mt-2">
            <div className="flex items-center space-x-2">
              <BookmarkCheck className="h-4 w-4 text-neutral-700" />
              <p className="text-sm font-medium text-gray-800">Save signature for future use</p>
            </div>
            <Input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmSave();
                if (e.key === "Escape") { setSaveDialogOpen(false); setPendingDataUrl(null); }
              }}
              placeholder={`Signature ${savedSigs.length + 1}`}
              autoFocus
              className="text-sm"
            />
            <div className="flex items-center space-x-2">
              <Button size="sm" onClick={confirmSave}>
                <BookmarkCheck className="h-3.5 w-3.5 mr-1.5" />
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setSaveDialogOpen(false); setPendingDataUrl(null); }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
