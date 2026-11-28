# Eternita Backend Integration Guide

This guide reflects the backend code currently in this repository. Values that
are project-specific, secret, or not configured here remain explicit
placeholders; do not guess them.

## 1. Backend base URLs

The local NestJS backend listens on port `3000` by default (`PORT` can override
it).

| Frontend environment | Base URL |
| --- | --- |
| Expo web on the backend computer | `http://localhost:3000` |
| Android emulator | `http://10.0.2.2:3000` |
| Physical Android/iOS device on the same Wi-Fi | `http://<BACKEND_COMPUTER_LAN_IPV4>:3000` |
| Production | `<PRODUCTION_BACKEND_HTTPS_URL — not configured in this repository>` |

For a physical device, use the backend computer's IPv4 address from `ipconfig`
(for example `http://192.168.1.10:3000`); both devices must be on the same
network and the computer firewall must permit the port.

Example frontend setting for a physical-device test:

```dotenv
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.10:3000
```

Replace the example IP with the actual backend computer address. Use the
appropriate base URL per environment; do not ship a local URL in production.

## 2. Firebase client configuration

Use the same Firebase project configured for the backend. The backend
repository does not contain the Firebase Web app configuration, so obtain
these values from Firebase Console → Project settings → Your apps → Web app.
Keep project-specific values as placeholders until the project owner supplies
them:

```dotenv
EXPO_PUBLIC_FIREBASE_API_KEY=<FIREBASE_WEB_API_KEY>
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=<FIREBASE_AUTH_DOMAIN_FROM_FIREBASE_CONSOLE>
EXPO_PUBLIC_FIREBASE_PROJECT_ID=<FIREBASE_PROJECT_ID>
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=<FIREBASE_STORAGE_BUCKET_FROM_CONSOLE>
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<FIREBASE_PROJECT_NUMBER>
EXPO_PUBLIC_FIREBASE_APP_ID=<FIREBASE_WEB_APP_ID>
```

Firebase Web config is client configuration. `apiKey` is not the Firebase
Admin service-account private key. Never put Admin credentials, service
account JSON, database credentials, or the Gemini API key in the frontend.
Enable the desired sign-in provider in Firebase Authentication.

## 3. Firebase sign-in flow

1. Initialize the Firebase client SDK with the Web app configuration above.
2. Register/sign in the user through Firebase Authentication.
3. After sign-in, get a fresh token from the current user:

```ts
const idToken = await auth.currentUser?.getIdToken(true);
if (!idToken) throw new Error("No signed-in Firebase user");
```

4. Attach the token to every protected backend request. Refresh/get a new token
   when needed; do not hardcode, log, or share tokens.

## 4. Backend authentication

Protected routes require:

```http
Authorization: Bearer <Firebase ID token>
Content-Type: application/json
```

Example header (placeholder only; do not copy as a real token):

```http
Authorization: Bearer <FIREBASE_ID_TOKEN>
```

The backend verifies the token and uses the verified UID as the authenticated
identity. Do not send a Firebase UID as a substitute for the token, and do not
read/write protected Firestore collections directly from the frontend.

## 5. Owner registration

`POST /auth/register-owner` is public because a new user cannot have an ID
token before registration. It creates a Firebase Authentication user and an
owner profile. Request validation comes from `RegisterOwnerDto`:

- `email`: required valid email string, maximum 254 characters.
- `password`: required string, 6–128 characters.
- `displayName`: required string, trimmed, non-empty, maximum 100 characters.

Request:

```json
{
  "email": "owner@example.com",
  "password": "<USER-CHOSEN-PASSWORD>",
  "displayName": "Owner Name"
}
```

Success status: `201 Created`.

```json
{
  "uid": "<FIREBASE_UID>",
  "role": "owner",
  "name": "Owner Name",
  "handle": "owner"
}
```

The returned handle is generated from the email's local part (lowercase and
sanitized); the example above is for `owner@example.com`.

Known errors:

