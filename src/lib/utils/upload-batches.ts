export interface UploadBatch {
  id: string;
  documentIds: string[];
  uploadedAt: string; // ISO date
}

const KEY = "signrr_upload_batches";
const MAX = 50;

export function loadBatches(): UploadBatch[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as UploadBatch[];
  } catch {
    return [];
  }
}

/** Record a set of document IDs that were uploaded together. Only tracks batches of 2+. */
export function saveBatch(documentIds: string[]): void {
  if (documentIds.length < 2) return;
  const existing = loadBatches();
  const entry: UploadBatch = {
    id: `batch_${Date.now()}`,
    documentIds: [...documentIds],
    uploadedAt: new Date().toISOString(),
  };
  localStorage.setItem(KEY, JSON.stringify([entry, ...existing].slice(0, MAX)));
}
