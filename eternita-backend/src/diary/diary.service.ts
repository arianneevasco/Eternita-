import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { getDb } from "../config/firebase";
import { PolicyEvaluationService } from "../policy/policy-evaluation.service";
import { CreateEntryDto, EditEntryDto } from "./dto";
import { isReleaseDateReached } from "./release-date";
import { calculateEntryHash } from "./entry-hash";
import { LegacyService } from "../legacy/legacy.service";

@Injectable()
export class DiaryService {
  constructor(
    private readonly policyEvaluation: PolicyEvaluationService,
    private readonly legacyService: LegacyService,
  ) {}

  private get db() {
    return getDb();
  }

  async createEntry(ownerUid: string, dto: CreateEntryDto) {
    const entryReference = this.db
      .collection("users")
      .doc(ownerUid)
      .collection("entries")
      .doc();
    const ownerReference = this.db.collection("users").doc(ownerUid);
    const isDraft = dto.isDraft ?? true;
    const publishedEntries = this.db
      .collection("users")
      .doc(ownerUid)
      .collection("entries")
      .where("isDraft", "==", false)
      .orderBy("publishedAt", "desc")
      .limit(1);

    return this.db.runTransaction(async (transaction) => {
      const now = new Date();
      let previousHash = "GENESIS";
      let sequence: number | undefined;
      let publishedAt: Date | undefined;
      let entryHash = "GENESIS";

      if (!isDraft) {
        const ownerSnapshot = await transaction.get(ownerReference);
        const lastEntriesSnapshot = await transaction.get(publishedEntries);
        const lastEntry = lastEntriesSnapshot.empty
          ? undefined
          : lastEntriesSnapshot.docs[0].data() as Record<string, any>;
        previousHash = lastEntry?.entryHash ?? "GENESIS";
        sequence = (lastEntry?.sequence ?? ownerSnapshot.data()?.lastSeq ?? 0) + 1;
        publishedAt = now;
        entryHash = calculateEntryHash({
          previousHash,
          ownerUid,
          entryId: entryReference.id,
          title: dto.title,
          content: dto.originalText,
          publishedAt,
        });
      }

      const entryData = {
        entryId: entryReference.id,
        ownerUid,
        ...dto,
        isFavorite: false,
        people: dto.people ?? [],
        tags: dto.tags ?? [],
        isDraft,
        finalText: dto.originalText,
        isHidden: false,
        currentVersion: 1,
        previousHash,
        entryHash,
        createdAt: now,
        updatedAt: now,
        ...(publishedAt ? { publishedAt, sequence } : {}),
      };

      transaction.create(entryReference, entryData);
      if (!isDraft && sequence !== undefined) {
        transaction.set(ownerReference, { lastSeq: sequence, lastHash: entryHash }, { merge: true });
      }
      return entryData;
    });
  }

  async listEntries(ownerUid: string) {
    const snapshot = await this.db
      .collection("users")
      .doc(ownerUid)
      .collection("entries")
      .where("isHidden", "==", false)
      .orderBy("createdAt", "desc")
      .get();

    return snapshot.docs.map((document) => ({
      entryId: document.id,
      ...document.data(),
    }));
  }

  async getEntry(ownerUid: string, entryId: string): Promise<Record<string, any> | null> {
    const entrySnapshot = await this.db
      .collection("users")
      .doc(ownerUid)
      .collection("entries")
      .doc(entryId)
      .get();

    if (!entrySnapshot.exists) {
      return null;
    }

    const data = entrySnapshot.data() as Record<string, any>;
    return { entryId: entrySnapshot.id, ...data };
  }

