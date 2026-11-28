import { createHash } from "crypto";
import type { StoredEntry } from "./types.ts";

export function calculateEntryHash(entry: Omit<StoredEntry, "entryHash">): string {
  const data = JSON.stringify({
    id: entry.id,
    sequence: entry.sequence,
    previousHash: entry.previousHash,
    title: entry.title,
    originalText: entry.originalText,
    correctedText: entry.correctedText
  });

  return createHash("sha256").update(data).digest("hex");
}