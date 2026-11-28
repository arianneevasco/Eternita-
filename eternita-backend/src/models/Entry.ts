export abstract class Entry {
  readonly id: string;
  date: string;
  text: string;
  tags: string[];

  constructor(id: string, date: string, text: string, tags: string[] = []) {
    if (!id.trim()) {
      throw new Error("Entry id cannot be empty.");
    }

    if (!date.trim()) {
      throw new Error("Entry date cannot be empty.");
    }

    this.id = id;
    this.date = date;
    this.text = text;
    this.tags = [...tags];
  }

  addTag(tag: string): void {
    const cleanTag = tag.trim();

    if (!cleanTag) {
      throw new Error("Tag cannot be empty.");
    }

    if (!this.tags.includes(cleanTag)) {
      this.tags.push(cleanTag);
    }
  }

  hasTag(tag: string): boolean {
    return this.tags.includes(tag.trim());
  }

  abstract describe(): string;

  abstract summarize(): string;

  abstract isReadable(): boolean;
}