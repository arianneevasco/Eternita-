import { Injectable } from "@nestjs/common";
import { PolicyStorageService } from "./policy-storage.service";
import { evaluatePolicy } from "./prolog-evaluator";
import { compilePolicy } from "./compiler";
import { evaluateLetterRelease } from "./letter-release";
import { isReleaseDateReached } from "../diary/release-date";

export type AccessLevel = "existence" | "summary" | "full";

export interface AccessRequest {
  requesterUid: string;
  ownerUid: string;
  entryId: string;
  requestedAccess: AccessLevel;
  releaseDate?: string;
  entry?: {
    entryId: string;
    title?: string;
    people?: string[];
    tags?: string[];
  };
  allowFrozenPolicy?: boolean;
}

export interface AccessDecision {
  allowed: boolean;
  reason: string;
}

@Injectable()
export class PolicyEvaluationService {
  constructor(
    private readonly policyStorage: PolicyStorageService,
  ) {}

  async evaluateAccess(
    request: AccessRequest,
  ): Promise<AccessDecision> {
    if (!isReleaseDateReached(request.releaseDate)) {
      return {
        allowed: false,
        reason: "Entry is not available yet.",
      };
    }

    const policy = await this.policyStorage.getActivePolicy(
      request.ownerUid,
    );
    const effectivePolicy = policy ?? (request.allowFrozenPolicy
      ? await this.policyStorage.getLatestFrozenPolicy(request.ownerUid)
      : null);

    if (!effectivePolicy) {
      return {
        allowed: false,
        reason: "No active policy is available for this owner.",
      };
    }

    try {
      const storedPolicy = effectivePolicy as typeof effectivePolicy & {
        policyText?: string;
        compiledFacts?: string[];
      };
      const identityMap = typeof storedPolicy.policyText === "string"
        ? await this.getIdentityMap(request.ownerUid, storedPolicy.policyText)
        : {};
      const compiled = request.entry && typeof storedPolicy.policyText === "string"
        ? compilePolicy(storedPolicy.policyText, [request.entry], identityMap)
        : undefined;
      const facts = compiled?.facts ?? (storedPolicy.compiledFacts ?? []);

      const atom = (value: string) =>
        /^[a-z][a-zA-Z0-9_]*$/.test(value)
          ? value
          : `'${value.replace(/'/g, "''")}'`;

      // A scheduled letter is private to its declared recipient until its
      // release date. On/after that UTC calendar date, the release acts as a
      // full-level grant; ordinary policy denies still override that grant.
      if (compiled) {
        const releaseDecision = evaluateLetterRelease(
          compiled.releases,
          request.entry?.title,
          request.requesterUid,
          identityMap,
        );
        if (releaseDecision.kind === "denied") {
          return { allowed: false, reason: releaseDecision.reason };
        }
        if (releaseDecision.kind === "released") {
          facts.push(`grant(${atom(request.requesterUid)},${atom(request.entryId)},full).`);
        }
      }

      const result = await evaluatePolicy({
        facts: facts.join("\n"),
        query: `access_allowed(${atom(request.requesterUid)}, ${atom(request.entryId)}, ${request.requestedAccess}).`,
      });

      if (result.error) {
        return {
          allowed: false,
          reason: "Access could not be evaluated.",
        };
      }

      return {
        allowed: result.allowed,
        reason: result.allowed
          ? "Access granted by policy."
          : "Access denied by policy.",
      };
    } catch {
      return {
        allowed: false,
        reason: "Access could not be evaluated.",
      };
    }
  }

  private async getIdentityMap(ownerUid: string, policyText: string): Promise<Record<string, string>> {
    const storage = this.policyStorage as PolicyStorageService & {
      getPolicyIdentityMap?: (ownerUid: string, policyText: string) => Promise<Record<string, string>>;
    };
    return storage.getPolicyIdentityMap
      ? storage.getPolicyIdentityMap(ownerUid, policyText)
      : {};
  }
}
