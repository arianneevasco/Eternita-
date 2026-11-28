import { describe, expect, it, jest } from "@jest/globals";
import { Timestamp } from "firebase-admin/firestore";

jest.mock("@nestjs/common", () => {
  const decorator = () => () => undefined;
  class TestException extends Error {}
  return {
    BadRequestException: TestException,
    ConflictException: TestException,
    ForbiddenException: TestException,
    Injectable: decorator,
    NotFoundException: TestException,
    UnauthorizedException: TestException,
    Body: decorator,
    Controller: decorator,
    Get: decorator,
    Param: decorator,
    Post: decorator,
    Req: decorator,
    UseGuards: decorator,
  };
});
jest.mock("../src/auth/auth.guard", () => ({ AuthGuard: class AuthGuard {} }));
import { DiaryService } from "../src/diary/diary.service";
import { LegacyController } from "../src/legacy/legacy.controller";
import { LegacyService, type LegacyRequestDocument } from "../src/legacy/legacy.service";

type StoredDocument = { path: string; data: LegacyRequestDocument };

class FakeReference {
  constructor(private readonly db: FakeFirestore, public readonly path: string) {}

  get id() {
    return this.path.split("/").pop() as string;
  }

  collection(name: string) {
    return new FakeCollection(this.db, `${this.path}/${name}`);
  }
}

class FakeCollection {
  private readonly filters: Array<[string, unknown]> = [];
  private orderedField?: keyof LegacyRequestDocument;
  private descending = false;
  private maximum?: number;

  constructor(private readonly db: FakeFirestore, public readonly path: string) {}

  doc(id = `request-${this.db.nextId++}`) {
    return new FakeReference(this.db, `${this.path}/${id}`);
  }

  where(field: string, _operator: string, value: unknown) {
    this.filters.push([field, value]);
    return this;
  }

  orderBy(field: keyof LegacyRequestDocument, direction: "asc" | "desc" = "asc") {
    this.orderedField = field;
    this.descending = direction === "desc";
    return this;
  }

  limit(value: number) {
    this.maximum = value;
    return this;
  }

  async get() {
    const collectionName = this.path.split("/").pop();
    const groupQuery = this.path.startsWith("collectionGroup:");
    const groupName = groupQuery ? this.path.slice("collectionGroup:".length) : collectionName;
    let documents = [...this.db.documents.values()].filter((document) => {
      const parts = document.path.split("/");
      const matchesCollection = parts[parts.length - 2] === groupName;
      const matchesFilters = this.filters.every(([field, value]) =>
        document.data[field as keyof LegacyRequestDocument] === value,
      );
      return matchesCollection && matchesFilters;
    });

    if (!groupQuery) {
      documents = documents.filter((document) => document.path.slice(0, document.path.lastIndexOf("/")) === this.path);
    }

    if (this.orderedField) {
      const field = this.orderedField;
      documents.sort((left, right) => {
        const leftValue = (left.data[field] as Timestamp).toMillis();
        const rightValue = (right.data[field] as Timestamp).toMillis();
        return this.descending ? rightValue - leftValue : leftValue - rightValue;
      });
    }

    if (this.maximum !== undefined) documents = documents.slice(0, this.maximum);

    return {
      empty: documents.length === 0,
      docs: documents.map((document) => ({
        id: document.path.split("/").pop(),
        ref: new FakeReference(this.db, document.path),
        data: () => document.data,
      })),
    };
  }
}

class FakeTransaction {
  constructor(private readonly db: FakeFirestore) {}

  get(target: FakeCollection) {
    return target.get();
  }

  create(reference: FakeReference, data: LegacyRequestDocument) {
    this.db.documents.set(reference.path, { path: reference.path, data });
  }

  update(reference: FakeReference, changes: Partial<LegacyRequestDocument>) {
    const document = this.db.documents.get(reference.path);
    if (!document) throw new Error("Document does not exist");
    document.data = { ...document.data, ...changes };
  }
}

