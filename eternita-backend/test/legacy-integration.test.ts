import { UnauthorizedException, ValidationPipe } from "@nestjs/common";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, jest } from "@jest/globals";

const emulatorAvailable = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

jest.setTimeout(30_000);

(emulatorAvailable ? describe : describe.skip)("legacy lifecycle HTTP integration", () => {
  let app: INestApplication;
  let getDb: typeof import("../src/config/firebase").getDb;

  const unique = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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
    const config = await import("../src/config/firebase");
    const { LegacyService } = await import("../src/legacy/legacy.service");
    const { GeminiService } = await import("../src/ai/gemini.service");
    getDb = config.getDb;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(LegacyService)
      .useFactory({ factory: () => new LegacyService(getDb()) })
      .overrideProvider(GeminiService)
      .useValue({
        answerQuestion: async () => ({ answer: "test", modelName: "test-model" }),
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    await app.listen(0);
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  function createRequest(ownerUid: string, requesterUid: string) {
    return request(app.getHttpServer())
      .post("/legacy/request")
      .set("x-test-uid", requesterUid)
      .send({ ownerUid });
  }

  async function storedRequest(ownerUid: string, requestId: string) {
    return getDb()
      .collection("users")
      .doc(ownerUid)
      .collection("legacyRequests")
      .doc(requestId)
      .get();
  }

  it("creates, approves, activates, and revokes a request over HTTP", async () => {
    const ownerUid = unique("owner");
    const requesterUid = unique("requester");
    const created = await createRequest(ownerUid, requesterUid).expect(201);
    expect(created.body).toMatchObject({ status: "pending", decision: null });

    const approved = await request(app.getHttpServer())
      .post(`/legacy/requests/${created.body.requestId}/approve`)
      .set("x-test-uid", ownerUid)
      .expect(201);
    expect(approved.body.status).toBe("approved");

    const activated = await request(app.getHttpServer())
      .post(`/legacy/requests/${created.body.requestId}/activate`)
      .set("x-test-uid", ownerUid)
      .expect(201);
    expect(activated.body.status).toBe("active");

    const revoked = await request(app.getHttpServer())
      .post(`/legacy/requests/${created.body.requestId}/revoke`)
      .set("x-test-uid", ownerUid)
      .expect(201);
    expect(revoked.body.status).toBe("revoked");

    expect((await storedRequest(ownerUid, created.body.requestId)).data()).toMatchObject({
      ownerUid,
      requesterUid,
      status: "revoked",
      decision: "approved",
      decisionByUid: ownerUid,
    });
  });

  it("allows the owner to deny a pending request", async () => {
    const ownerUid = unique("owner");
    const requesterUid = unique("requester");
    const created = await createRequest(ownerUid, requesterUid).expect(201);

    const denied = await request(app.getHttpServer())
      .post(`/legacy/requests/${created.body.requestId}/deny`)
      .set("x-test-uid", ownerUid)
      .expect(201);

    expect(denied.body.status).toBe("denied");
    expect(denied.body.decision).toBe("denied");
  });

  it("allows the requester to cancel a pending request", async () => {
    const ownerUid = unique("owner");
    const requesterUid = unique("requester");
    const created = await createRequest(ownerUid, requesterUid).expect(201);

    const cancelled = await request(app.getHttpServer())
      .post(`/legacy/requests/${created.body.requestId}/cancel`)
      .set("x-test-uid", requesterUid)
      .expect(201);

    expect(cancelled.body.status).toBe("cancelled");
  });

  it("rejects invalid transitions with conflict responses", async () => {
    const ownerUid = unique("owner");
    const requesterUid = unique("requester");
    const created = await createRequest(ownerUid, requesterUid).expect(201);

    await request(app.getHttpServer())
      .post(`/legacy/requests/${created.body.requestId}/activate`)
      .set("x-test-uid", ownerUid)
      .expect(409);

    await request(app.getHttpServer())
      .post(`/legacy/requests/${created.body.requestId}/approve`)
      .set("x-test-uid", ownerUid)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/legacy/requests/${created.body.requestId}/cancel`)
      .set("x-test-uid", requesterUid)
      .expect(409);

    await request(app.getHttpServer())
      .post(`/legacy/requests/${created.body.requestId}/approve`)
      .set("x-test-uid", ownerUid)
      .expect(409);
  });

  it("rejects unauthenticated and unauthorized lifecycle actors", async () => {
    const ownerUid = unique("owner");
    const requesterUid = unique("requester");
    const intruderUid = unique("intruder");
    const created = await createRequest(ownerUid, requesterUid).expect(201);

    await request(app.getHttpServer())
      .post("/legacy/request")
      .send({ ownerUid })
      .expect(401);

    await request(app.getHttpServer())
      .post(`/legacy/requests/${created.body.requestId}/approve`)
      .set("x-test-uid", requesterUid)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/legacy/requests/${created.body.requestId}/deny`)
      .set("x-test-uid", intruderUid)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/legacy/requests/${created.body.requestId}/cancel`)
      .set("x-test-uid", ownerUid)
      .expect(403);
  });
});