- `400 Bad Request`, Firebase rejects email/password:
  `{ "message": "The email or password is invalid.", "error": "Bad Request", "statusCode": 400 }`
- `400 Bad Request`, DTO validation fails:
  `{ "message": ["<class-validator messages>"], "error": "Bad Request", "statusCode": 400 }`
- `409 Conflict`, email already exists:
  `{ "message": "An account with this email already exists.", "error": "Conflict", "statusCode": 409 }`

After registration, sign in using Firebase client Authentication and use that
user's ID token for protected routes. Beneficiaries are not created through
this owner-only registration route: they sign up/sign in with Firebase, then
join an invitation through `POST /auth/join`.

## 6. Create diary entry

`POST /entries` requires a bearer token. The verified token UID determines the
owner; do not send `ownerUid` in the body.

Required fields from `CreateEntryDto`:

| Field | Type and validation |
| --- | --- |
| `title` | string, 1–200 characters |
| `originalText` | string, 1–20,000 characters |
| `journal` | string, 1–100 characters |
| `entryDate` | string matching `YYYY-MM-DD` |
| `entryTime` | string matching `HH:mm` |
| `mood` | integer from 1 through 5 |

Optional fields and defaults:

| Field | Type and default |
| --- | --- |
| `releaseDate` | optional string matching `YYYY-MM-DD` |
| `people` | array of strings matching `^[a-z][a-z0-9_]{0,30}$`; default `[]` |
| `tags` | array of strings matching `^[a-z][a-z0-9_]{0,30}$`; default `[]` |
| `isFavorite` | boolean; schema default `false` (service also stores `false` on create) |
| `isDraft` | boolean; default `true` |
| `writingMode` | `verbatim`, `lightfix`, or `review`; default `verbatim` |

Example:

```json
{
  "title": "A memory",
  "originalText": "The original diary entry.",
  "journal": "Personal",
  "entryDate": "2026-11-28",
  "entryTime": "14:30",
  "mood": 4,
  "people": [],
  "tags": [],
  "isFavorite": false,
  "isDraft": true,
  "writingMode": "verbatim"
}
```

Success status: `201 Created`. The response is the created document, with
server-generated fields. Example for a draft:

```json
{
  "entryId": "<ENTRY_ID>",
  "ownerUid": "<AUTHENTICATED_UID>",
  "title": "A memory",
  "originalText": "The original diary entry.",
  "journal": "Personal",
  "entryDate": "2026-11-28",
  "entryTime": "14:30",
  "mood": 4,
  "people": [],
  "tags": [],
  "isFavorite": false,
  "isDraft": true,
  "writingMode": "verbatim",
  "finalText": "The original diary entry.",
  "isHidden": false,
  "currentVersion": 1,
  "previousHash": "GENESIS",
  "entryHash": "GENESIS",
  "createdAt": "<ISO-8601 DATE>",
  "updatedAt": "<ISO-8601 DATE>"
}
```

If `isDraft` is `false`, the response also includes `publishedAt` and
`sequence`; hash-chain values are computed for publication. Dates are
serialized to JSON by the server.

Known errors: `400 Bad Request` for Zod body validation, shaped as
`{ "message": "Invalid request data", "errors": { "<field>": ["<validation message>"] } }`;
`401 Unauthorized` for a missing/invalid token. Other persistence failures
are not mapped to a route-specific response.

## 7. List diary entries

`GET /entries` requires a bearer token.

- Request body: none.
- Query parameters: none.
- Success status: `200 OK`.
- Success response: array of entry documents, each shaped as
  `{ "entryId": "<ENTRY_ID>", ...storedEntryFields }`. The list contains
  non-hidden entries belonging to the authenticated UID, newest `createdAt`
  first. It includes the stored entry content and other document fields.
- Error: `401 Unauthorized` for a missing/invalid token:
  `{ "message": "Unauthorized", "statusCode": 401 }`.

## 8. Common error responses

Known and common responses from the current backend:

