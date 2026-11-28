import { calculateEntryHash } from "../../src/storage/hashChain";
import { describe, expect, test } from "@jest/globals";

describe("calculateEntryHash", () => {
  test("returns the same hash for the same entry data", () => {
    const entry = {
      id: "entry-1",
      sequence: 1,
      previousHash: "GENESIS",
      title: "Family Trip",
      originalText: "Maria visited Baguio.",
      correctedText: "Maria visited Baguio."
    };

    expect(calculateEntryHash(entry)).toBe(calculateEntryHash(entry));
  });

  test("returns a different hash when the text changes", () => {
    const entry = {
      id: "entry-1",
      sequence: 1,
      previousHash: "GENESIS",
      title: "Family Trip",
      originalText: "Maria visited Baguio.",
      correctedText: "Maria visited Baguio."
    };

    const changedEntry = {
      ...entry,
      originalText: "Maria visited Manila."
    };

    expect(calculateEntryHash(entry)).not.toBe(
      calculateEntryHash(changedEntry)
    );
  });

  test("returns a different hash when the previous hash changes", () => {
    const entry = {
      id: "entry-1",
      sequence: 1,
      previousHash: "GENESIS",
      title: "Family Trip",
      originalText: "Maria visited Baguio.",
      correctedText: "Maria visited Baguio."
    };

    const changedEntry = {
      ...entry,
      previousHash: "different-hash"
    };

    expect(calculateEntryHash(entry)).not.toBe(
      calculateEntryHash(changedEntry)
    );
  });
});
