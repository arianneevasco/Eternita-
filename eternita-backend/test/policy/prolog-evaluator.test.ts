import { describe, expect, it } from "@jest/globals";
import { evaluatePolicy } from "../../src/policy/prolog-evaluator";

describe("Prolog evaluator", () => {
  const facts = `
    person(ana).
    person(maria).

    entry(entry_1).
    entry_owner(entry_1, maria).

    protocol(ana).

    grant(ana, entry_1, summary).
  `;

  it("returns allowed: true for a valid grant", async () => {
    const result = await evaluatePolicy({
      facts,
      query: "access_allowed(ana, entry_1, summary).",
    });

    expect(result.allowed).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("returns allowed: false for a missing grant", async () => {
    const result = await evaluatePolicy({
      facts,
      query: "access_allowed(stranger, entry_1, full).",
    });

    expect(result.allowed).toBe(false);
  });

  it("returns allowed: false when Prolog facts are invalid", async () => {
    const result = await evaluatePolicy({
      facts: "this is not valid prolog :::",
      query: "access_allowed(ana, entry_1, summary).",
    });

    expect(result.allowed).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("returns allowed: false when the query is invalid", async () => {
    const result = await evaluatePolicy({
      facts,
      query: "this_is_not_a_valid_query(",
    });

    expect(result.allowed).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("deny full blocks full only", async () => {
    const full = await evaluatePolicy({
      facts: "grant(ana, entry_1, full).\ndeny(ana, entry_1, full).",
      query: "access_allowed(ana, entry_1, full).",
    });
    const summary = await evaluatePolicy({
      facts: "grant(ana, entry_1, full).\ndeny(ana, entry_1, full).",
      query: "access_allowed(ana, entry_1, summary).",
    });
    const existence = await evaluatePolicy({
      facts: "grant(ana, entry_1, full).\ndeny(ana, entry_1, full).",
      query: "access_allowed(ana, entry_1, existence).",
    });

    expect(full.allowed).toBe(false);
    expect(summary.allowed).toBe(true);
    expect(existence.allowed).toBe(true);
  });

  it("deny summary blocks summary and full but not existence", async () => {
    const full = await evaluatePolicy({
      facts: "grant(ana, entry_1, full).\ndeny(ana, entry_1, summary).",
      query: "access_allowed(ana, entry_1, full).",
    });
    const summary = await evaluatePolicy({
      facts: "grant(ana, entry_1, full).\ndeny(ana, entry_1, summary).",
      query: "access_allowed(ana, entry_1, summary).",
    });
    const existence = await evaluatePolicy({
      facts: "grant(ana, entry_1, full).\ndeny(ana, entry_1, summary).",
      query: "access_allowed(ana, entry_1, existence).",
    });

    expect(full.allowed).toBe(false);
    expect(summary.allowed).toBe(false);
    expect(existence.allowed).toBe(true);
  });

  it("deny existence blocks existence, summary, and full", async () => {
    const results = await Promise.all([
      evaluatePolicy({
        facts: "grant(ana, entry_1, full).\ndeny(ana, entry_1, existence).",
        query: "access_allowed(ana, entry_1, existence).",
      }),
      evaluatePolicy({
        facts: "grant(ana, entry_1, full).\ndeny(ana, entry_1, existence).",
        query: "access_allowed(ana, entry_1, summary).",
      }),
      evaluatePolicy({
        facts: "grant(ana, entry_1, full).\ndeny(ana, entry_1, existence).",
        query: "access_allowed(ana, entry_1, full).",
      }),
    ]);

    expect(results.every((result) => !result.allowed)).toBe(true);
  });

  it("deny beats allow at every affected level", async () => {
    const result = await evaluatePolicy({
      facts: "grant(ana, entry_1, full).\ndeny(ana, entry_1, summary).",
      query: "access_allowed(ana, entry_1, full).",
    });

    expect(result.allowed).toBe(false);
  });

  it("full grant allows full, summary, and existence", async () => {
    const results = await Promise.all([
      evaluatePolicy({ facts: "grant(ana, entry_1, full).", query: "access_allowed(ana, entry_1, full)." }),
      evaluatePolicy({ facts: "grant(ana, entry_1, full).", query: "access_allowed(ana, entry_1, summary)." }),
      evaluatePolicy({ facts: "grant(ana, entry_1, full).", query: "access_allowed(ana, entry_1, existence)." }),
    ]);

    expect(results.every((result) => result.allowed)).toBe(true);
  });

  it("summary grant allows summary and existence but not full", async () => {
    const summary = await evaluatePolicy({
      facts: "grant(ana, entry_1, summary).",
      query: "access_allowed(ana, entry_1, summary).",
    });
    const existence = await evaluatePolicy({
      facts: "grant(ana, entry_1, summary).",
      query: "access_allowed(ana, entry_1, existence).",
    });
    const full = await evaluatePolicy({
      facts: "grant(ana, entry_1, summary).",
      query: "access_allowed(ana, entry_1, full).",
    });

    expect(summary.allowed).toBe(true);
    expect(existence.allowed).toBe(true);
    expect(full.allowed).toBe(false);
  });

  it("existence grant allows existence only", async () => {
    const existence = await evaluatePolicy({
      facts: "grant(ana, entry_1, existence).",
      query: "access_allowed(ana, entry_1, existence).",
    });
    const summary = await evaluatePolicy({
      facts: "grant(ana, entry_1, existence).",
      query: "access_allowed(ana, entry_1, summary).",
    });
    const full = await evaluatePolicy({
      facts: "grant(ana, entry_1, existence).",
      query: "access_allowed(ana, entry_1, full).",
    });

    expect(existence.allowed).toBe(true);
    expect(summary.allowed).toBe(false);
    expect(full.allowed).toBe(false);
  });
});
