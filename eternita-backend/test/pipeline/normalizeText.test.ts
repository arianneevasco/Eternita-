import { normalizeText } from "../../src/pipeline/normalizeText";
import { describe, expect, test } from "@jest/globals";

describe("normalizeText", () => {
  test("removes extra spaces and trims text", () => {
    expect(normalizeText("  Maria   visited  Baguio .  ")).toBe(
      "Maria visited Baguio ."
    );
  });

  test("returns an empty string for empty text", () => {
    expect(normalizeText("")).toBe("");
  });

  test("returns an empty string for whitespace-only text", () => {
    expect(normalizeText("   ")).toBe("");
  });

  test("throws an error for non-string input", () => {
    expect(() => normalizeText(123 as unknown as string)).toThrow(TypeError);
  });
});
