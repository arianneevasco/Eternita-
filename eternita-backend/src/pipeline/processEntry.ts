import { normalizeText } from "./normalizeText";
import { extractNames } from "./extractNames";
import { extractTopics } from "./extractTopics";
import { correctText } from "./correctText";
import { createTextDiff } from "./createTextDiff";
import type { DiaryEntry, ProcessedEntry } from "./types";

export function createEntry(id: string, originalText: string): DiaryEntry {
  return Object.freeze({
    id,
    originalText,
  });
}

export function processEntry(entry: DiaryEntry): ProcessedEntry {
  if (!entry || typeof entry.originalText !== "string") {
    throw new TypeError("Entry must contain originalText as a string.");
  }

  const normalizedText = normalizeText(entry.originalText);
  const correctedText = correctText(normalizedText);

  return Object.freeze({
    id: entry.id,
    originalText: entry.originalText,
    normalizedText,
    names: extractNames(normalizedText),
    topics: extractTopics(normalizedText),
    correctedText,
    diff: createTextDiff(normalizedText, correctedText),
  });
}