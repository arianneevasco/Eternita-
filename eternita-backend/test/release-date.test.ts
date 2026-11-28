import { describe, expect, it } from "@jest/globals";
import { isReleaseDateReached } from "../src/diary/release-date";

describe("isReleaseDateReached", () => {
  it("blocks a future release date", () => {
    expect(isReleaseDateReached("2999-01-01")).toBe(false);
  });

  it("allows a past release date", () => {
    expect(isReleaseDateReached("2000-01-01")).toBe(true);
  });

  it("allows an entry without a release date", () => {
    expect(isReleaseDateReached(undefined)).toBe(true);
  });
});
