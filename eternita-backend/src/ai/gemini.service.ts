import { GoogleGenAI } from "@google/genai";
import { Injectable } from "@nestjs/common";
import type { PermittedEntry } from "./access-context";
import { GEMINI_MODEL_ID } from "./gemini.config";
import { buildGeminiPrompt } from "./gemini-prompt";
import {
  classifyGeminiError,
  extractGeminiResponse,
  GeminiServiceError,
  withTimeout,
} from "./gemini-runtime";

export interface GeminiAnswer {
  answer: string;
  modelName: string;
  tokenUsage?: unknown;
}

@Injectable()
export class GeminiService {
  private ai?: GoogleGenAI;

  private getClient(): GoogleGenAI {
    if (!process.env.GEMINI_API_KEY) {
      throw new GeminiServiceError("GEMINI_CONFIGURATION_MISSING");
    }

    this.ai ??= new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    return this.ai;
  }

  async answerQuestion(
    question: string,
    permittedEntries: PermittedEntry[],
  ): Promise<GeminiAnswer> {
    const prompt = buildGeminiPrompt(question, permittedEntries);

    let requestPhase: "before_network" | "after_network" = "before_network";
    try {
      const request = this.getClient().models.generateContent({
        model: GEMINI_MODEL_ID,
        contents: prompt,
      });
      requestPhase = "after_network";
      const response = await withTimeout(
        request,
        15_000,
      );
      const extracted = extractGeminiResponse(response);

      return {
        answer: extracted.answer,
        modelName: GEMINI_MODEL_ID,
        tokenUsage: extracted.tokenUsage,
      };
    } catch (error) {
      throw classifyGeminiError(error, {
        modelId: GEMINI_MODEL_ID,
        requestPhase,
      });
    }
  }
}
