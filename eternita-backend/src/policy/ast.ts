export type WritingMode =
  | "verbatim"
  | "lightfix"
  | "review";

export interface SeeStatement {
  type: "see";
  allow: boolean;
  kind: "existence" | "summary" | "full";
  by: "mentions" | "tag";
  value: string;
  line: number;
}

export interface ReleaseStatement {
  type: "release";
  title: string;
  to: string;
  on: string;
  line: number;
}

export interface CustodyStatement {
  type: "custody";
  to: string;
  line: number;
}

export interface ModeStatement {
  type: "mode";
  mode: WritingMode;
  line: number;
}

export type PolicyStatement =
  | SeeStatement
  | ReleaseStatement
  | CustodyStatement
  | ModeStatement;

export interface Protocol {
  name: string;
  statements: PolicyStatement[];
  line: number;
}

export interface PolicyProgram {
  protocols: Protocol[];
}
