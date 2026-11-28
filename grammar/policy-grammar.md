program = protocol , { protocol } ;

protocol = "protocol" , identifier , ":" , statement , { statement } ;

statement = permission
| letter_release
| custody_transfer
| default_writing_mode ;

permission = "may" , [ "not" ] , access_verb , information_type ,
"of" , "entries" , topic_condition ;

access_verb = "see" | "read" ;

information_type = "existence" | "summary" ;

topic_condition = "mentioning" , identifier
| "tagged" , identifier ;

letter_release = "release" , "letter" , title_words , "to" , identifier ,
"when" , "date" , date ;

title_words = title_word , { title_word } ;

title_word = word ;

custody_transfer = "transfer" , "custody" , "to" , identifier ;

default_writing_mode = "default" , "writing" , "mode" , writing_mode ;

writing_mode = "verbatim" | "lightfix" | "review" ;

identifier = lowercase_letter , { lowercase_letter | digit | "_" } ;

lowercase_letter = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i"
| "j" | "k" | "l" | "m" | "n" | "o" | "p" | "q" | "r"
| "s" | "t" | "u" | "v" | "w" | "x" | "y" | "z" ;

uppercase_letter = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I"
| "J" | "K" | "L" | "M" | "N" | "O" | "P" | "Q" | "R"
| "S" | "T" | "U" | "V" | "W" | "X" | "Y" | "Z" ;

word = letter , { letter | digit | "\_" } ;

letter = lowercase_letter | uppercase_letter ;

digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" ;

date = year , "-" , month , "-" , day ;

year = digit , digit , digit , digit ;

month = digit , digit ;

day = digit , digit ;

## Grammar explanation

A policy must contain at least one protocol. Each protocol must contain at least one statement. Protocol names must be unique.

A permission statement starts with `may` or `may not`. The Owner can choose `see` or `read`, followed by `existence` or `summary`. Therefore, the parser accepts four permission combinations: `see existence`, `see summary`, `read existence`, and `read summary`.

A permission can select entries by a person mentioned in the entry or by a tag. For example, `mentioning maria` selects entries that mention Maria. `tagged family` selects entries tagged `family`.

A letter release records a letter title, recipient, and release date. The title does not require quotation marks because the parser accepts unquoted titles. The recipient must match the protocol name.

A custody transfer records the intended custody recipient. It does not include a condition in the current parser. It is a declaration only and does not automatically grant the recipient access to diary entries.

A default writing mode records the Owner’s preferred writing mode. The supported modes are `verbatim`, `lightfix`, and `review`. The default is used only when the Owner does not choose a writing mode for a specific entry.

The parser rejects an empty policy, an empty protocol, duplicate protocol names, invalid identifiers, unsupported statements, invalid dates, and unsupported writing modes.

## Handout sample policy

protocol maria:
may see existence of entries mentioning maria
may read summary of entries tagged family
may not read summary of entries tagged health
release letter To my daughter to maria when date 2040-05-01
transfer custody to juan
default writing mode verbatim

## Derivation

program
→ protocol

protocol
→ "protocol" maria ":" statement { statement }

statement 1
→ permission
→ may see existence of entries mentioning maria

statement 2
→ permission
→ may read summary of entries tagged family

statement 3
→ permission
→ may not read summary of entries tagged health

statement 4
→ letter_release
→ release letter To my daughter to maria when date 2040-05-01

statement 5
→ custody_transfer
→ transfer custody to juan

statement 6
→ default_writing_mode
→ default writing mode verbatim
