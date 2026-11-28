import { describe, expect, it } from "@jest/globals";
import { compilePolicy } from "../../src/policy/compiler";
import { evaluatePolicy } from "../../src/policy/prolog-evaluator";

const policyText = `
protocol recipient:
  may read full of entries tagged family
  may not read summary of entries tagged private
`;

async function evaluateEntry(entryId: string, tags: string[], access: string) {
  const compiled = compilePolicy(policyText, [{ entryId, tags }]);
  return evaluatePolicy({
    facts: compiled.facts.join("\n"),
    query: `access_allowed(recipient, ${entryId}, ${access}).`,
  });
}

function evaluateFacts(facts: string, level: string) {
  return evaluatePolicy({
    facts,
    query: `access_allowed(recipient, entry_1, ${level}).`,
  });
}

describe("diary policy access integration", () => {
  it("allows a recipient full access and inherited summary access", async () => {
    const full = await evaluateEntry("entry_1", ["family"], "full");
    const summary = await evaluateEntry("entry_1", ["family"], "summary");

    expect(full.allowed).toBe(true);
    expect(summary.allowed).toBe(true);
  });

  it("denies a recipient when the exact access level is denied", async () => {
    const result = await evaluateEntry("entry_2", ["private"], "summary");

    expect(result.allowed).toBe(false);
  });

  it("denies by default when no policy rule matches", async () => {
    const result = await evaluateEntry("entry_3", ["business"], "existence");

    expect(result.allowed).toBe(false);
  });

  it("enforces the deny hierarchy for full, summary, and existence", async () => {
    const fullOnly = await Promise.all([
      evaluateFacts("grant(recipient, entry_1, full).\ndeny(recipient, entry_1, full).", "full"),
      evaluateFacts("grant(recipient, entry_1, full).\ndeny(recipient, entry_1, full).", "summary"),
      evaluateFacts("grant(recipient, entry_1, full).\ndeny(recipient, entry_1, full).", "existence"),
    ]);
    const summaryDeny = await Promise.all([
      evaluateFacts("grant(recipient, entry_1, full).\ndeny(recipient, entry_1, summary).", "full"),
      evaluateFacts("grant(recipient, entry_1, full).\ndeny(recipient, entry_1, summary).", "summary"),
      evaluateFacts("grant(recipient, entry_1, full).\ndeny(recipient, entry_1, summary).", "existence"),
    ]);
    const existenceDeny = await Promise.all([
      evaluateFacts("grant(recipient, entry_1, full).\ndeny(recipient, entry_1, existence).", "full"),
      evaluateFacts("grant(recipient, entry_1, full).\ndeny(recipient, entry_1, existence).", "summary"),
      evaluateFacts("grant(recipient, entry_1, full).\ndeny(recipient, entry_1, existence).", "existence"),
    ]);

    expect(fullOnly.map((result) => result.allowed)).toEqual([false, true, true]);
    expect(summaryDeny.map((result) => result.allowed)).toEqual([false, false, true]);
    expect(existenceDeny.map((result) => result.allowed)).toEqual([false, false, false]);
  });

  it("enforces hierarchical grants and deny precedence", async () => {
    const fullGrant = await Promise.all([
      evaluateFacts("grant(recipient, entry_1, full).", "full"),
      evaluateFacts("grant(recipient, entry_1, full).", "summary"),
      evaluateFacts("grant(recipient, entry_1, full).", "existence"),
    ]);
    const summaryGrant = await Promise.all([
      evaluateFacts("grant(recipient, entry_1, summary).", "full"),
      evaluateFacts("grant(recipient, entry_1, summary).", "summary"),
      evaluateFacts("grant(recipient, entry_1, summary).", "existence"),
    ]);
    const existenceGrant = await Promise.all([
      evaluateFacts("grant(recipient, entry_1, existence).", "full"),
      evaluateFacts("grant(recipient, entry_1, existence).", "summary"),
      evaluateFacts("grant(recipient, entry_1, existence).", "existence"),
    ]);
    const conflict = await evaluateFacts(
      "grant(recipient, entry_1, full).\ndeny(recipient, entry_1, summary).",
      "full",
    );

    expect(fullGrant.map((result) => result.allowed)).toEqual([true, true, true]);
    expect(summaryGrant.map((result) => result.allowed)).toEqual([false, true, true]);
    expect(existenceGrant.map((result) => result.allowed)).toEqual([false, false, true]);
    expect(conflict.allowed).toBe(false);
  });
});
