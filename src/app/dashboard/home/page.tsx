"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UploadDialog } from "@/components/documents/upload-dialog";
import { DocumentList } from "@/components/documents/document-list";
import { Upload, Plus, FileSignature } from "lucide-react";
import { DocumentsToSign } from "@/components/documents/documents-to-sign";

export default function DashboardPage() {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleUploadSuccess = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage and track your documents
          </p>
        </div>
        <Button onClick={() => setUploadDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Document
        </Button>
      </div>

      {/* Documents to Sign */}
      <div className="mb-10">
        <div className="flex items-center space-x-2 mb-4">
          <FileSignature className="h-5 w-5 text-blue-600" />
          <h2 className="text-base font-semibold">Awaiting Your Signature</h2>
        </div>
        <DocumentsToSign />
      </div>

      {/* Your Documents */}
      <div>
        <div className="flex items-center space-x-2 mb-4">
          <Upload className="h-5 w-5 text-gray-500" />
          <h2 className="text-base font-semibold">Your Documents</h2>
        </div>
        <DocumentList refreshTrigger={refreshTrigger} />
      </div>

      {/* Upload Dialog */}
      <UploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onUploadSuccess={handleUploadSuccess}
      />
    </div>
  );
}
