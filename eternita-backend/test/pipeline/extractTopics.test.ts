import { extractTopics } from "../../src/pipeline/extractTopics";
import { describe, expect, test } from "@jest/globals";

describe("extractTopics", () => {
  test("extracts repeated meaningful words", () => {
    expect(
      extractTopics("Maria talked about travel. Travel made Maria happy.")
    ).toEqual(["maria", "travel"]);
  });

  test("returns an empty array for empty text", () => {
    expect(extractTopics("")).toEqual([]);
  });

  test("does not include stopwords", () => {
    expect(extractTopics("the the the")).toEqual([]);
  });

  test("throws an error for non-string input", () => {
    expect(() => extractTopics(undefined as unknown as string)).toThrow(
      TypeError
    );
  });
});
