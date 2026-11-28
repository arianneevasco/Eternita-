# Firestore query-to-index mapping

The backend query inventory is maintained in
[`src/config/firestore-query-indexes.ts`](../eternita-backend/src/config/firestore-query-indexes.ts).
The Jest audit in
[`test/firestore-query-index-audit.test.ts`](../eternita-backend/test/firestore-query-index-audit.test.ts)
reads `firestore.indexes.json` and fails when a required composite index is
missing, differs in scope or fields, or is unused.

## Required composite indexes

| Query | Collection | Filters | Ordering | Index |
|---|---|---|---|---|
| `diary.createEntry.latestPublished` | `users/{ownerUid}/entries` | `isDraft == false` | `publishedAt DESC` | `entries`: `isDraft ASC`, `publishedAt DESC` |
| `diary.listEntries` | `users/{ownerUid}/entries` | `isHidden == false` | `createdAt DESC` | `entries`: `isHidden ASC`, `createdAt DESC` |
| `diary.publishDraft.latestPublished` | `users/{ownerUid}/entries` | `isDraft == false` | `publishedAt DESC` | `entries`: `isDraft ASC`, `publishedAt DESC` |
| `policy.getActivePolicy` | `users/{ownerUid}/policies` | `status == active` | `createdAt DESC` | `policies`: `status ASC`, `createdAt DESC` |
| `policy.getLatestFrozenPolicy` | `users/{ownerUid}/policies` | `status == frozen` | `createdAt DESC` | `policies`: `status ASC`, `createdAt DESC` |
| `legacy.getLegacyRequestStatus` | `users/{ownerUid}/legacyRequests` | `requesterUid == requesterUid` | `requestedAt DESC` | `legacyRequests`: `requesterUid ASC`, `requestedAt DESC` |
| `people.join.invite` | `invites` | `code == body.code`, `status == pending` | none | `invites`: `code ASC`, `status ASC` |

## Queries not requiring composite indexes

Point reads, equality-only queries, single-field ordering, and bounded reads
without multiple filter/order fields use Firestore single-field indexes or do
not require an additional composite index. These are still listed in the
source inventory, including diary version reads, legacy grant lookups, death
report scans, policy saves, AI's 50-entry load, and the people profile query.

The audit deliberately does not add indexes for those queries.
