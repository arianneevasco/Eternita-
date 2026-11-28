export interface StoredEntry {
  id: string;
  sequence: number;
  previousHash: string;
  entryHash: string;
  title: string;
  originalText: string;
  correctedText: string;
}

export interface ChainCheckpoint {
  expectedEntryCount: number;
  expectedLatestHash: string;
}

export interface ChainVerificationResult {
  isValid: boolean;
  brokenAtSequence: number | null;
  reason: string | null;
}

export class TamperDetected extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TamperDetected";
  }
}