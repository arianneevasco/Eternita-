import { getLetterReleaseId } from "./compiler";

export interface ScheduledLetterRelease {
  id: string;
  to: string;
  title: string;
  date: string;
}

export type LetterReleaseDecision =
  | { kind: "not-scheduled" }
  | { kind: "denied"; reason: string }
  | { kind: "released" };

/** Release applies only to its declared recipient, on or after its UTC date. */
export function evaluateLetterRelease(
  releases: ScheduledLetterRelease[],
  title: string | undefined,
  requesterUid: string,
  identityMap: Record<string, string>,
  today = new Date().toISOString().slice(0, 10),
): LetterReleaseDecision {
  if (!title) return { kind: "not-scheduled" };

  const letterId = getLetterReleaseId(title);
  const matchingReleases = releases.filter((release) => release.id === letterId);
  if (matchingReleases.length === 0) return { kind: "not-scheduled" };

  const recipientRelease = matchingReleases.find((release) =>
    (identityMap[release.to] ?? release.to) === requesterUid,
  );
  if (!recipientRelease) {
    return { kind: "denied", reason: "Letter is not available to this person." };
  }
  if (today < recipientRelease.date) {
    return { kind: "denied", reason: "Letter is not available yet." };
  }

  return { kind: "released" };
}
