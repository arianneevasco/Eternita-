# Policy Grammar Review

## Review date

2026-11-22

## Reviewed deliverable

- `grammar/policy-grammar.md`
- `eternita-backend/test/policy-parser.test.ts`

## Statement types reviewed

| Statement type       | Meaning agreed by team                                                     |
| -------------------- | -------------------------------------------------------------------------- |
| Protocol permission  | Controls whether a registered person may receive limited diary information |
| Letter release       | Controls when a letter may be released to a recipient                      |
| Custody transfer     | Records the intended custody recipient                                     |
| Default writing mode | Records the Owner’s preferred writing mode                                 |

## Access rules agreed

| Rule                        | Team decision                                                         |
| --------------------------- | --------------------------------------------------------------------- |
| Deny by default             | If no permission exists, access is denied                             |
| Deny overrides allow        | If allow and deny conflict, deny wins                                 |
| Action-specific permissions | Existence and summary permissions remain separate                     |
| Custody transfer            | Recognized and recorded but does not automatically grant diary access |
| Frozen policy               | A frozen policy cannot be changed                                     |

## Sample programs reviewed

| Sample program | Statement types used                          | Team decision |
| -------------- | --------------------------------------------- | ------------- |
| Sample 1       | Protocol permissions                          | Accepted      |
| Sample 2       | Letter release and custody transfer           | Accepted      |
| Sample 3       | Protocol permissions and default writing mode | Accepted      |

## Handout sample policy

| Acceptance criterion          | Status | Evidence                                                                                                                                              |
| ----------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Handout sample can be derived | Met    | The handout sample and its derivation are included in [`grammar/policy-grammar.md`](../grammar/policy-grammar.md), and the syntax matches the parser. |

The handout sample uses all four statement types:

- Protocol permissions
- Letter release
- Custody transfer
- Default writing mode

## Parser test result

The policy parser tests passed.

```text
Test Suites: 1 passed, 1 total
Tests:       10 passed, 10 total
```

## Team agreement

The team agrees that the grammar supports protocol permissions, letter release, custody transfer, and default writing mode. The team also agrees that denied entries must never reach Gemini and that custody transfer must not automatically grant diary access.

## Reviewers

| Team member          | Review status | Date       |
| -------------------- | ------------- | ---------- |
| Arianne R. Evasco    | Approved      | 2026-11-22 |
| Lea Marie B. Gozarin | Approved      | 2026-11-22 |
| Lyza Gwen B. Guatno  | Approved      | 2026-11-22 |
| Lovely E. Montaño    | Approved      | 2026-11-22 |
