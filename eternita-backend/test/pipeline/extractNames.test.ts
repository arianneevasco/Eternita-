import { extractNames } from "../../src/pipeline/extractNames";
import { describe, expect, test } from "@jest/globals";

describe("extractNames", () => {
  test("extracts capitalized names", () => {
    expect(extractNames("Maria visited Baguio.")).toEqual([
      "Baguio",
      "Maria"
    ]);
  });

  test("does not repeat the same name", () => {
    expect(extractNames("Maria met Maria.")).toEqual(["Maria"]);
  });

  test("returns an empty array for empty text", () => {
    expect(extractNames("")).toEqual([]);
  });

  test("returns an empty array when there are no names", () => {
    expect(extractNames("the cat is sleeping")).toEqual([]);
  });

  test("throws an error for non-string input", () => {
    expect(() => extractNames(null as unknown as string)).toThrow(TypeError);
  });
});
