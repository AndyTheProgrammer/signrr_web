"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileSignature,
  CheckCircle2,
  Clock,
  ExternalLink,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface DocumentToSign {
  id: string;
  title: string;
  document_status: string;
  signing_mode: string;
  created_at: string;
  signer_status: string;
  signing_order: number;
  signed_at: string | null;
  magic_token: string | null;
  is_my_turn: boolean;
}

export function DocumentsToSign() {
  const [documents, setDocuments] = useState<DocumentToSign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDocumentsToSign();
  }, []);

  const fetchDocumentsToSign = async () => {
    try {
      const response = await fetch("/api/documents/to-sign");
      if (!response.ok) {
        throw new Error("Failed to fetch");
      }
      const data = await response.json();
      setDocuments(data.documents);
    } catch (error: any) {
      toast.error("Failed to load documents to sign");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-8">
        <FileSignature className="mx-auto h-10 w-10 text-gray-400" />
        <p className="mt-2 text-sm text-gray-500">
          No documents waiting for your signature
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {documents.map((doc) => (
        <Card key={doc.id + doc.signing_order} className="hover:border-gray-300 transition-colors">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 min-w-0">
                <FileSignature className="h-5 w-5 text-blue-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium truncate">{doc.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Signer #{doc.signing_order} &middot;{" "}
                    {formatDistanceToNow(new Date(doc.created_at), {
                      addSuffix: true,
                    })}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2 flex-shrink-0 ml-4">
                {doc.signer_status === "signed" ? (
                  <Badge className="bg-green-500 hover:bg-green-600">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Signed
                  </Badge>
                ) : doc.is_my_turn ? (
                  <Button size="sm" asChild>
                    <a href={`/sign/${doc.magic_token}`}>
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Sign Now
                    </a>
                  </Button>
                ) : (
                  <Badge variant="secondary">
                    <Clock className="h-3 w-3 mr-1" />
                    Waiting
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
