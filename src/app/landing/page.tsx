"use client";

import React, { useEffect, useState } from "react";
import Button from "../components/button";
import { LANDING_PAGE_ACTIONS } from "../lib/actionFields";
import { useRouter } from "next/navigation";

const LandingPage = () => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const router = useRouter();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setUploadedFile(file);
      // Create URL for PDF preview
      const url = URL.createObjectURL(file);
      setPdfUrl(url);
    }
  };

  //Here I need a useEffect to listen to the changes. Once pdfUrl changes, I should navigate to the preview page.
  // Means I need to create a new page for the preview.
  useEffect(() => {
    console.log(pdfUrl);
    if (pdfUrl) {
      router.push(`document/viewer?pdfUrl=${encodeURIComponent(pdfUrl)}`);
    }
  }, [pdfUrl]);

  
  const RenderActions = () => {
    return LANDING_PAGE_ACTIONS.map((item, index) => {
      const { id, action, description, type, title } = item;
      return (
        <div
          key={id}
          className="flex justify-between max-w-3xl rounded-md border border-gray-200 p-5"
        >
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-sm">{description}</p>
          </div>
          {type === "upload" ? (
            <div className="">
              <input
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleFileUpload}
                id={`upload-${id}`}
              />
              <Button
                buttonTitle={action}
                onClick={() => document.getElementById(`upload-${id}`)?.click()}
                className="bg-black px-5 py-2 rounded-lg text-white cursor-pointer"
              />
            </div>
          ) : (
            <Button
              buttonTitle={action}
              onClick={() => console.log("Button clicked")}
              className="bg-black px-5 py-2 rounded-lg text-white cursor-pointer"
            />
          )}
        </div>
      );
    });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">Your Documents</h1>
      <p className="py-5">Recent Documents and Quick Actions</p>

      <main className="py-5">
        <div className="flex flex-col gap-5">
          {RenderActions()}

          {/* PDF Preview Section */}
          {/* {pdfUrl && (
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-2">Preview:</h3>
              <iframe
                src={pdfUrl}
                className="w-full h-[600px] border rounded-md"
                title="PDF Preview"
              />
            </div>
          )} */}
        </div>
      </main>
    </div>
  );
};

export default LandingPage;
