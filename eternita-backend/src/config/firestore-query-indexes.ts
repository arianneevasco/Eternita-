export type FirestoreIndexField = {
  fieldPath: string;
  order: "ASCENDING" | "DESCENDING";
};

export type FirestoreIndexDefinition = {
  collectionGroup: string;
  queryScope: "COLLECTION" | "COLLECTION_GROUP";
  fields: FirestoreIndexField[];
};

export type FirestoreQueryInventoryItem = {
  id: string;
  sourceFile: string;
  functionName: string;
  collection: string;
  queryScope: "COLLECTION" | "COLLECTION_GROUP";
  filters: string[];
  orderBy: string[];
  limit?: number;
  requiredCompositeIndex: FirestoreIndexDefinition | null;
};

const entryIndex = (fields: FirestoreIndexField[]): FirestoreIndexDefinition => ({
  collectionGroup: "entries",
  queryScope: "COLLECTION",
  fields,
});

const policyIndex: FirestoreIndexDefinition = {
  collectionGroup: "policies",
  queryScope: "COLLECTION",
  fields: [
    { fieldPath: "status", order: "ASCENDING" },
    { fieldPath: "createdAt", order: "DESCENDING" },
  ],
};

const legacyStatusIndex: FirestoreIndexDefinition = {
  collectionGroup: "legacyRequests",
  queryScope: "COLLECTION",
  fields: [
    { fieldPath: "requesterUid", order: "ASCENDING" },
    { fieldPath: "requestedAt", order: "DESCENDING" },
  ],
};

const inviteIndex: FirestoreIndexDefinition = {
  collectionGroup: "invites",
  queryScope: "COLLECTION",
  fields: [
    { fieldPath: "code", order: "ASCENDING" },
    { fieldPath: "status", order: "ASCENDING" },
  ],
};

