import { compilePolicy, getLetterReleaseId } from "../src/policy/compiler";
import { expect, test } from "@jest/globals";

const policy = `
protocol maria:
  may see existence of entries mentioning maria
  may read summary of entries tagged family
  may read full of entries tagged travel
  may not read summary of entries tagged health
  release letter To my daughter to maria when date 2040-05-01
  transfer custody to juan
  default writing mode verbatim
`;

test("compiles permissions and preserves deny rules", () => {
  const result = compilePolicy(policy, [
    { entryId: "entry_family", tags: ["family"] },
    { entryId: "entry_travel", tags: ["travel"] },
    { entryId: "entry_health", tags: ["health"] },
    { entryId: "entry_maria", people: ["maria"] },
  ]);

  expect(result.facts).toContain(
    "grant(maria,entry_maria,existence)."
  );

  expect(result.facts).toContain(
    "grant(maria,entry_family,summary)."
  );

  expect(result.facts).toContain(
    "grant(maria,entry_travel,full)."
  );

  expect(result.facts).toContain(
    "deny(maria,entry_health,summary)."
  );

  expect(result.defaultMode).toBe("verbatim");
  expect(result.custodyDeclarations).toEqual([
    { to: "juan" },
  ]);
  expect(result.releases).toEqual([
    {
      id: getLetterReleaseId("To my daughter"),
      to: "maria",
      title: "To my daughter",
      date: "2040-05-01",
    },
  ]);
});

test("maps symbolic protocol identities to real Firebase UIDs safely", () => {
  const result = compilePolicy(
    `protocol beneficiary:\n  may read full of entries tagged family`,
    [{ entryId: "entry_family", tags: ["family"] }],
    { beneficiary: "firebase-user-123_ABC" },
  );

  expect(result.facts).toContain(
    "grant('firebase-user-123_ABC',entry_family,full).",
  );
});
