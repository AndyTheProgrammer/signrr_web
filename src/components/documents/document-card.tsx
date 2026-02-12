"use client";

import { Document, DocumentStatus } from "@/types/database";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Eye, Trash2, Clock, CheckCircle2, FileSignature } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { toast } from "sonner";

interface DocumentCardProps {
  document: Document;
  onDelete: () => void;
}

export function DocumentCard({ document, onDelete }: DocumentCardProps) {
  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this document?")) {
      return;
    }

    try {
      const response = await fetch(`/api/documents/${document.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete document");
      }

      toast.success("Document deleted successfully");
      onDelete();
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    }
  };

  const getStatusConfig = (status: DocumentStatus) => {
    switch (status) {
      case "draft":
        return {
          label: "Draft",
          variant: "secondary" as const,
          icon: Clock,
        };
      case "pending":
        return {
          label: "Pending Signatures",
          variant: "default" as const,
          icon: FileSignature,
        };
      case "completed":
        return {
          label: "Completed",
          variant: "default" as const,
          icon: CheckCircle2,
          className: "bg-green-500 hover:bg-green-600",
        };
      default:
        return {
          label: status,
          variant: "secondary" as const,
          icon: Clock,
        };
    }
  };

  const statusConfig = getStatusConfig(document.status);
  const StatusIcon = statusConfig.icon;

  return (
    <Card className="hover:border-gray-300 transition-colors group">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
              <FileText className="h-5 w-5 text-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate">{document.title}</h3>
              <p className="text-xs text-gray-400 mt-1">
                {formatDistanceToNow(new Date(document.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        <Badge
          variant={statusConfig.variant}
          className={statusConfig.className}
        >
          <StatusIcon className="h-3 w-3 mr-1" />
          {statusConfig.label}
        </Badge>
        {document.status === "completed" && document.completed_at && (
          <p className="text-xs text-gray-400 mt-2">
            Completed {formatDistanceToNow(new Date(document.completed_at), { addSuffix: true })}
          </p>
        )}
      </CardContent>

      <CardFooter className="flex justify-between pt-3 border-t">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/documents/${document.id}`}>
            <Eye className="h-4 w-4 mr-1" />
            View
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDelete}
          className="text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