export const firestoreQueryInventory: FirestoreQueryInventoryItem[] = [
  {
    id: "diary.createEntry.latestPublished",
    sourceFile: "src/diary/diary.service.ts",
    functionName: "createEntry",
    collection: "users/{ownerUid}/entries",
    queryScope: "COLLECTION",
    filters: ["isDraft == false"],
    orderBy: ["publishedAt DESC"],
    limit: 1,
    requiredCompositeIndex: entryIndex([
      { fieldPath: "isDraft", order: "ASCENDING" },
      { fieldPath: "publishedAt", order: "DESCENDING" },
    ]),
  },
  {
    id: "diary.listEntries",
    sourceFile: "src/diary/diary.service.ts",
    functionName: "listEntries",
    collection: "users/{ownerUid}/entries",
    queryScope: "COLLECTION",
    filters: ["isHidden == false"],
    orderBy: ["createdAt DESC"],
    requiredCompositeIndex: entryIndex([
      { fieldPath: "isHidden", order: "ASCENDING" },
      { fieldPath: "createdAt", order: "DESCENDING" },
    ]),
  },
  {
    id: "diary.listVersions",
    sourceFile: "src/diary/diary.service.ts",
    functionName: "listVersions",
    collection: "users/{ownerUid}/versions/{entryId}/versions",
    queryScope: "COLLECTION",
    filters: [],
    orderBy: ["version DESC"],
    requiredCompositeIndex: null,
  },
  {
    id: "diary.publishDraft.latestPublished",
    sourceFile: "src/diary/diary.service.ts",
    functionName: "publishDraft",
    collection: "users/{ownerUid}/entries",
    queryScope: "COLLECTION",
    filters: ["isDraft == false"],
    orderBy: ["publishedAt DESC"],
    limit: 1,
    requiredCompositeIndex: entryIndex([
      { fieldPath: "isDraft", order: "ASCENDING" },
      { fieldPath: "publishedAt", order: "DESCENDING" },
    ]),
  },
  {
    id: "diary.verifyChain.publishedEntries",
    sourceFile: "src/diary/diary.service.ts",
    functionName: "verifyChain",
    collection: "users/{ownerUid}/entries",
    queryScope: "COLLECTION",
    filters: ["isDraft == false"],
    orderBy: [],
    requiredCompositeIndex: null,
  },
  {
    id: "ai.getEntries",
    sourceFile: "src/ai/ai.controller.ts",
    functionName: "getEntries",
    collection: "users/{ownerUid}/entries",
    queryScope: "COLLECTION",
    filters: [],
    orderBy: [],
    limit: 50,
    requiredCompositeIndex: null,
  },
  {
    id: "policy.savePolicy.entries",
    sourceFile: "src/policy/policy-storage.service.ts",
    functionName: "savePolicy",
    collection: "users/{ownerUid}/entries",
    queryScope: "COLLECTION",
    filters: [],
    orderBy: [],
    requiredCompositeIndex: null,
  },
  {
    id: "policy.savePolicy.activePolicies",
    sourceFile: "src/policy/policy-storage.service.ts",
    functionName: "savePolicy",
    collection: "users/{ownerUid}/policies",
    queryScope: "COLLECTION",
    filters: ["status == active"],
    orderBy: [],
    requiredCompositeIndex: null,
  },
  {
    id: "policy.getActivePolicy",
    sourceFile: "src/policy/policy-storage.service.ts",
    functionName: "getActivePolicy",
    collection: "users/{ownerUid}/policies",
    queryScope: "COLLECTION",
    filters: ["status == active"],
    orderBy: ["createdAt DESC"],
    limit: 1,
    requiredCompositeIndex: policyIndex,
  },
  {
    id: "policy.getLatestFrozenPolicy",
    sourceFile: "src/policy/policy-storage.service.ts",
    functionName: "getLatestFrozenPolicy",
    collection: "users/{ownerUid}/policies",
    queryScope: "COLLECTION",
    filters: ["status == frozen"],
    orderBy: ["createdAt DESC"],
    limit: 1,
    requiredCompositeIndex: policyIndex,
  },
  {
    id: "policy.getPolicyIdentityMap.legacyRequests",
    sourceFile: "src/policy/policy-storage.service.ts",
    functionName: "getPolicyIdentityMap",
    collection: "users/{ownerUid}/legacyRequests",
    queryScope: "COLLECTION",
    filters: [],
    orderBy: [],
    requiredCompositeIndex: null,
  },
  {
    id: "legacy.requestLegacyAccess.duplicateCheck",
    sourceFile: "src/legacy/legacy.service.ts",
    functionName: "requestLegacyAccess",
    collection: "users/{ownerUid}/legacyRequests",
    queryScope: "COLLECTION",
    filters: ["requesterUid == requesterUid"],
    orderBy: [],
    requiredCompositeIndex: null,
  },
  {
    id: "legacy.getLegacyRequestStatus",
    sourceFile: "src/legacy/legacy.service.ts",
    functionName: "getLegacyRequestStatus",
    collection: "users/{ownerUid}/legacyRequests",
    queryScope: "COLLECTION",
    filters: ["requesterUid == requesterUid"],
    orderBy: ["requestedAt DESC"],
    limit: 1,
    requiredCompositeIndex: legacyStatusIndex,
  },
  {
    id: "legacy.getLegacyGrantState",
    sourceFile: "src/legacy/legacy.service.ts",
    functionName: "getLegacyGrantState",
    collection: "legacyRequests",
    queryScope: "COLLECTION_GROUP",
    filters: ["requesterUid == requesterUid"],
    orderBy: [],
    requiredCompositeIndex: null,
  },
  {
    id: "legacy.transitionRequest",
    sourceFile: "src/legacy/legacy.service.ts",
    functionName: "transitionRequest",
    collection: "legacyRequests",
    queryScope: "COLLECTION_GROUP",
    filters: ["requestId == requestId"],
    orderBy: [],
    limit: 1,
    requiredCompositeIndex: null,
  },
  {
    id: "death.submitDeathReport.grants",
    sourceFile: "src/legacy/death-verification.service.ts",
    functionName: "submitDeathReport",
    collection: "users/{ownerUid}/legacyRequests",
    queryScope: "COLLECTION",
    filters: ["requesterUid == submittedByUid"],
    orderBy: [],
    requiredCompositeIndex: null,
  },
  {
    id: "death.submitDeathReport.reports",
    sourceFile: "src/legacy/death-verification.service.ts",
    functionName: "submitDeathReport",
    collection: "users/{ownerUid}/deathReports",
    queryScope: "COLLECTION",
    filters: ["submittedByUid == submittedByUid"],
    orderBy: [],
    requiredCompositeIndex: null,
  },
  {
    id: "death.confirmDueReports",
    sourceFile: "src/legacy/death-verification.service.ts",
    functionName: "confirmDueReports",
    collection: "deathReports",
    queryScope: "COLLECTION_GROUP",
    filters: ["status == pending"],
    orderBy: [],
    requiredCompositeIndex: null,
  },
  {
    id: "death.confirmReport.policies",
    sourceFile: "src/legacy/death-verification.service.ts",
    functionName: "confirmReport",
    collection: "users/{ownerUid}/policies",
    queryScope: "COLLECTION",
    filters: ["status == active"],
    orderBy: [],
    requiredCompositeIndex: null,
  },
  {
    id: "death.confirmReport.grants",
    sourceFile: "src/legacy/death-verification.service.ts",
    functionName: "confirmReport",
    collection: "users/{ownerUid}/legacyRequests",
    queryScope: "COLLECTION",
    filters: ["status == active"],
    orderBy: [],
    requiredCompositeIndex: null,
  },
  {
    id: "people.join.invite",
    sourceFile: "src/people/people.controller.ts",
    functionName: "join",
    collection: "invites",
    queryScope: "COLLECTION",
    filters: ["code == body.code", "status == pending"],
    orderBy: [],
    limit: 1,
    requiredCompositeIndex: inviteIndex,
  },
  {
    id: "people.getPeople",
    sourceFile: "src/people/people.controller.ts",
    functionName: "getPeople",
    collection: "users",
    queryScope: "COLLECTION",
    filters: ["ownerUid == request.uid"],
    orderBy: [],
    requiredCompositeIndex: null,
  },
];

export const requiredFirestoreIndexes = Array.from(
  new Map(
    firestoreQueryInventory
      .map((query) => query.requiredCompositeIndex)
      .filter((index): index is FirestoreIndexDefinition => index !== null)
      .map((index) => [JSON.stringify(index), index]),
  ).values(),
);
