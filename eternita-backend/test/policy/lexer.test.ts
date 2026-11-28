import { tokenizePolicy } from "../../src/policy/lexer";
import { PolicySyntaxError } from "../../src/policy/policy-syntax-error";
import { describe, expect, it } from "@jest/globals";

describe("Policy lexer", () => {
  it("tokenizes the handout sample policy correctly", () => {
    const handoutSamplePolicy = [
      "protocol maria:",
      "may see existence of entries mentioning maria",
      'may read summary of entries tagged "family"',
      'release letter "To my daughter" to maria when date >= 2040-05-01',
      "transfer custody to adam_jr if trustee unavailable for 90 days",
      "default writing mode: light_fix"
    ].join("\n");

    const tokens = tokenizePolicy(handoutSamplePolicy);

    expect(tokens).toEqual([
      { type: "KEYWORD", value: "protocol", line: 1, column: 1 },
      { type: "NAME", value: "maria", line: 1, column: 10 },
      { type: "SYMBOL", value: ":", line: 1, column: 15 },

      { type: "KEYWORD", value: "may", line: 2, column: 1 },
      { type: "KEYWORD", value: "see", line: 2, column: 5 },
      { type: "KEYWORD", value: "existence", line: 2, column: 9 },
      { type: "KEYWORD", value: "of", line: 2, column: 19 },
      { type: "KEYWORD", value: "entries", line: 2, column: 22 },
      { type: "KEYWORD", value: "mentioning", line: 2, column: 30 },
      { type: "NAME", value: "maria", line: 2, column: 41 },

      { type: "KEYWORD", value: "may", line: 3, column: 1 },
      { type: "KEYWORD", value: "read", line: 3, column: 5 },
      { type: "KEYWORD", value: "summary", line: 3, column: 10 },
      { type: "KEYWORD", value: "of", line: 3, column: 18 },
      { type: "KEYWORD", value: "entries", line: 3, column: 21 },
      { type: "KEYWORD", value: "tagged", line: 3, column: 29 },
      { type: "STRING", value: "family", line: 3, column: 36 },

      { type: "KEYWORD", value: "release", line: 4, column: 1 },
      { type: "KEYWORD", value: "letter", line: 4, column: 9 },
      { type: "STRING", value: "To my daughter", line: 4, column: 16 },
      { type: "KEYWORD", value: "to", line: 4, column: 33 },
      { type: "NAME", value: "maria", line: 4, column: 36 },
      { type: "KEYWORD", value: "when", line: 4, column: 42 },
      { type: "KEYWORD", value: "date", line: 4, column: 47 },
      { type: "SYMBOL", value: ">=", line: 4, column: 52 },
      { type: "DATE", value: "2040-05-01", line: 4, column: 55 },

      { type: "KEYWORD", value: "transfer", line: 5, column: 1 },
      { type: "KEYWORD", value: "custody", line: 5, column: 10 },
      { type: "KEYWORD", value: "to", line: 5, column: 18 },
      { type: "NAME", value: "adam_jr", line: 5, column: 21 },
      { type: "KEYWORD", value: "if", line: 5, column: 29 },
      { type: "KEYWORD", value: "trustee", line: 5, column: 32 },
      { type: "KEYWORD", value: "unavailable", line: 5, column: 40 },
      { type: "KEYWORD", value: "for", line: 5, column: 52 },
      { type: "NUMBER", value: "90", line: 5, column: 56 },
      { type: "KEYWORD", value: "days", line: 5, column: 59 },

      { type: "KEYWORD", value: "default", line: 6, column: 1 },
      { type: "KEYWORD", value: "writing", line: 6, column: 9 },
      { type: "KEYWORD", value: "mode", line: 6, column: 17 },
      { type: "SYMBOL", value: ":", line: 6, column: 21 },
      { type: "NAME", value: "light_fix", line: 6, column: 23 },

      { type: "EOF", value: "", line: 6, column: 32 }
    ]);
  });

  it("stores type, value, line, and column for each token", () => {
    const tokens = tokenizePolicy("GRANT existence TO ana;");

    expect(tokens[0]).toEqual({
      type: "KEYWORD",
      value: "GRANT",
      line: 1,
      column: 1
    });

    expect(tokens[1]).toEqual({
      type: "KEYWORD",
      value: "existence",
      line: 1,
      column: 7
    });
  });

  it("recognizes keywords, names, strings, dates, and numbers", () => {
    const tokens = tokenizePolicy(
      'GRANT full TO ana ON 2040-05-01 FOR 30;'
    );

    const types = tokens.map((token) => token.type);

    expect(types).toContain("KEYWORD");
    expect(types).toContain("NAME");
    expect(types).toContain("DATE");
    expect(types).toContain("NUMBER");
  });

  it("raises PolicySyntaxError for an unknown character", () => {
    expect(() => tokenizePolicy("GRANT @;"))
      .toThrow(PolicySyntaxError);
  });

  it("raises PolicySyntaxError for an unterminated string", () => {
    expect(() => tokenizePolicy('POLICY "unfinished'))
      .toThrow(PolicySyntaxError);
  });
});
