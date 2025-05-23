"use client";

import PdfViewer from "@/app/components/pdf/viewer";
import { useParams, useSearchParams } from "next/navigation";
import React from "react";

const DocumentViewerPage = () => {
  const params = useSearchParams();
  // console.log(params);

  //
  const pdfUrl = params.get("pdfUrl");
  //URl decode it
  decodeURIComponent(pdfUrl!);

  // console.log(pdfUrl);

  return (
    <div>
      <PdfViewer pdfUrl={pdfUrl!} title="" />
    </div>
  );
};

export default DocumentViewerPage;
