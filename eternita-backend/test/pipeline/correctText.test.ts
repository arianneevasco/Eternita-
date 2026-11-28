import { correctText } from "../../src/pipeline/correctText";
import { describe, expect, test } from "@jest/globals";

describe("correctText", () => {
  test("fixes spacing before punctuation", () => {
    expect(correctText("Maria visited Baguio .")).toBe(
      "Maria visited Baguio."
    );
  });

  test("capitalizes the first letter and adds a period", () => {
    expect(correctText("maria visited baguio")).toBe(
      "Maria visited baguio."
    );
  });

  test("returns an empty string for empty text", () => {
    expect(correctText("")).toBe("");
  });

  test("throws an error for non-string input", () => {
    expect(() => correctText(42 as unknown as string)).toThrow(TypeError);
  });
});
