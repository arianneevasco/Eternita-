// @ts-expect-error tau-prolog does not provide TypeScript declarations.
import pl from "tau-prolog";

export interface PolicyEvaluationInput {
  facts: string;
  query: string;
}

export interface PolicyEvaluationResult {
  allowed: boolean;
  error?: string;
}

export async function evaluatePolicy(
  input: PolicyEvaluationInput
): Promise<PolicyEvaluationResult> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: PolicyEvaluationResult) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        resolve(result);
      }
    };
    const timeout = setTimeout(() => {
      finish({ allowed: false, error: "Prolog evaluation timed out." });
    }, 2000);
    const failClosed = (error: unknown) => finish({ allowed: false, error: String(error) });

    try {
    const session = pl.create(1000);
      // Policy semantics: absence of a grant denies access. Grants are
      // hierarchical (full > summary > existence), and any matching deny at
      // or above the requested level overrides an allow.
      const program = `${input.facts}
deny(_, _, _) :- fail.
access_level_rank(existence, 1).
access_level_rank(summary, 2).
access_level_rank(full, 3).

denies_at_or_above(Viewer, Entry, Level) :-
    deny(Viewer, Entry, DeniedLevel),
    access_level_rank(DeniedLevel, DeniedRank),
    access_level_rank(Level, RequestedRank),
    DeniedRank =< RequestedRank.

grants_at_or_above(Viewer, Entry, Level) :-
    grant(Viewer, Entry, GrantedLevel),
    access_level_rank(GrantedLevel, GrantedRank),
    access_level_rank(Level, RequestedRank),
    GrantedRank >= RequestedRank.

access_allowed(Viewer, Entry, Level) :-
    grants_at_or_above(Viewer, Entry, Level),
    \\+ denies_at_or_above(Viewer, Entry, Level).`;

    session.consult(program, {
      success: () => {
        session.query(input.query, {
          success: () => {
            session.answer({
              success: () => {
                finish({ allowed: true });
              },
              fail: () => {
                finish({ allowed: false });
              },
              error: failClosed,
            });
          },
          error: failClosed,
        });
      },
      error: failClosed,
    });
    } catch (error) {
      failClosed(error);
    }
  });
}
