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
  Send,
  Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
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
  const [ownerEmail, setOwnerEmail] = useState("");
  const [addSignersDialogOpen, setAddSignersDialogOpen] = useState(false);
  const [selfSignDialogOpen, setSelfSignDialogOpen] = useState(false);
  const [sequentialSignDialogOpen, setSequentialSignDialogOpen] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [sendEmailOpen, setSendEmailOpen] = useState(false);
  const [sendEmailInput, setSendEmailInput] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

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
          setOwnerEmail(data.user.email ?? "");
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

  const handleSendEmail = async () => {
    const trimmed = sendEmailInput.trim();
    if (!trimmed || !document) return;
    setSendingEmail(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      toast.success(`Document sent to ${trimmed}`);
      setSendEmailInput("");
      setSendEmailOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to send email");
    } finally {
      setSendingEmail(false);
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

  // Detect when it is the owner's turn in the sequential signing flow
  const ownerCurrentSigner =
    document.status === "pending" &&
    document.signers &&
    document.signers.length > 0
      ? document.signers.find(
          (s) => s.signing_order === document.current_signer_index + 1 && s.is_self && s.status === "pending"
        ) ?? null
      : null;
  const ownerIsCurrentSigner = ownerCurrentSigner !== null;
  const ownerIsFirst = ownerCurrentSigner?.signing_order === 1;

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
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative group inline-block">
          <Button
            onClick={handleDownload}
            disabled={document.status !== "completed"}
          >
            <Download className="h-4 w-4 mr-2" />
            {document.status === "completed" ? "Download Signed PDF" : "Download PDF"}
          </Button>
          {document.status !== "completed" && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              Available once all signers have signed
            </div>
          )}
        </div>

        {/* Send by Email — only for completed documents */}
        {document.status === "completed" && (
          <Button
            variant="outline"
            onClick={() => {
              setSendEmailOpen((v) => !v);
              setSendEmailInput("");
            }}
          >
            <Send className="h-4 w-4 mr-2" />
            Send by Email
          </Button>
        )}

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
        {ownerIsCurrentSigner && (
          <Button onClick={() => setSequentialSignDialogOpen(true)}>
            <PenLine className="h-4 w-4 mr-2" />
            Sign Now (Your Turn)
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

      {/* Your-turn-to-sign banner */}
      {ownerIsCurrentSigner && (
        <div className="mb-4 flex items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 px-5 py-4">
          <PenLine className="h-5 w-5 text-neutral-700 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-neutral-900">Your signature is required</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {ownerIsFirst
                ? "You're first in the signing sequence. Sign now to get things started."
                : "The previous signer has completed their step. Sign now to keep the workflow moving."}
            </p>
          </div>
          <Button size="sm" onClick={() => setSequentialSignDialogOpen(true)}>
            Sign Now
          </Button>
        </div>
      )}

      {/* Send by Email inline panel */}
      {sendEmailOpen && document.status === "completed" && (
        <div className="mb-6 border rounded-xl p-4 bg-gray-50 space-y-3">
          <div className="flex items-center space-x-2">
            <Mail className="h-4 w-4 text-neutral-700" />
            <p className="text-sm font-medium text-gray-800">
              Send signed document by email
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="email"
              placeholder="recipient@example.com"
              value={sendEmailInput}
              onChange={(e) => setSendEmailInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSendEmail();
                if (e.key === "Escape") setSendEmailOpen(false);
              }}
              className="flex-1"
              autoFocus
              disabled={sendingEmail}
            />
            <Button
              onClick={handleSendEmail}
              disabled={sendingEmail || !sendEmailInput.trim()}
            >
              {sendingEmail ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {sendingEmail ? "Sending…" : "Send"}
            </Button>
          </div>
          <p className="text-xs text-gray-400">
            The signed PDF will be attached directly to the email.
          </p>
        </div>
      )}

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
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{signer.full_name || "No name"}</p>
                          {signer.is_self && (
                            <Badge variant="secondary" className="text-xs py-0">
                              You
                            </Badge>
                          )}
                        </div>
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
                        !signer.is_self &&
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
        ownerEmail={ownerEmail}
        ownerName={ownerName}
        onSuccess={fetchDocument}
      />

      {/* Self-sign Dialog (draft documents) */}
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

      {/* Sequential sign Dialog (owner's turn in pending workflow) */}
      {document && (
        <SelfSignDialog
          open={sequentialSignDialogOpen}
          onOpenChange={setSequentialSignDialogOpen}
          documentId={documentId}
          documentTitle={document.title}
          signingMode={document.signing_mode}
          signerName={ownerName}
          onSuccess={fetchDocument}
          sequential
        />
      )}
    </div>
  );
}
