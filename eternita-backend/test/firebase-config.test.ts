import { describe, expect, it, jest } from "@jest/globals";

const applicationDefault = jest.fn(() => ({ kind: "adc" }));
const cert = jest.fn((value: unknown) => ({ kind: "service-account", value }));
const getApp = jest.fn(() => ({ name: "existing" }));
const getApps = jest.fn(() => [] as unknown[]);
const initializeApp = jest.fn(() => ({ name: "new" }));
const getFirestore = jest.fn(() => ({ kind: "firestore" }));

jest.mock("firebase-admin/app", () => ({
  applicationDefault,
  cert,
  getApp,
  getApps,
  initializeApp,
}));
jest.mock("firebase-admin/firestore", () => ({ getFirestore }));

import {
  FirebaseConfigurationError,
  initializeFirebase,
  resolveFirebaseOptions,
} from "../src/config/firebase";

describe("Firebase configuration", () => {
  it("uses an explicitly configured service account", () => {
    const options = resolveFirebaseOptions(
      { FIREBASE_KEY_PATH: "firebase/serviceAccountKey.json" },
      {
        existsSync: () => true,
        readFileSync: (() => JSON.stringify({
          project_id: "eternita-local",
          client_email: "firebase@example.test",
          private_key: "private-key",
        })) as any,
      },
    );

    expect(cert).toHaveBeenCalledWith(expect.objectContaining({ project_id: "eternita-local" }));
    expect(options.credential).toEqual(expect.objectContaining({ kind: "service-account" }));
  });

  it("uses Application Default Credentials and the explicit project ID", () => {
    const options = resolveFirebaseOptions({ FIREBASE_PROJECT_ID: "eternita-prod" });

    expect(applicationDefault).toHaveBeenCalled();
    expect(options).toEqual({
      credential: { kind: "adc" },
      projectId: "eternita-prod",
    });
  });

  it("reports missing and invalid service-account configuration clearly", () => {
    expect(() => resolveFirebaseOptions(
      { FIREBASE_KEY_PATH: "missing.json" },
      { existsSync: () => false, readFileSync: (() => "") as any },
    )).toThrow(FirebaseConfigurationError);

    expect(() => resolveFirebaseOptions(
      { FIREBASE_KEY_PATH: "invalid.json" },
      { existsSync: () => true, readFileSync: (() => "{}") as any },
    )).toThrow(/Invalid Firebase service-account key/);
  });

  it("keeps emulator configuration compatible with ADC and project selection", () => {
    const options = resolveFirebaseOptions({
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
      FIREBASE_PROJECT_ID: "demo-no-project",
    });

    expect(options.projectId).toBe("demo-no-project");
    expect(applicationDefault).toHaveBeenCalled();
  });

  it("reuses an existing Firebase app instead of initializing a duplicate", () => {
    getApps.mockReturnValueOnce([{ name: "existing" }]);

    expect(initializeFirebase()).toEqual({ kind: "firestore" });
    expect(getApp).toHaveBeenCalled();
    expect(initializeApp).not.toHaveBeenCalled();
    expect(getFirestore as any).toHaveBeenCalledWith({ name: "existing" });
  });
});
