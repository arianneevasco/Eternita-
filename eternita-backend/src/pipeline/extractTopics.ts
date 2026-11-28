const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on",
  "at", "for", "with", "is", "was", "were", "she", "he", "they",
  "we", "it", "this", "that", "these", "those", "i", "my", "our"
]);

export function extractTopics(text: string): readonly string[] {
  if (typeof text !== "string") {
    throw new TypeError("Text must be a string.");
  }

  const words = text
    .toLowerCase()
    .match(/[a-z]+(?:'[a-z]+)?/g) ?? [];

  const counts = new Map<string, number>();

  for (const word of words) {
    if (!STOPWORDS.has(word) && word.length > 2) {
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }

  return Object.freeze(
    [...counts.entries()]
      .filter(([, count]) => count > 1)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([topic]) => topic)
  );
}