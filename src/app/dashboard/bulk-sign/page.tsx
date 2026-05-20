"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Document as DocumentType } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  Download,
  Eye,
  Package,
  FolderOpen,
  Send,
  AtSign,
  ArrowRight,
  Upload,
  X,
  FilePlus2,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  loadBatches,
  saveBatch,
  type UploadBatch,
} from "@/lib/utils/upload-batches";
import type { BulkPlacementResult } from "@/components/signing/bulk-placement-picker";

// ── Dynamic imports (react-pdf needs browser APIs) ────────────────────────
const BulkPlacementPicker = dynamic(
  () =>
    import("@/components/signing/bulk-placement-picker").then((m) => ({
      default: m.BulkPlacementPicker,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    ),
  }
);

const PdfPreviewModal = dynamic(
  () =>
    import("@/components/signing/pdf-preview-modal").then((m) => ({
      default: m.PdfPreviewModal,
    })),
  { ssr: false }
);

// ── Types ──────────────────────────────────────────────────────────────────
type PageStep = "entry" | "loading" | "select" | "configure" | "processing" | "done";

interface SignResult {
  documentId: string;
  title: string;
  success: boolean;
  error?: string;
}

interface DocGroup {
  id: string; // batch id or "individual"
  label: string;
  uploadedAt: string | null;
  documents: DocumentType[];
}

// ── Helpers ────────────────────────────────────────────────────────────────
async function getSignedUrl(documentId: string): Promise<string> {
  const res = await fetch(`/api/documents/${documentId}/pdf-url`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to get download URL");
  return data.url as string;
}

async function downloadFile(url: string, filename: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Download request failed");
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

function safeFilename(title: string) {
  return title.replace(/[^a-z0-9]/gi, "_");
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Derives a recipient email address from a document title and a domain.
 * e.g. title="nahshon.kampamba", domain="zamtel.co.zm"
 *   → "nahshon.kampamba@zamtel.co.zm"
 */
function deriveEmail(title: string, domain: string): string {
  const username = title
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._+-]/g, "");
  const cleanDomain = domain.trim().toLowerCase().replace(/^@+/, "");
  return `${username}@${cleanDomain}`;
}

function groupDocuments(docs: DocumentType[], batches: UploadBatch[]): DocGroup[] {
  const groups: DocGroup[] = [];
  const assigned = new Set<string>();

  // Match docs to their batches (most-recent batch first)
  for (const batch of batches) {
    const batchDocs = docs.filter((d) => batch.documentIds.includes(d.id));
    if (batchDocs.length === 0) continue;
    groups.push({
      id: batch.id,
      label: `Batch upload · ${batch.documentIds.length} file${batch.documentIds.length !== 1 ? "s" : ""}`,
      uploadedAt: batch.uploadedAt,
      documents: batchDocs,
    });
    batchDocs.forEach((d) => assigned.add(d.id));
  }

  // Remaining docs not in any known batch
  const individuals = docs.filter((d) => !assigned.has(d.id));
  if (individuals.length > 0) {
    groups.push({
      id: "individual",
      label: "Individual uploads",
      uploadedAt: null,
      documents: individuals,
    });
  }

  return groups;
}

// ── Step indicator ─────────────────────────────────────────────────────────
function StepIndicator({ current }: { current: PageStep }) {
  if (current === "entry") return null;
  const steps = ["select", "configure", "done"] as const;
  const labels = { select: "Select", configure: "Configure", done: "Done" };
  const idx = steps.indexOf(current as (typeof steps)[number]);
  return (
    <div className="hidden sm:flex items-center space-x-2">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center">
          <div
            className={`flex items-center space-x-1.5 text-xs font-medium ${
              i <= idx ? "text-neutral-900" : "text-gray-400"
            }`}
          >
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                i < idx
                  ? "bg-green-500 text-white"
                  : i === idx
                  ? "bg-neutral-900 text-white"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {i < idx ? "✓" : i + 1}
            </span>
            <span>{labels[s]}</span>
          </div>
          {i < steps.length - 1 && <div className="w-8 h-px bg-gray-200 mx-2" />}
        </div>
      ))}
    </div>
  );
}

