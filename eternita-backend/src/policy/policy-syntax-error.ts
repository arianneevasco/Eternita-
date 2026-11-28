export class PolicySyntaxError extends Error {
  constructor(
    message: string,
    public readonly line: number,
    public readonly column: number
  ) {
    super(`PolicySyntaxError at line ${line}, column ${column}: ${message}`);
    this.name = "PolicySyntaxError";
  }
}