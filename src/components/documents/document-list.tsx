"use client";

import { useEffect, useState } from "react";
import { Document, DocumentStatus } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileText,
  Filter,
  Eye,
  Trash2,
  Clock,
  CheckCircle2,
  FileSignature,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { toast } from "sonner";

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

interface DocumentListProps {
  refreshTrigger?: number;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onDocumentsLoaded?: (docs: Document[]) => void;
}

function getStatusConfig(status: DocumentStatus) {
  switch (status) {
    case "draft":
      return { label: "Draft", icon: Clock, className: "bg-neutral-100 text-neutral-700 border-neutral-200" };
    case "pending":
      return { label: "Pending", icon: FileSignature, className: "bg-amber-50 text-amber-700 border-amber-200" };
    case "completed":
      return { label: "Completed", icon: CheckCircle2, className: "bg-green-50 text-green-700 border-green-200" };
    default:
      return { label: status, icon: Clock, className: "bg-neutral-100 text-neutral-700 border-neutral-200" };
  }
}

export function DocumentList({
  refreshTrigger,
  selectable,
  selectedIds,
  onToggleSelect,
  onDocumentsLoaded,
}: DocumentListProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(25);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const url =
        statusFilter === "all"
          ? "/api/documents"
          : `/api/documents?status=${statusFilter}`;

      const response = await fetch(url);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch documents");
      }

      const data = await response.json();
      setDocuments(data.documents);
      onDocumentsLoaded?.(data.documents);
      setPage(1);
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [statusFilter, refreshTrigger]);

  const handleDelete = async (doc: Document) => {
    if (!confirm("Are you sure you want to delete this document?")) return;
    try {
      const response = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete document");
      }
      toast.success("Document deleted");
      fetchDocuments();
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    }
  };

  const totalPages = Math.max(1, Math.ceil(documents.length / pageSize));
  const pageDocuments = documents.slice((page - 1) * pageSize, page * pageSize);
  const startRow = documents.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRow = Math.min(page * pageSize, documents.length);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-neutral-900 mx-auto" />
          <p className="mt-3 text-sm text-gray-500">Loading documents…</p>
        </div>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="rounded-lg border bg-white">
        <div className="flex items-center justify-between px-4 py-2.5 border-b">
          <span className="text-sm text-gray-500">0 documents</span>
          <FilterMenu value={statusFilter} onChange={(v) => setStatusFilter(v)} />
        </div>
        <div className="text-center py-16">
          <FileText className="mx-auto h-10 w-10 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-600">No documents found</p>
          <p className="mt-1 text-xs text-gray-400">
            {statusFilter === "all"
              ? "Upload a document to get started."
              : `No ${statusFilter} documents found.`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-neutral-50/50">
        <span className="text-sm text-gray-500">
          {documents.length} document{documents.length !== 1 ? "s" : ""}
          {statusFilter !== "all" && (
            <span className="ml-1 text-gray-400">· {statusFilter}</span>
          )}
        </span>
        <FilterMenu value={statusFilter} onChange={(v) => setStatusFilter(v)} />
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {selectable && <TableHead className="w-10 py-2" />}
            <TableHead className="py-2">Document</TableHead>
            <TableHead className="w-32 py-2">Status</TableHead>
            <TableHead className="w-40 py-2">Created</TableHead>
            <TableHead className="w-20 py-2 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageDocuments.map((doc) => {
            const { label, icon: StatusIcon, className: badgeClass } = getStatusConfig(doc.status);
            const isSelected = selectedIds?.has(doc.id);

            return (
              <TableRow
                key={doc.id}
                data-state={isSelected ? "selected" : undefined}
                className={selectable ? "cursor-pointer" : undefined}
                onClick={selectable ? () => onToggleSelect?.(doc.id) : undefined}
              >
                {selectable && (
                  <TableCell className="py-1.5 pr-0">
                    <div
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                        isSelected ? "bg-neutral-900 border-neutral-900" : "border-neutral-300"
                      }`}
                    >
                      {isSelected && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </TableCell>
                )}

                <TableCell className="py-1.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded bg-red-50 flex items-center justify-center flex-shrink-0">
                      <FileText className="h-3.5 w-3.5 text-red-400" />
                    </div>
                    <span className="text-sm truncate max-w-sm" title={doc.title}>
                      {doc.title}
                    </span>
                  </div>
                </TableCell>

                <TableCell className="py-1.5">
                  <Badge variant="outline" className={`text-xs gap-1 py-0 ${badgeClass}`}>
                    <StatusIcon className="h-3 w-3" />
                    {label}
                  </Badge>
                </TableCell>

                <TableCell className="py-1.5 text-xs text-gray-500">
                  {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}
                </TableCell>

                <TableCell className="py-1.5 text-right">
                  {!selectable && (
                    <div className="flex items-center justify-end gap-0.5">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild>
                        <Link href={`/dashboard/documents/${doc.id}`}>
                          <Eye className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-gray-400 hover:text-red-600"
                        onClick={(e) => { e.stopPropagation(); handleDelete(doc); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Pagination footer */}
      <div className="flex items-center justify-between px-4 py-2.5 border-t bg-neutral-50/50">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Rows per page</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs px-2">
                {pageSize}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuRadioGroup
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v) as PageSize);
                  setPage(1);
                }}
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <DropdownMenuRadioItem key={n} value={String(n)}>
                    {n}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            {startRow}–{endRow} of {documents.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setPage(1)}
              disabled={page === 1}
              title="First page"
            >
              <ChevronLeft className="h-3.5 w-3.5 -mr-1" />
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-gray-500 w-16 text-center">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              title="Last page"
            >
              <ChevronRight className="h-3.5 w-3.5 -ml-1" />
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterMenu({
  value,
  onChange,
}: {
  value: DocumentStatus | "all";
  onChange: (v: DocumentStatus | "all") => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8">
          <Filter className="h-3.5 w-3.5 mr-1.5" />
          {value === "all" ? "All" : value.charAt(0).toUpperCase() + value.slice(1)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(v) => onChange(v as DocumentStatus | "all")}
        >
          <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="draft">Draft</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="pending">Pending</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="completed">Completed</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
