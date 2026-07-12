import { splitName, extractTsFromBase } from "./utils.js";

export function parseFilename(filename, catalog = { sections: [], properties: [] }) {
    const { base, ext } = splitName(filename || "");
    const { baseNoTs } = extractTsFromBase(base);
    const sectionCodes = new Set((catalog.sections || []).map((s) => s.code));
    const propertyCodes = new Set((catalog.properties || []).map((p) => p.code));
    const sections = [];
    const properties = [];
    let rest = baseNoTs;

    while (rest.length >= 3) {
        const m = rest.match(/^(\d{2})-/);
        if (!m || !sectionCodes.has(m[1])) break;
        sections.push(m[1]);
        rest = rest.slice(3);
    }
    while (rest.length >= 2) {
        const m = rest.match(/^([a-z])-/);
        if (!m || !propertyCodes.has(m[1])) break;
        properties.push(m[1]);
        rest = rest.slice(2);
    }
    if (rest.endsWith("-")) rest = rest.slice(0, -1);

    return { sections, properties, title: rest, ext };
}

export function composeFilenameBase({ sections = [], properties = [], title = "" }) {
    const parts = [];
    for (const code of sections) parts.push(code);
    for (const code of [...properties].sort()) parts.push(code);
    if (title) parts.push(title);
    return parts.join("-");
}

export function basenameFromPath(path) {
    if (!path) return "";
    const parts = path.replace(/\\/g, "/").split("/");
    return parts[parts.length - 1] || "";
}
