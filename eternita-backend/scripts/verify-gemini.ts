import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { normalizeTokenUsage } from "../src/ai/ai-log";
import { GeminiService } from "../src/ai/gemini.service";
import { GeminiServiceError } from "../src/ai/gemini-runtime";

async function main(): Promise<void> {
  if (!process.env.GEMINI_API_KEY) {
    console.log(JSON.stringify({
      status: "skipped",
      keyPresent: false,
      reason: "GEMINI_API_KEY is not configured in this environment.",
    }));
    process.exitCode = 2;
    return;
  }

  const startedAt = Date.now();
  try {
    const result = await new GeminiService().answerQuestion(
      "Reply with exactly GEMINI_VERIFICATION_OK.",
      [],
    );
    const normalizedUsage = normalizeTokenUsage(result.tokenUsage);

    console.log(JSON.stringify({
      status: "success",
      keyPresent: true,
      modelName: result.modelName,
      latencyMs: Date.now() - startedAt,
      responseTextExtracted: result.answer.length > 0,
      responseMatchedExpected: result.answer.trim() === "GEMINI_VERIFICATION_OK",
      tokenUsage: normalizedUsage,
    }));

    if (result.answer.trim() !== "GEMINI_VERIFICATION_OK") {
      process.exitCode = 1;
    }
  } catch (error) {
    console.log(JSON.stringify({
      status: "error",
      keyPresent: true,
      latencyMs: Date.now() - startedAt,
      code: error instanceof GeminiServiceError
        ? error.code
        : "GEMINI_VERIFICATION_ERROR",
      category: error instanceof GeminiServiceError
        ? error.diagnosticCategory
        : "unknown_provider_error",
      diagnostic: error instanceof GeminiServiceError ? error.diagnostic : undefined,
    }));
    process.exitCode = 1;
  }
}

void main();
