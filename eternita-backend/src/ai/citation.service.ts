import type { AccessLevel } from "../policy/policy-evaluation.service";
import type { CandidateEntry, PermittedEntry } from "./access-context";

export class CitationService {
  formatEntryCitation(entry: CandidateEntry, accessLevel: AccessLevel): string {
    if (accessLevel === "existence") {
      return `[Entry ${entry.entryId}]`;
    }

    return `[${entry.title ?? "Untitled Entry"} — ${entry.entryId}]`;
  }

  ensureCitations(answer: string, entries: PermittedEntry[]): string {
    const citations = entries.map((entry) => entry.citation);
    const missing = citations.filter((citation) => !answer.includes(citation));

    if (missing.length === 0) {
      return answer;
    }

    return `${answer}\n\nSources: ${missing.join(" ")}`;
  }
}
