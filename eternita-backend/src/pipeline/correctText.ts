export function correctText(text: string): string {
    if (typeof text !== "string") {
        throw new TypeError("Text must be a string");
    }
    let corrected = text.trim();

    corrected = corrected.replace(/\s+([.,!?;:])/g, "$1");
    corrected = corrected.replace(/([.,!?;:])(?=[A-Za-z])/g, "$1");

    if (corrected.length > 0) {
        corrected = corrected[0].toUpperCase() + corrected.slice(1);
    }

    if (corrected.length > 0 && !/[.!?]$/.test(corrected)) {
        corrected +=".";
    }
    return corrected;
}
