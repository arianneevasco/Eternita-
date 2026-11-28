import { Body, Controller, NotFoundException, Post, Req, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { AuthGuard } from "../auth/auth.guard";
import { getDb } from "../config/firebase";
import { ContextFilterService } from "./context-filter.service";
import { GeminiService } from "./gemini.service";
import { CitationService } from "./citation.service";
import { AiUseLogService } from "./ai-use-log.service";
import type { CandidateEntry } from "./access-context";
import { getAuthenticatedViewerUid } from "./access-context";
import { hashPrompt, normalizePromptCategory } from "./ai-log";
import { GEMINI_MODEL_ID } from "./gemini.config";
import { GeminiServiceError } from "./gemini-runtime";
import { LegacyService } from "../legacy/legacy.service";
import { ZodValidationPipe } from "../common/zod-validation.pipe";

const aiAskSchema = z.object({
  ownerUid: z.string().trim().min(1, "ownerUid is required"),
  question: z.string().trim().min(1, "question is required").max(4_000, "question is too long"),
  promptCategory: z.string().trim().max(100, "promptCategory is too long").optional(),
}).strict();

type AiAskBody = z.infer<typeof aiAskSchema>;

@Controller("ai")
@UseGuards(AuthGuard)
export class AiController {
  constructor(
    private readonly contextFilter: ContextFilterService,
    private readonly geminiService: GeminiService,
    private readonly citations: CitationService,
    private readonly aiUseLog: AiUseLogService,
    private readonly legacyService: LegacyService,
  ) {}

  @Post("ask")
  async askQuestion(
    @Req() request: { uid: string },
    @Body(new ZodValidationPipe(aiAskSchema)) body: AiAskBody,
  ) {
    const startedAt = Date.now();
    const requesterUid = getAuthenticatedViewerUid(request);
    const ownerSnapshot = await getDb().collection("users").doc(body.ownerUid).get();
    if (!ownerSnapshot.exists || ownerSnapshot.data()?.role !== "owner") {
      throw new NotFoundException("Owner profile not found.");
    }
    const modelName = GEMINI_MODEL_ID;
    let selectedEntries: Awaited<ReturnType<ContextFilterService["filterEntries"]>> = [];
    let legacyGrant = { active: true, released: false };

    try {
      if (requesterUid !== body.ownerUid) {
        legacyGrant = await this.legacyService.getLegacyGrantState(requesterUid, body.ownerUid);
        if (!legacyGrant.active) {
          const answer = "I cannot answer because no permitted records are available.";
          await this.writeLog(requesterUid, body, selectedEntries, modelName, "denied", startedAt);
          return {
            answer,
            status: "denied",
            error: { code: "NO_ACTIVE_LEGACY_GRANT", message: answer },
            citations: [],
            selectedEntryIds: [],
            accessLevels: {},
          };
        }
      }

      const entries = await this.getEntries(body.ownerUid);

      selectedEntries = (await this.contextFilter.filterEntries(
        requesterUid,
        body.ownerUid,
        entries,
        legacyGrant.released === true,
      )).slice(0, 20);

      if (selectedEntries.length === 0) {
        const answer = "I cannot answer because no permitted records are available.";
        await this.writeLog(requesterUid, body, selectedEntries, modelName, "denied", startedAt);
        return {
          answer,
          status: "denied",
          error: { code: "NO_PERMITTED_ENTRIES", message: answer },
          citations: [],
          selectedEntryIds: [],
          accessLevels: {},
        };
      }

      const result = await this.geminiService.answerQuestion(body.question, selectedEntries);
      const answer = this.citations.ensureCitations(result.answer, selectedEntries);
      await this.writeLog(requesterUid, body, selectedEntries, result.modelName, "success", startedAt, undefined, result.tokenUsage);

      return {
        answer,
        status: "success",
        error: null,
        citations: selectedEntries.map((entry) => entry.citation),
        selectedEntryIds: selectedEntries.map((entry) => entry.entryId),
        accessLevels: Object.fromEntries(selectedEntries.map((entry) => [entry.entryId, entry.accessLevel])),
      };
    } catch (error) {
      await this.writeLog(requesterUid, body, selectedEntries, modelName, "error", startedAt, error);
      const code = error instanceof GeminiServiceError
        ? error.code
        : "AI_BACKEND_ERROR";
      return {
        answer: "I cannot answer this request right now.",
        status: "error",
        error: {
          code,
          message: "The AI service could not complete the request.",
        },
        citations: [],
        selectedEntryIds: [],
        accessLevels: {},
      };
    }
  }

  private async getEntries(ownerUid: string): Promise<CandidateEntry[]> {
    const snapshot = await getDb()
      .collection("users")
      .doc(ownerUid)
      .collection("entries")
      .limit(50)
      .get();

    return snapshot.docs.map((document) => ({
      entryId: document.id,
      ...(document.data() as Omit<CandidateEntry, "entryId">),
    }));
  }

  private async writeLog(
    authenticatedUserUid: string,
    body: AiAskBody,
    entries: Awaited<ReturnType<ContextFilterService["filterEntries"]>>,
    modelName: string,
    responseStatus: "success" | "denied" | "error",
    startedAt: number,
    error?: unknown,
    tokenUsage?: unknown,
  ): Promise<void> {
    try {
      await this.aiUseLog.writeLog({
        authenticatedUserUid,
        requestTimestamp: new Date(),
        promptCategory: normalizePromptCategory(body.promptCategory?.slice(0, 100)),
        promptLength: typeof body.question === "string" ? body.question.length : 0,
        promptHash: hashPrompt(typeof body.question === "string" ? body.question : ""),
        tokenUsage,
        selectedEntryIds: entries.map((entry) => entry.entryId),
        accessLevels: Object.fromEntries(entries.map((entry) => [entry.entryId, entry.accessLevel])),
        modelName,
        responseStatus,
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.name : error ? "Unknown AI error" : undefined,
      });
    } catch {
      // Logging failure must not expose diary data or replace the safe AI response.
    }
  }
}