class FakeFirestore {
  readonly documents = new Map<string, StoredDocument>();
  nextId = 1;

  collection(name: string) {
    return new FakeCollection(this, name);
  }

  collectionGroup(name: string) {
    return new FakeCollection(this, `collectionGroup:${name}`);
  }

  runTransaction<T>(callback: (transaction: FakeTransaction) => Promise<T>) {
    return callback(new FakeTransaction(this));
  }
}

function createHarness() {
  const db = new FakeFirestore();
  const service = new LegacyService(db as any);
  const controller = new LegacyController(service);
  return { db, service, controller };
}

describe("legacy lifecycle", () => {
  it("uses request.uid and supports the complete valid state machine", async () => {
    const { controller } = createHarness();
    const created = await controller.requestAccess({ uid: "requester" }, { ownerUid: "owner" });
    expect(created.status).toBe("pending");

    expect((await controller.approve({ uid: "owner" }, created.requestId)).status).toBe("approved");
    expect((await controller.activate({ uid: "owner" }, created.requestId)).status).toBe("active");
    expect((await controller.revoke({ uid: "owner" }, created.requestId)).status).toBe("revoked");
  });

  it("supports owner denial and requester cancellation", async () => {
    const denied = createHarness();
    const deniedRequest = await denied.controller.requestAccess({ uid: "requester" }, { ownerUid: "owner" });
    expect((await denied.controller.deny({ uid: "owner" }, deniedRequest.requestId)).status).toBe("denied");

    const cancelled = createHarness();
    const cancelledRequest = await cancelled.controller.requestAccess({ uid: "requester" }, { ownerUid: "owner" });
    expect((await cancelled.controller.cancel({ uid: "requester" }, cancelledRequest.requestId)).status).toBe("cancelled");
  });

  it("rejects unauthorized actors and invalid transitions", async () => {
    const { controller } = createHarness();
    const created = await controller.requestAccess({ uid: "requester" }, { ownerUid: "owner" });

    await expect(controller.approve({ uid: "requester" }, created.requestId)).rejects.toThrow("not authorized");
    await expect(controller.deny({ uid: "requester" }, created.requestId)).rejects.toThrow("not authorized");
    await expect(controller.approve({ uid: "intruder" }, created.requestId)).rejects.toThrow("not authorized");
    await expect(controller.deny({ uid: "intruder" }, created.requestId)).rejects.toThrow("not authorized");
    await expect(controller.cancel({ uid: "owner" }, created.requestId)).rejects.toThrow("not authorized");

    await controller.approve({ uid: "owner" }, created.requestId);
    await expect(controller.activate({ uid: "requester" }, created.requestId)).rejects.toThrow("not authorized");
    await expect(controller.activate({ uid: "intruder" }, created.requestId)).rejects.toThrow("not authorized");
    await controller.activate({ uid: "owner" }, created.requestId);
    await expect(controller.revoke({ uid: "requester" }, created.requestId)).rejects.toThrow("not authorized");
    await expect(controller.revoke({ uid: "intruder" }, created.requestId)).rejects.toThrow("not authorized");

    await controller.revoke({ uid: "owner" }, created.requestId);
    await expect(controller.activate({ uid: "owner" }, created.requestId)).rejects.toThrow("Cannot transition");
  });

  it("prevents self-requests and duplicate pending requests", async () => {
    const { controller } = createHarness();
    await expect(controller.requestAccess({ uid: "owner" }, { ownerUid: "owner" })).rejects.toThrow();
    await controller.requestAccess({ uid: "requester" }, { ownerUid: "owner" });
    await expect(controller.requestAccess({ uid: "requester" }, { ownerUid: "owner" })).rejects.toThrow("active or pending");

    const approved = createHarness();
    const approvedRequest = await approved.controller.requestAccess({ uid: "requester" }, { ownerUid: "owner" });
    await approved.controller.approve({ uid: "owner" }, approvedRequest.requestId);
    await expect(approved.controller.requestAccess({ uid: "requester" }, { ownerUid: "owner" })).rejects.toThrow("active or pending");

    const active = createHarness();
    const activeRequest = await active.controller.requestAccess({ uid: "requester" }, { ownerUid: "owner" });
    await active.controller.approve({ uid: "owner" }, activeRequest.requestId);
    await active.controller.activate({ uid: "owner" }, activeRequest.requestId);
    await expect(active.controller.requestAccess({ uid: "requester" }, { ownerUid: "owner" })).rejects.toThrow("active or pending");
  });

  it("returns safe requester status and a safe active-grant result", async () => {
    const { controller, service } = createHarness();
    const request = await controller.requestAccess({ uid: "requester" }, { ownerUid: "owner" });
    const status = await controller.getStatus({ uid: "requester" }, "owner");
    expect(status).toMatchObject({ requestId: request.requestId, status: "pending" });
    expect(status).not.toHaveProperty("requesterUid");
    expect(await service.getActiveLegacyGrant("requester", "owner")).toEqual({ active: false });

    await controller.approve({ uid: "owner" }, request.requestId);
    await controller.activate({ uid: "owner" }, request.requestId);
    expect(await service.getActiveLegacyGrant("requester", "owner")).toEqual({ active: true });
  });

});

