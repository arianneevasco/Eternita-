import { createHash } from "crypto";

export function calculateEntryHash(input: {
  previousHash: string;
  ownerUid: string;
  entryId: string;
  title: string;
  content: string;
  publishedAt: Date;
}): string {
  const canonical = JSON.stringify({
    previousHash: input.previousHash,
    ownerUid: input.ownerUid,
    entryId: input.entryId,
    title: input.title,
    content: input.content,
    publishedAt: input.publishedAt.toISOString(),
  });

  return createHash("sha256").update(canonical, "utf8").digest("hex");
}
