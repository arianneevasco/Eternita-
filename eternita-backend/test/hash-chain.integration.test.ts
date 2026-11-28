import { UnauthorizedException, ValidationPipe } from "@nestjs/common";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, jest } from "@jest/globals";

const emulatorAvailable = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
jest.setTimeout(30_000);

(emulatorAvailable ? describe : describe.skip)("Firestore diary hash-chain integration", () => {
  let app: INestApplication;
  let getDb: typeof import("../src/config/firebase").getDb;
  let DiaryService: typeof import("../src/diary/diary.service").DiaryService;

  const unique = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  function entryBody(isDraft = true) {
    return {
      title: "Hash entry",
      originalText: "Chain content",
      journal: "diary",
      entryDate: "2026-11-27",
      entryTime: "12:00",
      mood: 4,
      people: [],
      tags: ["family"],
      isDraft,
      writingMode: "verbatim",
    };
  }

  beforeAll(async () => {
    jest.unstable_mockModule("../src/auth/auth.guard", () => ({
      AuthGuard: class TestAuthGuard {
        canActivate(context: any) {
          const req = context.switchToHttp().getRequest();
          const authenticatedUid = req.headers["x-test-uid"];
          if (typeof authenticatedUid !== "string" || !authenticatedUid) throw new UnauthorizedException();
          req.uid = authenticatedUid;
          return true;
        }
      },
    }));
    jest.unstable_mockModule("../src/auth/firebase-auth.service", () => ({ FirebaseAuthService: class TestFirebaseAuthService {} }));

    const { AppModule } = await import("../src/app.module");
    const config = await import("../src/config/firebase");
    const legacy = await import("../src/legacy/legacy.service");
    const death = await import("../src/legacy/death-verification.service");
    const gemini = await import("../src/ai/gemini.service");
    const diary = await import("../src/diary/diary.service");
    getDb = config.getDb;
    DiaryService = diary.DiaryService;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(legacy.LegacyService).useFactory({ factory: () => new legacy.LegacyService(getDb()) })
      .overrideProvider(death.DeathVerificationService).useFactory({ factory: () => new death.DeathVerificationService(getDb()) })
      .overrideProvider(gemini.GeminiService).useValue({ answerQuestion: async () => ({ answer: "[Hash entry — hash]", modelName: "test-model" }) })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => { if (app) await app.close(); });

  it("publishes the first and subsequent entries with valid sequence and links", async () => {
    const ownerUid = unique("owner");
    const first = await request(app.getHttpServer()).post("/entries").set("x-test-uid", ownerUid).send(entryBody()).expect(201);
    const second = await request(app.getHttpServer()).post("/entries").set("x-test-uid", ownerUid).send(entryBody()).expect(201);
    const firstPublished = await request(app.getHttpServer()).post(`/entries/${first.body.entryId}/publish`).set("x-test-uid", ownerUid).expect(201);
    const secondPublished = await request(app.getHttpServer()).post(`/entries/${second.body.entryId}/publish`).set("x-test-uid", ownerUid).expect(201);

    expect(firstPublished.body.sequence).toBe(1);
    expect(firstPublished.body.previousHash).toBe("GENESIS");
    expect(secondPublished.body.sequence).toBe(2);
    expect(secondPublished.body.previousHash).toBe(firstPublished.body.entryHash);
    expect((await app.get(DiaryService).verifyChain(ownerUid)).isValid).toBe(true);
  });

  it("detects tampering, missing links, and reordered entries", async () => {
    const ownerUid = unique("owner");
    const first = await request(app.getHttpServer()).post("/entries").set("x-test-uid", ownerUid).send(entryBody()).expect(201);
    const second = await request(app.getHttpServer()).post("/entries").set("x-test-uid", ownerUid).send(entryBody()).expect(201);
    await request(app.getHttpServer()).post(`/entries/${first.body.entryId}/publish`).set("x-test-uid", ownerUid).expect(201);
    await request(app.getHttpServer()).post(`/entries/${second.body.entryId}/publish`).set("x-test-uid", ownerUid).expect(201);

    const db = getDb();
    const entries = db.collection("users").doc(ownerUid).collection("entries");
    await entries.doc(first.body.entryId).update({ finalText: "tampered" });
    expect((await app.get(DiaryService).verifyChain(ownerUid)).isValid).toBe(false);

    await entries.doc(first.body.entryId).update({ finalText: "Chain content", previousHash: "broken" });
    expect((await app.get(DiaryService).verifyChain(ownerUid)).isValid).toBe(false);

    const secondSnapshot = await entries.doc(second.body.entryId).get();
    await entries.doc(first.body.entryId).update({ sequence: 2 });
    await entries.doc(second.body.entryId).update({ sequence: 1, previousHash: "GENESIS" });
    expect((await app.get(DiaryService).verifyChain(ownerUid)).isValid).toBe(false);
    void secondSnapshot;
  });

  it("rejects published edits and serializes concurrent draft publication", async () => {
    const ownerUid = unique("owner");
    const first = await request(app.getHttpServer()).post("/entries").set("x-test-uid", ownerUid).send(entryBody()).expect(201);
    const second = await request(app.getHttpServer()).post("/entries").set("x-test-uid", ownerUid).send(entryBody()).expect(201);
    await request(app.getHttpServer()).post(`/entries/${first.body.entryId}/publish`).set("x-test-uid", ownerUid).expect(201);
    await request(app.getHttpServer()).patch(`/entries/${first.body.entryId}`).set("x-test-uid", ownerUid).send({ originalText: "changed" }).expect(409);

    const [publishedFirst, publishedSecond] = await Promise.all([
      request(app.getHttpServer()).post(`/entries/${second.body.entryId}/publish`).set("x-test-uid", ownerUid),
      request(app.getHttpServer()).post(`/entries/${second.body.entryId}/publish`).set("x-test-uid", ownerUid),
    ]);
    expect([publishedFirst.status, publishedSecond.status].some((status) => status === 201)).toBe(true);
    expect((await app.get(DiaryService).verifyChain(ownerUid)).isValid).toBe(true);
  });

  it("keeps owner diary access and existing recipient/AI gates intact", async () => {
    const ownerUid = unique("owner");
    const recipientUid = "recipient";
    await getDb().collection("users").doc(ownerUid).set({ uid: ownerUid, role: "owner", deceased: false });
    const entry = await request(app.getHttpServer()).post("/entries").set("x-test-uid", ownerUid).send(entryBody()).expect(201);
    const ownerRead = await request(app.getHttpServer()).get(`/entries/${entry.body.entryId}`).set("x-test-uid", ownerUid).expect(200);
    expect(ownerRead.body.accessGranted).toBe(true);
    const recipientRead = await request(app.getHttpServer()).get(`/entries/${entry.body.entryId}`).query({ ownerUid }).set("x-test-uid", recipientUid).expect(200);
    expect(recipientRead.body.accessGranted).toBe(false);
    const ai = await request(app.getHttpServer()).post("/ai/ask").set("x-test-uid", recipientUid).send({ ownerUid, question: "question" }).expect(201);
    expect(ai.body.status).toBe("denied");
  });
});
