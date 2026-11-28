import { Injectable } from "@nestjs/common";
import { PolicyEvaluationService } from "../policy/policy-evaluation.service";
import { CitationService } from "./citation.service";
import { CandidateEntry, PermittedEntry, selectPermittedEntries } from "./access-context";

@Injectable()
export class ContextFilterService {
  constructor(
    private readonly policyEvaluation: PolicyEvaluationService,
    private readonly citations: CitationService,
  ) {}

  async filterEntries(
    requesterUid: string,
    ownerUid: string,
    entries: CandidateEntry[],
    allowFrozenPolicy = false,
  ): Promise<PermittedEntry[]> {
    return selectPermittedEntries(
      requesterUid,
      ownerUid,
      entries,
      (request) => this.policyEvaluation.evaluateAccess(request),
      (entry, accessLevel) => this.citations.formatEntryCitation(entry, accessLevel),
      allowFrozenPolicy,
    );
  }
}
