import fs from "node:fs";
import path from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

const emulatorAvailable = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

(emulatorAvailable ? describe : describe.skip)("Firestore security rules in emulator", () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: `eternita-rules-${Date.now()}`,
      firestore: {
        rules: fs.readFileSync(path.resolve(__dirname, "../../firestore.rules"), "utf8"),
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it("allows an owner to read own profile and entry but denies writes", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "users/owner"), { role: "owner" });
      await setDoc(doc(context.firestore(), "users/owner/entries/entry"), { ownerUid: "owner" });
    });

    const owner = testEnv.authenticatedContext("owner").firestore();
    await assertSucceeds(getDoc(doc(owner, "users/owner")));
    await assertSucceeds(getDoc(doc(owner, "users/owner/entries/entry")));
    await assertFails(setDoc(doc(owner, "users/owner"), { role: "recipient" }));
    await assertFails(setDoc(doc(owner, "users/owner/entries/new"), { ownerUid: "owner" }));
  });

  it("denies direct recipient reads and all protected collection access", async () => {
    const recipient = testEnv.authenticatedContext("recipient").firestore();
    for (const documentPath of [
      "users/owner/entries/entry",
      "users/owner/policies/policy",
      "users/owner/legacyRequests/request",
      "users/owner/deathReports/report",
      "users/owner/activity/audit",
      "users/recipient/aiUseLogs/log",
      "invites/invite",
      "health/connection",
    ]) {
      await assertFails(getDoc(doc(recipient, documentPath)));
      await assertFails(setDoc(doc(recipient, documentPath), { attempted: true }));
    }
  });

  it("denies a beneficiary whose legacy grant is denied", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "users/owner/entries/entry"), { ownerUid: "owner" });
      await setDoc(doc(context.firestore(), "users/owner/legacyRequests/denied"), {
        ownerUid: "owner",
        requesterUid: "denied-beneficiary",
        status: "denied",
      });
    });

    const deniedBeneficiary = testEnv.authenticatedContext("denied-beneficiary").firestore();
    await assertFails(getDoc(doc(deniedBeneficiary, "users/owner/entries/entry")));
    await assertFails(setDoc(doc(deniedBeneficiary, "users/owner/entries/entry"), { attempted: true }));
    await assertFails(getDoc(doc(deniedBeneficiary, "users/owner")));
  });

  it("denies unauthenticated reads and writes by default", async () => {
    const unauthenticated = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(unauthenticated, "users/owner/entries/entry")));
    await assertFails(setDoc(doc(unauthenticated, "users/owner/entries/entry"), { attempted: true }));
  });

  it("denies direct updates to death, freeze, release, and audit fields", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "users/owner"), { deceased: false });
      await setDoc(doc(context.firestore(), "users/owner/policies/policy"), { frozenAt: null });
      await setDoc(doc(context.firestore(), "users/owner/legacyRequests/request"), { releasedAt: null });
      await setDoc(doc(context.firestore(), "users/owner/activity/audit"), { action: "before" });
    });

    const owner = testEnv.authenticatedContext("owner").firestore();
    await assertFails(updateDoc(doc(owner, "users/owner"), { deceased: true }));
    await assertFails(updateDoc(doc(owner, "users/owner/policies/policy"), { frozenAt: new Date() }));
    await assertFails(updateDoc(doc(owner, "users/owner/legacyRequests/request"), { releasedAt: new Date() }));
    await assertFails(updateDoc(doc(owner, "users/owner/activity/audit"), { action: "tampered" }));
  });
});
