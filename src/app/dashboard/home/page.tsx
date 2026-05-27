"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { UploadDialog } from "@/components/documents/upload-dialog";
import { DocumentList } from "@/components/documents/document-list";
import {
  Upload,
  Plus,
  PenLine,
  CheckSquare,
  X,
  Layers,
  FileUp,
} from "lucide-react";
import { DocumentsToSign } from "@/components/documents/documents-to-sign";
import { Document } from "@/types/database";
import { toast } from "sonner";
import { saveBatch } from "@/lib/utils/upload-batches";

// Returns the newly created document's ID so we can track it in a batch
async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("signing_mode", "positioned");
  const res = await fetch("/api/documents/upload", { method: "POST", body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Upload failed");
  return data.document.id as string;
}

export default function DashboardPage() {
  const router = useRouter();

  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadedDocuments, setLoadedDocuments] = useState<Document[]>([]);

  // Page-level drag-and-drop state
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const dragCountRef = useRef(0);

  // ── Selection helpers ────────────────────────────────────────────────────
  const toggleSelectionMode = () => {
    if (selectionMode) {
      setSelectionMode(false);
      setSelectedIds(new Set());
    } else {
      setSelectionMode(true);
    }
  };

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleBulkSignFromSelection = () => {
    const draftIds = loadedDocuments
      .filter((d) => selectedIds.has(d.id) && d.status === "draft")
      .map((d) => d.id);

    if (!draftIds.length) {
      toast.error("No draft documents selected. Only draft documents can be bulk-signed.");
      return;
    }
    router.push(`/dashboard/bulk-sign?ids=${draftIds.join(",")}`);
  };

  // ── Page-level drag-and-drop upload ─────────────────────────────────────
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCountRef.current += 1;
    if (dragCountRef.current === 1) setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCountRef.current -= 1;
    if (dragCountRef.current === 0) setIsDraggingOver(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    dragCountRef.current = 0;
    setIsDraggingOver(false);

    // No files means a DOM element was dragged (e.g. signer rows) — ignore silently
    if (!e.dataTransfer.files.length) return;

    const files = Array.from(e.dataTransfer.files).filter(
      (f) => f.type === "application/pdf"
    );

    if (!files.length) {
      toast.error("Only PDF files can be uploaded");
      return;
    }

    if (files.length === 1) {
      setUploadDialogOpen(true);
      return;
    }

    setIsUploading(true);
    const batchIds: string[] = [];
    const errors: string[] = [];

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        errors.push(`${file.name}: file too large (max 10 MB)`);
        continue;
      }
      try {
        const id = await uploadFile(file);
        batchIds.push(id);
      } catch (err: any) {
        errors.push(`${file.name}: ${err.message}`);
      }
    }

    setIsUploading(false);

    if (batchIds.length > 0) {
      // Persist batch so the bulk-sign page can group these documents
      saveBatch(batchIds);
      toast.success(
        `${batchIds.length} of ${files.length} document${files.length > 1 ? "s" : ""} uploaded`
      );
      setRefreshTrigger((t) => t + 1);
    }
    errors.forEach((msg) => toast.error(msg));
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="max-w-6xl mx-auto relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* ── Full-page drag overlay ── */}
      {isDraggingOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 pointer-events-none">
          <div className="bg-white rounded-2xl px-16 py-12 text-center border-4 border-dashed border-neutral-400 shadow-2xl">
            <FileUp className="h-14 w-14 mx-auto text-neutral-400 mb-4" />
            <p className="text-xl font-bold text-neutral-900">Drop PDFs to upload</p>
            <p className="text-sm text-neutral-500 mt-1">Multiple files supported</p>
          </div>
        </div>
      )}

      {/* ── Uploading indicator ── */}
      {isUploading && (
        <div className="fixed bottom-4 right-4 z-50 bg-white border rounded-xl shadow-lg px-4 py-3 flex items-center space-x-3">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-neutral-900" />
          <span className="text-sm text-gray-700">Uploading documents…</span>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Manage and track your documents</p>
        </div>

        <div className="flex items-center space-x-2">
          {selectionMode ? (
            <>
              <Button variant="outline" size="sm" onClick={toggleSelectionMode}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleBulkSignFromSelection}
                disabled={selectedIds.size === 0}
              >
                <Layers className="h-4 w-4 mr-2" />
                Bulk Sign ({selectedIds.size})
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={toggleSelectionMode}>
                <CheckSquare className="h-4 w-4 mr-2" />
                Select
              </Button>
              {/* Direct entry to the batch-grouped bulk sign page */}
              <Button
                variant="outline"
                onClick={() => router.push("/dashboard/bulk-sign")}
              >
                <Layers className="h-4 w-4 mr-2" />
                Bulk Sign
              </Button>
              <Button onClick={() => setUploadDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Document
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Awaiting signature ── */}
      {!selectionMode && (
        <div className="mb-10">
          <div className="flex items-center space-x-2 mb-4">
            <PenLine className="h-5 w-5 text-neutral-700" />
            <h2 className="text-base font-semibold">Awaiting Your Signature</h2>
          </div>
          <DocumentsToSign />
        </div>
      )}

      {/* ── Your documents ── */}
      <div>
        <div className="flex items-center space-x-2 mb-4">
          <Upload className="h-5 w-5 text-gray-500" />
          <h2 className="text-base font-semibold">
            {selectionMode ? "Select Documents to Bulk Sign" : "Your Documents"}
          </h2>
          {selectionMode && selectedIds.size > 0 && (
            <span className="text-xs text-gray-500">({selectedIds.size} selected)</span>
          )}
        </div>

        {selectionMode && (
          <p className="text-xs text-gray-400 mb-4">
            Click a document card to select it. Only draft documents will be included
            in bulk signing.
          </p>
        )}

        <DocumentList
          refreshTrigger={refreshTrigger}
          selectable={selectionMode}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onDocumentsLoaded={setLoadedDocuments}
        />
      </div>

      {/* ── Drop hint ── */}
      {!selectionMode && !isDraggingOver && (
        <p className="text-center text-xs text-gray-400 mt-10">
          Drag and drop PDF files anywhere on this page to upload multiple documents at once
        </p>
      )}

      <UploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onUploadSuccess={() => setRefreshTrigger((t) => t + 1)}
      />
    </div>
  );
}
