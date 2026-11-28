import type { DiffChange } from "./types.ts";

function buildLcsTable(
  originalWords: readonly string[],
  correctedWords: readonly string[]
): number[][] {
  const table: number[][] = Array.from(
    { length: originalWords.length + 1 },
    () => new Array<number>(correctedWords.length + 1).fill(0)
  );

  for (let i = originalWords.length - 1; i >= 0; i -= 1) {
    for (let j = correctedWords.length - 1; j >= 0; j -= 1) {
      if (originalWords[i] === correctedWords[j]) {
        table[i][j] = table[i + 1][j + 1] + 1;
      } else {
        table[i][j] = Math.max(table[i + 1][j], table[i][j + 1]);
      }
    }
  }

  return table;
}

export function createTextDiff(
  originalText: string,
  correctedText: string
): readonly DiffChange[] {
  if (typeof originalText !== "string" || typeof correctedText !== "string") {
    throw new TypeError("Original and corrected text must be strings.");
  }

  const originalWords = originalText.split(/\s+/).filter(Boolean);
  const correctedWords = correctedText.split(/\s+/).filter(Boolean);
  const table = buildLcsTable(originalWords, correctedWords);

  const changes: DiffChange[] = [];
  let i = 0;
  let j = 0;

  while (i < originalWords.length && j < correctedWords.length) {
    if (originalWords[i] === correctedWords[j]) {
      changes.push({ type: "unchanged", value: originalWords[i] });
      i += 1;
      j += 1;
    } else if (
      i + 1 < originalWords.length &&
      originalWords[i] + originalWords[i + 1] === correctedWords[j]
    ) {
      changes.push({ type: "removed", value: originalWords[i + 1] });
      changes.push({ type: "added", value: correctedWords[j] });
      i += 2;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      changes.push({ type: "removed", value: originalWords[i] });
      i += 1;
    } else {
      changes.push({ type: "added", value: correctedWords[j] });
      j += 1;
    }
  }

  while (i < originalWords.length) {
    changes.push({ type: "removed", value: originalWords[i] });
    i += 1;
  }

  while (j < correctedWords.length) {
    changes.push({ type: "added", value: correctedWords[j] });
    j += 1;
  }

  return Object.freeze(changes.map((change) => Object.freeze(change)));
}
