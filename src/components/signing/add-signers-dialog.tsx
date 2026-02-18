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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, X, Mail, User } from "lucide-react";
import { toast } from "sonner";

interface AddSignersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  onSuccess: () => void;
}

interface Signer {
  email: string;
  full_name: string;
}

export function AddSignersDialog({
  open,
  onOpenChange,
  documentId,
  onSuccess,
}: AddSignersDialogProps) {
  const [signers, setSigners] = useState<Signer[]>([
    { email: "", full_name: "" },
  ]);
  const [loading, setLoading] = useState(false);

  const addSigner = () => {
    setSigners([...signers, { email: "", full_name: "" }]);
  };

  const removeSigner = (index: number) => {
    if (signers.length === 1) {
      toast.error("You must have at least one signer");
      return;
    }
    setSigners(signers.filter((_, i) => i !== index));
  };

  const updateSigner = (index: number, field: keyof Signer, value: string) => {
    const newSigners = [...signers];
    newSigners[index][field] = value;
    setSigners(newSigners);
  };

  const validateSigners = () => {
    for (let i = 0; i < signers.length; i++) {
      const signer = signers[i];
      if (!signer.email || !signer.full_name) {
        toast.error(`Signer #${i + 1}: All fields are required`);
        return false;
      }

      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(signer.email)) {
        toast.error(`Signer #${i + 1}: Invalid email address`);
        return false;
      }
    }

    // Check for duplicate emails
    const emails = signers.map((s) => s.email.toLowerCase());
    const uniqueEmails = new Set(emails);
    if (emails.length !== uniqueEmails.size) {
      toast.error("Each signer must have a unique email address");
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateSigners()) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/documents/${documentId}/signers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ signers }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to add signers");
      }

      toast.success("Signers added successfully! Invitations sent.");
      setSigners([{ email: "", full_name: "" }]);
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
            Add people who need to sign this document. They will sign in the order listed below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {signers.map((signer, index) => (
            <div
              key={index}
              className="border rounded-lg p-4 space-y-3 relative"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center">
                    <span className="text-sm font-medium text-neutral-700">
                      {index + 1}
                    </span>
                  </div>
                  <span className="font-medium text-sm text-gray-700">
                    Signer #{index + 1}
                  </span>
                </div>
                {signers.length > 1 && (
                  <button
                    onClick={() => removeSigner(index)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor={`name-${index}`}>Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id={`name-${index}`}
                    type="text"
                    placeholder="John Doe"
                    value={signer.full_name}
                    onChange={(e) =>
                      updateSigner(index, "full_name", e.target.value)
                    }
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`email-${index}`}>Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id={`email-${index}`}
                    type="email"
                    placeholder="john@example.com"
                    value={signer.email}
                    onChange={(e) =>
                      updateSigner(index, "email", e.target.value)
                    }
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={addSigner}
            className="w-full"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Add Another Signer
          </Button>
        </div>

        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => {
              setSigners([{ email: "", full_name: "" }]);
              onOpenChange(false);
            }}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Adding Signers..." : `Add ${signers.length} Signer${signers.length > 1 ? "s" : ""}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
