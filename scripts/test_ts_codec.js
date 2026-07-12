// Dev-only: node scripts/test_ts_codec.js
import {
    TS_PREFIX,
    encodeMarkers,
    decodeMarkers,
    extractTsFromBase,
    addMarker,
    encodeBlock,
    decodeBlock,
    MARKER_IMAGE,
    MARKER_AUDIO,
    COLLISION_MS,
} from "../static/js/shared/utils.js";

function assert(cond, msg) {
    if (!cond) throw new Error(msg);
}

function assertEq(actual, expected, msg) {
    if (actual !== expected) throw new Error(`${msg}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

// encodeBlock / decodeBlock
{
    const ms = [45000, 78000, 102000];
    const enc = encodeBlock(ms);
    assertEq(enc, "4500_3300_2400", "encodeBlock deltas");
    const dec = decodeBlock(enc.split("_"));
    assertEq(JSON.stringify(dec), JSON.stringify(ms), "decodeBlock round-trip");
}

// images only
{
    const markers = [
        { ms: 45000, type: MARKER_IMAGE },
        { ms: 78000, type: MARKER_IMAGE },
        { ms: 102000, type: MARKER_IMAGE },
    ];
    const suffix = encodeMarkers(markers);
    assertEq(suffix, `${TS_PREFIX}4500_3300_2400`, "images only suffix");
    const decoded = decodeMarkers(suffix);
    assertEq(decoded.length, 3, "images only count");
    assertEq(decoded[0].ms, 45000, "first image ms");
}

// images + audio
{
    const markers = [
        { ms: 45000, type: MARKER_IMAGE },
        { ms: 78000, type: MARKER_IMAGE },
        { ms: 52000, type: MARKER_AUDIO },
        { ms: 97000, type: MARKER_AUDIO },
    ];
    const suffix = encodeMarkers(markers);
    assertEq(suffix, `${TS_PREFIX}4500_3300_a_5200_4500`, "images + audio suffix");
    const decoded = decodeMarkers(suffix);
    assertEq(decoded.filter(m => m.type === MARKER_IMAGE).length, 2, "image count");
    assertEq(decoded.filter(m => m.type === MARKER_AUDIO).length, 2, "audio count");
    assertEq(decoded.find(m => m.type === MARKER_AUDIO).ms, 52000, "first audio ms");
}

// audio only
{
    const markers = [
        { ms: 52000, type: MARKER_AUDIO },
        { ms: 82000, type: MARKER_AUDIO },
    ];
    const suffix = encodeMarkers(markers);
    assertEq(suffix, `${TS_PREFIX}a_5200_3000`, "audio only suffix");
    const decoded = decodeMarkers(suffix);
    assertEq(decoded.length, 2, "audio only count");
    assertEq(decoded[0].type, MARKER_AUDIO, "audio only type");
}

// extractTsFromBase
{
    const { baseNoTs, markers } = extractTsFromBase("clip-ts_4500_3300_a_5200");
    assertEq(baseNoTs, "clip", "strip suffix from base");
    assertEq(markers.length, 3, "extract marker count");
}

// addMarker collision — new wins
{
    let markers = [{ ms: 50000, type: MARKER_IMAGE }];
    markers = addMarker(markers, 50050, MARKER_IMAGE);
    assertEq(markers.length, 1, "collision replaces old mark");
    assertEq(markers[0].ms, 50050, "collision keeps new ms");
}

// collision across types
{
    let markers = [{ ms: 50000, type: MARKER_IMAGE }];
    markers = addMarker(markers, 50050, MARKER_AUDIO);
    assertEq(markers.length, 1, "cross-type collision removes old");
    assertEq(markers[0].type, MARKER_AUDIO, "cross-type keeps new type");
}

// no collision when far apart
{
    let markers = [{ ms: 50000, type: MARKER_IMAGE }];
    markers = addMarker(markers, 50000 + COLLISION_MS, MARKER_IMAGE);
    assertEq(markers.length, 2, "no collision when >= COLLISION_MS apart");
}

// round-trip via extractTsFromBase
{
    const original = [
        { ms: 60500, type: MARKER_IMAGE },
        { ms: 66500, type: MARKER_IMAGE },
        { ms: 33200, type: MARKER_AUDIO },
    ];
    const suffix = encodeMarkers(original);
    const { markers } = extractTsFromBase(`myvideo${suffix}`);
    assertEq(markers.length, 3, "full round-trip count");
    assertEq(markers[0].ms, 33200, "sorted by ms");
    assertEq(markers[2].ms, 66500, "sorted last");
}

console.log("All ts codec tests passed.");
