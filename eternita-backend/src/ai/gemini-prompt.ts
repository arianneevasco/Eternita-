import type { PermittedEntry } from "./access-context";

export function buildGeminiPrompt(question: string, permittedEntries: PermittedEntry[]): string {
  const context = permittedEntries.map((entry) => {
    if (entry.accessLevel === "existence") {
      return `${entry.citation} exists on ${entry.entryDate ?? "an unspecified date"}.`;
    }

    if (entry.accessLevel === "summary") {
      return `${entry.citation}\nTitle: ${entry.title}\nSummary: ${entry.summary}`;
    }

    return `${entry.citation}\nTitle: ${entry.title}\nSummary: ${entry.summary}\nContent: ${entry.content}`;
  }).join("\n");

  return `
Answer only using the entries below.
Do not invent memories, people, dates, or facts.
Do not pretend to be the owner.
If the answer is not in the entries, say you cannot answer.
Cite every factual claim using one of the supplied citations, exactly as formatted.

Entries:
${context}

Question:
${question}
`;
}
