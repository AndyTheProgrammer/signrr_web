"use client";

import { useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RotateCcw, Check } from "lucide-react";

interface SignatureCanvasComponentProps {
  onSave: (signatureData: string) => void;
  signerName: string;
}

export function SignatureCanvasComponent({
  onSave,
  signerName,
}: SignatureCanvasComponentProps) {
  const sigCanvasRef = useRef<SignatureCanvas>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  const handleClear = () => {
    sigCanvasRef.current?.clear();
    setIsEmpty(true);
  };

  const handleSave = () => {
    if (sigCanvasRef.current?.isEmpty()) {
      return;
    }

    const signatureData = sigCanvasRef.current.toDataURL("image/png");
    onSave(signatureData);
  };

  const handleBegin = () => {
    setIsEmpty(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Draw Your Signature</CardTitle>
        <p className="text-sm text-gray-600 mt-2">
          Sign below using your mouse or touch screen
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border-2 border-dashed border-gray-300 rounded-lg bg-white">
          <SignatureCanvas
            ref={sigCanvasRef}
            canvasProps={{
              className: "w-full h-48 rounded-lg",
              style: { touchAction: "none" },
            }}
            backgroundColor="white"
            penColor="black"
            onBegin={handleBegin}
          />
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Signing as: <span className="font-medium text-gray-900">{signerName}</span>
          </p>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={handleClear} disabled={isEmpty}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Clear
            </Button>
            <Button onClick={handleSave} disabled={isEmpty}>
              <Check className="h-4 w-4 mr-2" />
              Confirm Signature
            </Button>
          </div>
        </div>

        <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3">
          <p className="text-sm text-neutral-700">
            <strong>Note:</strong> By signing this document, you agree that your electronic
            signature is legally binding.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
