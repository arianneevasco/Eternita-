import { Protocol } from "./Protocol";

export class Beneficiary {
  private protocol: Protocol | null = null;

  constructor(
    public readonly id: string,
    public readonly handle: string,
    public readonly displayName: string
  ) {}

  assignProtocol(protocol: Protocol): void {
    if (protocol.beneficiaryId !== this.id) {
      throw new Error("Protocol does not belong to this Beneficiary");
    }

    this.protocol = protocol;
  }

  getProtocol(): Protocol | null {
    return this.protocol;
  }

  hasProtocol(): boolean {
    return this.protocol !== null;
  }
}