// ── Main content ───────────────────────────────────────────────────────────
function BulkSignContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // IDs passed via URL pre-select specific documents
  const preSelectedIds = (searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const [step, setStep] = useState<PageStep>("loading");

  // ── Entry step state ──────────────────────────────────────────────────────
  const [entryFiles, setEntryFiles] = useState<File[]>([]);
  const [isDragOverEntry, setIsDragOverEntry] = useState(false);
  const [isUploadingEntry, setIsUploadingEntry] = useState(false);
  const [entryUploadProgress, setEntryUploadProgress] = useState({ done: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Select step state ────────────────────────────────────────────────────
  const [docGroups, setDocGroups] = useState<DocGroup[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Configure / processing / done state ─────────────────────────────────
  const [selectedDocs, setSelectedDocs] = useState<DocumentType[]>([]);
  const [referencePdfUrl, setReferencePdfUrl] = useState<string | null>(null);
  const [results, setResults] = useState<SignResult[]>([]);

  // ── Results pagination ────────────────────────────────────────────────────
  const RESULTS_PER_PAGE = 10;
  const [resultsPage, setResultsPage] = useState(1);

  // ── Background job tracking ───────────────────────────────────────────────
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobTotal, setJobTotal] = useState(0);
  const [jobProcessed, setJobProcessed] = useState(0);

  // ── Download / preview state ─────────────────────────────────────────────
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadAllProgress, setDownloadAllProgress] = useState(0);
  const [previewDoc, setPreviewDoc] = useState<SignResult | null>(null);

  // ── Bulk email send state ─────────────────────────────────────────────────
  const [bulkSendModalOpen, setBulkSendModalOpen] = useState(false);
  const [bulkSendDomain, setBulkSendDomain] = useState("");
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [bulkSendQueued, setBulkSendQueued] = useState(false);

  // ── Load draft docs (reusable — called from entry or on pre-selected mount) ─
  const loadDraftDocs = useCallback(async (preSelectIds: string[] = []) => {
    setStep("loading");
    try {
      const res = await fetch("/api/documents?status=draft");
      if (!res.ok) throw new Error("Failed to fetch documents");
      const data = await res.json();
      const docs: DocumentType[] = data.documents ?? [];
      setDocGroups(groupDocuments(docs, loadBatches()));
      if (preSelectIds.length > 0) {
        const validIds = new Set(docs.map((d) => d.id));
        setSelectedIds(new Set(preSelectIds.filter((id) => validIds.has(id))));
      }
      setStep("select");
    } catch (err: any) {
      toast.error(err.message);
      setStep("entry");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (preSelectedIds.length > 0) {
      // Came from dashboard selection mode — skip entry
      loadDraftDocs(preSelectedIds);
    } else {
      setStep("entry");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Skip select step after upload — go straight to configure ─────────────
  const jumpToConfigure = useCallback(async (ids: string[]) => {
    setStep("loading");
    try {
      const res = await fetch("/api/documents?status=draft");
      if (!res.ok) throw new Error("Failed to fetch documents");
      const data = await res.json();
      const docs: DocumentType[] = data.documents ?? [];

      // Populate docGroups so the Back button on configure works correctly
      setDocGroups(groupDocuments(docs, loadBatches()));
      const uploadedSet = new Set(ids);
      setSelectedIds(uploadedSet);

      const toSign = docs.filter((d) => uploadedSet.has(d.id));
      if (!toSign.length) throw new Error("Uploaded documents not found — please try again");

      setSelectedDocs(toSign);
      const pdfRes = await fetch(`/api/documents/${toSign[0].id}/pdf-url`);
      if (!pdfRes.ok) throw new Error("Failed to load reference PDF");
      const pdfData = await pdfRes.json();
      setReferencePdfUrl(pdfData.url);
      setStep("configure");
    } catch (err: any) {
      toast.error(err.message);
      // Fall back to select step with the uploaded docs pre-selected
      await loadDraftDocs(ids);
    }
  }, [loadDraftDocs]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Entry upload helpers ──────────────────────────────────────────────────
  const validateAndSetFiles = (files: File[]) => {
    const valid: File[] = [];
    for (const f of files) {
      if (f.type !== "application/pdf") {
        toast.error(`${f.name}: only PDF files are supported`);
      } else if (f.size > 10 * 1024 * 1024) {
        toast.error(`${f.name}: file too large (max 10 MB)`);
      } else {
        valid.push(f);
      }
    }
    if (valid.length)
      setEntryFiles((prev) => {
        const existing = new Set(prev.map((f) => f.name));
        return [...prev, ...valid.filter((f) => !existing.has(f.name))];
      });
  };

  const handleEntryDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverEntry(false);
    validateAndSetFiles(Array.from(e.dataTransfer.files));
  };

  const handleEntryUploadAndProceed = async () => {
    if (!entryFiles.length) return;
    setIsUploadingEntry(true);
    setEntryUploadProgress({ done: 0, total: entryFiles.length });
    const uploadedIds: string[] = [];
    for (let i = 0; i < entryFiles.length; i++) {
      try {
        const fd = new FormData();
        fd.append("file", entryFiles[i]);
        fd.append("signing_mode", "positioned");
        const res = await fetch("/api/documents/upload", { method: "POST", body: fd });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error ?? "Upload failed");
        uploadedIds.push(d.document.id as string);
      } catch (err: any) {
        toast.error(`${entryFiles[i].name}: ${err.message}`);
      }
      setEntryUploadProgress({ done: i + 1, total: entryFiles.length });
    }
    setIsUploadingEntry(false);
    if (uploadedIds.length > 0) {
      saveBatch(uploadedIds);
      setEntryFiles([]);
      await jumpToConfigure(uploadedIds);
    }
  };

  // ── Selection helpers ────────────────────────────────────────────────────
  const toggleDoc = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleGroup = (group: DocGroup) => {
    const allSelected = group.documents.every((d) => selectedIds.has(d.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        group.documents.forEach((d) => next.delete(d.id));
      } else {
        group.documents.forEach((d) => next.add(d.id));
      }
      return next;
    });
  };

  const allDocuments = docGroups.flatMap((g) => g.documents);
  const selectedCount = selectedIds.size;

  // ── Proceed to configure ─────────────────────────────────────────────────
  const handleProceedToConfigure = async () => {
    const docs = allDocuments.filter((d) => selectedIds.has(d.id));
    if (!docs.length) return;
    setSelectedDocs(docs);
    try {
      const res = await fetch(`/api/documents/${docs[0].id}/pdf-url`);
      if (!res.ok) throw new Error("Failed to load reference PDF");
      const data = await res.json();
      setReferencePdfUrl(data.url);
      setStep("configure");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // ── Sign all selected docs ───────────────────────────────────────────────
  const handlePlacementComplete = async (result: BulkPlacementResult) => {
    setStep("processing");
    try {
      const body: Record<string, unknown> = {
        documentIds: selectedDocs.map((d) => d.id),
        signature_data: result.signatureData,
        placement_mode: result.mode,
      };
      if (result.mode === "all-pages") body.position = result.position;
      else body.placements = result.placements;

      const res = await fetch("/api/documents/bulk-self-sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to queue signing job");

      // Step stays as "processing" — the polling effect transitions to "done"
      setJobId(data.jobId);
      setJobTotal(data.total);
    } catch (err: any) {
      toast.error(err.message);
      setStep("configure");
    }
  };

  // ── Poll for job completion ───────────────────────────────────────────────
  useEffect(() => {
    if (!jobId || step !== "processing") return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/documents/bulk-sign-jobs/${jobId}`);
        if (!res.ok) return; // transient error — keep polling
        const data = await res.json();
        setJobProcessed(data.processed ?? 0);
        if (data.status === "completed") {
          setResults(data.results);
          setResultsPage(1);
          setJobId(null);
          setStep("done");
        }
      } catch {
        // network hiccup — keep polling
      }
    };

    poll(); // check immediately on mount
    const interval = setInterval(poll, 2500);
    return () => clearInterval(interval);
  }, [jobId, step]);

  // ── Download helpers ─────────────────────────────────────────────────────
  const handleDownloadOne = async (r: SignResult) => {
    setDownloadingId(r.documentId);
    try {
      const url = await getSignedUrl(r.documentId);
      await downloadFile(url, `${safeFilename(r.title)}_signed.pdf`);
    } catch (err: any) {
      toast.error(`Download failed: ${err.message}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadAll = async () => {
    const successful = results.filter((r) => r.success);
    if (!successful.length) return;
    setDownloadingAll(true);
    setDownloadAllProgress(0);
    for (let i = 0; i < successful.length; i++) {
      try {
        const url = await getSignedUrl(successful[i].documentId);
        await downloadFile(url, `${safeFilename(successful[i].title)}_signed.pdf`);
        setDownloadAllProgress(i + 1);
      } catch {
        toast.error(`Failed to download "${successful[i].title}"`);
      }
      if (i < successful.length - 1)
        await new Promise((r) => setTimeout(r, 700));
    }
    setDownloadingAll(false);
  };

  // ── Bulk email send ───────────────────────────────────────────────────────
  const cleanDomain = bulkSendDomain.trim().toLowerCase().replace(/^@+/, "");
  const domainValid = cleanDomain.includes(".");

  const handleBulkSend = async () => {
    if (!domainValid) return;
    const sends = results
      .filter((r) => r.success)
      .map((r) => ({ documentId: r.documentId, email: deriveEmail(r.title, cleanDomain) }));

    setIsBulkSending(true);
    try {
      const res = await fetch("/api/documents/bulk-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sends }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to queue emails");
      setBulkSendQueued(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to queue emails");
    } finally {
      setIsBulkSending(false);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto">
      {/* Page header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center space-x-4">
          {step !== "processing" && (
            <Link href="/dashboard/home">
              <Button variant="ghost" size="sm" className="text-gray-500 -ml-2">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Bulk Sign Documents</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {step === "entry"
                ? "Sign multiple documents with a single signature"
                : "Sign multiple documents with one signature"}
            </p>
          </div>
        </div>
        {step !== "loading" && step !== "processing" && step !== "entry" && (
          <StepIndicator current={step} />
        )}
      </div>

      {/* ── Loading ── */}
      {step === "loading" && (
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
        </div>
      )}

      {/* ── Entry ── */}
      {step === "entry" && (
        <div className="max-w-3xl mx-auto space-y-6">
          <p className="text-center text-sm text-gray-500">
            Upload new PDF documents or choose from documents you&apos;ve already saved as drafts.
          </p>

          {/* Choice cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Upload card */}
            <div
              className={`relative flex flex-col items-center text-center border-2 border-dashed rounded-2xl p-8 cursor-pointer transition-all duration-150 ${
                isDragOverEntry
                  ? "border-neutral-900 bg-neutral-50 scale-[1.01] shadow-md"
                  : "border-gray-300 hover:border-neutral-400 hover:bg-gray-50 hover:shadow-sm"
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={(e) => { e.preventDefault(); setIsDragOverEntry(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragOverEntry(false); }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleEntryDrop}
            >
              <div className="w-16 h-16 rounded-2xl bg-neutral-900 flex items-center justify-center mb-5 shadow-lg">
                <Upload className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-base font-bold text-neutral-900">Upload Documents</h3>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                Drop PDF files here or click to open your file explorer.
                Multiple files supported.
              </p>
              <p className="text-xs text-gray-400 mt-3">PDF only · max 10 MB each</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) {
                    validateAndSetFiles(Array.from(e.target.files));
                    e.target.value = "";
                  }
                }}
              />
            </div>

            {/* Select from drafts card */}
            <div
              className="flex flex-col items-center text-center border-2 border-dashed rounded-2xl p-8 cursor-pointer border-gray-300 hover:border-neutral-400 hover:bg-gray-50 hover:shadow-sm transition-all duration-150"
              onClick={() => loadDraftDocs()}
            >
              <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-5">
                <FolderOpen className="h-7 w-7 text-gray-600" />
              </div>
              <h3 className="text-base font-bold text-neutral-900">Select from Drafts</h3>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                Browse and choose from documents you have already uploaded as drafts.
              </p>
              <p className="text-xs text-gray-400 mt-3">Grouped by upload batch</p>
            </div>
          </div>

          {/* Staged files panel */}
          {entryFiles.length > 0 && (
            <div className="border rounded-2xl bg-white overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b bg-gray-50 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FilePlus2 className="h-4 w-4 text-neutral-700" />
                  <p className="text-sm font-semibold text-neutral-900">
                    {entryFiles.length} file{entryFiles.length !== 1 ? "s" : ""} ready to upload
                  </p>
                </div>
                <button
                  onClick={() => setEntryFiles([])}
                  disabled={isUploadingEntry}
                  className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-40"
                >
                  Clear all
                </button>
              </div>

              <div className="divide-y">
                {entryFiles.slice(0, 5).map((f, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                        <FileText className="h-3.5 w-3.5 text-red-500" />
                      </div>
                      <p className="text-sm truncate">{f.name}</p>
                    </div>
                    <div className="flex items-center space-x-3 flex-shrink-0 ml-3">
                      <span className="text-xs text-gray-400">{formatFileSize(f.size)}</span>
                      {!isUploadingEntry && (
                        <button
                          onClick={() => setEntryFiles((prev) => prev.filter((_, j) => j !== i))}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {entryFiles.length > 5 && (
                  <div className="px-5 py-2.5 text-xs text-gray-400">
                    and {entryFiles.length - 5} more file{entryFiles.length - 5 !== 1 ? "s" : ""}…
                  </div>
                )}
              </div>

              <div className="px-5 py-4 border-t bg-gray-50">
                {isUploadingEntry ? (
                  <div className="flex items-center space-x-3">
                    <Loader2 className="h-4 w-4 animate-spin text-neutral-700 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-neutral-900">
                        Uploading {entryUploadProgress.done} of {entryUploadProgress.total}…
                      </p>
                      <div className="mt-1.5 h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-neutral-900 rounded-full transition-all duration-300"
                          style={{
                            width: `${(entryUploadProgress.done / entryUploadProgress.total) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-400">
                      Documents will be grouped as a batch for signing.
                    </p>
                    <Button onClick={handleEntryUploadAndProceed} className="ml-4">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload &amp; Continue
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Select ── */}
      {step === "select" && (
        <div className="space-y-4">
          {/* Instruction */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Select the documents you want to sign. Documents are grouped by upload batch.
            </p>
            <span className="text-sm font-medium text-neutral-900">
              {selectedCount} selected
            </span>
          </div>

          {docGroups.length === 0 ? (
            <div className="bg-white border rounded-2xl p-12 text-center text-gray-400">
              <FolderOpen className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm font-medium text-gray-600">No draft documents</p>
              <p className="text-xs mt-1">
                Upload some documents first, then come back to bulk-sign them.
              </p>
              <Button
                variant="outline"
                className="mt-6"
                onClick={() => router.push("/dashboard/home")}
              >
                Go to Dashboard
              </Button>
            </div>
          ) : (
            <>
              {docGroups.map((group) => {
                const allGroupSelected = group.documents.every((d) =>
                  selectedIds.has(d.id)
                );
                const someGroupSelected = group.documents.some((d) =>
                  selectedIds.has(d.id)
                );
                const selectedInGroup = group.documents.filter((d) =>
                  selectedIds.has(d.id)
                ).length;

                return (
                  <div
                    key={group.id}
                    className="bg-white border rounded-2xl overflow-hidden"
                  >
                    {/* Group header */}
                    <div className="flex items-center justify-between px-5 py-3.5 border-b bg-gray-50">
                      <div className="flex items-center space-x-3">
                        {group.id === "individual" ? (
                          <FolderOpen className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        ) : (
                          <Package className="h-4 w-4 text-neutral-600 flex-shrink-0" />
                        )}
                        <div>
                          <p className="text-sm font-semibold text-neutral-900">
                            {group.label}
                          </p>
                          {group.uploadedAt && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              Uploaded{" "}
                              {formatDistanceToNow(new Date(group.uploadedAt), {
                                addSuffix: true,
                              })}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Select All toggle */}
                      <button
                        onClick={() => toggleGroup(group)}
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                          allGroupSelected
                            ? "bg-neutral-900 text-white border-neutral-900 hover:bg-neutral-700"
                            : someGroupSelected
                            ? "bg-neutral-100 text-neutral-900 border-neutral-300 hover:bg-neutral-200"
                            : "bg-white text-neutral-700 border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {allGroupSelected
                          ? `Deselect All (${selectedInGroup})`
                          : `Select All (${group.documents.length})`}
                      </button>
                    </div>

                    {/* Document list */}
                    <div className="divide-y">
                      {group.documents.map((doc) => {
                        const isChecked = selectedIds.has(doc.id);
                        return (
                          <label
                            key={doc.id}
                            className={`flex items-center space-x-4 px-5 py-3.5 cursor-pointer transition-colors ${
                              isChecked
                                ? "bg-neutral-50"
                                : "hover:bg-gray-50/50"
                            }`}
                          >
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => toggleDoc(doc.id)}
                              className="flex-shrink-0"
                            />
                            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                              <FileText className="h-4 w-4 text-red-500" />
                            </div>
                            <p className="text-sm font-medium flex-1 truncate">
                              {doc.title}
                            </p>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Footer action */}
              <div className="flex items-center justify-between pt-2 pb-4">
                <p className="text-sm text-gray-500">
                  {selectedCount > 0
                    ? `${selectedCount} document${selectedCount !== 1 ? "s" : ""} will be signed`
                    : "Select at least one document to continue"}
                </p>
                <Button
                  size="lg"
                  onClick={handleProceedToConfigure}
                  disabled={selectedCount === 0}
                >
                  Configure Signature →
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Configure ── */}
      {step === "configure" && (
        <div className="space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold">Draw and place your signature</h2>
              <p className="text-sm text-gray-500 mt-1">
                Reference:{" "}
                <span className="font-medium text-gray-700">
                  {selectedDocs[0]?.title}
                </span>
                . Placement applies to all {selectedDocs.length} document
                {selectedDocs.length !== 1 ? "s" : ""}.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep("select")}
              className="flex-shrink-0 ml-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>

          <div className="bg-white border rounded-2xl p-6">
            {referencePdfUrl ? (
              <BulkPlacementPicker
                pdfUrl={referencePdfUrl}
                onComplete={handlePlacementComplete}
              />
            ) : (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Processing ── */}
      {step === "processing" && (
        <div className="flex flex-col items-center justify-center py-32 space-y-6 max-w-sm mx-auto">
          <Loader2 className="h-12 w-12 animate-spin text-neutral-700" />
          <div className="w-full text-center space-y-3">
            <p className="text-lg font-semibold">Signing documents…</p>
            <p className="text-sm text-gray-500">
              {jobProcessed} of {jobTotal} signed
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div
                className="h-2 bg-neutral-900 rounded-full transition-all duration-500"
                style={{
                  width: jobTotal > 0 ? `${Math.round((jobProcessed / jobTotal) * 100)}%` : "0%",
                }}
              />
            </div>
            <p className="text-xs text-gray-400">
              {jobTotal > 0
                ? `${Math.round((jobProcessed / jobTotal) * 100)}% complete`
                : "Starting…"}
            </p>
          </div>
        </div>
      )}

      {/* ── Done ── */}
      {step === "done" && (
        <div className="max-w-2xl mx-auto">
          <div className="bg-white border rounded-2xl p-8 space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                    failCount === 0 ? "bg-green-100" : "bg-amber-100"
                  }`}
                >
                  {failCount === 0 ? (
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  ) : (
                    <XCircle className="h-6 w-6 text-amber-600" />
                  )}
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Bulk signing complete</h2>
                  <p className="text-sm text-gray-500">
                    {successCount} signed successfully
                    {failCount > 0 ? `, ${failCount} failed` : ""}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {successCount > 1 && (
                  <Button
                    variant="outline"
                    onClick={handleDownloadAll}
                    disabled={downloadingAll}
                  >
                    {downloadingAll ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {downloadAllProgress}/{successCount}…
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Download All
                      </>
                    )}
                  </Button>
                )}
                {successCount > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setBulkSendDomain("");
                      setBulkSendQueued(false);
                      setBulkSendModalOpen(true);
                    }}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Send by Email
                  </Button>
                )}
              </div>
            </div>

            {/* ── Results table (paginated) ── */}
            {(() => {
              const totalPages = Math.ceil(results.length / RESULTS_PER_PAGE);
              const pageStart = (resultsPage - 1) * RESULTS_PER_PAGE;
              const pageEnd = pageStart + RESULTS_PER_PAGE;
              const pageResults = results.slice(pageStart, pageEnd);

              return (
                <div className="border rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50 hover:bg-gray-50">
                          <TableHead className="w-10 text-center text-xs">#</TableHead>
                          <TableHead className="text-xs">Document</TableHead>
                          <TableHead className="w-28 text-xs">Status</TableHead>
                          <TableHead className="w-44 text-xs text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pageResults.map((r, idx) => (
                          <TableRow key={r.documentId} className="hover:bg-gray-50/50">
                            {/* Row number */}
                            <TableCell className="text-center text-xs text-gray-400 font-mono">
                              {pageStart + idx + 1}
                            </TableCell>

                            {/* Document title */}
                            <TableCell className="max-w-0">
                              <p className="text-sm font-medium truncate">{r.title}</p>
                            </TableCell>

                            {/* Status badge */}
                            <TableCell>
                              {r.success ? (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Signed
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1 text-xs font-medium text-red-600"
                                  title={r.error}
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                  Failed
                                </span>
                              )}
                            </TableCell>

                            {/* Actions */}
                            <TableCell className="text-right">
                              {r.success ? (
                                <div className="inline-flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs text-gray-500 hover:text-neutral-900"
                                    onClick={() => setPreviewDoc(r)}
                                  >
                                    <Eye className="h-3.5 w-3.5 mr-1" />
                                    Preview
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs text-gray-500 hover:text-neutral-900"
                                    disabled={downloadingId === r.documentId || downloadingAll}
                                    onClick={() => handleDownloadOne(r)}
                                  >
                                    {downloadingId === r.documentId ? (
                                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                                    ) : (
                                      <Download className="h-3.5 w-3.5 mr-1" />
                                    )}
                                    Download
                                  </Button>
                                </div>
                              ) : (
                                r.error && (
                                  <p className="text-xs text-red-500 truncate max-w-[160px] ml-auto" title={r.error}>
                                    {r.error}
                                  </p>
                                )
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Table footer — pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                      <p className="text-xs text-gray-500">
                        {pageStart + 1}–{Math.min(pageEnd, results.length)} of {results.length} documents
                      </p>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setResultsPage((p) => Math.max(1, p - 1))}
                          disabled={resultsPage <= 1}
                          className="h-7 px-2.5 text-xs"
                        >
                          ← Prev
                        </Button>
                        <span className="text-xs text-gray-500 px-2">
                          {resultsPage} / {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setResultsPage((p) => Math.min(totalPages, p + 1))}
                          disabled={resultsPage >= totalPages}
                          className="h-7 px-2.5 text-xs"
                        >
                          Next →
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="flex justify-end pt-2 border-t">
              <Button asChild size="lg">
                <Link href="/dashboard/home">← Back to Dashboard</Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── PDF Preview Modal ── */}
      {previewDoc && (
        <PdfPreviewModal
          documentId={previewDoc.documentId}
          title={previewDoc.title}
          open={!!previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}

      {/* ── Send by Email modal ── */}
      <Dialog
        open={bulkSendModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setBulkSendModalOpen(false);
            setBulkSendDomain("");
            setBulkSendQueued(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Send className="h-4 w-4 text-neutral-700" />
              <span>Send Documents by Email</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {/* ── Queued confirmation ── */}
            {bulkSendQueued ? (
              <div className="flex flex-col items-center text-center py-4 space-y-4">
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="h-7 w-7 text-green-600" />
                </div>
                <div>
                  <p className="text-base font-semibold text-neutral-900">
                    {successCount} email{successCount !== 1 ? "s" : ""} queued
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Documents are being sent in the background.
                    Recipients will receive their emails shortly.
                  </p>
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    setBulkSendModalOpen(false);
                    setBulkSendQueued(false);
                  }}
                >
                  Done
                </Button>
              </div>
            ) : (
              <>
            {/* Explanation */}
            <p className="text-sm text-gray-500 leading-relaxed">
              Each signed document is sent to an email derived from its filename.
              Enter the shared domain — the filename becomes the email username.
            </p>

            {/* Example pill */}
            <div className="flex flex-wrap items-center gap-1.5 bg-gray-50 border rounded-lg px-3 py-2 text-xs text-gray-500">
              <FileText className="h-3.5 w-3.5 text-gray-400" />
              <span className="font-mono">jane.doe</span>
              <ArrowRight className="h-3 w-3 text-gray-300" />
              <AtSign className="h-3 w-3 text-gray-400" />
              <span className="font-mono text-neutral-700">domain.co.zm</span>
              <ArrowRight className="h-3 w-3 text-gray-300" />
              <span className="font-mono font-medium text-neutral-900">
                jane.doe@domain.co.zm
              </span>
            </div>

            {/* Domain input */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-700">Email domain</label>
              <div className="relative">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  placeholder="e.g. domain.co.zm or gmail.com"
                  value={bulkSendDomain}
                  onChange={(e) => {
                    setBulkSendDomain(e.target.value);
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter" && domainValid) handleBulkSend(); }}
                  className="pl-8 text-sm"
                  disabled={isBulkSending}
                  autoFocus
                />
              </div>
              {bulkSendDomain.trim() && !domainValid && (
                <p className="text-xs text-amber-600">
                  Enter a valid domain, e.g.{" "}
                  <span className="font-mono">company.com</span>
                </p>
              )}
            </div>

            {/* 2-row preview */}
            {domainValid && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Preview
                </p>
                <div className="border rounded-lg bg-white divide-y overflow-hidden">
                  {results
                    .filter((r) => r.success)
                    .slice(0, 2)
                    .map((r) => {
                      const derivedEmail = deriveEmail(r.title, cleanDomain);
                      return (
                        <div key={r.documentId} className="flex items-center gap-3 px-3 py-2.5">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-xs text-gray-500 truncate max-w-[35%]">
                              {r.title}
                            </span>
                            <ArrowRight className="h-3 w-3 text-gray-300 flex-shrink-0" />
                            <span className="text-xs font-medium text-neutral-900 truncate">
                              {derivedEmail}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  {results.filter((r) => r.success).length > 2 && (
                    <div className="px-3 py-2 text-xs text-gray-400">
                      and {results.filter((r) => r.success).length - 2} more…
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Send action */}
            <Button
              onClick={handleBulkSend}
              disabled={!domainValid || isBulkSending}
              className="w-full"
            >
              {isBulkSending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Queuing…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send {successCount} Email{successCount !== 1 ? "s" : ""}
                </>
              )}
            </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Page export ────────────────────────────────────────────────────────────
export default function BulkSignPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
        </div>
      }
    >
      <BulkSignContent />
    </Suspense>
  );
}
