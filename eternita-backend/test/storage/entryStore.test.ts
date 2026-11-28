import { EntryStore } from "../../src/storage/entryStore";
import { TamperDetected } from "../../src/storage/types";
import type { StoredEntry } from "../../src/storage/types";
import { describe, expect, test } from "@jest/globals";

describe("EntryStore", () => {
  test("appends entries and creates a valid hash chain", () => {
    const store = new EntryStore();

    store.appendEntry({
      id: "entry-1",
      title: "Family Trip",
      originalText: "Maria visited Baguio.",
      correctedText: "Maria visited Baguio."
    });

    store.appendEntry({
      id: "entry-2",
      title: "Birthday Memories",
      originalText: "We celebrated Ana's birthday.",
      correctedText: "We celebrated Ana's birthday."
    });

    const result = store.verify();

    expect(result.isValid).toBe(true);
    expect(result.brokenAtSequence).toBeNull();
    expect(result.reason).toBeNull();
  });

  test("links each entry to the previous hash", () => {
    const store = new EntryStore();

    const first = store.appendEntry({
      id: "entry-1",
      title: "First Entry",
      originalText: "First entry text.",
      correctedText: "First entry text."
    });

    const second = store.appendEntry({
      id: "entry-2",
      title: "Second Entry",
      originalText: "Second entry text.",
      correctedText: "Second entry text."
    });

    expect(first.previousHash).toBe("GENESIS");
    expect(second.previousHash).toBe(first.entryHash);
  });

  test("does not provide an edit or delete operation", () => {
    const store = new EntryStore();

    expect((store as unknown as Record<string, unknown>).editEntry).toBeUndefined();
    expect((store as unknown as Record<string, unknown>).deleteEntry).toBeUndefined();
  });

  test("detects a changed entry", () => {
    const store = new EntryStore();

    store.appendEntry({
      id: "entry-1",
      title: "First Entry",
      originalText: "Original text.",
      correctedText: "Original text."
    });

    const entries = (store as unknown as { entries: StoredEntry[] }).entries;
    entries[0].originalText = "Changed text.";

    const result = store.verify();

    expect(result.isValid).toBe(false);
    expect(result.brokenAtSequence).toBe(1);
    expect(result.reason).toContain("Tampered entry detected");
  });

  test("detects a removed entry from the chain", () => {
    const store = new EntryStore();

    store.appendEntry({
      id: "entry-1",
      title: "First Entry",
      originalText: "First entry.",
      correctedText: "First entry."
    });

    store.appendEntry({
      id: "entry-2",
      title: "Second Entry",
      originalText: "Second entry.",
      correctedText: "Second entry."
    });

    const entries = (store as unknown as { entries: StoredEntry[] }).entries;
    entries.splice(0, 1);

    const result = store.verify();

    expect(result.isValid).toBe(false);
    expect(result.brokenAtSequence).toBe(2);
    expect(result.reason).toContain("Removed entry detected");
  });

  test("detects a reordered entry", () => {
    const store = new EntryStore();

    store.appendEntry({
      id: "entry-1",
      title: "First Entry",
      originalText: "First entry.",
      correctedText: "First entry."
    });

    store.appendEntry({
      id: "entry-2",
      title: "Second Entry",
      originalText: "Second entry.",
      correctedText: "Second entry."
    });

    const storeWithEntries = store as unknown as { entries: StoredEntry[] };
    storeWithEntries.entries = [
      storeWithEntries.entries[1],
      storeWithEntries.entries[0]
    ];

    const result = store.verify();

    expect(result.isValid).toBe(false);
    expect(result.brokenAtSequence).toBe(2);
    expect(result.reason).toContain("Broken link");
  });

test("detects removal of the final entry using the checkpoint", () => {
  const store = new EntryStore();

  store.appendEntry({
    id: "entry-1",
    title: "First Entry",
    originalText: "First entry.",
    correctedText: "First entry."
  });

  store.appendEntry({
    id: "entry-2",
    title: "Second Entry",
    originalText: "Second entry.",
    correctedText: "Second entry."
  });

  const entries = (store as unknown as { entries: StoredEntry[] }).entries;
  entries.pop();

  const result = store.verify();

  expect(result.isValid).toBe(false);
  expect(result.brokenAtSequence).toBe(2);
  expect(result.reason).toContain("Removed entry detected");
});

test("raises TamperDetected when an entry is changed", () => {
  const store = new EntryStore();

  store.appendEntry({
    id: "entry-1",
    title: "First Entry",
    originalText: "Original text.",
    correctedText: "Original text."
  });

  const entries = (store as unknown as { entries: StoredEntry[] }).entries;
  entries[0].title = "Changed title";

  expect(() => store.verifyOrThrow()).toThrow(TamperDetected);
  expect(() => store.verifyOrThrow()).toThrow(/entry 1/);
});

test("raises TamperDetected when the final entry is removed", () => {
  const store = new EntryStore();

  store.appendEntry({
    id: "entry-1",
    title: "First Entry",
    originalText: "First entry.",
    correctedText: "First entry."
  });

  store.appendEntry({
    id: "entry-2",
    title: "Second Entry",
    originalText: "Second entry.",
    correctedText: "Second entry."
  });

  const entries = (store as unknown as { entries: StoredEntry[] }).entries;
  entries.pop();

  expect(() => store.verifyOrThrow()).toThrow(TamperDetected);
  expect(() => store.verifyOrThrow()).toThrow(/Removed entry detected/);
});
})
