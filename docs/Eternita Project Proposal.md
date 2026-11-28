# Eternita Project Proposal and Finalized Requirements

**Course:** CS 413 Programming Languages — Final Project
**Project subtitle:** My Personal AI Diary

> **Requirement status:** This document is the requirements baseline for later
> design, coding, and testing. Team review and approval are still required
> before the requirements are considered approved.

## 1. Purpose and Problem

People use diaries to keep personal memories, but digital diaries can be hard to
share safely if the owner becomes unable to share them. Some apps keep every
entry locked, while sharing an account can expose more information than the
owner intended.

Other AI diary can create other risks. It may make up memories, reveal private
entries, or speak as if it were the owner.

**Eternita** is a personal diary system. It lets an owner write diary entries
and decide which registered askers may see selected information. If the owner
is no longer able to manage the account, an assigned asker may request the
system's legacy process. The AI may answer questions only with diary entries
that pass the owner's access rules. Answers must identify their sources and
must not invent memories.

## 2. System Users and Roles

Eternita has two account roles: **Owner** and **Asker**.

| Account role | Description and permissions                                                                                                                                                                                                       |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Owner**    | Creates and manages the diary, writes access rules, and chooses registered askers. The owner may assign one or more askers to act as trustees.                                                                                    |
| **Asker**    | A person registered and approved by the owner. An asker may request access to the owner's diary only when the legacy process is active and the owner's rules allow it. Askers cannot create, edit, or delete the owner's entries. |

A **trusted person (trustee)** is an asker chosen by the owner to provide the
required confirmation and request legacy activation. Trustee is an added duty,
not a separate account role. It does not give automatic access to diary
entries; the trustee must also have permission under the owner's rules to ask
questions or see information.

## 3. Scope

### 3.1 Included in the project

Eternita will include:

- A phone, tablet, and laptop-friendly app for owners and askers.
- Owner accounts, registered asker accounts, and role-based access.
- Journals for personal, health, family, and travel entries.
- Drafting, saving, editing, favoriting, and removing diary entries.
- People and memory displays, including portraits, "stars," and emotion
  symbols.
- Voice-to-text entry and writing help with selectable writing modes.
- Mood summaries and memory summaries for the owner.
- Owner-written access rules, including rules about people, topics, and dates.
- A policy language that the system can check and apply.
- A server that checks access rules before it sends any diary text to the AI.
- An AI question-and-answer feature for registered askers after legacy
  activation.
- Tests that use fictional accounts, diary entries, and dates only.

The planned project technologies are an Expo and React Native app, a
TypeScript/NestJS server, Firebase Authentication and Firestore, SWI-Prolog for
access decisions, and Gemini 2.5 Flash for AI answers. The AI model is called
through the server, not directly from the app.

### 3.2 Not included in the project

Eternita will not:

- Create, witness, notarize, or carry out legal wills, estate plans, or asset
  transfers.
- Automatically check government or hospital records to confirm a person's
  death.
- Provide public social feeds, live co-writing, or third-party messaging.
- Be released for real personal diaries or real biometric data as part of this
  academic project.
- Let the AI browse the whole diary or decide for itself which entries an
  asker may see.

### 3.3 Not a legal will

> **Eternita is not a legal will.** A Letter of Wishes or other message stored
> in Eternita is a personal message only. It is not a Last Will and Testament
> and does not replace the legal steps required by Philippine law. Eternita
> does not provide legal advice.

This notice must appear in project materials and in the app wherever users
create or view a Letter of Wishes.

## 4. Assumptions

1. All sample accounts, names, diary entries, portraits, passwords, and dates
   used for design, development, demos, and testing are fictional.
2. The owner registers and approves each asker before that person can request
   access.
3. The owner writes access rules before legacy access is requested.
4. An owner may assign an asker as a trustee. The system uses the required
   confirmation process before legacy access begins; it does not confirm death
   automatically.
5. A trustee's extra duty does not grant access to diary content.
6. The app and server need a working network connection for account and cloud
   features.
7. Any camera, voice, or device authentication feature depends on the user's
   device and operating system. Such features must not be described as active
   when they are only a preview.

## 5. Functional Requirements

These six components are required parts of the system.

### 5.1 Component 1 — Diary Model

The diary is organized using clear object types, such as `Entry`, `Journal`,
`Person`, `Star`, and `LegacyItem`. Shared types may use a common parent where
it makes sense. Each type keeps control of its own data.

