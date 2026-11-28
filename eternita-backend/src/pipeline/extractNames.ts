const COMMON_WORDS = Object.freeze([
    "the", "and", "a", "to", "of", "in", "is", "it", "that","Those","My", "for", "on", "with", "as", "this", "by", "an", "be", "are", "from", "at", "or", "but", "not", "It", "The", "They","I",
    "The", "Our", "We", "You", "He", "She", "They", "It", "My", "Your", "His", "Her", "Its", "Our", "Their", "Me", "Him", "Us", "Them",
]);

export function extractNames(text: string): readonly string[] {
    if (typeof text !== "string") {
        throw new TypeError("Text must be a string");
    }

    const words = text.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) ?? [];
    const names = new Set<string>();
    
    for ( const word of words) {
        const isFirstLetterCapitalized = word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase();
        
        if (isFirstLetterCapitalized && !COMMON_WORDS.includes(word)) {
            names.add(word);
        }
    }

    return [...names].sort((left, right) => left.localeCompare(right));
}
