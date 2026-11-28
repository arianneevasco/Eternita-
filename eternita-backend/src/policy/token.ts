export type TokenType =
  | "KEYWORD"
  | "NAME"
  | "STRING"
  | "DATE"
  | "NUMBER"
  | "SYMBOL"
  | "EOF";

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}