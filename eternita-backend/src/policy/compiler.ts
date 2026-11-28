import { createHash } from "crypto";
import { parsePolicy } from "./parser";
import {
  PolicyProgram,
  WritingMode,
} from "./ast";

export interface CompiledPolicy {
  schemaVersion: 1;
  facts: string[];
  releases: {
    id: string;
    to: string;
    title: string;
    date: string;
  }[];
  custodyDeclarations: {
    to: string;
  }[];
  defaultMode: WritingMode;
}

export interface PolicyEntry {
  entryId: string;
  people?: string[];
  tags?: string[];
}

const NAME =
  /^[a-z][a-z0-9_]{0,30}$/;

function checkedName(
  value: string,
  line: number
): string {
  if (!NAME.test(value)) {
    throw new Error(
      `Line ${line}: invalid identifier "${value}"`
    );
  }

  return value;
}

export function getLetterReleaseId(title: string): string {
  const normalized = title.trim();

  if (!normalized) {
    throw new Error(
      "Letter title must not be empty"
    );
  }

  return createHash("sha256")
    .update(normalized, "utf8")
    .digest("hex");
}

function prologAtom(value: string): string {
  if (/^[a-z][a-zA-Z0-9_]*$/.test(value)) {
    return value;
  }

  return `'${value.replace(/'/g, "''")}'`;
}

export function compilePolicy(
  source: string,
  entries: PolicyEntry[] = [],
  identityMap: Record<string, string> = {},
): CompiledPolicy {
  const program: PolicyProgram =
    parsePolicy(source);

  const facts: string[] = [];
  const releases: CompiledPolicy["releases"] = [];
  const custodyDeclarations:
    CompiledPolicy["custodyDeclarations"] = [];

  const releaseKeys = new Set<string>();

  let defaultMode: WritingMode | undefined;

  for (const protocol of program.protocols) {
    const viewer = checkedName(
      protocol.name,
      protocol.line
    );

    for (const statement of protocol.statements) {
      if (statement.type === "see") {
        const action = statement.kind;

        for (const entry of entries) {
          const values = statement.by === "mentions"
            ? entry.people ?? []
            : entry.tags ?? [];

          if (!values.includes(statement.value)) {
            continue;
          }

          const predicate = statement.allow ? "grant" : "deny";
          const fact = `${predicate}(${prologAtom(identityMap[viewer] ?? viewer)},${prologAtom(entry.entryId)},${action}).`;

          if (!facts.includes(fact)) {
            facts.push(fact);
          }
        }
      }

      if (statement.type === "release") {
        const id = getLetterReleaseId(statement.title);
        const key = `${id}:${statement.to}`;

        if (releaseKeys.has(key)) {
          throw new Error(
            `Line ${statement.line}: duplicate release`
          );
        }

        releaseKeys.add(key);

        releases.push({
          id,
          to: statement.to,
          title: statement.title,
          date: statement.on,
        });
      }

      if (statement.type === "custody") {
        const recipient = checkedName(
          statement.to,
          statement.line
        );

        custodyDeclarations.push({
          to: recipient,
        });
      }

      if (statement.type === "mode") {
        if (
          defaultMode &&
          defaultMode !== statement.mode
        ) {
          throw new Error(
            `Line ${statement.line}: conflicting writing modes`
          );
        }

        defaultMode = statement.mode;
      }
    }
  }

  return {
    schemaVersion: 1,
    facts,
    releases,
    custodyDeclarations,
    defaultMode: defaultMode ?? "verbatim",
  };
}
