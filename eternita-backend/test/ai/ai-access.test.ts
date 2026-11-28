import { describe, expect, it, jest } from "@jest/globals";
import {
  getAuthenticatedViewerUid,
  selectPermittedEntries,
} from "../../src/ai/access-context";
import { CitationService } from "../../src/ai/citation.service";
import {
  buildAiUseLogDocument,
  hashPrompt,
  normalizeTokenUsage,
} from "../../src/ai/ai-log";
import { buildGeminiPrompt } from "../../src/ai/gemini-prompt";
import { GEMINI_MODEL_ID } from "../../src/ai/gemini.config";

const candidate = (entryId: string) => ({
  entryId,
  entryDate: "2026-11-26",
  title: `Title ${entryId}`,
  summary: `Summary ${entryId}`,
  finalText: `Private content ${entryId}`,
  people: [],
  tags: ["family"],
  isHidden: false,
});

describe("AI access selection", () => {
  it("uses the authenticated request UID and rejects a missing UID", () => {
    expect(getAuthenticatedViewerUid({ uid: "firebase-user" })).toBe("firebase-user");
    expect(() => getAuthenticatedViewerUid({})).toThrow("Authenticated UID is required.");
  });

  it("calls policy evaluation for every non-owner candidate and excludes failures", async () => {
    const evaluate = jest.fn(async (request: { entryId: string; requestedAccess: string }) => {
      if (request.entryId === "denied") {
        return { allowed: false, reason: "denied" };
      }
      if (request.entryId === "failure") {
        throw new Error("policy failure");
      }
      return {
        allowed: request.requestedAccess === "summary",
        reason: "test",
      };
    });

    const selected = await selectPermittedEntries(
      "viewer",
      "owner",
      [candidate("allowed"), candidate("denied"), candidate("failure")],
      evaluate,
      new CitationService().formatEntryCitation.bind(new CitationService()),
    );

    expect(selected).toHaveLength(1);
    expect(selected[0]).toMatchObject({
      entryId: "allowed",
      accessLevel: "summary",
      title: "Title allowed",
      summary: "Summary allowed",
    });
    expect(selected[0].content).toBeUndefined();
    expect(evaluate).toHaveBeenCalledTimes(6);
  });

  it("projects full access with content", async () => {
    const selected = await selectPermittedEntries(
      "viewer",
      "owner",
      [candidate("full")],
      async (request) => ({ allowed: request.requestedAccess === "full", reason: "test" }),
      (entry, level) => new CitationService().formatEntryCitation(entry, level),
    );

    expect(selected[0]).toMatchObject({
      accessLevel: "full",
      title: "Title full",
      summary: "Summary full",
      content: "Private content full",
    });
  });

  it("projects existence access with minimal metadata only", async () => {
    const selected = await selectPermittedEntries(
      "viewer",
      "owner",
      [candidate("existence")],
      async (request) => ({ allowed: request.requestedAccess === "existence", reason: "test" }),
      (entry, level) => new CitationService().formatEntryCitation(entry, level),
    );

    expect(selected[0]).toEqual({
      entryId: "existence",
      entryDate: "2026-11-26",
      accessLevel: "existence",
      citation: "[Entry existence]",
    });
  });

  it("bypasses policy evaluation for owner candidates", async () => {
    const evaluate = jest.fn();
    const selected = await selectPermittedEntries(
      "owner",
      "owner",
      [candidate("owner-entry")],
      evaluate as any,
      (entry, level) => new CitationService().formatEntryCitation(entry, level),
    );

    expect(evaluate).not.toHaveBeenCalled();
    expect(selected[0].accessLevel).toBe("full");
  });

  it("excludes hidden and unreleased entries from every AI context", async () => {
    const evaluate = jest.fn(async () => ({ allowed: true, reason: "allowed" }));
    const selected = await selectPermittedEntries(
      "owner",
      "owner",
      [
        { ...candidate("hidden"), isHidden: true },
        { ...candidate("future"), releaseDate: "2999-01-01" },
        candidate("visible"),
      ],
      evaluate,
      (entry, level) => new CitationService().formatEntryCitation(entry, level),
    );

    expect(selected.map((entry) => entry.entryId)).toEqual(["visible"]);
    expect(evaluate).not.toHaveBeenCalled();
  });
});

