import { Owner } from "./Owner";
import { Beneficiary } from "./Beneficiary";
import { Protocol } from "./Protocol";
import { Grant } from "./Grant";

export interface VaultEntry {
  id: string;
  title: string;
  content: string;
  tags: string[];
  mentionedPeople: string[];
}

export class Vault {
  private entries: VaultEntry[] = [];
  private protocols: Protocol[] = [];
  private isFrozen = false;

  constructor(
    private readonly id: string,
    private readonly ownerId: string
  ) {}

  getOwnerId(): string {
    return this.ownerId;
  }

  addEntry(entry: VaultEntry): void {
    this.ensureNotFrozen();
    this.entries.push(entry);
  }

  getEntryCount(): number {
    return this.entries.length;
  }

  getEntriesForOwner(): VaultEntry[] {
    return [...this.entries];
  }

  getPermittedEntries(beneficiary: Beneficiary): VaultEntry[] {
    const protocol = beneficiary.getProtocol();

    if (!protocol) {
      return [];
    }

    return this.entries.filter((entry) =>
      this.isEntryPermitted(protocol, entry)
    );
  }

  addProtocol(protocol: Protocol): void {
    this.ensureNotFrozen();
    this.protocols.push(protocol);
  }

  getProtocolForBeneficiary(beneficiaryId: string): Protocol | null {
    return (
      this.protocols.find(
        (protocol) => protocol.beneficiaryId === beneficiaryId
      ) ?? null
    );
  }

  freeze(): void {
    this.isFrozen = true;
  }

  isVaultFrozen(): boolean {
    return this.isFrozen;
  }

  private isEntryPermitted(
    protocol: Protocol,
    entry: VaultEntry
  ): boolean {
    const actions: Array<"existence" | "summary"> = [
      "existence",
      "summary",
    ];

    for (const action of actions) {
      if (this.hasMatchingDeny(protocol, action, entry)) {
        return false;
      }
    }

    return this.hasMatchingAllow(protocol, entry);
  }

  private hasMatchingDeny(
    protocol: Protocol,
    action: "existence" | "summary",
    entry: VaultEntry
  ): boolean {
    return protocol.getGrants().some((grant) =>
      grant.isDeny() &&
      grant.matches(action, { type: "tagged", value: "health" }) &&
      entry.tags.includes("health")
    );
  }

  private hasMatchingAllow(protocol: Protocol, entry: VaultEntry): boolean {
    return protocol.getGrants().some((grant) =>
      grant.isAllow() && this.grantMatchesEntry(grant, entry)
    );
  }

  private grantMatchesEntry(
    grant: Grant,
    entry: VaultEntry
  ): boolean {
    if (grant.topic.type === "mentioning") {
      return entry.mentionedPeople.includes(grant.topic.value);
    }

    return entry.tags.includes(grant.topic.value);
  }

  private ensureNotFrozen(): void {
    if (this.isFrozen) {
      throw new Error("Vault is frozen and cannot be changed");
    }
  }
}