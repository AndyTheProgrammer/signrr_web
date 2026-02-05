"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UploadDialog } from "@/components/documents/upload-dialog";
import { DocumentList } from "@/components/documents/document-list";
import { Upload, FileText } from "lucide-react";

export default function DashboardPage() {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleUploadSuccess = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Your Documents</h1>
        <p className="text-gray-600 mt-2">
          Manage and track your documents for signing
        </p>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="flex justify-between items-center rounded-lg border border-gray-200 p-5 hover:border-gray-300 transition-colors">
            <div className="flex items-start space-x-3">
              <Upload className="h-6 w-6 text-blue-600 mt-1" />
              <div>
                <h3 className="font-semibold">Upload Document</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Upload a PDF to start the signing process
                </p>
              </div>
            </div>
            <Button
              onClick={() => setUploadDialogOpen(true)}
              size="sm"
            >
              Upload
            </Button>
          </div>

          <div className="flex justify-between items-center rounded-lg border border-gray-200 p-5 opacity-50">
            <div className="flex items-start space-x-3">
              <FileText className="h-6 w-6 text-gray-400 mt-1" />
              <div>
                <h3 className="font-semibold">Scan Document</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Scan a document using your device camera
                </p>
              </div>
            </div>
            <Button size="sm" disabled>
              Scan
            </Button>
          </div>
        </div>
      </div>

      {/* Recent Documents */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Recent Documents</h2>
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