  async editEntry(requesterUid: string, ownerUid: string, entryId: string, dto: EditEntryDto) {
    if (requesterUid !== ownerUid) {
      throw new ForbiddenException("Only the owner can edit an entry.");
    }
    const entryReference = this.db
      .collection("users")
      .doc(ownerUid)
      .collection("entries")
      .doc(entryId);
    const versionReference = this.db
      .collection("users")
      .doc(ownerUid)
      .collection("versions")
      .doc(entryId)
      .collection("versions")
      .doc();

    return this.db.runTransaction(async (transaction) => {
      const entrySnapshot = await transaction.get(entryReference);
      if (!entrySnapshot.exists) {
        throw new NotFoundException("Entry not found.");
      }

      const currentEntry = entrySnapshot.data() as Record<string, any>;
      if (currentEntry.isDraft !== true) {
        throw new ConflictException("Published entries cannot be edited because that would invalidate the hash chain.");
      }

      const nextVersion = (currentEntry.currentVersion ?? 1) + 1;
      const now = new Date();
      transaction.create(versionReference, {
        entryId,
        version: currentEntry.currentVersion ?? 1,
        content: currentEntry.finalText ?? currentEntry.originalText,
        previousHash: currentEntry.previousHash,
        entryHash: currentEntry.entryHash,
        createdAt: now,
      });
      transaction.update(entryReference, {
        ...dto,
        finalText: dto.originalText ?? currentEntry.finalText ?? currentEntry.originalText,
        currentVersion: nextVersion,
        updatedAt: now,
      });

      return { entryId, currentVersion: nextVersion, updatedAt: now };
    });
  }

  async setFavorite(requesterUid: string, ownerUid: string, entryId: string, isFavorite: boolean) {
    if (requesterUid !== ownerUid) {
      throw new ForbiddenException("Only the owner can favorite an entry.");
    }
    const entryReference = this.db
      .collection("users")
      .doc(ownerUid)
      .collection("entries")
      .doc(entryId);
    const entrySnapshot = await entryReference.get();

    if (!entrySnapshot.exists) {
      throw new NotFoundException("Entry not found.");
    }

    await entryReference.update({ isFavorite, updatedAt: new Date() });
    return { entryId, isFavorite };
  }

  async hideEntry(requesterUid: string, ownerUid: string, entryId: string) {
    if (requesterUid !== ownerUid) {
      throw new ForbiddenException("Only the owner can hide an entry.");
    }
    const entryReference = this.db
      .collection("users")
      .doc(ownerUid)
      .collection("entries")
      .doc(entryId);
    const entrySnapshot = await entryReference.get();

    if (!entrySnapshot.exists) {
      throw new NotFoundException("Entry not found.");
    }

    await entryReference.update({ isHidden: true, updatedAt: new Date() });
    return { entryId, isHidden: true };
  }

  async listVersions(ownerUid: string, entryId: string) {
    const snapshot = await this.db
      .collection("users")
      .doc(ownerUid)
      .collection("versions")
      .doc(entryId)
      .collection("versions")
      .orderBy("version", "desc")
      .get();

    return snapshot.docs.map((document) => ({
      versionId: document.id,
      ...document.data(),
    }));
  }

  async publishDraft(requesterUid: string, ownerUid: string, entryId: string) {
    if (requesterUid !== ownerUid) {
      throw new ForbiddenException("Only the owner can publish an entry.");
    }
    const entryReference = this.db
      .collection("users")
      .doc(ownerUid)
      .collection("entries")
      .doc(entryId);
    const ownerReference = this.db.collection("users").doc(ownerUid);
    const publishedEntries = this.db
      .collection("users")
      .doc(ownerUid)
      .collection("entries")
      .where("isDraft", "==", false)
      .orderBy("publishedAt", "desc")
      .limit(1);

    return this.db.runTransaction(async (transaction) => {
      const entrySnapshot = await transaction.get(entryReference);
      const ownerSnapshot = await transaction.get(ownerReference);
      const lastEntriesSnapshot = await transaction.get(publishedEntries);

      if (!entrySnapshot.exists) {
        throw new NotFoundException("Draft not found.");
      }

      const entry = entrySnapshot.data() as Record<string, any>;

      if (entry.ownerUid !== ownerUid || !entry.isDraft) {
        throw new NotFoundException("Draft not found.");
      }

      const lastEntry = lastEntriesSnapshot.empty
        ? undefined
        : lastEntriesSnapshot.docs[0].data() as Record<string, any>;
      const previousHash = lastEntry?.entryHash ?? "GENESIS";
      const sequence = (lastEntry?.sequence ?? ownerSnapshot.data()?.lastSeq ?? 0) + 1;
      const publishedAt = new Date();
      const content = entry.finalText ?? entry.originalText;
      const entryHash = calculateEntryHash({
        previousHash,
        ownerUid,
        entryId,
        title: entry.title,
        content,
        publishedAt,
      });

      transaction.update(entryReference, {
        isDraft: false,
        publishedAt,
        sequence,
        previousHash,
        entryHash,
        updatedAt: publishedAt,
      });
      transaction.set(ownerReference, {
        lastSeq: sequence,
        lastHash: entryHash,
      }, { merge: true });

      return { entryId, previousHash, entryHash, sequence, publishedAt };
    });
  }

