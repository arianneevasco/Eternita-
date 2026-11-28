import { Entry } from "../src/models/Entry";
import { DiaryEntry } from "../src/models/DiaryEntry";
import { LetterOfWishes } from "../src/models/LetterOfWishes";
import { describe, expect, it } from "@jest/globals";

describe("DiaryEntry", () => {
  it("stores date, text, and tags", () => {
    const entry = new DiaryEntry(
      "diary-1",
      "2026-11-23",
      "Today was a good day.",
      ["personal"]
    );

    expect(entry.date).toBe("2026-11-23");
    expect(entry.text).toBe("Today was a good day.");
    expect(entry.tags).toEqual(["personal"]);
  });

  it("describes and summarizes a diary entry", () => {
    const entry = new DiaryEntry(
      "diary-1",
      "2026-11-23",
      "Today was a good day. I spent time with my family.",
      []
    );

    expect(entry.describe()).toContain("Diary entry from 2026-11-23");
    expect(entry.summarize()).toBe("Today was a good day");
  });

  it("returns false for readability when text is empty", () => {
    const entry = new DiaryEntry("diary-2", "2026-11-23", "   ");

    expect(entry.isReadable()).toBe(false);
  });

  it("prevents duplicate tags", () => {
    const entry = new DiaryEntry(
      "diary-3",
      "2026-11-23",
      "Text",
      ["family"]
    );

    entry.addTag("family");

    expect(entry.tags).toEqual(["family"]);
  });
});

describe("LetterOfWishes", () => {
  it("stores release date and recipient", () => {
    const letter = new LetterOfWishes(
      "letter-1",
      "2026-11-23",
      "Take care of yourself.",
      "2030-01-01",
      "My future self"
    );

    expect(letter.releaseDate).toBe("2030-01-01");
    expect(letter.recipient).toBe("My future self");
  });

  it("describes and summarizes a letter", () => {
    const letter = new LetterOfWishes(
      "letter-1",
      "2026-11-23",
      "Take care of yourself.",
      "2030-01-01",
      "My future self"
    );

    expect(letter.describe()).toContain("My future self");
    expect(letter.describe()).toContain("2030-01-01");
    expect(letter.summarize()).toContain("My future self");
  });

  it("is not readable before its release date", () => {
    const letter = new LetterOfWishes(
      "letter-2",
      "2026-11-23",
      "Future message.",
      "2030-01-01",
      "My future self"
    );

    expect(letter.isReadable()).toBe(false);
  });

  it("throws an error when recipient is empty", () => {
    expect(() => {
      new LetterOfWishes(
        "letter-3",
        "2026-11-23",
        "Future message.",
        "2030-01-01",
        "   "
      );
    }).toThrow("Recipient cannot be empty.");
  });
});

describe("Entry polymorphism", () => {
  it("calls common methods on different entry types without type checks", () => {
    const entries: Entry[] = [
      new DiaryEntry(
        "diary-polymorphic",
        "2026-11-23",
        "A diary entry.",
        ["diary"]
      ),
      new LetterOfWishes(
        "letter-polymorphic",
        "2026-11-23",
        "A letter of wishes.",
        "2030-01-01",
        "My future self",
        ["letter"]
      ),
    ];

    const descriptions = entries.map((entry) => entry.describe());
    const summaries = entries.map((entry) => entry.summarize());
    const readability = entries.map((entry) => entry.isReadable());

    expect(descriptions).toHaveLength(2);
    expect(summaries).toHaveLength(2);
    expect(readability).toEqual([true, false]);
  });
});
