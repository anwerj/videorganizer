export function splitName(name) {
    const i = name.lastIndexOf('.');
    return i === -1 ? { base: name, ext: "" } : { base: name.slice(0, i), ext: name.slice(i) };
}

export function extractTsFromBase(base) {
    // matches ...__ts_12_345_678 at the END of base (before extension)
    const m = base.match(/^(.*?)(__ts_[0-9_]+)$/);
    if (!m) return { baseNoTs: base, ts: [] };
    const raw = m[2]; // "__ts_..."
    const nums = raw.slice("__ts_".length).split('_').map(s => parseInt(s, 10)).filter(n => !isNaN(n));
    return { baseNoTs: m[1], ts: nums };
}

export function normalizeTs(list) {
    if (!list || !list.length) return [];
    // sort asc, keep entries at least 500ms apart
    const sorted = [...list].sort((a, b) => a - b);
    const out = [];
    for (const t of sorted) {
        if (out.length === 0 || Math.abs(t - out[out.length - 1]) >= 500) out.push(t);
    }
    return out;
}
