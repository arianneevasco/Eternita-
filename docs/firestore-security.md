# Firestore security and indexes

Firestore client access is deny-by-default. The backend uses the Firebase Admin SDK, which bypasses these rules; therefore backend controllers and services must authorize using the verified Firebase UID before every resource operation.

## Collections and protected fields

| Path | Client access | Protected data |
| --- | --- | --- |
| `users/{uid}` | Read own profile only | `role`, `ownerUid`, `deceased`, settings, sequence and hash metadata |
| `users/{uid}/activity/{activityId}` | Denied | Activity history |
| `users/{uid}/entries/{entryId}` | Read own entries only | Raw text, hidden state, release date, owner UID, hashes, sequence, timestamps |
| `users/{uid}/versions/{entryId}/versions/{versionId}` | Read own versions only | Historical raw content and hash fields |
| `users/{uid}/policies/{policyId}` | Denied | Policy text, compiled facts, decisions, freeze status and timestamps |
| `users/{uid}/legacyRequests/{requestId}` | Denied | Requester identity, status and decision |
| `users/{uid}/deathReports/{reportId}` | Denied | Death evidence and verification metadata |
| `users/{uid}/aiUseLogs/{logId}` | Denied | Prompt hashes, selected entries, access levels and model metadata |
| `invites/{inviteId}` | Denied | Invitation codes and redemption state |
| `health/connection` | Denied | Backend health probe metadata |

All client creates, updates, and deletes are denied. Backend writes are performed through the Admin SDK after application authorization. The catch-all rule denies future paths unless explicitly added.

## Composite indexes

The required indexes are in `firestore.indexes.json` and preserve the existing query behavior:

- `entries`: `isHidden ASC`, `createdAt DESC`
- `entries`: `isDraft ASC`, `publishedAt DESC`
- `policies`: `status ASC`, `createdAt DESC`
- `legacyRequests`: `requesterUid ASC`, `requestedAt DESC`
- `invites`: `code ASC`, `status ASC`

## Access model

Owners may directly read their own profile, entries, and historical versions. Recipients, denied users, and unauthenticated users cannot directly read diary or policy documents; recipient access is evaluated and filtered by the backend before a response is returned. Sensitive state and all writes remain backend-only.
