import { createHash } from "crypto";

export const GENESIS_HASH = "0".repeat(64);

/**
 * @deprecated The Firestore diary path uses calculateEntryHash from
 * entry-hash.ts as the canonical production implementation. This legacy
 * helper remains only for compatibility with older callers.
 */
export class HashChainService {
  createHash(
    previousHash: string,
    entryId: string,
    originalText: string,
    version: number
  ): string {
    const text = `${previousHash}${entryId}${originalText}${version}`;

    return createHash("sha256").update(text, "utf8").digest("hex");
  }
}
