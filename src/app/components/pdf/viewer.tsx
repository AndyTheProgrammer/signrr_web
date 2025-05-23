import React from "react";

interface Props {
  pdfUrl: string;
  title: string;
}

const PdfViewer = (props: Props) => {
  const { pdfUrl, title } = props;

  // I should propbably be picking document name as the title.

  return (
    <React.Fragment>
      {pdfUrl && (
        <div className="mt-4">
          <h3 className="text-lg font-semibold mb-2">{title}</h3>
          <iframe
            src={pdfUrl}
            className="w-full h-[800px] border rounded-md"
            title="PDF Preview"
          />
        </div>
      )}
    </React.Fragment>
  );
};

export default PdfViewer;
