import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";

export type LegacyRequestStatus =
  | "pending"
  | "approved"
  | "denied"
  | "active"
  | "revoked"
  | "cancelled"
  | "released";

export type LegacyDecision = "approved" | "denied" | null;

export interface LegacyRequestDocument {
  requestId: string;
  ownerUid: string;
  requesterUid: string;
  status: LegacyRequestStatus;
  decision: LegacyDecision;
  decisionByUid: string | null;
  decisionAt: Timestamp | null;
  activatedAt: Timestamp | null;
  revokedAt: Timestamp | null;
  releasedAt?: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  requestedAt: Timestamp;
}

export interface LegacyRequestSafeResult {
  requestId: string;
  status: LegacyRequestStatus;
  decision: LegacyDecision;
  decisionAt: Timestamp | null;
  activatedAt: Timestamp | null;
  revokedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface LegacyGrantResult {
  active: boolean;
}

export interface LegacyGrantState extends LegacyGrantResult {
  released: boolean;
}

const DUPLICATE_STATUSES: LegacyRequestStatus[] = ["pending", "approved", "active"];

@Injectable()
export class LegacyService {
  constructor(private readonly db: Firestore = getFirestore()) {}

  async requestLegacyAccess(ownerUid: string, requesterUid: string): Promise<LegacyRequestSafeResult> {
    if (requesterUid === ownerUid) {
      throw new BadRequestException("A user cannot request legacy access to their own diary.");
    }

    return this.db.runTransaction(async (transaction) => {
      const existingRequests = await transaction.get(
        this.db
          .collection("users")
          .doc(ownerUid)
          .collection("legacyRequests")
          .where("requesterUid", "==", requesterUid),
      );

      const duplicate = existingRequests.docs.some((document) => {
        const data = document.data() as LegacyRequestDocument;
        return data.ownerUid === ownerUid && DUPLICATE_STATUSES.includes(data.status);
      });

      if (duplicate) {
        throw new ConflictException("An active or pending legacy request already exists.");
      }

      const requestReference = this.db
        .collection("users")
        .doc(ownerUid)
        .collection("legacyRequests")
        .doc();
      const now = Timestamp.now();
      const requestData: LegacyRequestDocument = {
        requestId: requestReference.id,
        ownerUid,
        requesterUid,
        status: "pending",
        decision: null,
        decisionByUid: null,
        decisionAt: null,
        activatedAt: null,
        revokedAt: null,
        createdAt: now,
        updatedAt: now,
        requestedAt: now,
      };

      transaction.create(requestReference, requestData);
      return toSafeResult(requestData);
    });
  }

  async getLegacyRequestStatus(ownerUid: string, requesterUid: string): Promise<LegacyRequestSafeResult | { status: "not_requested" }> {
    const snapshot = await this.db
      .collection("users")
      .doc(ownerUid)
      .collection("legacyRequests")
      .where("requesterUid", "==", requesterUid)
      .orderBy("requestedAt", "desc")
      .limit(1)
      .get();

    if (snapshot.empty) {
      return { status: "not_requested" };
    }

    return toSafeResult(snapshot.docs[0].data() as LegacyRequestDocument);
  }

  async getActiveLegacyGrant(requesterUid: string, ownerUid: string): Promise<LegacyGrantResult> {
    const state = await this.getLegacyGrantState(requesterUid, ownerUid);
    return { active: state.active };
  }

  async getLegacyGrantState(requesterUid: string, ownerUid: string): Promise<LegacyGrantState> {
    if (requesterUid === ownerUid) {
      return { active: true, released: false };
    }

    const snapshot = await this.db
      .collectionGroup("legacyRequests")
      .where("requesterUid", "==", requesterUid)
      .get();

    const grant = snapshot.docs.find((document) => {
        const data = document.data() as LegacyRequestDocument;
        return data.ownerUid === ownerUid && (data.status === "active" || data.status === "released");
    });

    return {
      active: Boolean(grant),
      released: grant?.data().status === "released",
    };
  }

  approveLegacyRequest(requestId: string, authenticatedUid: string) {
    return this.transitionRequest(requestId, authenticatedUid, "owner", ["pending"], "approved", (_data, now) => ({
      decision: "approved",
      decisionByUid: authenticatedUid,
      decisionAt: now,
    }));
  }

  denyLegacyRequest(requestId: string, authenticatedUid: string) {
    return this.transitionRequest(requestId, authenticatedUid, "owner", ["pending"], "denied", (_data, now) => ({
      decision: "denied",
      decisionByUid: authenticatedUid,
      decisionAt: now,
    }));
  }

  activateLegacyRequest(requestId: string, authenticatedUid: string) {
    return this.transitionRequest(requestId, authenticatedUid, "owner", ["approved"], "active", (_data, now) => ({
      activatedAt: now,
    }));
  }

  revokeLegacyRequest(requestId: string, authenticatedUid: string) {
    return this.transitionRequest(requestId, authenticatedUid, "owner", ["approved", "active", "released"], "revoked", (_data, now) => ({
      revokedAt: now,
    }));
  }

  cancelLegacyRequest(requestId: string, authenticatedUid: string) {
    return this.transitionRequest(requestId, authenticatedUid, "requester", ["pending"], "cancelled", () => ({}));
  }

  private async transitionRequest(
    requestId: string,
    authenticatedUid: string,
    role: "owner" | "requester",
    allowedStatuses: LegacyRequestStatus[],
    nextStatus: LegacyRequestStatus,
    fields: (_data: LegacyRequestDocument, now: Timestamp) => Record<string, unknown>,
  ): Promise<LegacyRequestSafeResult> {
    return this.db.runTransaction(async (transaction) => {
      const matches = await transaction.get(
        this.db.collectionGroup("legacyRequests").where("requestId", "==", requestId).limit(1),
      );

      if (matches.empty) {
        throw new NotFoundException("Legacy request not found.");
      }

      const document = matches.docs[0];
      const data = document.data() as LegacyRequestDocument;
      const authorized = role === "owner"
        ? data.ownerUid === authenticatedUid
        : data.requesterUid === authenticatedUid;

      if (!authorized) {
        throw new ForbiddenException("You are not authorized to change this legacy request.");
      }

      if (!allowedStatuses.includes(data.status)) {
        throw new ConflictException(`Cannot transition legacy request from ${data.status} to ${nextStatus}.`);
      }

      const now = Timestamp.now();
      const changes = fields(data, now);
      transaction.update(document.ref, { ...changes, status: nextStatus, updatedAt: now });

      return toSafeResult({
        ...data,
        ...changes,
        status: nextStatus,
        updatedAt: now,
      } as LegacyRequestDocument);
    });
  }
}

function toSafeResult(data: LegacyRequestDocument): LegacyRequestSafeResult {
  return {
    requestId: data.requestId,
    status: data.status,
    decision: data.decision,
    decisionAt: data.decisionAt,
    activatedAt: data.activatedAt,
    revokedAt: data.revokedAt,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}
