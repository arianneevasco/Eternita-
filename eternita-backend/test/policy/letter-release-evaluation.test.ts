import { describe, expect, it } from "@jest/globals";
import { compilePolicy, getLetterReleaseId } from "../../src/policy/compiler";
import { evaluateLetterRelease } from "../../src/policy/letter-release";
import { evaluatePolicy } from "../../src/policy/prolog-evaluator";

const requesterUid = "beneficiary-uid_123";
const title = "Future letter";
const releases = [{ id: getLetterReleaseId(title), to: "maria", title, date: "2040-05-01" }];
const identityMap = { maria: requesterUid };

describe("scheduled letter policy", () => {
  it("denies access before the release date", () => {
    expect(evaluateLetterRelease(releases, title, requesterUid, identityMap, "2040-04-30"))
      .toEqual({ kind: "denied", reason: "Letter is not available yet." });
  });

  it.each(["2040-05-01", "2040-05-02"])("releases on or after the release date (%s)", (today) => {
    expect(evaluateLetterRelease(releases, title, requesterUid, identityMap, today))
      .toEqual({ kind: "released" });
  });

  it("does not disclose a scheduled letter to a different person", () => {
    expect(evaluateLetterRelease(releases, title, "another-beneficiary", identityMap, "2040-05-02"))
      .toEqual({ kind: "denied", reason: "Letter is not available to this person." });
  });

  it("does not apply a release rule to a different letter", () => {
    expect(evaluateLetterRelease(releases, "Other letter", requesterUid, identityMap, "2040-05-02"))
      .toEqual({ kind: "not-scheduled" });
  });

  it("keeps a matching deny effective against the released-letter grant", async () => {
    const compiled = compilePolicy(
      "protocol maria:\n  may not read summary of entries tagged family\n  release letter Future letter to maria when date 2040-05-01",
      [{ entryId: "future_letter", tags: ["family"] }],
      identityMap,
    );
    const decision = evaluateLetterRelease(releases, title, requesterUid, identityMap, "2040-05-01");
    expect(decision.kind).toBe("released");
    const facts = [
      ...compiled.facts,
      `grant('${requesterUid}',future_letter,full).`,
    ].join("\n");
    const result = await evaluatePolicy({
      facts,
      query: `access_allowed('${requesterUid}', future_letter, full).`,
    });
    expect(result.allowed).toBe(false);
  });
});
