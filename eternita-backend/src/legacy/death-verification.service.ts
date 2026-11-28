import { ConflictException, ForbiddenException, Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { getFirestore, Timestamp, type Firestore } from "firebase-admin/firestore";

export type DeathReportStatus = "pending" | "confirmed" | "cancelled";

export interface DeathReportDocument {
  reportId: string;
  ownerUid: string;
  submittedByUid: string;
  status: DeathReportStatus;
  submittedAt: Timestamp;
  confirmAfter: Timestamp;
  confirmedAt: Timestamp | null;
}

@Injectable()
export class DeathVerificationService implements OnModuleInit, OnModuleDestroy {
  private scheduler?: ReturnType<typeof setInterval>;

  constructor(private readonly db: Firestore = getFirestore()) {}

  onModuleInit() {
    this.scheduler = setInterval(() => void this.confirmDueReports().catch(() => undefined), 1000);
    this.scheduler.unref?.();
  }

  onModuleDestroy() {
    if (this.scheduler) clearInterval(this.scheduler);
  }

  async submitDeathReport(ownerUid: string, submittedByUid: string) {
    if (ownerUid === submittedByUid) {
      throw new ForbiddenException("The owner cannot submit a death report for themselves.");
    }

    return this.db.runTransaction(async (transaction) => {
      const ownerReference = this.db.collection("users").doc(ownerUid);
      const ownerSnapshot = await transaction.get(ownerReference);
      if (ownerSnapshot.exists && ownerSnapshot.data()?.deceased === true) {
        throw new ConflictException("This owner is already marked deceased.");
      }

      const grants = await transaction.get(ownerReference.collection("legacyRequests").where("requesterUid", "==", submittedByUid));
      const eligible = grants.docs.some((document) => ["active", "released"].includes(document.data().status));
      if (!eligible) {
        throw new ForbiddenException("An active legacy grant is required to submit a death report.");
      }

      const reports = await transaction.get(ownerReference.collection("deathReports").where("submittedByUid", "==", submittedByUid));
      if (reports.docs.some((document) => ["pending", "confirmed"].includes(document.data().status))) {
        throw new ConflictException("An active death report already exists for this beneficiary.");
      }

      const reportReference = ownerReference.collection("deathReports").doc();
      const now = Timestamp.now();
      const report: DeathReportDocument = {
        reportId: reportReference.id,
        ownerUid,
        submittedByUid,
        status: "pending",
        submittedAt: now,
        confirmAfter: Timestamp.fromMillis(now.toMillis() + this.getDelayMs()),
        confirmedAt: null,
      };
      transaction.create(reportReference, report);
      this.writeActivity(transaction, ownerUid, submittedByUid, "deathReportSubmitted", { reportId: report.reportId });
      return { reportId: report.reportId, status: report.status, confirmAfter: report.confirmAfter };
    });
  }

  async confirmDueReports(): Promise<number> {
    const snapshot = await this.db.collectionGroup("deathReports").where("status", "==", "pending").get();
    let confirmed = 0;
    for (const document of snapshot.docs) {
      const report = document.data() as DeathReportDocument;
      if (report.confirmAfter.toMillis() <= Date.now() && await this.confirmReport(document.ref)) confirmed += 1;
    }
    return confirmed;
  }

  private async confirmReport(reportReference: FirebaseFirestore.DocumentReference) {
    return this.db.runTransaction(async (transaction) => {
      const reportSnapshot = await transaction.get(reportReference);
      if (!reportSnapshot.exists) return false;
      const report = reportSnapshot.data() as DeathReportDocument;
      if (report.status !== "pending" || report.confirmAfter.toMillis() > Date.now()) return false;

      const ownerReference = this.db.collection("users").doc(report.ownerUid);
      const policies = await transaction.get(ownerReference.collection("policies").where("status", "==", "active"));
      const grants = await transaction.get(ownerReference.collection("legacyRequests").where("status", "==", "active"));
      const now = Timestamp.now();

      transaction.update(reportReference, { status: "confirmed", confirmedAt: now });
      transaction.set(ownerReference, { deceased: true, deathConfirmedAt: now }, { merge: true });
      this.writeActivity(transaction, report.ownerUid, "system", "deathReportConfirmed", { reportId: report.reportId });

      for (const policy of policies.docs) transaction.update(policy.ref, { status: "frozen", frozenAt: now, updatedAt: now });
      if (policies.docs.length) this.writeActivity(transaction, report.ownerUid, "system", "policiesFrozen", { reportId: report.reportId, policyIds: policies.docs.map((policy) => policy.id) });

      for (const grant of grants.docs) {
        transaction.update(grant.ref, { status: "released", releasedAt: now, updatedAt: now });
        this.writeActivity(transaction, report.ownerUid, "system", "legacyGrantReleased", { reportId: report.reportId, requestId: grant.id, requesterUid: grant.data().requesterUid });
      }
      return true;
    });
  }

  private getDelayMs() {
    const configured = Number(process.env.DEATH_REPORT_CONFIRMATION_DELAY_MINUTES ?? "2");
    return (Number.isFinite(configured) && configured >= 0 ? configured : 2) * 60_000;
  }

  private writeActivity(transaction: FirebaseFirestore.Transaction, ownerUid: string, actorUid: string, action: string, details: Record<string, unknown>) {
    const activityReference = this.db.collection("users").doc(ownerUid).collection("activity").doc();
    transaction.create(activityReference, { activityId: activityReference.id, ownerUid, actorUid, action, createdAt: Timestamp.now(), ...details });
  }
}
