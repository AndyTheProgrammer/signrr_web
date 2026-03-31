"use client";

import PdfViewer from "@/app/components/pdf/viewer";
import { useSearchParams } from "next/navigation";
import React, { Suspense } from "react";

const DocumentViewerContent = () => {
  const params = useSearchParams();
  const pdfUrl = decodeURIComponent(params.get("pdfUrl") ?? "");

  return (
    <div>
      <PdfViewer pdfUrl={pdfUrl} title="" />
    </div>
  );
};

const DocumentViewerPage = () => {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" /></div>}>
      <DocumentViewerContent />
    </Suspense>
  );
};

export default DocumentViewerPage;