- **FR-1.1:** The owner can create, edit, save as a draft, favorite, and remove
  diary entries.
- **FR-1.2:** The owner can organize entries in Personal, Health, Family, and
  Travel journals.
- **FR-1.3:** Each saved entry records its date and time.
- **FR-1.4:** The owner can add a person and, if desired, a portrait. Entries
  about that person may show a related star in the app.
- **FR-1.5:** The app may show an emotion symbol for an entry without adding an
  emotion word to the entry itself.
- **FR-1.6:** The owner can create and manage legacy items such as a life
  story, future messages, a bucket list, final wishes, and a memory album.

### 5.2 Component 2 — Entry Processing

Entry processing uses small functions that return results without silently
changing other data. Saving a committed entry also creates an integrity record
that can reveal later changes.

- **FR-2.1:** The system can process entries and calculate mood information,
  such as a monthly view, average mood, and the owner's most common writing
  weekday.
- **FR-2.2:** The system can map entries to emotion symbols using consistent
  rules.
- **FR-2.3:** The system keeps a linked record of committed entry changes.
  Editing or removing an entry must not silently erase the record of its
  earlier committed versions.
- **FR-2.4:** The system checks the linked integrity records and reports when
  an entry may have been changed without permission.

### 5.3 Component 3 — Writing Modes

- **FR-3.1:** The owner can enter text or use voice-to-text where the device
  supports it and the owner grants microphone permission.
- **FR-3.2:** Before asking for writing help, the owner can select one of these
  modes:
  - **Stay As It Is:** keep the owner's words unchanged.
  - **Real Life:** fix spelling and grammar without changing the meaning.
  - **Review:** give suggestions for the owner to consider.
- **FR-3.3:** Writing help must not replace the original entry without the
  owner's approval.
- **FR-3.4:** The owner can view weekly, monthly, life-story, and "On This Day"
  memory summaries.

### 5.4 Component 4 — Access Rules

The system checks the owner's rules before showing or using an entry.

- **FR-4.1:** Nothing is shared by default. An entry is available to an asker
  only when an explicit rule allows it.
- **FR-4.2:** If one rule allows access and another rule denies it, denial
  takes priority.
- **FR-4.3:** Rules can limit access by asker, person, topic, or release date.
- **FR-4.4:** A message with a future release date stays hidden until that date.
- **FR-4.5:** Once legacy access is activated, the system locks the owner's
  access rules so they cannot be changed for that legacy process.
- **FR-4.6:** A trustee has no extra diary access unless the owner has also
  allowed that access through the rules.

### 5.5 Component 5 — Policy Language

Owners need a readable way to write access rules. The policy language is a
small set of instructions that the system can check and apply.

- **FR-5.1:** The project defines the policy language's grammar using EBNF, a
  standard way to describe valid instruction formats.
- **FR-5.2:** A lexer splits a policy into small pieces, such as names, dates,
  and words like "allow" or "deny."
- **FR-5.3:** A parser checks whether those pieces follow the language rules.
- **FR-5.4:** The policy interpreter turns valid rules into facts and rules
  that SWI-Prolog can evaluate.
- **FR-5.5:** Invalid policies show a clear error and are not applied.

### 5.6 Component 6 — Grounded AI Questions and Answers

The AI answers an asker's questions using only information the owner has
allowed.

- **FR-6.1:** The server searches for entries that may relate to the question.
- **FR-6.2:** Before an entry reaches the AI, the server checks that the asker
  is registered, legacy access is active, the access rules allow the entry,
  and any release date has passed.
- **FR-6.3:** The AI may summarize allowed entries or quote the owner's exact
  words.
- **FR-6.4:** Answers that refer to memories include the exact dates of the
  entries used.
- **FR-6.5:** If no entry can be shared, the system gives the same neutral
  response whether an entry does not exist or is not allowed. It must not
  reveal that a hidden entry exists.

## 6. AI Model, Tools, and Instructions

### 6.1 Model

- **FR-AI-1:** The project uses Gemini 2.5 Flash for answers. The app sends
  questions to the Eternita server; the server calls the model over a secure
  connection.
- **FR-AI-2:** The model does not connect directly to the diary database.

### 6.2 Server tools

The server uses these tools before and while preparing an answer:

- **FR-AI-3 — Entry Search:** Find entries that may relate to the asker's
  question. Search results are not shared with the model until they pass the
  access checks.
- **FR-AI-4 — Access Checker:** Apply the owner's rules using SWI-Prolog.
- **FR-AI-5 — Date Checker:** Check that a time-locked message has reached its
  release date.
- **FR-AI-6 — Source Formatter:** Attach entry dates and mark exact quotes so
  the answer can be checked.
- **FR-AI-7 — Safe Reply:** Return the neutral response when no allowed entry
  can answer the question.

### 6.3 Instructions for the AI

- **FR-AI-8:** Use only the allowed entry text provided by the server.
- **FR-AI-9:** Include the date of each entry used to answer.
- **FR-AI-10:** When quoting, use the owner's exact words and do not change
  them.
- **FR-AI-11:** Speak as Eternita, an AI diary assistant. Never claim to be the
  owner or speak as if the owner is still talking.
- **FR-AI-12:** Do not guess, add details, or invent memories.
- **FR-AI-13:** If the allowed entries do not answer the question, say so
  neutrally without revealing whether hidden entries exist.

## 7. Non-Functional Requirements

These requirements describe how the system must protect information and
behave.

### 7.1 Security

- **NFR-SEC-1 — Deny by default:** All diary entries and legacy items are
  private unless an owner's explicit rule allows access.
- **NFR-SEC-2 — Denial takes priority:** If rules conflict, the system denies
  access.
- **NFR-SEC-3 — Check before sharing:** The server checks the asker's identity,
  legacy status, access rules, and release dates before sending entry text to
  the AI.
- **NFR-SEC-4 — Fail safely:** If an identity, rule, date, or integrity check
  fails, the system does not share the entry.
- **NFR-SEC-5 — Secure connections:** Account and diary data sent over a
  network must use HTTPS.
- **NFR-SEC-6 — Change detection:** The system checks its linked integrity
  records and reports unexpected changes.

### 7.2 Privacy

- **NFR-PRIV-1:** Only the entries needed for an allowed answer may be sent to
  the AI.
- **NFR-PRIV-2:** The AI must not receive denied entries, even if they match
  the asker's question.
- **NFR-PRIV-3:** The same neutral reply is used for hidden and non-existent
  information so the system does not reveal what the owner recorded.
- **NFR-PRIV-4:** The repository, demos, and tests use fictional data only.
  Real passwords, private diary entries, and real face data must not be
  committed or used for this project.

### 7.3 Honest AI

- **NFR-HON-1:** Each answer about a memory must be based on allowed diary
  entries and include their dates.
- **NFR-HON-2:** The AI must not invent events, claim that a guess is a fact,
  or add feelings that are not in the allowed entries.
- **NFR-HON-3:** The AI must clearly act as an AI assistant and must not
  impersonate the owner.

### 7.4 Reliability and ease of use

- **NFR-REL-1:** If the system cannot safely finish an access check, it denies
  access instead of sharing the entry.
- **NFR-REL-2:** The same rules, entries, and release date must produce the
  same access decision.
- **NFR-REL-3:** Errors must not show private entry text, passwords, or
  technical error details to users.
- **NFR-USE-1:** The main screens must work on phones, tablets, and laptop
  screens.
- **NFR-USE-2:** Buttons, forms, and error messages must use clear language
  and be usable with a keyboard or touch screen.

## 8. Fictional Data and Legal Notice

This proposal does not include real diary entries or real user records.
Examples in the app, tests, and presentations must use invented names, dates,
and events only.

**Eternita is not a legal will and does not provide legal advice.** A Letter of
Wishes or other message in Eternita is personal guidance only. It does not
replace a Last Will and Testament that meets the legal requirements in the
Philippines.

## 9. Team Review and Approval

The project proposal and finalized requirements were reviewed and approved by
all team members. These requirements will be used as the baseline for design,
implementation, and testing.

| Team member       | Role     | Status   | Date       |
| ----------------- | -------- | -------- | ---------- |
| Arianne Evasco    | Backend  | Approved | 2026-11-25 |
| Lea Marie Gozarin | UI/UX    | Pending  | YYYY-MM-DD |
| Lyza Gwen Guatno  | QA       | Pending  | YYYY-MM-DD |
| Lovely Montaño    | Frontend | Approved | 2026-11-25 |
