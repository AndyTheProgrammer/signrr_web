"use client";

import { useEffect, useState } from "react";
import { Document, DocumentStatus } from "@/types/database";
import { DocumentCard } from "./document-card";
import { Button } from "@/components/ui/button";
import { FileText, Filter } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DocumentListProps {
  refreshTrigger?: number;
}

export function DocumentList({ refreshTrigger }: DocumentListProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | "all">("all");

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const url = statusFilter === "all"
        ? "/api/documents"
        : `/api/documents?status=${statusFilter}`;

      const response = await fetch(url);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch documents");
      }

      const data = await response.json();
      setDocuments(data.documents);
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [statusFilter, refreshTrigger]);

  const handleDocumentDelete = () => {
    fetchDocuments();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading documents...</p>
        </div>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-semibold text-gray-900">No documents</h3>
        <p className="mt-1 text-sm text-gray-500">
          {statusFilter === "all"
            ? "Get started by uploading a document."
            : `No ${statusFilter} documents found.`}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {statusFilter === "all" ? "All Documents" : `${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} Documents`}
          <span className="ml-2 text-sm font-normal text-gray-500">
            ({documents.length})
          </span>
        </h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filter: {statusFilter === "all" ? "All" : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup value={statusFilter} onValueChange={(value) => setStatusFilter(value as DocumentStatus | "all")}>
              <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="draft">Draft</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="pending">Pending</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="completed">Completed</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {documents.map((document) => (
          <DocumentCard
            key={document.id}
            document={document}
            onDelete={handleDocumentDelete}
          />
        ))}
      </div>
    </div>
  );
}
