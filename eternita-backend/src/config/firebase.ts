import {
  applicationDefault,
  cert,
  getApp,
  getApps,
  initializeApp,
  type App,
  type AppOptions,
} from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import * as fs from "fs";
import * as path from "path";
import "dotenv/config";

export class FirebaseConfigurationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "FirebaseConfigurationError";
  }
}

let db: Firestore | undefined;

export function resolveFirebaseOptions(
  environment: NodeJS.ProcessEnv = process.env,
  fileSystem: Pick<typeof fs, "existsSync" | "readFileSync"> = fs,
): AppOptions {
  const projectId = environment.FIREBASE_PROJECT_ID?.trim() || undefined;
  const keyPathValue = environment.FIREBASE_KEY_PATH?.trim();

  if (!keyPathValue) {
    return {
      credential: applicationDefault(),
      ...(projectId ? { projectId } : {}),
    };
  }

  const keyPath = path.resolve(process.cwd(), keyPathValue);
  if (!fileSystem.existsSync(keyPath)) {
    throw new FirebaseConfigurationError(
      `Firebase service-account key not found at FIREBASE_KEY_PATH: ${keyPath}`,
    );
  }

  try {
    const serviceAccount = JSON.parse(
      fileSystem.readFileSync(keyPath, "utf8"),
    ) as Record<string, unknown>;

    if (
      typeof serviceAccount.project_id !== "string" ||
      typeof serviceAccount.client_email !== "string" ||
      typeof serviceAccount.private_key !== "string"
    ) {
      throw new Error("missing project_id, client_email, or private_key");
    }

    return {
      credential: cert(serviceAccount),
      ...(projectId ? { projectId } : {}),
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "invalid JSON";
    throw new FirebaseConfigurationError(
      `Invalid Firebase service-account key at FIREBASE_KEY_PATH: ${keyPath} (${detail})`,
      { cause: error },
    );
  }
}

export function initializeFirebase(): Firestore {
  if (db) {
    return db;
  }

  let app: App;
  try {
    app = getApps().length > 0
      ? getApp()
      : initializeApp(resolveFirebaseOptions());
    db = getFirestore(app);
    return db;
  } catch (error) {
    if (error instanceof FirebaseConfigurationError) {
      throw error;
    }

    const detail = error instanceof Error ? error.message : "unknown error";
    throw new FirebaseConfigurationError(
      `Firebase initialization failed: ${detail}`,
      { cause: error },
    );
  }
}

export function getDb(): Firestore {
  return db ?? initializeFirebase();
}
