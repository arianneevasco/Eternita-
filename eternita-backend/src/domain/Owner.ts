import { Vault } from "./Vault";

export class Owner {
  private vault: Vault | null = null;

  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly displayName: string
  ) {}

  createVault(vault: Vault): void {
    if (vault.getOwnerId() !== this.id) {
      throw new Error("Vault does not belong to this Owner");
    }

    this.vault = vault;
  }

  getVault(): Vault | null {
    return this.vault;
  }

  hasVault(): boolean {
    return this.vault !== null;
  }
}