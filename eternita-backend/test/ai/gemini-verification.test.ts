import { describe, expect, it } from "@jest/globals";
import {
  classifyGeminiError,
  extractGeminiResponse,
  GeminiServiceError,
  withTimeout,
} from "../../src/ai/gemini-runtime";

describe("Gemini verification runtime", () => {
  it("extracts response text and usage metadata", () => {
    expect(extractGeminiResponse({
      text: "GEMINI_VERIFICATION_OK",
      usageMetadata: { promptTokenCount: 1 },
    })).toEqual({
      answer: "GEMINI_VERIFICATION_OK",
      tokenUsage: { promptTokenCount: 1 },
    });
  });

  it("rejects an invalid Gemini response", () => {
    expect(() => extractGeminiResponse({ text: null }))
      .toThrow(new GeminiServiceError("GEMINI_INVALID_RESPONSE"));
  });

  it("classifies rate limits without exposing provider details", () => {
    expect(classifyGeminiError({ status: 429 }).code)
      .toBe("GEMINI_RATE_LIMITED");
    expect(classifyGeminiError({ status: 429 }).diagnosticCategory)
      .toBe("quota_exceeded");
    expect(classifyGeminiError(new Error("provider secret detail")).message)
      .toBe("GEMINI_PROVIDER_ERROR");
  });

  it("classifies authentication failures without returning the provider message", () => {
    const result = classifyGeminiError({
      status: 401,
      message: "credential-bearing provider detail",
    });

    expect(result.diagnosticCategory).toBe("invalid_authentication");
    expect(result.message).toBe("GEMINI_PROVIDER_ERROR");
  });

  it("classifies malformed responses separately", () => {
    expect(() => extractGeminiResponse({ text: null })).toThrow(
      expect.objectContaining({ diagnosticCategory: "malformed_response" }),
    );
  });

  it("fails safely on timeout", async () => {
    await expect(withTimeout(new Promise(() => undefined), 1))
      .rejects.toEqual(new GeminiServiceError("GEMINI_TIMEOUT", "network_or_timeout"));
  });
});
