# Eternita

Eternita (Alaala) is a privacy-controlled personal AI diary. The owner can write diary entries, create privacy policies, and choose what information trusted people may access. The backend verifies Firebase identities, applies Prolog-based access rules, and sends only authorized diary context to Gemini.

## Team Members

1. ARIANNE EVASCO
2. LEA MARIE GOZARIN
3. LYZA GWEN GUATNO
4. LOVELY MONTAÑO

## Repository Structure

```text
Eternita/
├─ eternita-backend/
│  ├─ src/
│  │  └─ policy/
│  ├─ test/
│  ├─ prolog/
│  │  └─ access-rules.pl
│  ├─ docs/
│  │  └─ grammar/
│  │     └─ policy-grammar.md
│  ├─ package.json
│  └─ tsconfig.json
│
├─ docs/
│  ├─ uml/
│  ├─ requirements/
│  └─ architecture/
│
└─ reports/
   ├─ progress-reports/
   └─ testing-reports/
```

| Folder                           | Purpose                                                                    |
| -------------------------------- | -------------------------------------------------------------------------- |
| `eternita-backend/src/`          | NestJS backend source code                                                 |
| `eternita-backend/test/`         | Backend, policy, and Prolog tests                                          |
| `eternita-backend/prolog/`       | SWI-Prolog access rules used by the backend                                |
| `grammar/`                      | Policy-language grammar and examples                                       |
| `docs/`                          | Shared project documentation, UML diagrams, requirements, and architecture |
| `reports/`                       | Progress reports, testing reports, and final project reports               |

## Branching Convention

Use short-lived branches for work. Merge completed work into `main` through a pull request.

| Branch                        | Purpose                                   |
| ----------------------------- | ----------------------------------------- |
| `main`                        | Stable, integrated version of the project |
| `develop`                     | Integration branch for completed features |
| `feature/<short-description>` | New feature work                          |
| `fix/<short-description>`     | Bug fixes                                 |
| `docs/<short-description>`    | Documentation changes                     |
| `test/<short-description>`    | Test improvements                         |

Examples:

```text
feature/policy-compiler
feature/prolog-access-evaluator
fix/hash-chain-integrity
docs/add-uml-diagrams
test/add-policy-compiler-tests
```

Do not commit directly to `main`. Create a branch, commit your work, push it, and open a pull request for review.

## Commit Message Convention

Use this format:

```text
<type>: <short description>
```

| Type       | Use it for                                   |
| ---------- | -------------------------------------------- |
| `feat`     | A new feature                                |
| `fix`      | A bug fix                                    |
| `docs`     | Documentation changes                        |
| `test`     | Adding or improving tests                    |
| `refactor` | Code restructuring without changing behavior |
| `chore`    | Maintenance, dependencies, or configuration  |

Examples:

```text
feat: add policy compiler
feat: add Prolog access evaluator
fix: validate diary entry dates
docs: add repository workflow
test: add policy compiler tests
chore: update backend dependencies
```

## Backend Development

The backend is built with Node.js, TypeScript, NestJS, Firebase Admin SDK, Firestore, SWI-Prolog, and Gemini.

### Requirements

- Node.js 22 or newer
- npm
- SWI-Prolog
- Firebase project with Authentication and Firestore enabled
- Firebase service-account key
- Gemini API key

### Backend setup

From the repository root:

```bash
cd eternita-backend
npm install
```

Create a `.env` file using `.env.example` as a guide. Never commit `.env`, Firebase service-account keys, API keys, or ID tokens.

### Run the backend

```bash
npm run start:dev
```

The backend should run at:

```text
http://localhost:3000
```

### Run tests

```bash
npm run build
npm test -- --runInBand
```

## Security Rules

- The mobile app must not access Firestore directly.
- All Firestore access must go through the backend.
- The backend verifies Firebase ID tokens before processing requests.
- The policy compiler turns owner privacy policies into Prolog facts.
- Prolog decides whether a viewer is allowed to access a topic.
- Access is denied by default.
- A matching denial overrides an allow rule.
- Diary entries with any denied topic must not be sent to Gemini.

## Important Files

Do not commit or share these files:

```text
.env
firebase/serviceAccountKey.json
*.pem
ID tokens
API keys
```

## Documentation

Project documentation is stored in the `docs/` folder:

- `docs/uml/` — Use case, sequence, and class diagrams
- `docs/requirements/` — Finalized project requirements
- `docs/architecture/` — System and backend architecture

Project reports are stored in the `reports/` folder:

- `reports/progress-reports/`
- `reports/testing-reports/`
