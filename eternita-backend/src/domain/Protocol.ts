import { Grant } from "./Grant";

export class Protocol {
  private grants: Grant[] = [];
  private isFrozen = false;

  constructor(
    public readonly id: string,
    public readonly beneficiaryId: string,
    public readonly name: string
  ) {}

  addGrant(grant: Grant): void {
    this.ensureNotFrozen();
    this.grants.push(grant);
  }

  getGrants(): Grant[] {
    return [...this.grants];
  }

  hasGrant(grant: Grant): boolean {
    return this.grants.some((existingGrant) =>
      existingGrant.matches(grant.action, grant.topic)
    );
  }

  freeze(): void {
    this.isFrozen = true;
  }

  isProtocolFrozen(): boolean {
    return this.isFrozen;
  }

  private ensureNotFrozen(): void {
    if (this.isFrozen) {
      throw new Error("Protocol is frozen and cannot be changed");
    }
  }
}