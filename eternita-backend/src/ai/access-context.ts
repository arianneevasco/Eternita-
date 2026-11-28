import type { AccessLevel, AccessRequest, AccessDecision } from "../policy/policy-evaluation.service";
import { isReleaseDateReached } from "../diary/release-date";

export interface CandidateEntry {
  entryId: string;
  ownerUid?: string;
  entryDate?: string;
  releaseDate?: string;
  isHidden?: boolean;
  title?: string;
  summary?: string;
  finalText?: string;
  originalText?: string;
  people?: string[];
  tags?: string[];
}

export interface PermittedEntry {
  entryId: string;
  entryDate?: string;
  accessLevel: AccessLevel;
  citation: string;
  title?: string;
  summary?: string;
  content?: string;
}

type EvaluateAccess = (request: AccessRequest) => Promise<AccessDecision>;

export function getAuthenticatedViewerUid(request: { uid?: unknown }): string {
  if (typeof request.uid !== "string" || request.uid.length === 0) {
    throw new Error("Authenticated UID is required.");
  }

  return request.uid;
}

export async function selectPermittedEntries(
  requesterUid: string,
  ownerUid: string,
  candidates: CandidateEntry[],
  evaluateAccess: EvaluateAccess,
  formatCitation: (entry: CandidateEntry, accessLevel: AccessLevel) => string,
  allowFrozenPolicy = false,
): Promise<PermittedEntry[]> {
  const permitted: PermittedEntry[] = [];

  for (const entry of candidates) {
    if (entry.isHidden || !isReleaseDateReached(entry.releaseDate)) {
      continue;
    }

    let accessLevel: AccessLevel | undefined;
    let evaluationFailed = false;

    if (requesterUid === ownerUid) {
      accessLevel = "full";
    } else {
      for (const requestedAccess of ["full", "summary", "existence"] as const) {
        try {
          const decision = await evaluateAccess({
            requesterUid,
            ownerUid,
            entryId: entry.entryId,
            requestedAccess,
            releaseDate: entry.releaseDate,
            entry: {
              entryId: entry.entryId,
              title: entry.title,
              people: entry.people,
              tags: entry.tags,
            },
            allowFrozenPolicy,
          });

          if (decision.reason === "Access could not be evaluated.") {
            evaluationFailed = true;
            break;
          }

          if (decision.allowed) {
            accessLevel = requestedAccess;
            break;
          }
        } catch {
          accessLevel = undefined;
          break;
        }
      }
    }

    if (!accessLevel || evaluationFailed) {
      continue;
    }

    const base = {
      entryId: entry.entryId,
      entryDate: entry.entryDate,
      accessLevel,
      citation: formatCitation(entry, accessLevel),
    };

    if (accessLevel === "existence") {
      permitted.push(base);
    } else if (accessLevel === "summary") {
      permitted.push({
        ...base,
        title: entry.title,
        summary: entry.summary,
      });
    } else {
      permitted.push({
        ...base,
        title: entry.title,
        summary: entry.summary,
        content: entry.finalText ?? entry.originalText,
      });
    }
  }

  return permitted;
}
