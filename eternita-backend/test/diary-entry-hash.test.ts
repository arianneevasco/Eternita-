import { describe, expect, it } from "@jest/globals";
import { calculateEntryHash } from "../src/diary/entry-hash";

const publishedAt = new Date("2040-05-01T00:00:00.000Z");

describe("calculateEntryHash", () => {
  it("creates a deterministic hash for the same published entry", () => {
    const input = {
      previousHash: "GENESIS",
      ownerUid: "owner-1",
      entryId: "entry-1",
      title: "A memory",
      content: "A stored memory.",
      publishedAt,
    };

    expect(calculateEntryHash(input)).toBe(calculateEntryHash(input));
  });

  it("changes when the previous hash or content changes", () => {
    const input = {
      previousHash: "GENESIS",
      ownerUid: "owner-1",
      entryId: "entry-1",
      title: "A memory",
      content: "A stored memory.",
      publishedAt,
    };

    expect(calculateEntryHash(input)).not.toBe(
      calculateEntryHash({ ...input, previousHash: "different" }),
    );
    expect(calculateEntryHash(input)).not.toBe(
      calculateEntryHash({ ...input, content: "Changed memory." }),
    );
  });
});
