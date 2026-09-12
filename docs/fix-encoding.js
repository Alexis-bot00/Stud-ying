const fs = require("fs");

const file = "./index.html";
const backup = "./index-before-final-encoding-fix.html";

fs.copyFileSync(file, backup);

const text = fs.readFileSync(file, "utf8");

const cp1252 = new Map([
    [0x20AC, 0x80], // €
    [0x201A, 0x82], // ‚
    [0x0192, 0x83], // ƒ
    [0x201E, 0x84], // „
    [0x2026, 0x85], // …
    [0x2020, 0x86], // †
    [0x2021, 0x87], // ‡
    [0x02C6, 0x88], // ˆ
    [0x2030, 0x89], // ‰
    [0x0160, 0x8A], // Š
    [0x2039, 0x8B], // ‹
    [0x0152, 0x8C], // Œ
    [0x017D, 0x8E], // Ž
    [0x2018, 0x91], // ‘
    [0x2019, 0x92], // ’
    [0x201C, 0x93], // “
    [0x201D, 0x94], // ”
    [0x2022, 0x95], // •
    [0x2013, 0x96], // –
    [0x2014, 0x97], // —
    [0x02DC, 0x98], // ˜
    [0x2122, 0x99], // ™
    [0x0161, 0x9A], // š
    [0x203A, 0x9B], // ›
    [0x0153, 0x9C], // œ
    [0x017E, 0x9E], // ž
    [0x0178, 0x9F]  // Ÿ
]);

const bytes = [];

for (const character of text) {
    const code = character.codePointAt(0);

    if (code <= 0xFF) {
        bytes.push(code);
        continue;
    }

    if (cp1252.has(code)) {
        bytes.push(cp1252.get(code));
        continue;
    }

    const utf8 = Buffer.from(character, "utf8");

    for (const byte of utf8) {
        bytes.push(byte);
    }
}

const fixed = Buffer.from(bytes).toString("utf8");

fs.writeFileSync(file, fixed, "utf8");

console.log("");
console.log("Encoding fixed successfully.");
console.log("Backup created:");
console.log(backup);
console.log("");