import { UnauthorizedException, ValidationPipe } from "@nestjs/common";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, jest } from "@jest/globals";

const emulatorAvailable = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
jest.setTimeout(30_000);

(emulatorAvailable ? describe : describe.skip)("death report HTTP integration", () => {
  let app: INestApplication;
  let getDb: typeof import("../src/config/firebase").getDb;

  const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  async function seedOwner(ownerUid: string) {
    await getDb().collection("users").doc(ownerUid).set({ uid: ownerUid, role: "owner", deceased: false });
  }

  async function seedGrant(ownerUid: string, requesterUid: string, status: string) {
    const reference = getDb().collection("users").doc(ownerUid).collection("legacyRequests").doc(uid("grant"));
    const now = new Date();
    await reference.set({
      requestId: reference.id, ownerUid, requesterUid, status,
      decision: status === "denied" ? "denied" : ["approved", "active", "released"].includes(status) ? "approved" : null,
      decisionByUid: ["denied", "approved", "active", "released"].includes(status) ? ownerUid : null,
      decisionAt: null, activatedAt: status === "active" || status === "released" ? now : null,
      revokedAt: status === "revoked" ? now : null, releasedAt: status === "released" ? now : null,
      createdAt: now, updatedAt: now, requestedAt: now,
    });
    return reference.id;
  }

  async function seedPolicy(ownerUid: string) {
    const reference = getDb().collection("users").doc(ownerUid).collection("policies").doc(uid("policy"));
    const now = new Date();
    await reference.set({
      policyId: reference.id, ownerUid,
      policyText: "protocol recipient:\n  may read full of entries tagged family",
      compiledFacts: [], compiledPolicy: {}, version: 1, status: "active", createdAt: now, updatedAt: now,
    });
    return reference.id;
  }

  async function seedEntry(ownerUid: string, entryId: string, overrides: Record<string, unknown> = {}) {
    await getDb().collection("users").doc(ownerUid).collection("entries").doc(entryId).set({
      entryId, ownerUid, title: "Family entry", summary: "Family summary", originalText: "Private text",
      finalText: "Private text", people: [], tags: ["family"], isHidden: false,
      createdAt: new Date(), updatedAt: new Date(), ...overrides,
    });
  }

  beforeAll(async () => {
    process.env.DEATH_REPORT_CONFIRMATION_DELAY_MINUTES = "0.01";
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
    const { LegacyService } = await import("../src/legacy/legacy.service");
    const { DeathVerificationService } = await import("../src/legacy/death-verification.service");
    const { GeminiService } = await import("../src/ai/gemini.service");
    getDb = config.getDb;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(LegacyService).useFactory({ factory: () => new LegacyService(getDb()) })
      .overrideProvider(DeathVerificationService).useFactory({ factory: () => new DeathVerificationService(getDb()) })
      .overrideProvider(GeminiService).useValue({ answerQuestion: async () => ({ answer: "[Family entry — family]", modelName: "test-model" }) })
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => { if (app) await app.close(); });

  it("allows an eligible beneficiary to submit once and keeps the report pending before the delay", async () => {
    const owner = uid("owner");
    const beneficiary = "recipient";
    await seedOwner(owner);
    await seedGrant(owner, beneficiary, "active");

    const response = await request(app.getHttpServer()).post("/legacy/death-reports")
      .set("x-test-uid", beneficiary).send({ ownerUid: owner }).expect(201);
    expect(response.body.status).toBe("pending");
    const report = await getDb().collection("users").doc(owner).collection("deathReports").doc(response.body.reportId).get();
    expect(report.data()?.status).toBe("pending");
  });

  it("rejects self-report, ineligible beneficiaries, duplicate reports, and unauthenticated requests", async () => {
    const owner = uid("owner");
    const beneficiary = "recipient";
    await seedOwner(owner);
    await seedGrant(owner, beneficiary, "active");

    await request(app.getHttpServer()).post("/legacy/death-reports").set("x-test-uid", owner).send({ ownerUid: owner }).expect(403);
    await request(app.getHttpServer()).post("/legacy/death-reports").set("x-test-uid", uid("stranger")).send({ ownerUid: owner }).expect(403);
    await request(app.getHttpServer()).post("/legacy/death-reports").set("x-test-uid", beneficiary).send({ ownerUid: owner }).expect(201);
    await request(app.getHttpServer()).post("/legacy/death-reports").set("x-test-uid", beneficiary).send({ ownerUid: owner }).expect(409);
    await request(app.getHttpServer()).post("/legacy/death-reports").send({ ownerUid: owner }).expect(401);
  });

  it("confirms after the delay, freezes policies, releases active grants, and preserves blocked grants", async () => {
    const owner = uid("owner");
    const beneficiary = "recipient";
    const denied = uid("denied");
    const pending = uid("pending");
    await seedOwner(owner);
    await seedGrant(owner, beneficiary, "active");
    await seedGrant(owner, denied, "denied");
    await seedGrant(owner, pending, "pending");
    const policyId = await seedPolicy(owner);
    await seedEntry(owner, "visible");
    const report = await request(app.getHttpServer()).post("/legacy/death-reports")
      .set("x-test-uid", beneficiary).send({ ownerUid: owner }).expect(201);

    await new Promise((resolve) => setTimeout(resolve, 1_500));
    const db = getDb();
    const reportSnapshot = await db.collection("users").doc(owner).collection("deathReports").doc(report.body.reportId).get();
    const ownerSnapshot = await db.collection("users").doc(owner).get();
    const policySnapshot = await db.collection("users").doc(owner).collection("policies").doc(policyId).get();
    const grants = await db.collection("users").doc(owner).collection("legacyRequests").get();
    expect(reportSnapshot.data()?.status).toBe("confirmed");
    expect(ownerSnapshot.data()?.deceased).toBe(true);
    expect(policySnapshot.data()?.status).toBe("frozen");
    expect(grants.docs.find((doc) => doc.data().requesterUid === beneficiary)?.data().status).toBe("released");
    expect(grants.docs.find((doc) => doc.data().requesterUid === denied)?.data().status).toBe("denied");
    expect(grants.docs.find((doc) => doc.data().requesterUid === pending)?.data().status).toBe("pending");

    await request(app.getHttpServer()).post("/policies")
      .set("x-test-uid", owner)
      .send({ policyText: "protocol recipient:\n  may read full of entries tagged family" })
      .expect(409);
  });

  it("uses the released grant and frozen policy for diary and AI access", async () => {
    const owner = uid("owner");
    const beneficiary = "recipient";
    await seedOwner(owner);
    await seedGrant(owner, beneficiary, "released");
    await seedPolicy(owner);
    await seedEntry(owner, "visible");
    await seedEntry(owner, "hidden", { isHidden: true });
    await seedEntry(owner, "future", { releaseDate: new Date(Date.now() + 60_000).toISOString() });

    const visible = await request(app.getHttpServer()).get("/entries/visible").query({ ownerUid: owner, access: "full" }).set("x-test-uid", beneficiary).expect(200);
    const hidden = await request(app.getHttpServer()).get("/entries/hidden").query({ ownerUid: owner, access: "full" }).set("x-test-uid", beneficiary).expect(200);
    const future = await request(app.getHttpServer()).get("/entries/future").query({ ownerUid: owner, access: "full" }).set("x-test-uid", beneficiary).expect(200);
    expect(visible.body.accessGranted).toBe(true);
    expect(hidden.body.accessGranted).toBe(false);
    expect(future.body.accessGranted).toBe(false);

    const ai = await request(app.getHttpServer()).post("/ai/ask").set("x-test-uid", beneficiary).send({ ownerUid: owner, question: "What is visible?" }).expect(201);
    expect(ai.body.selectedEntryIds).toEqual(["visible"]);
  });
});
