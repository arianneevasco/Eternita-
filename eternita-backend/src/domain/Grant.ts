export type GrantAction = "existence" | "summary" | "metadata" | "quotation";

export type GrantEffect = "allow" | "deny";

export type GrantTopic =
  | { type: "mentioning"; value: string }
  | { type: "tagged"; value: string };

export class Grant {
  constructor(
    public readonly id: string,
    public readonly action: GrantAction,
    public readonly topic: GrantTopic,
    public readonly effect: GrantEffect
  ) {}

  matches(action: GrantAction, topic: GrantTopic): boolean {
    return (
      this.action === action &&
      this.topic.type === topic.type &&
      this.topic.value === topic.value
    );
  }

  isAllow(): boolean {
    return this.effect === "allow";
  }

  isDeny(): boolean {
    return this.effect === "deny";
  }
}