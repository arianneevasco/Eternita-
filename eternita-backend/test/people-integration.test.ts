import { UnauthorizedException, ValidationPipe } from "@nestjs/common";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, jest } from "@jest/globals";

const emulatorAvailable = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

jest.setTimeout(30_000);

(emulatorAvailable ? describe : describe.skip)("people HTTP integration", () => {
  let app: INestApplication;
  let getDb: typeof import("../src/config/firebase").getDb;

  const unique = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  async function seedEntry(
    ownerUid: string,
    entryId: string,
    overrides: Record<string, unknown> = {},
  ) {
    await getDb().collection("users").doc(ownerUid).set({
      uid: ownerUid,
      role: "owner",
      deceased: false,
    }, { merge: true });
    const entry = {
      entryId,
      ownerUid,
      title: "Visible title",
      summary: "Visible summary",
      originalText: "Private original text",
      finalText: "Private final text",
      people: [],
      tags: ["family"],
      isHidden: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
    await getDb().collection("users").doc(ownerUid).collection("entries").doc(entryId).set(entry);
    return entry;
  }

  async function seedLegacyGrant(ownerUid: string, requesterUid: string, status: string) {
    const request = getDb().collection("users").doc(ownerUid).collection("legacyRequests").doc(unique("request"));
    const now = new Date();
    await request.set({
      requestId: request.id,
      ownerUid,
      requesterUid,
      status,
      decision: status === "denied" ? "denied" : status === "approved" || status === "active" ? "approved" : null,
      decisionByUid: status === "denied" || status === "approved" || status === "active" ? ownerUid : null,
      decisionAt: status === "denied" || status === "approved" || status === "active" ? now : null,
      activatedAt: status === "active" ? now : null,
      revokedAt: status === "revoked" ? now : null,
      createdAt: now,
      updatedAt: now,
      requestedAt: now,
    });
    return request.id;
  }

  async function seedPolicy(ownerUid: string, status = "active", policyText = `
protocol recipient:
  may read full of entries tagged family
  may not read full of entries tagged private
`) {
    const policy = getDb().collection("users").doc(ownerUid).collection("policies").doc(unique("policy"));
    const now = new Date();
    await policy.set({
      policyId: policy.id,
      ownerUid,
      policyText,
      compiledFacts: [],
      compiledPolicy: {},
      version: 1,
      status,
      createdAt: now,
      updatedAt: now,
    });
    return policy.id;
  }

  async function readEntry(
    requesterUid: string,
    ownerUid: string,
    entryId: string,
    access = "full",
  ) {
    return request(app.getHttpServer())
      .get(`/entries/${entryId}`)
      .query({ ownerUid, access })
      .set("x-test-uid", requesterUid);
  }

  beforeAll(async () => {
    jest.unstable_mockModule("../src/auth/auth.guard", () => ({
      AuthGuard: class TestAuthGuard {
        canActivate(context: any) {
          const req = context.switchToHttp().getRequest();
          const uid = req.headers["x-test-uid"];
          if (typeof uid !== "string" || !uid) throw new UnauthorizedException();
          req.uid = uid;
          return true;
        }
      },
    }));
    jest.unstable_mockModule("../src/auth/firebase-auth.service", () => ({
      FirebaseAuthService: class TestFirebaseAuthService {},
    }));

    const { AppModule } = await import("../src/app.module");
    const configModule = await import("../src/config/firebase");
    const { LegacyService } = await import("../src/legacy/legacy.service");
    getDb = configModule.getDb;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(LegacyService)
      .useFactory({ factory: () => new LegacyService(getDb()) })
      .overrideProvider((await import("../src/ai/gemini.service")).GeminiService)
      .useValue({
        answerQuestion: async () => ({
          answer: "The permitted entry says so. [Visible title — visible]",
          modelName: "test-model",
          tokenUsage: undefined,
        }),
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it("redeems an invitation exactly once and returns only safe people fields", async () => {
    const ownerUid = `owner-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const recipientUid = `recipient-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const inviteResponse = await request(app.getHttpServer())
      .post("/invites")
      .set("x-test-uid", ownerUid)
      .send({ handle: "recipient", name: "Recipient" })
      .expect(201);

    const joined = await request(app.getHttpServer())
      .post("/auth/join")
      .set("x-test-uid", recipientUid)
      .send({ code: inviteResponse.body.code, name: "Recipient Name" })
      .expect(201);

    expect(joined.body).toMatchObject({ uid: recipientUid, role: "recipient", ownerUid });

    const duplicate = await request(app.getHttpServer())
      .post("/auth/join")
      .set("x-test-uid", `recipient-duplicate-${Date.now()}`)
      .send({ code: inviteResponse.body.code, name: "Other" })
      .expect(201);
    expect(duplicate.body).toEqual({ error: "Invalid or already used invitation code" });

    const people = await request(app.getHttpServer())
      .get("/people")
      .set("x-test-uid", ownerUid)
      .expect(200);
    expect(people.body.people[0]).toEqual({
      uid: recipientUid,
      role: "recipient",
      ownerUid,
      name: "Recipient Name",
      handle: "recipient",
    });
    expect(people.body.people[0]).not.toHaveProperty("settings");
    expect(people.body.people[0]).not.toHaveProperty("deceased");

    const db = getDb();
    const inviteSnapshot = await db.collection("invites").doc(inviteResponse.body.inviteId).get();
    expect(inviteSnapshot.data()).toMatchObject({ status: "used", usedByUid: recipientUid });
  });

  it("rejects expired invitations and concurrent redemption leaves one used invite", async () => {
    const db = getDb();
    const expiredCode = `EXPIRED-${Date.now()}`;
    await db.collection("invites").add({
      ownerUid: `owner-expired-${Date.now()}`,
      code: expiredCode,
      handle: "expired",
      name: "Expired",
      status: "pending",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() - 1000),
    });

    const expired = await request(app.getHttpServer())
      .post("/auth/join")
      .set("x-test-uid", `expired-user-${Date.now()}`)
      .send({ code: expiredCode, name: "Expired" })
      .expect(201);
    expect(expired.body).toEqual({ error: "Invitation expired" });

    const code = `RACE-${Date.now()}`;
    await db.collection("invites").add({
      ownerUid: `owner-race-${Date.now()}`,
      code,
      handle: "race",
      name: "Race",
      status: "pending",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    const [first, second] = await Promise.all([
      request(app.getHttpServer()).post("/auth/join").set("x-test-uid", `race-a-${Date.now()}`).send({ code, name: "A" }),
      request(app.getHttpServer()).post("/auth/join").set("x-test-uid", `race-b-${Date.now()}`).send({ code, name: "B" }),
    ]);

    expect([first.body.error, second.body.error].filter(Boolean)).toHaveLength(1);
  });

  it.each([
    ["denied", "denied"],
    ["pending", "pending"],
    ["cancelled", "cancelled"],
    ["revoked", "revoked"],
  ])("rejects a %s recipient before policy evaluation", async (_label, status) => {
    const ownerUid = unique("owner");
    const requesterUid = "recipient";
    const entryId = unique("entry");
    await seedEntry(ownerUid, entryId);
    await seedLegacyGrant(ownerUid, requesterUid, status);

    const response = await readEntry(requesterUid, ownerUid, entryId);

    expect(response.status).toBe(200);
    expect(response.body.accessGranted).toBe(false);
    expect(response.body).not.toHaveProperty("content");
  });

  it("rejects unauthenticated and cross-owner diary reads", async () => {
    const ownerUid = unique("owner");
    const otherOwnerUid = unique("other-owner");
    const entryId = unique("entry");
    await seedEntry(ownerUid, entryId);

    await request(app.getHttpServer())
      .get(`/entries/${entryId}`)
      .query({ ownerUid })
      .expect(401);

    const response = await readEntry("recipient", ownerUid, entryId);
    expect(response.body.accessGranted).toBe(false);

    const otherEntry = await seedEntry(otherOwnerUid, unique("other-entry"));
    const otherResponse = await readEntry("recipient", otherOwnerUid, otherEntry.entryId);
    expect(otherResponse.body.accessGranted).toBe(false);
  });

  it("enforces hidden and release-date visibility", async () => {
    const ownerUid = unique("owner");
    const requesterUid = "recipient";
    await seedLegacyGrant(ownerUid, requesterUid, "active");
    await seedPolicy(ownerUid);

    const hidden = await seedEntry(ownerUid, unique("hidden"), { isHidden: true });
    const future = await seedEntry(ownerUid, unique("future"), { releaseDate: "2999-01-01" });
    const released = await seedEntry(ownerUid, unique("released"), { releaseDate: "2000-01-01" });

    expect((await readEntry(requesterUid, ownerUid, hidden.entryId)).body.accessGranted).toBe(false);
    expect((await readEntry(requesterUid, ownerUid, future.entryId)).body.accessGranted).toBe(false);
    expect((await readEntry(requesterUid, ownerUid, released.entryId)).body.accessGranted).toBe(true);
  });

  it("returns only the requested existence, summary, or full access projection", async () => {
    const ownerUid = unique("owner");
    const requesterUid = "recipient";
    await seedLegacyGrant(ownerUid, requesterUid, "active");
    await seedPolicy(ownerUid, "active", `
protocol recipient:
  may read full of entries tagged family
`);
    const entry = await seedEntry(ownerUid, unique("projection"));

    const existence = await readEntry(requesterUid, ownerUid, entry.entryId, "existence");
    expect(existence.body).toEqual({ accessGranted: true, exists: true });

    const summary = await readEntry(requesterUid, ownerUid, entry.entryId, "summary");
    expect(summary.body).toEqual({ accessGranted: true, summary: "Visible summary" });

    const full = await readEntry(requesterUid, ownerUid, entry.entryId, "full");
    expect(full.body).toMatchObject({
      accessGranted: true,
      title: "Visible title",
      content: "Private final text",
    });
  });

  it("enforces deny precedence over an allow policy", async () => {
    const ownerUid = unique("owner");
    const requesterUid = "recipient";
    await seedLegacyGrant(ownerUid, requesterUid, "active");
    await seedPolicy(ownerUid);
    const entry = await seedEntry(ownerUid, unique("private"), { tags: ["private"] });

    const response = await readEntry(requesterUid, ownerUid, entry.entryId, "full");
    expect(response.body.accessGranted).toBe(false);
  });

  it("denies access when the policy is frozen and restricts the freeze route to the owner", async () => {
    const ownerUid = unique("owner");
    const requesterUid = "recipient";
    await seedLegacyGrant(ownerUid, requesterUid, "active");
    const policyId = await seedPolicy(ownerUid);
    const entry = await seedEntry(ownerUid, unique("frozen"));

    await request(app.getHttpServer())
      .post(`/policies/${policyId}/freeze`)
      .set("x-test-uid", requesterUid)
      .expect(404);

    await request(app.getHttpServer())
      .post(`/policies/${policyId}/freeze`)
      .set("x-test-uid", ownerUid)
      .expect(201);

    const response = await readEntry(requesterUid, ownerUid, entry.entryId);
    expect(response.body.accessGranted).toBe(false);
  });

  it("denies AI access when the recipient policy is frozen", async () => {
    const ownerUid = unique("owner");
    const requesterUid = "recipient";
    await seedLegacyGrant(ownerUid, requesterUid, "active");
    const policyId = await seedPolicy(ownerUid, "active", `
protocol recipient:
  may read full of entries tagged family
`);
    await seedEntry(ownerUid, unique("frozen-ai"));

    await request(app.getHttpServer())
      .post(`/policies/${policyId}/freeze`)
      .set("x-test-uid", ownerUid)
      .expect(201);

    const response = await request(app.getHttpServer())
      .post("/ai/ask")
      .set("x-test-uid", requesterUid)
      .send({ ownerUid, question: "What is in the diary?" })
      .expect(201);

    expect(response.body.status).toBe("denied");
    expect(response.body.error.code).toBe("NO_PERMITTED_ENTRIES");
    expect(response.body.selectedEntryIds).toEqual([]);
  });

  it("uses the same active-grant and policy gate for AI access", async () => {
    const ownerUid = unique("owner");
    const requesterUid = "recipient";
    const entry = await seedEntry(ownerUid, unique("ai"));
    await seedPolicy(ownerUid, "active", `
protocol recipient:
  may read full of entries tagged family
`);

    const withoutGrant = await request(app.getHttpServer())
      .post("/ai/ask")
      .set("x-test-uid", requesterUid)
      .send({ ownerUid, question: "What is in the diary?" })
      .expect(201);
    expect(withoutGrant.body.status).toBe("denied");
    expect(withoutGrant.body.error.code).toBe("NO_ACTIVE_LEGACY_GRANT");

    await seedLegacyGrant(ownerUid, requesterUid, "active");
    const allowed = await request(app.getHttpServer())
      .post("/ai/ask")
      .set("x-test-uid", requesterUid)
      .send({ ownerUid, question: "What is in the diary?" })
      .expect(201);
    expect(allowed.body.status).toBe("success");
    expect(allowed.body.selectedEntryIds).toContain(entry.entryId);

    const hidden = await seedEntry(ownerUid, unique("ai-hidden"), { isHidden: true });
    const future = await seedEntry(ownerUid, unique("ai-future"), { releaseDate: "2999-01-01" });
    const filtered = await request(app.getHttpServer())
      .post("/ai/ask")
      .set("x-test-uid", requesterUid)
      .send({ ownerUid, question: "What is in the diary?" })
      .expect(201);
    expect(filtered.body.selectedEntryIds).not.toContain(hidden.entryId);
    expect(filtered.body.selectedEntryIds).not.toContain(future.entryId);
  });

  it("maps a symbolic policy protocol to a realistic hyphenated Firebase UID for diary and AI access", async () => {
    const ownerUid = unique("owner");
    const requesterUid = "beneficiary-user-123_ABC";
    await getDb().collection("users").doc(requesterUid).set({
      uid: requesterUid,
      role: "recipient",
      ownerUid,
      handle: "beneficiary",
    });
    await seedLegacyGrant(ownerUid, requesterUid, "active");
    const entry = await seedEntry(ownerUid, unique("mapped"));
    await request(app.getHttpServer())
      .post("/policies")
      .set("x-test-uid", ownerUid)
      .send({ policyText: "protocol beneficiary:\n  may read full of entries tagged family" })
      .expect(201);

    const diary = await readEntry(requesterUid, ownerUid, entry.entryId, "full");
    expect(diary.body.accessGranted).toBe(true);

    const ai = await request(app.getHttpServer())
      .post("/ai/ask")
      .set("x-test-uid", requesterUid)
      .send({ ownerUid, question: "What is in the family entry?" })
      .expect(201);
    expect(ai.body.status).toBe("success");
    expect(ai.body.selectedEntryIds).toContain(entry.entryId);
  });

  it.each([
    [{ question: "question" }, "missing ownerUid"],
    [{ ownerUid: "owner" }, "missing question"],
    [{ ownerUid: "", question: "question" }, "empty ownerUid"],
    [{ ownerUid: "owner", question: "" }, "empty question"],
    [{ ownerUid: 123, question: "question" }, "invalid ownerUid type"],
    [{ ownerUid: "owner", question: 123 }, "invalid question type"],
    [{ ownerUid: "owner", question: "question", unexpected: true }, "unexpected field"],
  ])("rejects malformed AI request: %s", async (body, _caseName) => {
    await request(app.getHttpServer())
      .post("/ai/ask")
      .set("x-test-uid", "recipient")
      .send(body)
      .expect(400);
  });

  it("rejects unknown owner targets before grant or entry access", async () => {
    await request(app.getHttpServer())
      .post("/ai/ask")
      .set("x-test-uid", "recipient")
      .send({ ownerUid: unique("missing-owner"), question: "question" })
      .expect(404);
  });

  it("rejects unauthenticated AI requests", async () => {
    await request(app.getHttpServer())
      .post("/ai/ask")
      .send({ ownerUid: unique("owner"), question: "question" })
      .expect(401);
  });

  it.each([
    ["denied", "denied"],
    ["pending", "pending"],
    ["cancelled", "cancelled"],
    ["revoked", "revoked"],
  ])("rejects a %s recipient before AI context loading", async (_label, status) => {
    const ownerUid = unique("owner");
    const requesterUid = "recipient";
    await seedEntry(ownerUid, unique("ai-denied"));
    await seedPolicy(ownerUid);
    await seedLegacyGrant(ownerUid, requesterUid, status);

    const response = await request(app.getHttpServer())
      .post("/ai/ask")
      .set("x-test-uid", requesterUid)
      .send({ ownerUid, question: "question" })
      .expect(201);
    expect(response.body.status).toBe("denied");
    expect(response.body.error.code).toBe("NO_ACTIVE_LEGACY_GRANT");
  });

  it.each([
    ["existence", "exists", "Private final text"],
    ["summary", "summary", "Private final text"],
    ["full", "content", undefined],
  ])("uses the policy access level %s without overexposing content", async (accessLevel, responseField, forbiddenContent) => {
    const ownerUid = unique("owner");
    const requesterUid = "recipient";
    await seedLegacyGrant(ownerUid, requesterUid, "active");
    await seedPolicy(ownerUid, "active", `
protocol recipient:
  may read ${accessLevel} of entries tagged family
`);
    const entry = await seedEntry(ownerUid, unique("ai-access"));

    const response = await request(app.getHttpServer())
      .post("/ai/ask")
      .set("x-test-uid", requesterUid)
      .send({ ownerUid, question: "question" })
      .expect(201);
    expect(response.body.status).toBe("success");
    expect(response.body.accessLevels[entry.entryId]).toBe(accessLevel);
    expect(response.body.answer).toBeDefined();
    expect(response.body).not.toHaveProperty(responseField);
    if (forbiddenContent) expect(response.body.answer).not.toContain(forbiddenContent);
  });

  it("keeps hidden and future entries out of AI context and preserves the 50-entry source limit", async () => {
    const ownerUid = unique("owner");
    const requesterUid = "recipient";
    await seedLegacyGrant(ownerUid, requesterUid, "active");
    await seedPolicy(ownerUid);
    for (let index = 0; index < 51; index += 1) {
      await seedEntry(ownerUid, `ai-${index}`, index === 0
        ? { isHidden: true }
        : index === 1
          ? { releaseDate: "2999-01-01" }
          : {});
    }

    const response = await request(app.getHttpServer())
      .post("/ai/ask")
      .set("x-test-uid", requesterUid)
      .send({ ownerUid, question: "question" })
      .expect(201);
    expect(response.body.status).toBe("success");
    expect(response.body.selectedEntryIds).toHaveLength(20);
    expect(response.body.selectedEntryIds).not.toContain("ai-0");
    expect(response.body.selectedEntryIds).not.toContain("ai-1");
  });

  it("loads no more than 50 raw entries from Firestore for an AI request", async () => {
    const ownerUid = unique("owner");
    const requesterUid = "recipient";
    await seedLegacyGrant(ownerUid, requesterUid, "active");
    await seedPolicy(ownerUid);
    for (let index = 0; index < 75; index += 1) {
      await seedEntry(ownerUid, `raw-limit-${index}`);
    }

    const { AiController } = await import("../src/ai/ai.controller");
    const controller = app.get(AiController) as AiController & {
      getEntries(ownerUid: string): Promise<unknown[]>;
    };
    const rawEntries = await controller.getEntries(ownerUid);

    expect(rawEntries).toHaveLength(50);
  });
});
