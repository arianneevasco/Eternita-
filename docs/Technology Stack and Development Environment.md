Technology Stack and Development Environment
---

## 1. Purpose

This document records the chosen programming languages, logic engine, AI model, scripting orchestrator, cloud database, media storage, and user interface framework for Eternita, along with the rationale for how each technology fits its assigned programming paradigm and component. It also defines the reproducible local setup and cross-language verification steps required across all team members' machines.

---

## 2. Technology Selections and Paradigm Fit

| Component / Layer | Paradigm | Selected Technology | Rationale & Paradigm Fit |
|---|---|---|---|
| Diary Model | Object-Oriented (OOP) | TypeScript/Node.js | Provides classes, interfaces, inheritance, encapsulation, and type-safe domain models such as `Entry`, `DiaryEntry`, and `LetterOfWishes`. |
| Entry Processing Pipeline | Functional Programming | TypeScript/Node.js | Supports pure functions, immutable transformations, typed results, and composable pipeline steps without unintended side effects. |
| Access Rules Engine | Logic / Declarative Programming | SWI-Prolog (`swipl`) | Expresses deny-by-default authorization rules, role relationships (Owner, Trustee, Registered Asker), and release-date constraints declaratively rather than burying security checks in imperative branches. |
| Grounded AI Q&A Engine | Generative AI / Tool-Augmented LLM | Gemini 2.5 Flash (`gemini-2.5-flash`) | Delivers fast, low-latency responses with structured tool/function calling for grounded Q&A. **Note:** Deprecated on Google AI Studio with automatic routing to `gemini-3.5-flash-lite` starting Dec 1, 2026; keep the model ID configurable via environment variables. |
| Q&A Orchestration & Scripting | Scripting / Glue Integration | TypeScript/Node.js | Matches the backend runtime and coordinates authentication, Firestore, Prolog authorization, and future Gemini calls before diary content reaches the LLM. |
| Cloud Database & Auth | Persistence / Backend-as-a-Service | Firebase Admin SDK, Cloud Firestore, and Firebase Authentication | Provides backend identity verification and document storage for diary entries, people, trustees, and release-date records. |
| Media Storage | Cloud Media / CDN | Cloudinary | Stores and serves user-uploaded images (such as the one image per person that becomes a constellation) and resizes them on delivery, keeping binary files out of the database. |
| User Interface | Component-Based UI | React Native (Expo + TypeScript) | Aligns with the existing frontend prototype, providing type-safe screens and state flows for Owner, Trustee, and Registered Asker interactions. |

---

## 3. Architectural & Security Rationale

### Deterministic Security Before LLM Generation

Access control is enforced strictly by SWI-Prolog (deny-by-default) before the TypeScript/Node.js backend retrieves entries or invokes Gemini. Prompt instructions alone are never relied upon to protect private diary entries.

### Zero Existence Leakage

When SWI-Prolog denies access (or an entry does not exist), the TypeScript/Node.js orchestrator returns a uniform neutral refusal without revealing whether matching records exist.

### Configurable Model Endpoint

Because `gemini-2.5-flash` routes automatically to `gemini-3.5-flash-lite` starting December 1, 2026, the model identifier is loaded from `.env` (`GEMINI_MODEL`) so the team can update or test models without modifying source code.

### Protected Data Layer (Firebase)

Firestore Security Rules are set to deny all direct client reads and writes of diary data, as a second layer behind the Prolog rules. Diary content is read only by the TypeScript/NestJS backend through the Firebase Admin SDK, and the service account credentials are never shipped in the mobile app. The app uses only the public Firebase client configuration and Firebase Authentication.

### Controlled Media Access (Cloudinary)

Uploads are signed by the backend so the Cloudinary API secret never reaches the client. Diary-related images are stored as authenticated assets, and the app receives a delivery URL only after Prolog has authorized the request.

---

## 4. Repository Dependency Files

All project dependencies are tracked in version-controlled manifest files in the repository.

### Backend (`eternita-backend/package.json` and `package-lock.json`)

```text
@nestjs/common
@nestjs/core
@nestjs/platform-express
firebase-admin
dotenv
zod
typescript
ts-node
jest
ts-jest
@types/node
```

### Frontend and future integrations

SWI-Prolog is an external prerequisite and must be installed separately. It
must be available as `swipl` on the system `PATH`.

React Native/Expo, Gemini, and Cloudinary dependencies will be added to their
own manifests when those integrations are implemented. They are not active
backend dependencies in this repository.

### Environment Variables (`.env.example`)

```bash
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-2.5-flash

# Firebase (backend only: never commit the service account file or ship it in the mobile app)
FIREBASE_PROJECT_ID=your_firebase_project_id
GOOGLE_APPLICATION_CREDENTIALS=path/to/serviceAccountKey.json

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret            # backend only, never in the mobile app
```

---

## 5. Reproducible Setup & Cross-Language Smoke Test

Every team member must verify that the TypeScript/Node.js backend can execute a
SWI-Prolog rule.

### Prerequisites

- SWI-Prolog (`swipl`) installed and available on `PATH`.
- Node.js and npm installed.
- Access to the team Firebase project and Cloudinary account (credentials shared privately and copied into a local `.env`, which is never committed).

### Verification Files

**`eternita-backend/scripts/prolog-smoke.ts`**

```typescript
// The smoke test starts SWI-Prolog and calls an access rule from Node.js.
access(ana, entry_1, existence)
```

### Run Command

```powershell
cd eternita-backend
npm install
npm run prolog-smoke
```

---
