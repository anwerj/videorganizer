import { splitName, extractTsFromBase, normalizeTs } from "../shared/utils.js";

const el = id => document.getElementById(id);
const grid = el("timestampGrid");
const video = el("sourceVideo");
const canvas = el("frameCanvas");
const ctx = canvas.getContext("2d");
const titleEl = el("videoTitle");
const loadingStatus = el("loadingStatus");

// Expose setLayout globally for buttons
window.setLayout = function (n) {
    grid.className = `timestamp-grid cols-${n}`;
    localStorage.setItem("ts-layout-cols", n);
}

// Load prev layout preference
const savedLayout = localStorage.getItem("ts-layout-cols");
if (savedLayout) window.setLayout(savedLayout);

async function init() {
    const path = location.hash ? decodeURIComponent(location.hash.slice(1)) : null;
    if (!path) {
        titleEl.textContent = "No video selected";
        return;
    }

    // Set title
    const { base } = splitName(path.split("/").pop());
    const { baseNoTs, ts } = extractTsFromBase(base);
    titleEl.textContent = baseNoTs;

    const timestamps = normalizeTs(ts);
    if (!timestamps.length) {
        loadingStatus.textContent = "No timestamps found in filename.";
        return;
    }

    loadingStatus.textContent = `Found ${timestamps.length} timestamps...`;

    // Setup video
    video.src = "/api/stream?path=" + encodeURIComponent(path);
    await video.load();

    // wait for metadata to know dimensions
    if (video.readyState < 1) {
        await new Promise(r => video.addEventListener("loadedmetadata", r, { once: true }));
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Process each timestamp
    for (let i = 0; i < timestamps.length; i++) {
        const ms = timestamps[i];
        loadingStatus.textContent = `Extracting ${i + 1}/${timestamps.length}...`;

        try {
            const imgData = await extractFrame(ms / 1000);
            addCard(ms, imgData);
        } catch (e) {
            console.error("Frame extraction failed", ms, e);
        }
    }

    loadingStatus.textContent = "";
}

function extractFrame(seconds) {
    return new Promise((resolve, reject) => {
        const onSeek = () => {
            try {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                // using toDataURL for simplicity, though toBlob + URL.createObjectURL is more efficient for many images
                // sticking to DataURL to avoid managing object URL revocations for now
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

function addCard(ms, imgData) {
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

// Start
init();
