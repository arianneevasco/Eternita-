import { createHash } from "crypto";
import type { AiUseLogInput } from "./ai-use-log.service";

export interface NormalizedTokenUsage {
  promptTokens: number | null;
  candidatesTokens: number | null;
  totalTokens: number | null;
}

const PROMPT_CATEGORIES = new Set([
  "general",
  "family",
  "work",
  "health",
  "travel",
  "relationships",
]);

export function hashPrompt(prompt: string): string {
  return createHash("sha256").update(prompt, "utf8").digest("hex");
}

export function normalizePromptCategory(category?: string): string {
  return category && PROMPT_CATEGORIES.has(category) ? category : "general";
}

export function normalizeTokenUsage(usage: unknown): NormalizedTokenUsage {
  if (!usage || typeof usage !== "object") {
    return { promptTokens: null, candidatesTokens: null, totalTokens: null };
  }

  const metadata = usage as Record<string, unknown>;
  const numberOrNull = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) ? value : null;

  return {
    promptTokens: numberOrNull(metadata.promptTokenCount),
    candidatesTokens: numberOrNull(metadata.candidatesTokenCount),
    totalTokens: numberOrNull(metadata.totalTokenCount),
  };
}

export function buildAiUseLogDocument(input: AiUseLogInput): Omit<AiUseLogInput, "error" | "tokenUsage"> & {
  tokenUsage: NormalizedTokenUsage;
  error: string | null;
} {
  return {
    authenticatedUserUid: input.authenticatedUserUid,
    requestTimestamp: input.requestTimestamp,
    promptCategory: normalizePromptCategory(input.promptCategory),
    promptLength: input.promptLength,
    promptHash: input.promptHash,
    tokenUsage: normalizeTokenUsage(input.tokenUsage),
    selectedEntryIds: input.selectedEntryIds,
    accessLevels: input.accessLevels,
    modelName: input.modelName,
    responseStatus: input.responseStatus,
    latencyMs: input.latencyMs,
    error: input.error ?? null,
  };
}