describe("AI citations, prompt privacy, and logging", () => {
  it("formats summary/full and existence citations", () => {
    const citations = new CitationService();
    expect(citations.formatEntryCitation(candidate("one"), "summary"))
      .toBe("[Title one — one]");
    expect(citations.formatEntryCitation(candidate("one"), "existence"))
      .toBe("[Entry one]");
  });

  it("does not put unauthorized fields into the Gemini prompt", () => {
    const prompt = buildGeminiPrompt("Question", [
      {
        entryId: "summary-entry",
        entryDate: "2026-11-26",
        accessLevel: "summary",
        citation: "[Summary — summary-entry]",
        title: "Summary",
        summary: "Visible summary",
      },
      {
        entryId: "existence-entry",
        entryDate: "2026-11-26",
        accessLevel: "existence",
        citation: "[Entry existence-entry]",
      },
    ]);

    expect(prompt).toContain("Visible summary");
    expect(prompt).not.toContain("Private content");
    expect(prompt).not.toContain("Title: undefined");
  });

  it("writes privacy-safe logging fields without prompts or diary data", () => {
    const log = buildAiUseLogDocument({
      authenticatedUserUid: "viewer",
      requestTimestamp: new Date("2026-11-26T00:00:00.000Z"),
      promptCategory: "family",
      promptLength: 12,
      promptHash: hashPrompt("private prompt"),
      tokenUsage: {
        promptTokenCount: 10,
        candidatesTokenCount: 20,
        totalTokenCount: 30,
      },
      selectedEntryIds: ["entry-1"],
      accessLevels: { "entry-1": "summary" },
      modelName: GEMINI_MODEL_ID,
      responseStatus: "success",
      latencyMs: 50,
    });

    expect(log).toMatchObject({
      authenticatedUserUid: "viewer",
      promptCategory: "family",
      promptLength: 12,
      selectedEntryIds: ["entry-1"],
      accessLevels: { "entry-1": "summary" },
      modelName: GEMINI_MODEL_ID,
      responseStatus: "success",
      latencyMs: 50,
      error: null,
      promptHash: hashPrompt("private prompt"),
      tokenUsage: {
        promptTokens: 10,
        candidatesTokens: 20,
        totalTokens: 30,
      },
    });
    expect(log).not.toHaveProperty("prompt");
    expect(log).not.toHaveProperty("response");
    expect(log).not.toHaveProperty("content");
    expect(log).not.toHaveProperty("summary");
    expect(log).not.toHaveProperty("title");
    expect(log).not.toHaveProperty("authToken");
    expect(log).not.toHaveProperty("apiKey");
    expect(log).not.toHaveProperty("oauthToken");
  });

  it("stores a SHA-256 prompt hash without storing the raw prompt", () => {
    const rawPrompt = "What did I write about family?";
    const log = buildAiUseLogDocument({
      authenticatedUserUid: "viewer",
      requestTimestamp: new Date(),
      promptCategory: "general",
      promptLength: rawPrompt.length,
      promptHash: hashPrompt(rawPrompt),
      selectedEntryIds: [],
      accessLevels: {},
      modelName: GEMINI_MODEL_ID,
      responseStatus: "denied",
      latencyMs: 1,
    });

    expect(log.promptHash).toBe(hashPrompt(rawPrompt));
    expect(log.promptHash).not.toBe(rawPrompt);
    expect(log).not.toHaveProperty("prompt");
  });

  it("stores token usage when available and null fields when unavailable", () => {
    expect(normalizeTokenUsage({
      promptTokenCount: 1,
      candidatesTokenCount: 2,
      totalTokenCount: 3,
    })).toEqual({
      promptTokens: 1,
      candidatesTokens: 2,
      totalTokens: 3,
    });

    expect(normalizeTokenUsage(undefined)).toEqual({
      promptTokens: null,
      candidatesTokens: null,
      totalTokens: null,
    });
  });

  it("maps unsupported prompt categories to general", () => {
    const log = buildAiUseLogDocument({
      authenticatedUserUid: "viewer",
      requestTimestamp: new Date(),
      promptCategory: "raw user category with sensitive text",
      promptLength: 0,
      promptHash: hashPrompt(""),
      selectedEntryIds: [],
      accessLevels: {},
      modelName: GEMINI_MODEL_ID,
      responseStatus: "denied",
      latencyMs: 1,
    });

    expect(log.promptCategory).toBe("general");
    expect(log.promptCategory).not.toContain("raw user category");
  });
});
