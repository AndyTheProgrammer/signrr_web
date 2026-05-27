"use client";

import { useEffect, useState } from "react";
import { Clock, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface DocumentToSign {
  id: string;
  title: string;
  signing_mode: string;
  created_at: string;
  signing_order: number;
  total_signers: number;
  signed_count: number;
  current_signer_name: string | null;
  magic_token: string | null;
  is_my_turn: boolean;
}

function SigningProgress({
  total,
  signed,
  myOrder,
}: {
  total: number;
  signed: number;
  myOrder: number;
}) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-colors ${total > 6 ? "w-2" : "w-3"} ${
            i < signed ? "bg-green-400" : i === myOrder - 1 ? "bg-blue-500" : "bg-gray-200"
          }`}
        />
      ))}
    </div>
  );
}

function Panel({
  docs,
  variant,
}: {
  docs: DocumentToSign[];
  variant: "sign" | "next";
}) {
  const [index, setIndex] = useState(0);
  const doc = docs[index];
  const isSign = variant === "sign";

  const prev = () => setIndex((i) => Math.max(0, i - 1));
  const next = () => setIndex((i) => Math.min(docs.length - 1, i + 1));

  return (
    <div className={`bg-white rounded-xl border overflow-hidden shadow-sm flex flex-col ${isSign ? "border-blue-100" : "border-gray-100"}`}>

      {/* Panel header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${isSign ? "border-blue-50 bg-blue-50/50" : "border-gray-100 bg-gray-50/50"}`}>
        <div className="flex items-center gap-2">
          {isSign ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
              <span className="text-sm font-semibold text-gray-800">Your turn to sign</span>
            </>
          ) : (
            <>
              <Clock className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-sm font-semibold text-gray-600">Up next</span>
            </>
          )}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium tabular-nums ${isSign ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
          {docs.length}
        </span>
      </div>

      {/* Document content */}
      {isSign ? (
        <a
          href={`/sign/${doc.magic_token}`}
          className="group flex flex-1 hover:bg-blue-50/30 transition-colors"
        >
          <div className="w-1 bg-blue-500 flex-shrink-0" />
          <div className="flex-1 px-4 py-4 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors mb-3">
              {doc.title}
            </p>
            <SigningProgress total={doc.total_signers} signed={doc.signed_count} myOrder={doc.signing_order} />
            <p className="text-xs text-gray-400 mt-1.5">
              Signer {doc.signing_order}/{doc.total_signers}
              {" · "}
              {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}
            </p>
          </div>
        </a>
      ) : (
        <div className="flex flex-1">
          <div className="w-1 bg-gray-200 flex-shrink-0" />
          <div className="flex-1 px-4 py-4 min-w-0">
            <p className="text-sm font-medium text-gray-600 truncate mb-3">
              {doc.title}
            </p>
            <SigningProgress total={doc.total_signers} signed={doc.signed_count} myOrder={doc.signing_order} />
            <p className="text-xs text-gray-400 mt-1.5">
              {doc.current_signer_name
                ? `Waiting for ${doc.current_signer_name}`
                : "Waiting for others"}
              {" · "}
              <span className="inline-flex items-center gap-0.5">
                <Users className="h-3 w-3" /> #{doc.signing_order}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Navigation footer */}
      <div className={`flex items-center justify-between px-4 py-2 border-t ${isSign ? "border-blue-50" : "border-gray-100"}`}>
        <button
          onClick={prev}
          disabled={index === 0}
          className="p-1 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="h-4 w-4 text-gray-500" />
        </button>

        <span className="text-xs text-gray-400 tabular-nums">
          {index + 1} of {docs.length}
        </span>

        <button
          onClick={next}
          disabled={index === docs.length - 1}
          className="p-1 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="h-4 w-4 text-gray-500" />
        </button>
      </div>

    </div>
  );
}

export function DocumentsToSign() {
  const [documents, setDocuments] = useState<DocumentToSign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/documents/to-sign")
      .then((r) => r.json())
      .then((data) => setDocuments(data.documents || []))
      .catch(() => toast.error("Failed to load documents to sign"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
        <div className="h-40 bg-gray-50 rounded-xl border border-gray-100 animate-pulse" />
        <div className="h-40 bg-gray-50 rounded-xl border border-gray-100 animate-pulse" />
      </div>
    );
  }

  const signNow = documents.filter((d) => d.is_my_turn).slice(0, 5);
  const upNext = documents.filter((d) => !d.is_my_turn).slice(0, 5);

  if (!signNow.length && !upNext.length) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
      {signNow.length > 0 ? (
        <Panel docs={signNow} variant="sign" />
      ) : (
        <div className="bg-white rounded-xl border border-blue-50 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-blue-50 bg-blue-50/50">
            <span className="relative flex h-2 w-2">
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-200" />
            </span>
            <span className="text-sm font-semibold text-gray-400">Your turn to sign</span>
          </div>
          <div className="flex-1 flex items-center justify-center py-8">
            <p className="text-xs text-gray-400">Nothing awaiting your signature</p>
          </div>
        </div>
      )}

      {upNext.length > 0 ? (
        <Panel docs={upNext} variant="next" />
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/50">
            <Clock className="h-3.5 w-3.5 text-gray-300" />
            <span className="text-sm font-semibold text-gray-400">Up next</span>
          </div>
          <div className="flex-1 flex items-center justify-center py-8">
            <p className="text-xs text-gray-400">No documents queued</p>
          </div>
        </div>
      )}
    </div>
  );
}
