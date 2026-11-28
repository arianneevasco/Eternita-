import { calculateEntryHash } from "./hashChain";
import { TamperDetected } from "./types";
import type {
  ChainCheckpoint,
  ChainVerificationResult,
  StoredEntry
} from "./types.js";

/**
 * @deprecated This in-memory chain is retained for legacy compatibility and
 * tests. Firestore diary persistence uses src/diary/entry-hash.ts.
 */
export class EntryStore {
  private entries: StoredEntry[] = [];
  private previousHash = "GENESIS";
  private checkpoint: ChainCheckpoint = {
    expectedEntryCount: 0,
    expectedLatestHash: "GENESIS"
  };

  appendEntry(input: {
    id: string;
    title: string;
    originalText: string;
    correctedText: string;
  }): StoredEntry {
    const sequence = this.entries.length + 1;

    const entryWithoutHash = {
      id: input.id,
      sequence,
      previousHash: this.previousHash,
      title: input.title,
      originalText: input.originalText,
      correctedText: input.correctedText
    };

    const entryHash = calculateEntryHash(entryWithoutHash);

    const storedEntry: StoredEntry = {
      ...entryWithoutHash,
      entryHash
    };

    this.entries.push(storedEntry);
    this.previousHash = entryHash;

    this.checkpoint = {
      expectedEntryCount: this.entries.length,
      expectedLatestHash: entryHash
    };

    return storedEntry;
  }

  getEntries(): readonly StoredEntry[] {
    return [...this.entries];
  }

  getCheckpoint(): ChainCheckpoint {
    return { ...this.checkpoint };
  }

  verify(): ChainVerificationResult {
    if (this.entries.length !== this.checkpoint.expectedEntryCount) {
      return {
        isValid: false,
        brokenAtSequence: this.checkpoint.expectedEntryCount,
        reason:
          `Removed entry detected: expected ${this.checkpoint.expectedEntryCount} ` +
          `entries, but found ${this.entries.length}.`
      };
    }

    let expectedPreviousHash = "GENESIS";

    for (const entry of this.entries) {
      const recalculatedHash = calculateEntryHash({
        id: entry.id,
        sequence: entry.sequence,
        previousHash: entry.previousHash,
        title: entry.title,
        originalText: entry.originalText,
        correctedText: entry.correctedText
      });

      if (entry.previousHash !== expectedPreviousHash) {
        return {
          isValid: false,
          brokenAtSequence: entry.sequence,
          reason:
            `Broken link at entry ${entry.sequence}: previous hash does not ` +
            `match the expected previous hash.`
        };
      }

      if (entry.entryHash !== recalculatedHash) {
        return {
          isValid: false,
          brokenAtSequence: entry.sequence,
          reason:
            `Tampered entry detected at entry ${entry.sequence}: stored hash ` +
            `does not match recalculated hash.`
        };
      }

      expectedPreviousHash = entry.entryHash;
    }

    const lastEntry = this.entries[this.entries.length - 1];

    if (
      this.entries.length > 0 &&
      lastEntry.entryHash !== this.checkpoint.expectedLatestHash
    ) {
      return {
        isValid: false,
        brokenAtSequence: lastEntry.sequence,
        reason:
          `Tampered entry detected at entry ${lastEntry.sequence}: ` +
          `the latest hash does not match the trusted checkpoint.`
      };
    }

    return {
      isValid: true,
      brokenAtSequence: null,
      reason: null
    };
  }

  verifyOrThrow(): void {
    const result = this.verify();

    if (!result.isValid) {
      throw new TamperDetected(result.reason ?? "Tamper detected.");
    }
  }
}
