export const TS_PREFIX = "-ts_";
export const AUDIO_DELIM = "_a_";
export const CS_MS = 10;
export const COLLISION_MS = 100;
export const MARKER_IMAGE = "image"; // default timestamp block in filename (key: t)
export const MARKER_AUDIO = "audio"; // audio-specific block (key: a)

export function splitName(name) {
    const i = name.lastIndexOf('.');
    return i === -1 ? { base: name, ext: "" } : { base: name.slice(0, i), ext: name.slice(i) };
}

export function toCs(ms) {
    return Math.round(ms / CS_MS);
}

export function fromCs(cs) {
    return cs * CS_MS;
}

export function sortMarkers(markers) {
    if (!markers || !markers.length) return [];
    return [...markers].sort((a, b) => a.ms - b.ms);
}

export function encodeBlock(msList) {
    if (!msList || !msList.length) return "";
    const sorted = [...msList].sort((a, b) => a - b);
    const cs = sorted.map(toCs);
    const parts = [String(cs[0])];
    for (let i = 1; i < cs.length; i++) {
        parts.push(String(cs[i] - cs[i - 1]));
    }
    return parts.join("_");
}

export function decodeBlock(csParts) {
    if (!csParts || !csParts.length) return [];
    const nums = csParts.map(s => parseInt(s, 10)).filter(n => !isNaN(n));
    if (!nums.length) return [];
    const cs = [nums[0]];
    for (let i = 1; i < nums.length; i++) {
        cs.push(cs[i - 1] + nums[i]);
    }
    return cs.map(fromCs);
}

export function encodeMarkers(markers) {
    const sorted = sortMarkers(markers);
    if (!sorted.length) return "";

    const images = sorted.filter(m => m.type === MARKER_IMAGE).map(m => m.ms);
    const audio = sorted.filter(m => m.type === MARKER_AUDIO).map(m => m.ms);

    if (!images.length && !audio.length) return "";

    let suffix = TS_PREFIX;
    if (images.length && audio.length) {
        suffix += encodeBlock(images) + AUDIO_DELIM + encodeBlock(audio);
    } else if (images.length) {
        suffix += encodeBlock(images);
    } else {
        suffix += "a_" + encodeBlock(audio);
    }
    return suffix;
}

export function decodeMarkers(suffix) {
    if (!suffix || !suffix.startsWith(TS_PREFIX)) return [];
    const body = suffix.slice(TS_PREFIX.length);

    let imagePart = "";
    let audioPart = null;

    const audioIdx = body.indexOf(AUDIO_DELIM);
    if (audioIdx === -1) {
        if (body.startsWith("a_")) {
            audioPart = body.slice(2);
        } else {
            imagePart = body;
        }
    } else {
        imagePart = body.slice(0, audioIdx);
        audioPart = body.slice(audioIdx + AUDIO_DELIM.length);
    }

    const markers = [];
    if (imagePart) {
        const parts = imagePart.split("_").filter(Boolean);
        for (const ms of decodeBlock(parts)) {
            markers.push({ ms, type: MARKER_IMAGE });
        }
    }
    if (audioPart) {
        const parts = audioPart.split("_").filter(Boolean);
        for (const ms of decodeBlock(parts)) {
            markers.push({ ms, type: MARKER_AUDIO });
        }
    }
    return sortMarkers(markers);
}

export function extractTsFromBase(base) {
    const m = base.match(/^(.*?)(-ts_(?:[0-9]+(?:_[0-9]+)*(?:_a_[0-9]+(?:_[0-9]+)*)?|a_[0-9]+(?:_[0-9]+)*))$/);
    if (!m) return { baseNoTs: base, markers: [] };
    return { baseNoTs: m[1], markers: decodeMarkers(m[2]) };
}

export function addMarker(markers, ms, type) {
    const filtered = (markers || []).filter(m => Math.abs(m.ms - ms) >= COLLISION_MS);
    filtered.push({ ms, type });
    return sortMarkers(filtered);
}
