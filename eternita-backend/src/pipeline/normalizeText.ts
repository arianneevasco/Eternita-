export function normalizeText(text: string): string {
    if (typeof text !== "string") {
        throw new TypeError("Text must be a string");
    }

    return text.replace(/\s+/g, " ").trim();
}