describe("legacy diary access gate", () => {
  it("allows owners without a grant and blocks recipients before policy evaluation", async () => {
    const policyEvaluation = { evaluateAccess: jest.fn(async () => ({ allowed: true, reason: "allowed" })) };
    const legacyService = { getActiveLegacyGrant: jest.fn(async () => ({ active: false })) };
    const diary = new DiaryService(policyEvaluation as any, legacyService as any);
    jest.spyOn(diary, "getEntry").mockResolvedValue({
      entryId: "entry-1",
      ownerUid: "owner",
      isHidden: false,
      people: [],
      tags: [],
      title: "Title",
      finalText: "Content",
    });

    const ownerResult = await diary.getEntryForViewer("owner", "owner", "entry-1", "full");
    expect(ownerResult.accessGranted).toBe(true);
    expect(legacyService.getActiveLegacyGrant).not.toHaveBeenCalled();

    const recipientResult = await diary.getEntryForViewer("requester", "owner", "entry-1", "full");
    expect(recipientResult.accessGranted).toBe(false);
    expect(policyEvaluation.evaluateAccess).not.toHaveBeenCalled();
  });

  it("allows a recipient with an active grant to reach policy evaluation", async () => {
    const policyEvaluation = { evaluateAccess: jest.fn(async () => ({ allowed: true, reason: "allowed" })) };
    const legacyService = { getActiveLegacyGrant: jest.fn(async () => ({ active: true })) };
    const diary = new DiaryService(policyEvaluation as any, legacyService as any);
    jest.spyOn(diary, "getEntry").mockResolvedValue({ entryId: "entry-1", isHidden: false, people: [], tags: [], finalText: "Content" });

    expect((await diary.getEntryForViewer("requester", "owner", "entry-1", "full")).accessGranted).toBe(true);
    expect(policyEvaluation.evaluateAccess).toHaveBeenCalled();
  });

  it.each(["pending", "denied", "revoked", "cancelled"] as const)("denies a %s request through the active-grant result", async (status) => {
    const { controller, service } = createHarness();
    const request = await controller.requestAccess({ uid: "requester" }, { ownerUid: "owner" });
    if (status === "denied") await controller.deny({ uid: "owner" }, request.requestId);
    if (status === "cancelled") await controller.cancel({ uid: "requester" }, request.requestId);
    if (status === "revoked") {
      await controller.approve({ uid: "owner" }, request.requestId);
      await controller.activate({ uid: "owner" }, request.requestId);
      await controller.revoke({ uid: "owner" }, request.requestId);
    }
    expect(await service.getActiveLegacyGrant("requester", "owner")).toEqual({ active: false });
  });
});
