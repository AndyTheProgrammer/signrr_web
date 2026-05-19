export interface SavedSignature {
  id: string;
  name: string;
  dataUrl: string; // base64 PNG — already bg-removed and cropped
  savedAt: string; // ISO date
}

const STORAGE_KEY = "signrr_saved_signatures";
const MAX_SAVED = 10;

export function loadSavedSignatures(): SavedSignature[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedSignature[]) : [];
  } catch {
    return [];
  }
}

export function persistSignature(dataUrl: string, name: string): SavedSignature {
  const existing = loadSavedSignatures();
  const entry: SavedSignature = {
    id: `sig_${Date.now()}`,
    name: name.trim() || `Signature ${existing.length + 1}`,
    dataUrl,
    savedAt: new Date().toISOString(),
  };
  const updated = [entry, ...existing].slice(0, MAX_SAVED);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return entry;
}

export function removeSavedSignature(id: string): SavedSignature[] {
  const updated = loadSavedSignatures().filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}
