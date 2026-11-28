import { createEntry, processEntry } from "../../src/pipeline/processEntry";
import { describe, expect, test } from "@jest/globals";

describe("processEntry", () => {
  test("returns a new processed entry without changing the original", () => {
    const entry = createEntry("entry-1", "  maria   visited  baguio .  ");
    const original = structuredClone(entry);

    const processed = processEntry(entry);

    expect(entry).toEqual(original);
    expect(processed).not.toBe(entry);
    expect(processed.normalizedText).toBe("maria visited baguio .");
    expect(processed.correctedText).toBe("Maria visited baguio.");
  });

  test("produces the same result for the same input", () => {
    const entry = createEntry("entry-1", "Maria visited Baguio.");

    expect(processEntry(entry)).toEqual(processEntry(entry));
  });

  test("handles empty text", () => {
    const entry = createEntry("entry-2", "");

    const processed = processEntry(entry);

    expect(processed.names).toEqual([]);
    expect(processed.topics).toEqual([]);
    expect(processed.correctedText).toBe("");
    expect(processed.diff).toEqual([]);
  });

  test("handles repeated names", () => {
    const entry = createEntry("entry-3", "Maria met Maria.");

    const processed = processEntry(entry);

    expect(processed.names).toEqual(["Maria"]);
  });

  test("throws an error when originalText is missing", () => {
    expect(() =>
      processEntry({ id: "entry-4" } as never)
    ).toThrow(TypeError);
  });
});
