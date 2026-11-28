import {
  Token,
  tokenize,
} from "./lexer";
import { PolicySyntaxError } from "./errors";
import {
  PolicyProgram,
  Protocol,
  PolicyStatement,
  SeeStatement,
  ReleaseStatement,
  CustodyStatement,
  ModeStatement,
  WritingMode,
} from "./ast";

const MODES: WritingMode[] = [
  "verbatim",
  "lightfix",
  "review",
];

export function parsePolicy(
  source: string
): PolicyProgram {
  const tokens = tokenize(source);
  let index = 0;

  const peek = () => tokens[index];
  const advance = () => tokens[index++];
  const isWord = (token: Token) =>
    token.type === "KEYWORD" || token.type === "NAME";

  function fail(
    message: string,
    line?: number
  ): never {
    throw new PolicySyntaxError(
      message,
      line ?? peek().line
    );
  }

  function expectWord(value: string) {
    const token = peek();

    if (
      !isWord(token) ||
      token.value !== value
    ) {
      fail(`Expected "${value}"`);
    }

    advance();
  }

  function expectColon() {
    const token = peek();

    if (token.type !== "SYMBOL" || token.value !== ":") {
      fail('Expected ":"');
    }

    advance();
  }

  function name(): string {
    const token = peek();

    if (!isWord(token)) {
      fail("Expected a name");
    }

    if (
      !/^[a-z][a-z0-9_]{0,30}$/.test(token.value)
    ) {
      fail("Invalid identifier");
    }

    advance();
    return token.value;
  }

  function protocol(): Protocol {
    const line = peek().line;

    expectWord("protocol");
    const owner = name();
    expectColon();

    const statements: PolicyStatement[] = [];

    while (
      peek().type !== "EOF" &&
      !(
        isWord(peek()) &&
        peek().value === "protocol"
      )
    ) {
      statements.push(statement(owner));
    }

    if (statements.length === 0) {
      fail(
        `Protocol "${owner}" has no statements`,
        line
      );
    }

    return {
      name: owner,
      statements,
      line,
    };
  }

  function statement(
    owner: string
  ): PolicyStatement {
    if (peek().value === "may") {
      return see();
    }

    if (peek().value === "release") {
      return release(owner);
    }

    if (peek().value === "transfer") {
      return custody();
    }

    if (peek().value === "default") {
      return mode();
    }

    fail("Unsupported policy statement");
  }

  function see(): SeeStatement {
    const line = peek().line;

    expectWord("may");

    let allow = true;

    if (peek().value === "not") {
      allow = false;
      advance();
    }

    const action = peek().value;

    if (action !== "see" && action !== "read") {
      fail("Unsupported access verb");
    }

    advance();

    const kind = peek().value;

    if (
      kind !== "existence" &&
      kind !== "summary" &&
      kind !== "full"
    ) {
      fail("Unsupported action");
    }

    advance();

    expectWord("of");
    expectWord("entries");

    const by = peek().value;

    if (
      by !== "mentioning" &&
      by !== "tagged"
    ) {
      fail("Unsupported topic type");
    }

    advance();

    const value = name();

    return {
      type: "see",
      allow,
      kind: kind as "existence" | "summary" | "full",
      by:
        by === "mentioning"
          ? "mentions"
          : "tag",
      value,
      line,
    };
  }

  function release(
    owner: string
  ): ReleaseStatement {
    const line = peek().line;

    expectWord("release");
    expectWord("letter");

    const titleParts: string[] = [];

    while (
      peek().type !== "EOF" &&
      !(
        isWord(peek()) &&
        peek().value === "to" &&
        isWord(tokens[index + 1]) &&
        isWord(tokens[index + 2]) &&
        tokens[index + 2]?.value === "when"
      )
    ) {
      titleParts.push(advance().value);
    }

    if (titleParts.length === 0) {
      fail("Letter title must not be empty");
    }

    const title = titleParts.join(" ");

    expectWord("to");
    const recipient = name();

    if (recipient !== owner) {
      fail(
        "Letter recipient must match the surrounding protocol",
        line
      );
    }

    expectWord("when");
    expectWord("date");

    const dateToken = peek();

    if (dateToken.type !== "DATE") {
      fail("Expected a date");
    }

    advance();

    return {
      type: "release",
      title,
      to: recipient,
      on: dateToken.value,
      line,
    };
  }

  function custody(): CustodyStatement {
    const line = peek().line;

    expectWord("transfer");
    expectWord("custody");
    expectWord("to");

    return {
      type: "custody",
      to: name(),
      line,
    };
  }

  function mode(): ModeStatement {
    const line = peek().line;

    expectWord("default");
    expectWord("writing");
    expectWord("mode");

    const token = peek();

    if (
      !MODES.includes(
        token.value as WritingMode
      )
    ) {
      fail("Unsupported writing mode");
    }

    advance();

    return {
      type: "mode",
      mode: token.value as WritingMode,
      line,
    };
  }

  const protocols: Protocol[] = [];
  const names = new Set<string>();

  while (peek().type !== "EOF") {
    const protocolNode = protocol();

    if (names.has(protocolNode.name)) {
      fail(
        `Duplicate protocol for "${protocolNode.name}"`,
        protocolNode.line
      );
    }

    names.add(protocolNode.name);
    protocols.push(protocolNode);
  }

  if (protocols.length === 0) {
    fail("Policy is empty", 1);
  }

  return { protocols };
}
