"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Document as DocumentType } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
  ChevronDown,
  AtSign,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  loadBatches,
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
type PageStep = "loading" | "select" | "configure" | "processing" | "done";

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

  // ── Download / preview state ─────────────────────────────────────────────
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadAllProgress, setDownloadAllProgress] = useState(0);
  const [previewDoc, setPreviewDoc] = useState<SignResult | null>(null);

  // ── Bulk email send state ─────────────────────────────────────────────────
  const [bulkSendOpen, setBulkSendOpen] = useState(false);
  const [bulkSendDomain, setBulkSendDomain] = useState("");
  const [isBulkSending, setIsBulkSending] = useState(false);
  const [bulkSendResults, setBulkSendResults] = useState<
    Map<string, { success: boolean; error?: string }>
  >(new Map());

  // ── Load all draft documents on mount ────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/documents?status=draft");
        if (!res.ok) throw new Error("Failed to fetch documents");
        const data = await res.json();
        const docs: DocumentType[] = data.documents ?? [];

        // Group by upload batch
        const batches = loadBatches();
        setDocGroups(groupDocuments(docs, batches));

        // Pre-select documents passed via URL (still in draft)
        if (preSelectedIds.length > 0) {
          const validIds = new Set(docs.map((d) => d.id));
          setSelectedIds(new Set(preSelectedIds.filter((id) => validIds.has(id))));
        }

        setStep("select");
      } catch (err: any) {
        toast.error(err.message);
        router.push("/dashboard/home");
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      if (!res.ok) throw new Error(data.error || "Failed to sign documents");

      setResults(data.results);
      setResultsPage(1);
      setStep("done");
    } catch (err: any) {
      toast.error(err.message);
      setStep("configure");
    }
  };

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
    setBulkSendResults(new Map());
    try {
      const res = await fetch("/api/documents/bulk-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sends }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send emails");
      const map = new Map<string, { success: boolean; error?: string }>(
        data.results.map((r: { documentId: string; success: boolean; error?: string }) => [
          r.documentId,
          { success: r.success, error: r.error },
        ])
      );
      setBulkSendResults(map);
      const sentCount = data.results.filter((r: { success: boolean }) => r.success).length;
      toast.success(
        `${sentCount} document${sentCount !== 1 ? "s" : ""} sent successfully`
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to send emails");
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
              Sign multiple documents with one signature
            </p>
          </div>
        </div>
        {step !== "loading" && step !== "processing" && (
          <StepIndicator current={step} />
        )}
      </div>

      {/* ── Loading ── */}
      {step === "loading" && (
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
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
        <div className="flex flex-col items-center justify-center py-32 space-y-5">
          <Loader2 className="h-14 w-14 animate-spin text-neutral-700" />
          <div className="text-center">
            <p className="text-lg font-semibold">Signing documents…</p>
            <p className="text-sm text-gray-500 mt-1">
              Applying your signature to {selectedDocs.length} document
              {selectedDocs.length !== 1 ? "s" : ""}. Please wait.
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

              {successCount > 1 && (
                <Button
                  variant="outline"
                  onClick={handleDownloadAll}
                  disabled={downloadingAll}
                  className="flex-shrink-0"
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
            </div>

            {/* ── Paginated results list ── */}
            {(() => {
              const totalPages = Math.ceil(results.length / RESULTS_PER_PAGE);
              const pageStart = (resultsPage - 1) * RESULTS_PER_PAGE;
              const pageEnd = pageStart + RESULTS_PER_PAGE;
              const pageResults = results.slice(pageStart, pageEnd);

              return (
                <div className="space-y-2">
                  {pageResults.map((r) => (
                    <div
                      key={r.documentId}
                      className={`flex items-center gap-3 border rounded-xl px-4 py-3 ${
                        r.success
                          ? "border-green-200 bg-green-50"
                          : "border-red-200 bg-red-50"
                      }`}
                    >
                      {r.success ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{r.title}</p>
                        {!r.success && r.error && (
                          <p className="text-xs text-red-600 mt-0.5">{r.error}</p>
                        )}
                      </div>
                      {r.success && (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-gray-600 hover:text-neutral-900"
                            onClick={() => setPreviewDoc(r)}
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />
                            Preview
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-gray-600 hover:text-neutral-900"
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
                      )}
                      <span
                        className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${
                          r.success
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {r.success ? "Signed" : "Failed"}
                      </span>
                    </div>
                  ))}

                  {/* Pagination controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-1">
                      <p className="text-xs text-gray-500">
                        {pageStart + 1}–{Math.min(pageEnd, results.length)} of{" "}
                        {results.length} documents
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

            {/* ── Optional: Send by Email ── */}
            {successCount > 0 && (
              <div className="border rounded-xl overflow-hidden">
                {/* Collapsible header */}
                <button
                  onClick={() => {
                    setBulkSendOpen((v) => !v);
                    setBulkSendDomain("");
                    setBulkSendResults(new Map());
                  }}
                  className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center space-x-2">
                    <Send className="h-4 w-4 text-neutral-600" />
                    <span className="text-sm font-semibold text-neutral-900">
                      Send Documents by Email
                    </span>
                    <span className="text-xs text-gray-400 font-normal">optional</span>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${
                      bulkSendOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {bulkSendOpen && (
                  <div className="border-t px-4 py-4 space-y-4 bg-gray-50">
                    {/* Explanation */}
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Each signed document is sent to an email derived from its filename.
                      Enter the shared domain — the filename becomes the username.
                    </p>
                    <div className="flex items-center space-x-2 bg-white border rounded-lg px-3 py-2 text-xs text-gray-500">
                      <FileText className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                      <span className="font-mono">nahshon.kampamba</span>
                      <ArrowRight className="h-3 w-3 flex-shrink-0" />
                      <AtSign className="h-3 w-3 flex-shrink-0" />
                      <span className="font-mono text-neutral-700">zamtel.co.zm</span>
                      <ArrowRight className="h-3 w-3 flex-shrink-0" />
                      <span className="font-mono font-medium text-neutral-900">
                        nahshon.kampamba@zamtel.co.zm
                      </span>
                    </div>

                    {/* Domain input */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-gray-700">
                        Email domain
                      </label>
                      <div className="relative">
                        <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                        <Input
                          placeholder="zamtel.co.zm or gmail.com"
                          value={bulkSendDomain}
                          onChange={(e) => {
                            setBulkSendDomain(e.target.value);
                            setBulkSendResults(new Map());
                          }}
                          className="pl-8 text-sm"
                          disabled={isBulkSending}
                        />
                      </div>
                      {bulkSendDomain.trim() && !domainValid && (
                        <p className="text-xs text-amber-600">
                          Enter a valid domain, e.g. <span className="font-mono">company.com</span>
                        </p>
                      )}
                    </div>

                    {/* Live preview table */}
                    {domainValid && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Preview
                        </p>
                        {(() => {
                          const successResults = results.filter((r) => r.success);
                          const previewRows = successResults.slice(0, 2);
                          const remaining = successResults.length - previewRows.length;
                          return (
                            <div className="border rounded-lg bg-white divide-y overflow-hidden">
                              {previewRows.map((r) => {
                                const derivedEmail = deriveEmail(r.title, cleanDomain);
                                const sendResult = bulkSendResults.get(r.documentId);
                                return (
                                  <div
                                    key={r.documentId}
                                    className="flex items-center gap-3 px-3 py-2.5"
                                  >
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <span className="text-xs text-gray-500 truncate min-w-0 max-w-[30%]">
                                        {r.title}
                                      </span>
                                      <ArrowRight className="h-3 w-3 text-gray-300 flex-shrink-0" />
                                      <span className="text-xs font-medium text-neutral-900 truncate">
                                        {derivedEmail}
                                      </span>
                                    </div>
                                    {sendResult !== undefined && (
                                      sendResult.success ? (
                                        <span className="flex items-center space-x-1 text-xs text-green-600 flex-shrink-0">
                                          <CheckCircle2 className="h-3.5 w-3.5" />
                                          <span>Sent</span>
                                        </span>
                                      ) : (
                                        <span
                                          className="flex items-center space-x-1 text-xs text-red-600 flex-shrink-0"
                                          title={sendResult.error}
                                        >
                                          <XCircle className="h-3.5 w-3.5" />
                                          <span>Failed</span>
                                        </span>
                                      )
                                    )}
                                  </div>
                                );
                              })}
                              {remaining > 0 && (
                                <div className="px-3 py-2 text-xs text-gray-400">
                                  and {remaining} more document{remaining !== 1 ? "s" : ""}…
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Send button */}
                    {domainValid && bulkSendResults.size === 0 && (
                      <Button
                        onClick={handleBulkSend}
                        disabled={isBulkSending}
                        className="w-full sm:w-auto"
                      >
                        {isBulkSending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Sending…
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Send {successCount} Email{successCount !== 1 ? "s" : ""}
                          </>
                        )}
                      </Button>
                    )}

                    {/* Summary after send */}
                    {bulkSendResults.size > 0 && (
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-600">
                          {[...bulkSendResults.values()].filter((r) => r.success).length} sent
                          successfully
                          {[...bulkSendResults.values()].filter((r) => !r.success).length > 0
                            ? `, ${[...bulkSendResults.values()].filter((r) => !r.success).length} failed`
                            : ""}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setBulkSendResults(new Map())}
                        >
                          Send Again
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

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