| Status | Typical shape/message |
| --- | --- |
| 400 | Standard validation: `{ "message": ["<validation messages>"], "error": "Bad Request", "statusCode": 400 }`; custom Zod validation: `{ "message": "Invalid request data", "errors": { ... } }`. |
| 401 | `{ "message": "Unauthorized", "statusCode": 401 }` for missing, invalid, or expired bearer token. |
| 403 | `{ "message": "<route-specific reason>", "error": "Forbidden", "statusCode": 403 }` for explicit permission failures. |
| 404 | `{ "message": "<route-specific reason>", "error": "Not Found", "statusCode": 404 }`. |
| 409 | `{ "message": "<route-specific conflict>", "error": "Conflict", "statusCode": 409 }`. |
| 500 | Unexpected errors generally use Nest's default `{ "statusCode": 500, "message": "Internal server error" }`; some routes normalize AI errors into a JSON result instead. |

Important: the current API is not fully consistent. Some business failures are
returned as HTTP 200/201 JSON objects such as `{ "error": "Invitation
expired" }` or `{ "accessGranted": false, "message": "..." }`. Check both
HTTP status and response fields. Do not assume every denial is HTTP 403.

## 9. CORS

CORS is **not currently configured**: `src/main.ts` does not call
`enableCors()`. Consequently no cross-origin Expo web origin is explicitly
allowed by the backend at present.

Configure the backend to allow the exact Expo web origin shown in the browser
address bar (common development origins are `http://localhost:8081` or
`http://localhost:19006`; verify the actual port) and the exact production web
origin. The repository does not currently contain an allowed-origin list.
Use explicit origins rather than wildcard `*` in production. Native Android
and iOS API calls are not governed by browser CORS.

## 10. Environment variables

### Frontend

Use public, framework-prefixed values only:

- `EXPO_PUBLIC_API_BASE_URL`: environment-specific API base URL.
- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` (if configured for the Firebase app)
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` (if supplied)
- `EXPO_PUBLIC_FIREBASE_APP_ID`

The backend repository does not include Firebase Web config or a frontend env
file. The placeholders in this guide must be filled from the Firebase project
and deployment configuration.

### Backend

See [`.env.example`](../.env.example). Backend variables read by this code:

| Variable | Purpose |
| --- | --- |
| `PORT` | Server port; defaults to `3000`. |
| `FIREBASE_PROJECT_ID` | Optional explicit Firebase project ID. |
| `FIREBASE_KEY_PATH` | Optional server-side service-account JSON path; if absent, Admin uses Application Default Credentials. |
| `GOOGLE_APPLICATION_CREDENTIALS` | Standard ADC credential-file path when ADC is used. Keep the file server-side. |
| `FIRESTORE_EMULATOR_HOST` | Firestore emulator endpoint, normally supplied by Firebase Emulator tooling. |
| `GEMINI_API_KEY` | Server-only Gemini API key. |
| `DEATH_REPORT_CONFIRMATION_DELAY_MINUTES` | Death-report delay in minutes; defaults to `2`. |

## 11. Values that must never be exposed to the frontend

Never put Firebase Admin SDK credentials, service-account JSON/private keys,
ADC credential files, Firestore/database credentials, `GEMINI_API_KEY`, or
other backend secrets into frontend environment variables or bundles. Never
commit real `.env` files. Firebase ID tokens and passwords are credentials too:
do not hardcode, log, or share them. Firebase Web client config is not an
Admin credential, but project-specific values are intentionally left as
placeholders here until supplied by the project owner.

## Contract gaps for the frontend team

- There is no production backend URL or Firebase Web config in this repo.
- CORS is not enabled and no origins are configured.
- `POST /invites`, `POST /auth/join`, `PATCH /entries/:entryId/favorite`,
  `POST /legacy/request`, and `POST /legacy/death-reports` use inline TypeScript
  body types without runtime field validation. Their field requirements should
  be treated as the current intended request format, not uniformly enforced
  DTO validation.
- The `access` query parameter on `GET /entries/:entryId` has no runtime enum
  validation.
- Some domain failures are returned in successful-status JSON bodies.