  async verifyChain(ownerUid: string) {
    const snapshot = await this.db
      .collection("users")
      .doc(ownerUid)
      .collection("entries")
      .where("isDraft", "==", false)
      .get();
    const entries: Array<Record<string, any>> = snapshot.docs
      .map((document) => ({
        entryId: document.id,
        ...(document.data() as Record<string, any>),
      }))
      .sort((left: Record<string, any>, right: Record<string, any>) =>
        (left.sequence ?? 0) - (right.sequence ?? 0),
      );

    let previousHash = "GENESIS";

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      const expectedSequence = index + 1;

      if (entry.sequence !== expectedSequence) {
        return {
          isValid: false,
          brokenAtEntryId: entry.entryId,
          reason: "Published entry sequence is broken.",
        };
      }

      if (entry.previousHash !== previousHash) {
        return {
          isValid: false,
          brokenAtEntryId: entry.entryId,
          reason: "Published entry previous hash is broken.",
        };
      }

      const publishedAt = asDate(entry.publishedAt);
      if (!publishedAt) {
        return {
          isValid: false,
          brokenAtEntryId: entry.entryId,
          reason: "Published entry has no valid publication date.",
        };
      }

      const expectedHash = calculateEntryHash({
        previousHash,
        ownerUid,
        entryId: entry.entryId,
        title: entry.title,
        content: entry.finalText ?? entry.originalText,
        publishedAt,
      });

      if (entry.entryHash !== expectedHash) {
        return {
          isValid: false,
          brokenAtEntryId: entry.entryId,
          reason: "Published entry hash does not match its content.",
        };
      }

      previousHash = entry.entryHash;
    }

    return { isValid: true, brokenAtEntryId: null, reason: null };
  }

  async getEntryForViewer(
    requesterUid: string,
    ownerUid: string,
    entryId: string,
    requestedAccess: "existence" | "summary" | "full",
  ) {
    const entry = await this.getEntry(ownerUid, entryId);

    if (!entry) {
      return safeRefusal("Entry not available.");
    }

    if (requesterUid !== ownerUid && entry.isHidden) {
      return safeRefusal("Entry not available.");
    }

    let legacyGrant = { active: true, released: false };
    if (requesterUid !== ownerUid) {
      const service = this.legacyService as LegacyService & {
        getLegacyGrantState?: (requesterUid: string, ownerUid: string) => Promise<{ active: boolean; released?: boolean }>;
      };
      legacyGrant = service.getLegacyGrantState
        ? await service.getLegacyGrantState(requesterUid, ownerUid) as { active: boolean; released: boolean }
        : { active: (await this.legacyService.getActiveLegacyGrant(requesterUid, ownerUid)).active, released: false };
      if (!legacyGrant.active) {
        return safeRefusal("Entry not available.");
      }
    }

    if (!isReleaseDateReached(entry.releaseDate)) {
      return safeRefusal("Entry is not available yet.");
    }

    const decision = requesterUid === ownerUid
      ? { allowed: true, reason: "Owner access granted." }
      : await this.policyEvaluation.evaluateAccess({
          requesterUid,
          ownerUid,
          entryId,
          requestedAccess,
          releaseDate: entry.releaseDate,
          entry: {
            entryId,
            title: entry.title,
            people: entry.people,
            tags: entry.tags,
          },
          allowFrozenPolicy: legacyGrant.released === true,
        });

    if (!decision.allowed) {
      return safeRefusal(decision.reason);
    }

    if (requestedAccess === "existence") {
      return {
        accessGranted: true,
        exists: true,
      };
    }

    if (requestedAccess === "summary") {
      return {
        accessGranted: true,
        summary: entry.summary,
      };
    }

    return {
      accessGranted: true,
      title: entry.title,
      content: entry.finalText ?? entry.originalText,
      createdAt: entry.createdAt,
    };
  }
}

function safeRefusal(message: string) {
  return {
    accessGranted: false,
    message,
  };
}

function asDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return value;
  }

  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return value.toDate();
  }

  return null;
}
