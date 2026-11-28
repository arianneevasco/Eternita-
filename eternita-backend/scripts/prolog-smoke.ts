import { spawnSync } from "node:child_process";
import path from "node:path";

const prologFile = path.resolve(process.cwd(), "prolog/access_rules.pl");

const result = spawnSync(
  "swipl",
  [
    "-q",
    "-f",
    prologFile,
    "-g",
    "access(ana,entry_1,existence),writeln(allowed),halt."
  ],
  { encoding: "utf8" }
);

if (result.error) {
  throw new Error(
    "SWI-Prolog is not installed or is not available on PATH."
  );
}

if (result.status !== 0 || !result.stdout.includes("allowed")) {
  throw new Error(
    `Prolog rule failed.\n${result.stderr || result.stdout}`
  );
}

console.log("SUCCESS: TypeScript called the Prolog access rule.");