"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import {
  Upload,
  FileText,
  X,
  MousePointerClick,
  PenTool,
  UserPlus,
  Mail,
  User,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { SigningMode } from "@/types/database";

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadSuccess: () => void;
}

interface Signer {
  email: string;
  full_name: string;
}

type Step = "upload" | "signers";

export function UploadDialog({
  open,
  onOpenChange,
  onUploadSuccess,
}: UploadDialogProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [extraFiles, setExtraFiles] = useState<File[]>([]); // additional files for multi-upload
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [signingMode, setSigningMode] = useState<SigningMode>("simple");
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [documentTitle, setDocumentTitle] = useState<string>("");

  // Signers state
  const [signers, setSigners] = useState<Signer[]>([{ email: "", full_name: "" }]);
  const [submittingSigners, setSubmittingSigners] = useState(false);

  const isMultiMode = extraFiles.length > 0;

  const resetAll = () => {
    setStep("upload");
    setFile(null);
    setExtraFiles([]);
    setUploading(false);
    setUploadProgress(null);
    setDragActive(false);
    setSigningMode("simple");
    setDocumentId(null);
    setDocumentTitle("");
    setSigners([{ email: "", full_name: "" }]);
  };

  const handleClose = (open: boolean) => {
    if (!open) resetAll();
    onOpenChange(open);
  };

  // --- Upload step ---
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.length) {
      handleFilesSelect(Array.from(e.dataTransfer.files));
    }
  };

  const validateFile = (f: File): string | null => {
    if (f.type !== "application/pdf") return `${f.name}: only PDF files are allowed`;
    if (f.size > 10 * 1024 * 1024) return `${f.name}: must be less than 10MB`;
    return null;
  };

  const handleFilesSelect = (selected: File[]) => {
    const errors: string[] = [];
    const valid: File[] = [];
    for (const f of selected) {
      const err = validateFile(f);
      if (err) errors.push(err);
      else valid.push(f);
    }
    if (errors.length) toast.error(errors[0]);
    if (!valid.length) return;
    if (valid.length === 1) {
      setFile(valid[0]);
      setExtraFiles([]);
    } else {
      setFile(valid[0]);
      setExtraFiles(valid.slice(1));
    }
  };

  const handleFileSelect = (selectedFile: File) => handleFilesSelect([selectedFile]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) handleFilesSelect(Array.from(e.target.files));
  };

  const removeExtraFile = (index: number) =>
    setExtraFiles((prev) => prev.filter((_, i) => i !== index));

  const uploadSingleFile = async (f: File, mode: SigningMode) => {
    const formData = new FormData();
    formData.append("file", f);
    formData.append("signing_mode", mode);
    const response = await fetch("/api/documents/upload", {
      method: "POST",
      body: formData,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Failed to upload document");
    return data.document;
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);

    if (isMultiMode) {
      // Multi-file path: upload all, then close and refresh
      const allFiles = [file, ...extraFiles];
      setUploadProgress({ done: 0, total: allFiles.length });
      let successCount = 0;
      for (let i = 0; i < allFiles.length; i++) {
        try {
          await uploadSingleFile(allFiles[i], "positioned");
          successCount++;
        } catch (err: any) {
          toast.error(`${allFiles[i].name}: ${err.message}`);
        }
        setUploadProgress({ done: i + 1, total: allFiles.length });
      }
      setUploading(false);
      setUploadProgress(null);
      if (successCount > 0) {
        toast.success(
          successCount === allFiles.length
            ? `${successCount} documents uploaded`
            : `${successCount} of ${allFiles.length} documents uploaded`
        );
        resetAll();
        onOpenChange(false);
        onUploadSuccess();
      }
    } else {
      // Single-file path: upload then go to signers step
      try {
        const doc = await uploadSingleFile(file, signingMode);
        setDocumentId(doc.id);
        setDocumentTitle(doc.title);
        setStep("signers");
      } catch (error: any) {
        toast.error(error.message || "An error occurred");
      } finally {
        setUploading(false);
      }
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  // --- Signers step ---
  const addSigner = () => setSigners([...signers, { email: "", full_name: "" }]);

  const removeSigner = (index: number) => {
    if (signers.length === 1) {
      toast.error("You must have at least one signer");
      return;
    }
    setSigners(signers.filter((_, i) => i !== index));
  };

  const updateSigner = (index: number, field: keyof Signer, value: string) => {
    const updated = [...signers];
    updated[index][field] = value;
    setSigners(updated);
  };

  const validateSigners = () => {
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
  };

  const handleSendForSigning = async () => {
    if (!validateSigners() || !documentId) return;
    setSubmittingSigners(true);
    try {
      const response = await fetch(`/api/documents/${documentId}/signers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signers }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to add signers");
      toast.success("Document sent for signing!");
      resetAll();
      onOpenChange(false);
      onUploadSuccess();
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setSubmittingSigners(false);
    }
  };

  const handleSkip = () => {
    toast.success("Document uploaded. Add signers from the document page.");
    resetAll();
    onOpenChange(false);
    onUploadSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        {/* Step indicator */}
        <div className="flex items-center space-x-2 mb-1">
          <div className={`flex items-center space-x-1.5 text-xs font-medium ${step === "upload" ? "text-neutral-900" : "text-gray-400"}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${step === "upload" ? "bg-neutral-900 text-white" : "bg-gray-200 text-gray-500"}`}>1</span>
            <span>Upload</span>
          </div>
          <div className="flex-1 h-px bg-gray-200" />
          <div className={`flex items-center space-x-1.5 text-xs font-medium ${step === "signers" ? "text-neutral-900" : "text-gray-400"}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${step === "signers" ? "bg-neutral-900 text-white" : "bg-gray-200 text-gray-500"}`}>2</span>
            <span>Add Signers</span>
          </div>
        </div>

        <DialogHeader>
          <DialogTitle>
            {step === "upload" ? "Upload Document" : `Who needs to sign "${documentTitle}"?`}
          </DialogTitle>
          <DialogDescription>
            {step === "upload"
              ? "Upload a PDF document to get started with signing"
              : "Add signers in the order you want them to sign. You can skip this and add them later."}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            {!file ? (
              <div
                className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                  dragActive ? "border-neutral-900 bg-neutral-50" : "border-gray-300 hover:border-gray-400"
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-600">Drag and drop your PDF here, or</p>
                <label className="mt-2 inline-block">
                  <span className="cursor-pointer text-sm font-medium text-neutral-900 hover:text-neutral-700 underline">
                    browse files
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept="application/pdf"
                    multiple
                    onChange={handleFileInput}
                  />
                </label>
                <p className="mt-1 text-xs text-gray-500">PDF up to 10MB · select multiple to bulk upload</p>
              </div>
            ) : (
              <>
                {/* Primary file */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <FileText className="h-8 w-8 text-red-500" />
                      <div>
                        <p className="text-sm font-medium">{file.name}</p>
                        <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                      </div>
                    </div>
                    <button onClick={() => { setFile(null); setExtraFiles([]); }} className="text-gray-400 hover:text-gray-600">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Extra files (multi-file mode) */}
                {extraFiles.length > 0 && (
                  <div className="space-y-2">
                    {extraFiles.map((f, i) => (
                      <div key={i} className="border rounded-lg px-3 py-2.5 flex items-center justify-between">
                        <div className="flex items-center space-x-2 min-w-0">
                          <FileText className="h-5 w-5 text-red-400 flex-shrink-0" />
                          <p className="text-sm truncate">{f.name}</p>
                          <p className="text-xs text-gray-400 flex-shrink-0">{formatFileSize(f.size)}</p>
                        </div>
                        <button onClick={() => removeExtraFile(i)} className="text-gray-400 hover:text-gray-600 ml-2">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <p className="text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                      Bulk upload: {1 + extraFiles.length} files will be uploaded as draft documents. Use "Bulk Sign" on the dashboard to sign them all at once.
                    </p>
                  </div>
                )}

                {/* Signing mode (single-file only) */}
                {!isMultiMode && <div className="space-y-3">
                  <Label className="text-sm font-medium">Signing Mode</Label>
                  <div className="space-y-2">
                    <label
                      className={`flex items-start space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                        signingMode === "simple" ? "border-neutral-900 bg-neutral-50" : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="signing_mode"
                        value="simple"
                        checked={signingMode === "simple"}
                        onChange={(e) => setSigningMode(e.target.value as SigningMode)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <PenTool className="h-4 w-4 text-neutral-700" />
                          <span className="font-medium text-sm">Simple Signature</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                          Signers draw their signature without placing it on the document
                        </p>
                      </div>
                    </label>

                    <label
                      className={`flex items-start space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                        signingMode === "positioned" ? "border-neutral-900 bg-neutral-50" : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="signing_mode"
                        value="positioned"
                        checked={signingMode === "positioned"}
                        onChange={(e) => setSigningMode(e.target.value as SigningMode)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <MousePointerClick className="h-4 w-4 text-neutral-700" />
                          <span className="font-medium text-sm">Positioned Signature</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                          Signers click on the document to place their signature at specific locations
                        </p>
                      </div>
                    </label>
                  </div>
                </div>}
              </>
            )}

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpload} disabled={!file || uploading}>
                {uploading && uploadProgress
                  ? `Uploading ${uploadProgress.done}/${uploadProgress.total}…`
                  : uploading
                  ? "Uploading…"
                  : isMultiMode
                  ? `Upload All (${1 + extraFiles.length})`
                  : (
                    <>
                      Continue
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </>
                  )}
              </Button>
            </div>
          </div>
        )}

        {step === "signers" && (
          <div className="space-y-4">
            <div className="space-y-3">
              {signers.map((signer, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center">
                        <span className="text-xs font-medium text-neutral-700">{index + 1}</span>
                      </div>
                      <span className="font-medium text-sm text-gray-700">Signer #{index + 1}</span>
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

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor={`name-${index}`} className="text-xs">Full Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                        <Input
                          id={`name-${index}`}
                          type="text"
                          placeholder="John Doe"
                          value={signer.full_name}
                          onChange={(e) => updateSigner(index, "full_name", e.target.value)}
                          className="pl-9 h-9 text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`email-${index}`} className="text-xs">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                        <Input
                          id={`email-${index}`}
                          type="email"
                          placeholder="john@example.com"
                          value={signer.email}
                          onChange={(e) => updateSigner(index, "email", e.target.value)}
                          className="pl-9 h-9 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <Button type="button" variant="outline" onClick={addSigner} className="w-full">
              <UserPlus className="h-4 w-4 mr-2" />
              Add Another Signer
            </Button>

            <div className="flex justify-between items-center pt-2 border-t">
              <div className="flex items-center space-x-2">
                <Button variant="ghost" onClick={handleSkip} disabled={submittingSigners} className="text-gray-500">
                  Skip for now
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    resetAll();
                    onOpenChange(false);
                    router.push(`/dashboard/documents/${documentId}`);
                  }}
                  disabled={submittingSigners}
                >
                  Sign it myself
                </Button>
              </div>
              <Button onClick={handleSendForSigning} disabled={submittingSigners}>
                {submittingSigners
                  ? "Sending..."
                  : `Send for Signing (${signers.length})`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
