/**
 * Resolves the "Customer PO" cell of the Oracle export into registered PO numbers.
 *
 * The cell is free text. Examples:
 *   044/PO/CRMI/2025-03082026-IV
 *   044/PO/CRMI/2025-CRMI/10072026/04/WW
 *   188/PO/CRMI/2025+009/PO/CRMI/2026-04082026-VI.
 *   051/PO/CRMI/2026 & 044/PO/CRMI/2026
 *   062/PO/CRMI/2026,162+188/PO/CRMI/2025-180826-VII      <- "162" is shorthand for 162/PO/CRMI/2025
 *
 * Strategy (no splitting by separator, because "-" is both a suffix separator and a PO separator):
 *   1. Every registered po_number from the database is searched inside the text ("contains"),
 *      with character boundaries so that 44/PO/CRMI/2025 does not match inside 044/PO/CRMI/2025.
 *   2. PO-shaped tokens (NNN/XX/.../YYYY) are also detected by pattern, including shorthand numbers
 *      that inherit the tail of the next full PO on their right. A token that is not registered
 *      is reported as unknown, so a cell with one unregistered PO is never treated as valid.
 *
 * The normalisation keeps the text length (1 character -> 1 character), so the returned character
 * spans can be used to highlight the raw cell text in the UI.
 */

const normalizeText = (value) => String(value === undefined || value === null ? '' : value)
    .replace(/\s/g, ' ')
    .toUpperCase();

const isAlnum = (ch) => ch !== undefined && ch !== '' && /[A-Z0-9]/.test(ch);

// Full PO-shaped token, e.g. 044/PO/CRMI/2025 or 003/CAM/2023
const FULL_PO_REGEX = /(?<![A-Z0-9\/])(\d{3,4})((?:\/[A-Z]{1,8}){1,3}\/\d{4})(?![A-Z0-9])/g;

// Bare number followed by separators and finally a full PO: "162" in "162+188/PO/CRMI/2025".
// It must not follow "-" : a number after "-" is normally the suffix of the previous PO
// (e.g. "044/PO/CRMI/2025-1408+051/PO/CRMI/2026"). Known limitation: shorthand right after "-" is not expanded.
const BARE_NUMBER_REGEX = /(?<![A-Z0-9\/.\-])(\d{3,4})(?=\s*[,+&]\s*(?:\d{3,4}\s*[,+&]\s*)*\d{3,4}\/)/g;

/**
 * @param {string} rawText                    value of the Customer PO cell
 * @param {Map<string,string>} registeredPoMap normalised PO number -> PO number as stored in the database
 * @returns {{ matched: string[], unknown: {text:string,start:number,end:number}[], expanded: {from:string,to:string}[] }}
 */
const resolvePoReferences = (rawText, registeredPoMap) => {
    const text = normalizeText(rawText);
    const matchedKeys = new Set();

    // 1. Registered PO numbers found anywhere in the text (with boundaries)
    for (const key of registeredPoMap.keys()) {
        if (!key) continue;
        let from = 0;
        let idx;
        while ((idx = text.indexOf(key, from)) !== -1) {
            const before = text[idx - 1];
            const after = text[idx + key.length];
            if (!isAlnum(before) && !isAlnum(after)) {
                matchedKeys.add(key);
                break;
            }
            from = idx + 1;
        }
    }

    // 2. PO-shaped tokens by pattern
    const fullTokens = [];
    let m;
    FULL_PO_REGEX.lastIndex = 0;
    while ((m = FULL_PO_REGEX.exec(text)) !== null) {
        fullTokens.push({
            start: m.index,
            end: m.index + m[0].length,
            number: m[1],
            tail: m[2],
            token: m[1] + m[2]
        });
    }

    const candidates = fullTokens.map((f) => ({ text: f.token, start: f.start, end: f.end, shorthand: false }));
    const expanded = [];

    BARE_NUMBER_REGEX.lastIndex = 0;
    while ((m = BARE_NUMBER_REGEX.exec(text)) !== null) {
        const next = fullTokens.find((f) => f.start > m.index);
        if (!next) continue;
        const token = m[1] + next.tail;
        candidates.push({ text: token, start: m.index, end: m.index + m[1].length, shorthand: true });
        expanded.push({ from: m[1], to: token });
    }

    const unknown = [];
    const seenUnknown = new Set();
    candidates.forEach((c) => {
        if (registeredPoMap.has(c.text)) {
            matchedKeys.add(c.text);
        } else if (!seenUnknown.has(c.text + '@' + c.start)) {
            seenUnknown.add(c.text + '@' + c.start);
            unknown.push({ text: c.text, start: c.start, end: c.end });
        }
    });

    return {
        matched: [...matchedKeys].map((k) => registeredPoMap.get(k)),
        unknown: unknown.sort((a, b) => a.start - b.start),
        expanded
    };
};

const buildRegisteredPoMap = (poRows) => {
    const map = new Map();
    poRows.forEach((po) => {
        const key = normalizeText(po.po_number).trim();
        if (key && !map.has(key)) map.set(key, po.po_number);
    });
    return map;
};

module.exports = { resolvePoReferences, buildRegisteredPoMap, normalizeText };
