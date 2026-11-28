import { Entry } from "./Entry";

export class DiaryEntry extends Entry {
  mood: string;

  constructor(
    id: string,
    date: string,
    text: string,
    tags: string[] = [],
    mood: string = "neutral"
  ) {
    super(id, date, text, tags);

    this.mood = mood;
  }

  describe(): string {
    return `Diary entry from ${this.date}: ${this.text}`;
  }

  summarize(): string {
    const firstSentence = this.text.split(".")[0].trim();

    return firstSentence || "No summary available.";
  }

  isReadable(): boolean {
    return this.text.trim().length > 0;
  }
}