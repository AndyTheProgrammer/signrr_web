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
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 flex-1 min-w-0">
            <FileText className="h-8 w-8 text-red-500 flex-shrink-0 mt-1" />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg truncate">{document.title}</h3>
              <p className="text-sm text-gray-500 mt-1">
                Created {formatDistanceToNow(new Date(document.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>
          <Badge
            variant={statusConfig.variant}
            className={statusConfig.className}
          >
            <StatusIcon className="h-3 w-3 mr-1" />
            {statusConfig.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        {document.status === "completed" && document.completed_at && (
          <p className="text-sm text-gray-600">
            Completed {formatDistanceToNow(new Date(document.completed_at), { addSuffix: true })}
          </p>
        )}
      </CardContent>

      <CardFooter className="flex justify-end space-x-2 pt-3 border-t">
        <Button
          variant="outline"
          size="sm"
          asChild
        >
          <Link href={`/dashboard/documents/${document.id}`}>
            <Eye className="h-4 w-4 mr-2" />
            View
          </Link>
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </Button>
      </CardFooter>
    </Card>
  );
}
