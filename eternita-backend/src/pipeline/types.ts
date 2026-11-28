export interface DiaryEntry {
    id: string;
    originalText: string;
}

export type DiffChangeType = "unchanged" | "removed" | "added";

export interface DiffChange {
    type: DiffChangeType;
    value: string;
}

export interface ProcessedEntry {
    id: string;
    originalText: string;
    normalizedText: string;
    names: readonly string[];
    topics: readonly string[];
    correctedText: string;
    diff: readonly DiffChange[];
}