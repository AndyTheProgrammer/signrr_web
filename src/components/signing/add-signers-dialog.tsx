"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { SignersListEditor, validateSigners, type LocalSigner } from "./signers-list-editor";

interface AddSignersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  ownerEmail: string;
  ownerName: string;
  onSuccess: () => void;
}

export function AddSignersDialog({
  open,
  onOpenChange,
  documentId,
  ownerEmail,
  ownerName,
  onSuccess,
}: AddSignersDialogProps) {
  const [signers, setSigners] = useState<LocalSigner[]>([
    { email: "", full_name: "", is_self: false },
  ]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!validateSigners(signers)) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/documents/${documentId}/signers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signers: signers.map((s) => ({
            email: s.email,
            full_name: s.full_name,
            is_self: s.is_self,
          })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to add signers");
      toast.success("Signers added successfully! Invitations sent.");
      setSigners([{ email: "", full_name: "", is_self: false }]);
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Signers</DialogTitle>
          <DialogDescription>
            Add people who need to sign this document. Drag rows to set the signing order.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <SignersListEditor
            signers={signers}
            onChange={setSigners}
            ownerEmail={ownerEmail}
            ownerName={ownerName}
          />
        </div>

        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => {
              setSigners([{ email: "", full_name: "", is_self: false }]);
              onOpenChange(false);
            }}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading
              ? "Adding Signers..."
              : `Add ${signers.length} Signer${signers.length > 1 ? "s" : ""}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
