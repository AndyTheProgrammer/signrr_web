"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Document, Signer } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft,
  FileText,
  Download,
  UserPlus,
  Clock,
  CheckCircle2,
  FileSignature,
  Mail,
  RefreshCw,
  Ban,
  XCircle,
  PenLine,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import Link from "next/link";
import { AddSignersDialog } from "@/components/signing/add-signers-dialog";
import { SelfSignDialog } from "@/components/signing/self-sign-dialog";

interface DocumentWithSigners extends Document {
  signers: Signer[];
}

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const documentId = params.id as string;

  const [document, setDocument] = useState<DocumentWithSigners | null>(null);
  const [loading, setLoading] = useState(true);
  const [ownerName, setOwnerName] = useState("");
  const [addSignersDialogOpen, setAddSignersDialogOpen] = useState(false);
  const [selfSignDialogOpen, setSelfSignDialogOpen] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (data.user) {
          setOwnerName(
            data.user.user_metadata?.full_name ||
            data.user.email ||
            "You"
          );
        }
      });
  }, []);

  useEffect(() => {
    fetchDocument();
  }, [documentId]);

  const fetchDocument = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/documents/${documentId}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch document");
      }

      const data = await response.json();
      setDocument(data.document);
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
      router.push("/dashboard/home");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async (signerId: string) => {
    setResendingId(signerId);
    try {
      const response = await fetch(`/api/documents/${documentId}/resend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signer_id: signerId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to resend");
      toast.success("Signing link resent successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to resend link");
    } finally {
      setResendingId(null);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm("Cancel this document? Signers will no longer be able to sign it.")) return;
    setCancelling(true);
    try {
      const response = await fetch(`/api/documents/${documentId}/cancel`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to cancel");
      toast.success("Document cancelled");
      fetchDocument();
    } catch (error: any) {
      toast.error(error.message || "Failed to cancel document");
    } finally {
      setCancelling(false);
    }
  };

  const handleDownload = async () => {
    if (!document) return;

    try {
      const response = await fetch(`/api/documents/${documentId}/pdf-url`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to get download URL");
      }

      // Open the signed URL in a new tab to trigger download
      window.open(data.url, "_blank");
    } catch (error: any) {
      toast.error(error.message || "Failed to download PDF");
    }
  };

  const getStatusConfig = (status: string) => {
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
      case "cancelled":
        return {
          label: "Cancelled",
          variant: "secondary" as const,
          icon: XCircle,
          className: "bg-red-100 text-red-700 hover:bg-red-100",
        };
      default:
        return {
          label: status,
          variant: "secondary" as const,
          icon: Clock,
        };
    }
  };

  const getSignerStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "signed":
        return (
          <Badge className="bg-green-500 hover:bg-green-600">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Signed
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading document...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!document) {
    return null;
  }

  const statusConfig = getStatusConfig(document.status);
  const StatusIcon = statusConfig.icon;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="mb-4"
        >
          <Link href="/dashboard/home">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Documents
          </Link>
        </Button>

        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4">
            <FileText className="h-10 w-10 text-red-500 mt-1" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{document.title}</h1>
              <p className="text-gray-600 mt-2">
                Created {formatDistanceToNow(new Date(document.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>
          <Badge variant={statusConfig.variant} className={statusConfig.className}>
            <StatusIcon className="h-4 w-4 mr-1" />
            {statusConfig.label}
          </Badge>
        </div>
      </div>

      {/* Actions */}
      <div className="flex space-x-2 mb-6">
        <Button onClick={handleDownload} disabled={document.status === "draft"}>
          <Download className="h-4 w-4 mr-2" />
          {document.status === "completed" ? "Download Signed PDF" : "Download PDF"}
        </Button>
        <Button
          variant="outline"
          onClick={() => setAddSignersDialogOpen(true)}
          disabled={document.status !== "draft" || (document.signers && document.signers.length > 0)}
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Add Signers
        </Button>
        {document.status === "draft" && (!document.signers || document.signers.length === 0) && (
          <Button onClick={() => setSelfSignDialogOpen(true)}>
            <PenLine className="h-4 w-4 mr-2" />
            Sign Yourself
          </Button>
        )}
        {document.status === "pending" && (
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={cancelling}
            className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
          >
            <Ban className="h-4 w-4 mr-2" />
            {cancelling ? "Cancelling..." : "Cancel Document"}
          </Button>
        )}
      </div>

      {/* Document Info */}
      <div className="grid gap-6 md:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Document Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-500">Status</p>
              <p className="text-sm mt-1">{statusConfig.label}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Created</p>
              <p className="text-sm mt-1">
                {new Date(document.created_at).toLocaleDateString()} at{" "}
                {new Date(document.created_at).toLocaleTimeString()}
              </p>
            </div>
            {document.completed_at && (
              <div>
                <p className="text-sm font-medium text-gray-500">Completed</p>
                <p className="text-sm mt-1">
                  {new Date(document.completed_at).toLocaleDateString()} at{" "}
                  {new Date(document.completed_at).toLocaleTimeString()}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Signing Progress</CardTitle>
          </CardHeader>
          <CardContent>
            {document.signers && document.signers.length > 0 ? (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Signatures</span>
                  <span className="font-medium">
                    {document.signers.filter((s) => s.status === "signed").length} /{" "}
                    {document.signers.length}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-neutral-900 h-2 rounded-full transition-all"
                    style={{
                      width: `${
                        (document.signers.filter((s) => s.status === "signed").length /
                          document.signers.length) *
                        100
                      }%`,
                    }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No signers added yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Signers List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Signers</CardTitle>
        </CardHeader>
        <CardContent>
          {document.signers && document.signers.length > 0 ? (
            <div className="space-y-3">
              {document.signers
                .sort((a, b) => a.signing_order - b.signing_order)
                .map((signer) => (
                  <div
                    key={signer.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center">
                        <span className="text-sm font-medium text-neutral-700">
                          {signer.signing_order}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{signer.full_name || "No name"}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          <Mail className="h-3 w-3 text-gray-400" />
                          <p className="text-sm text-gray-600">{signer.email}</p>
                        </div>
                        {signer.signed_at && (
                          <p className="text-xs text-gray-500 mt-1">
                            Signed {formatDistanceToNow(new Date(signer.signed_at), { addSuffix: true })}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getSignerStatusBadge(signer.status)}
                      {signer.status === "pending" &&
                        signer.signing_order === document.current_signer_index + 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleResend(signer.id)}
                            disabled={resendingId === signer.id}
                            className="text-gray-500 hover:text-gray-900 text-xs"
                          >
                            <RefreshCw className={`h-3 w-3 mr-1 ${resendingId === signer.id ? "animate-spin" : ""}`} />
                            Resend
                          </Button>
                        )}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <UserPlus className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">No signers yet</h3>
              <p className="mt-1 text-sm text-gray-500">
                Add signers to start the signing workflow
              </p>
              <Button
                className="mt-4"
                onClick={() => setAddSignersDialogOpen(true)}
                disabled={document.status !== "draft"}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add Signers
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Signers Dialog */}
      <AddSignersDialog
        open={addSignersDialogOpen}
        onOpenChange={setAddSignersDialogOpen}
        documentId={documentId}
        onSuccess={fetchDocument}
      />

      {/* Self-sign Dialog */}
      {document && (
        <SelfSignDialog
          open={selfSignDialogOpen}
          onOpenChange={setSelfSignDialogOpen}
          documentId={documentId}
          documentTitle={document.title}
          signingMode={document.signing_mode}
          signerName={ownerName}
          onSuccess={fetchDocument}
        />
      )}
    </div>
  );
}
