import { splitName, extractTsFromBase, MARKER_IMAGE } from "../shared/utils.js";

const el = id => document.getElementById(id);
const grid = el("timestampGrid");
const video = el("sourceVideo");
const canvas = el("frameCanvas");
const ctx = canvas.getContext("2d");
const titleEl = el("videoTitle");
const loadingStatus = el("loadingStatus");

window.setLayout = function (n) {
    grid.className = `timestamp-grid cols-${n}`;
    localStorage.setItem("ts-layout-cols", n);
}

const savedLayout = localStorage.getItem("ts-layout-cols");
if (savedLayout) window.setLayout(savedLayout);

async function init() {
    const path = location.hash ? decodeURIComponent(location.hash.slice(1)) : null;
    if (!path) {
        titleEl.textContent = "No video selected";
        return;
    }

    const { base } = splitName(path.split("/").pop());
    const { baseNoTs, markers } = extractTsFromBase(base);
    titleEl.textContent = baseNoTs;

    const defaultMarks = markers.filter(m => m.type === MARKER_IMAGE);

    if (!defaultMarks.length) {
        loadingStatus.textContent = markers.length
            ? "No screenshot timestamps in filename."
            : "No timestamps found in filename.";
        return;
    }

    loadingStatus.textContent = `Found ${defaultMarks.length} screenshot${defaultMarks.length === 1 ? "" : "s"}...`;

    video.src = "/api/stream?path=" + encodeURIComponent(path);
    await video.load();

    if (video.readyState < 1) {
        await new Promise(r => video.addEventListener("loadedmetadata", r, { once: true }));
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    for (let i = 0; i < defaultMarks.length; i++) {
        const m = defaultMarks[i];
        loadingStatus.textContent = `Extracting ${i + 1}/${defaultMarks.length}...`;
        try {
            const imgData = await extractFrame(m.ms / 1000);
            addTimestampCard(m.ms, imgData);
        } catch (e) {
            console.error("Frame extraction failed", m.ms, e);
        }
    }

    loadingStatus.textContent = "";
}

function extractFrame(seconds) {
    return new Promise((resolve, reject) => {
        const onSeek = () => {
            try {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL("image/jpeg", 0.85));
            } catch (e) {
                reject(e);
            }
        };

        video.currentTime = seconds;
        if (video.seeking) {
            video.addEventListener("seeked", onSeek, { once: true });
        } else {
            onSeek();
        }
    });
}

function formatTime(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    const milli = ms % 1000;
    return `${m}:${String(sec).padStart(2, '0')}:${String(milli).padStart(3, '0')}`;
}

function addTimestampCard(ms, imgData) {
    const card = document.createElement("div");
    card.className = "timestamp-card";
    card.innerHTML = `
        <img src="${imgData}" loading="lazy" />
        <div class="timestamp-info">
            <span class="timestamp-time">${formatTime(ms)}</span>
        </div>
    `;
    grid.appendChild(card);
}

init();
