"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Mail, User, X, GripVertical, UserCheck } from "lucide-react";
import { toast } from "sonner";

export interface LocalSigner {
  email: string;
  full_name: string;
  is_self: boolean;
}

interface SignersListEditorProps {
  signers: LocalSigner[];
  onChange: (signers: LocalSigner[]) => void;
  ownerEmail: string;
  ownerName: string;
}

export function SignersListEditor({
  signers,
  onChange,
  ownerEmail,
  ownerName,
}: SignersListEditorProps) {
  const dragIndex = useRef<number | null>(null);
  const dragOverIndex = useRef<number | null>(null);

  const handleDragStart = (index: number) => { dragIndex.current = index; };
  const handleDragEnter = (index: number) => { dragOverIndex.current = index; };
  const handleDragEnd = () => {
    const from = dragIndex.current;
    const to = dragOverIndex.current;
    if (from !== null && to !== null && from !== to) {
      const next = [...signers];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      onChange(next);
    }
    dragIndex.current = null;
    dragOverIndex.current = null;
  };

  const addSigner = () =>
    onChange([...signers, { email: "", full_name: "", is_self: false }]);

  const addSelf = () => {
    if (signers.some((s) => s.is_self)) {
      toast.error("You can only add yourself once");
      return;
    }
    onChange([...signers, { email: ownerEmail, full_name: ownerName, is_self: true }]);
  };

  const removeSigner = (index: number) => {
    if (signers.length === 1) {
      toast.error("You must have at least one signer");
      return;
    }
    onChange(signers.filter((_, i) => i !== index));
  };

  const updateSigner = (
    index: number,
    field: keyof Pick<LocalSigner, "email" | "full_name">,
    value: string
  ) => {
    const next = [...signers];
    next[index] = { ...next[index], [field]: value };
    onChange(next);
  };

  const selfAdded = signers.some((s) => s.is_self);

  return (
    <div className="space-y-3">
      {signers.map((signer, index) => (
        <div
          key={index}
          draggable
          onDragStart={() => handleDragStart(index)}
          onDragEnter={() => handleDragEnter(index)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => e.preventDefault()}
          className="border rounded-lg p-3 space-y-3 bg-white cursor-grab active:cursor-grabbing select-none"
        >
          {/* Row header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <GripVertical className="h-4 w-4 text-gray-300 flex-shrink-0" />
              <div className="w-6 h-6 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-medium text-neutral-700">{index + 1}</span>
              </div>
              <span className="font-medium text-sm text-gray-700">Signer #{index + 1}</span>
              {signer.is_self && (
                <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700 border-blue-200 py-0">
                  <UserCheck className="h-3 w-3 mr-1" />
                  You
                </Badge>
              )}
            </div>
            {signers.length > 1 && (
              <button
                onClick={() => removeSigner(index)}
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Fields */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor={`sle-name-${index}`} className="text-xs">Full Name</Label>
              <div className="relative">
                <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  id={`sle-name-${index}`}
                  type="text"
                  placeholder="John Doe"
                  value={signer.full_name}
                  onChange={(e) => updateSigner(index, "full_name", e.target.value)}
                  className="pl-8 h-9 text-sm"
                  disabled={signer.is_self}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`sle-email-${index}`} className="text-xs">Email</Label>
              <div className="relative">
                <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  id={`sle-email-${index}`}
                  type="email"
                  placeholder="john@example.com"
                  value={signer.email}
                  onChange={(e) => updateSigner(index, "email", e.target.value)}
                  className="pl-8 h-9 text-sm"
                  disabled={signer.is_self}
                />
              </div>
            </div>
          </div>

          {signer.is_self && (
            <p className="text-xs text-blue-600">
              You&apos;ll be prompted to sign directly in the dashboard when it&apos;s your turn.
            </p>
          )}
        </div>
      ))}

      {/* Add buttons */}
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={addSigner} className="flex-1">
          <UserPlus className="h-4 w-4 mr-2" />
          Add Signer
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={addSelf}
          disabled={selfAdded}
          className="flex-1 border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 disabled:opacity-50"
        >
          <UserCheck className="h-4 w-4 mr-2" />
          Add Myself
        </Button>
      </div>
    </div>
  );
}

export function validateSigners(signers: LocalSigner[]): boolean {
  for (let i = 0; i < signers.length; i++) {
    const s = signers[i];
    if (!s.email || !s.full_name) {
      toast.error(`Signer #${i + 1}: All fields are required`);
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email)) {
      toast.error(`Signer #${i + 1}: Invalid email address`);
      return false;
    }
  }
  const emails = signers.map((s) => s.email.toLowerCase());
  if (emails.length !== new Set(emails).size) {
    toast.error("Each signer must have a unique email address");
    return false;
  }
  return true;
}
