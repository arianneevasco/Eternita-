import { Entry } from "./Entry";

export class LetterOfWishes extends Entry {
  releaseDate: string;
  recipient: string;

  constructor(
    id: string,
    date: string,
    text: string,
    releaseDate: string,
    recipient: string,
    tags: string[] = []
  ) {
    super(id, date, text, tags);

    if (!releaseDate.trim()) {
      throw new Error("Release date cannot be empty.");
    }

    if (!recipient.trim()) {
      throw new Error("Recipient cannot be empty.");
    }

    this.releaseDate = releaseDate;
    this.recipient = recipient;
  }

  describe(): string {
    return `Letter of wishes for ${this.recipient}, to be released on ${this.releaseDate}: ${this.text}`;
  }

  summarize(): string {
    return `A letter of wishes for ${this.recipient}, scheduled for release on ${this.releaseDate}.`;
  }

  isReadable(): boolean {
    const today = new Date().toISOString().split("T")[0];

    return this.text.trim().length > 0 && this.releaseDate <= today;
  }
}