import { PolicySyntaxError } from "./policy-syntax-error";
import { Token, TokenType } from "./token";
export {Token, TokenType};

const KEYWORDS = new Set([
  "protocol",
  "grant",
  "revoke",
  "may",
  "see",
  "existence",
  "of",
  "entries",
  "mentioning",
  "read",
  "summary",
  "full",
  "tagged",
  "release",
  "letter",
  "to",
  "when",
  "date",
  "transfer",
  "custody",
  "if",
  "trustee",
  "unavailable",
  "for",
  "days",
  "default",
  "writing",
  "mode"
]);

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}/;
const NUMBER_PATTERN = /^\d+/;
const NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*/;

export function tokenizePolicy(source: string): Token[] {
  const tokens: Token[] = [];

  let position = 0;
  let line = 1;
  let column = 1;

  const advance = (count = 1) => {
    for (let i = 0; i < count; i++) {
      if (source[position] === "\n") {
        line++;
        column = 1;
      } else {
        column++;
      }

      position++;
    }
  };

  while (position < source.length) {
    const character = source[position];
    const startLine = line;
    const startColumn = column;

    // Ignore spaces, tabs, and newlines.
    if (character === " " || character === "\t" || character === "\n" || character === "\r") {
      advance();
      continue;
    }

    // String literal
    if (character === '"') {
      advance();
      let value = "";

      while (position < source.length && source[position] !== '"') {
        value += source[position];
        advance();
      }

      if (position >= source.length) {
        throw new PolicySyntaxError(
          "Unterminated string literal.",
          startLine,
          startColumn
        );
      }

      advance(); // Closing quote
      tokens.push({
        type: "STRING",
        value,
        line: startLine,
        column: startColumn
      });

      continue;
    }

    // Date literal: YYYY-MM-DD
    const dateMatch = source.slice(position).match(DATE_PATTERN);

    if (dateMatch) {
      const value = dateMatch[0];
      advance(value.length);

      tokens.push({
        type: "DATE",
        value,
        line: startLine,
        column: startColumn
      });

      continue;
    }

    // Number literal
    const numberMatch = source.slice(position).match(NUMBER_PATTERN);

    if (numberMatch) {
      const value = numberMatch[0];
      advance(value.length);

      tokens.push({
        type: "NUMBER",
        value,
        line: startLine,
        column: startColumn
      });

      continue;
    }

    // Keyword or name
    const nameMatch = source.slice(position).match(NAME_PATTERN);

    if (nameMatch) {
      const value = nameMatch[0];
      advance(value.length);

      const type: TokenType = KEYWORDS.has(value.toLowerCase())
        ? "KEYWORD"
        : "NAME";

      tokens.push({
        type,
        value,
        line: startLine,
        column: startColumn
      });

      continue;
    }

    // Two-character operator: >=
    if (source.startsWith(">=", position)) {
      advance(2);

      tokens.push({
        type: "SYMBOL",
        value: ">=",
        line: startLine,
        column: startColumn
      });

      continue;
    }

    // Symbols
    if (":;,(){}".includes(character)) {
      advance();

      tokens.push({
        type: "SYMBOL",
        value: character,
        line: startLine,
        column: startColumn
      });

      continue;
    }

    // Unknown character
    throw new PolicySyntaxError(
      `Unknown character '${character}'.`,
      startLine,
      startColumn
    );
  }

  tokens.push({
    type: "EOF",
    value: "",
    line,
    column
  });

  return tokens;
}

// Parser compatibility alias.
export const tokenize = tokenizePolicy;
