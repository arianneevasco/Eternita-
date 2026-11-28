import { createTextDiff } from "../../src/pipeline/createTextDiff";
import { describe, expect, test } from "@jest/globals";

describe("createTextDiff", () => {
  test("shows no changes when texts are the same", () => {
    expect(
      createTextDiff("Maria visited Baguio.", "Maria visited Baguio.")
    ).toEqual([
      { type: "unchanged", value: "Maria" },
      { type: "unchanged", value: "visited" },
      { type: "unchanged", value: "Baguio." }
    ]);
  });

  test("shows removed and added words", () => {
    expect(
      createTextDiff("Maria visited Baguio .", "Maria visited Baguio.")
    ).toEqual([
      { type: "unchanged", value: "Maria" },
      { type: "unchanged", value: "visited" },
      { type: "removed", value: "." },
      { type: "added", value: "Baguio." }
    ]);
  });

  test("handles empty original text", () => {
    expect(createTextDiff("", "Maria visited.")).toEqual([
      { type: "added", value: "Maria" },
      { type: "added", value: "visited." }
    ]);
  });

  test("handles empty corrected text", () => {
    expect(createTextDiff("Maria visited.", "")).toEqual([
      { type: "removed", value: "Maria" },
      { type: "removed", value: "visited." }
    ]);
  });

  test("throws an error for invalid input", () => {
    expect(() =>
      createTextDiff(null as unknown as string, "text")
    ).toThrow(TypeError);
  });
});
