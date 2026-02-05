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
import { Label } from "@/components/ui/label";
import { Upload, FileText, X, MousePointerClick, PenTool } from "lucide-react";
import { toast } from "sonner";
import { SigningMode } from "@/types/database";

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadSuccess: () => void;
}

export function UploadDialog({
  open,
  onOpenChange,
  onUploadSuccess,
}: UploadDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [signingMode, setSigningMode] = useState<SigningMode>("simple");

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (selectedFile: File) => {
    // Validate file type
    if (selectedFile.type !== "application/pdf") {
      toast.error("Only PDF files are allowed");
      return;
    }

    // Validate file size (10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    setFile(selectedFile);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("signing_mode", signingMode);

      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to upload document");
      }

      toast.success("Document uploaded successfully!");
      setFile(null);
      onOpenChange(false);
      onUploadSuccess();
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Upload a PDF document to get started with signing
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!file ? (
            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                dragActive
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-300 hover:border-gray-400"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm text-gray-600">
                Drag and drop your PDF here, or
              </p>
              <label className="mt-2 inline-block">
                <span className="cursor-pointer text-sm font-medium text-blue-600 hover:text-blue-500">
                  browse files
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept="application/pdf"
                  onChange={handleFileInput}
                />
              </label>
              <p className="mt-1 text-xs text-gray-500">PDF up to 10MB</p>
            </div>
          ) : (
            <>
              <div className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <FileText className="h-8 w-8 text-red-500" />
                    <div>
                      <p className="text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setFile(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Signing Mode Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Signing Mode</Label>
                <div className="space-y-2">
                  <label
                    className={`flex items-start space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      signingMode === "simple"
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
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
                        <PenTool className="h-4 w-4 text-blue-600" />
                        <span className="font-medium text-sm">Simple Signature</span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        Signers draw their signature without placing it on the document
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-start space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      signingMode === "positioned"
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
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
                        <MousePointerClick className="h-4 w-4 text-blue-600" />
                        <span className="font-medium text-sm">Positioned Signature</span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        Signers click on the document to place their signature at specific locations
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => {
                setFile(null);
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!file || uploading}
            >
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
