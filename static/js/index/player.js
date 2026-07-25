import {
    splitName,
    extractTsFromBase,
    encodeMarkers,
    sortMarkers,
    addMarker,
    MARKER_IMAGE,
    MARKER_AUDIO,
} from "../shared/utils.js";

export function initPlayer(api, elms, helpers = {}) {
    const mainVideo = elms.mainVideo;
    const previewCanvas = elms.previewCanvas;
    const previewCanvasWrap = elms.previewCanvasWrap;
    const seekOverlay = elms.seekOverlay;
    const curPathEl = elms.curPath;
    const newNameInput = elms.newName;
    const fileLabel = elms.fileLabel;

    // hidden preview video
    const previewVideo = document.createElement("video");
    previewVideo.muted = true;
    previewVideo.preload = "metadata";
    previewVideo.crossOrigin = "anonymous";
    previewVideo.style.display = "none";
    document.body.appendChild(previewVideo);

    let currentPath = null;
    let lastHoverTime = 0;
    let rotation = 0;
    const ctx = previewCanvas ? previewCanvas.getContext("2d") : null;

    // Outside panels so position:fixed is viewport-relative (backdrop-filter on .panel traps fixed)
    if (previewCanvasWrap && previewCanvasWrap.parentElement !== document.body) {
        document.body.appendChild(previewCanvasWrap);
    }

    let markers = []; // { ms, type }[]

    function rebuildNameWithTs(currentInputValue) {
        if (!currentInputValue) return currentInputValue;
        const { base, ext } = splitName(currentInputValue);
        const { baseNoTs } = extractTsFromBase(base);
        const suffix = encodeMarkers(markers);
        if (!suffix) return baseNoTs + ext;
        return `${baseNoTs}${suffix}${ext}`;
    }

    function setInputNamePreservingUserBase(newFullNameMaybe) {
        if (!newNameInput) return;
        newNameInput.value = rebuildNameWithTs(newFullNameMaybe || newNameInput.value);
    }

    function initTsFromFilename(filename) {
        const { base } = splitName(filename);
        const { markers: parsed } = extractTsFromBase(base);
        markers = sortMarkers(parsed);
    }

    function notifyMarkersChanged() {
        window.dispatchEvent(new CustomEvent("markers-changed"));
    }

    function addTimestampMs(ms, type = MARKER_IMAGE) {
        markers = addMarker(markers, ms, type);
        setInputNamePreservingUserBase();
        renderTimestampDots();
        notifyMarkersChanged();
    }

    function setCurrent(path, autoplay = false) {
        currentPath = path;

        if (curPathEl) curPathEl.textContent = path || "";
        if (fileLabel) fileLabel.textContent = path || "";

        const fname = path ? path.split("/").pop() : "";
        if (newNameInput) {
            if (fname) newNameInput.value = fname;
            initTsFromFilename(newNameInput.value || "");
            setInputNamePreservingUserBase(newNameInput.value || "");
            notifyMarkersChanged();
        }

        if (!path) {
            mainVideo.removeAttribute("src");
            previewVideo.removeAttribute("src");
            markers = [];
            clearTimestampDots();
            return;
        }

        previewVideo.onloadedmetadata = () => {
            if (previewVideo.videoWidth && previewVideo.videoHeight) {
                const aspect = previewVideo.videoWidth / previewVideo.videoHeight;
                const w = 320;
                const h = Math.round(w / aspect);
                previewCanvas.width = w;
                previewCanvas.height = h;
                previewCanvas.style.width = w + "px";
                previewCanvas.style.height = h + "px";
            }
        };

        const src = api.stream(path);
        mainVideo.src = src;
        previewVideo.src = src;
        previewVideo.load();
        mainVideo.load();

        if (autoplay) {
            const playAttempt = () => mainVideo.play().catch(() => { });
            if (mainVideo.readyState >= 1) playAttempt();
            else mainVideo.addEventListener("loadedmetadata", () => playAttempt(), { once: true });
        }

        if (!isFinite(mainVideo.duration) || isNaN(mainVideo.duration)) {
            mainVideo.addEventListener("loadedmetadata", () => renderTimestampDots(), { once: true });
        } else {
            renderTimestampDots();
        }
    }

    function rotateVideoClockwise() {
        rotation = (rotation + 90) % 360;
        mainVideo.style.transformOrigin = "center center";
        mainVideo.style.transform = `rotate(${rotation}deg)`;

        const parentEl = mainVideo.parentElement || mainVideo.parentNode;
        let maxW = mainVideo.clientWidth;
        let maxH = mainVideo.clientHeight;
        try {
            if (parentEl && typeof parentEl.getBoundingClientRect === 'function') {
                const pr = parentEl.getBoundingClientRect();
                maxW = pr.width; maxH = pr.height;
            }
        } catch { }

        if (rotation % 180 !== 0) {
            mainVideo.style.maxWidth = `${Math.floor(maxH)}px`;
            mainVideo.style.maxHeight = `${Math.floor(maxW)}px`;
            mainVideo.style.width = "100%";
            mainVideo.style.height = "auto";
        } else {
            mainVideo.style.maxWidth = `${Math.floor(maxW)}px`;
            mainVideo.style.maxHeight = `${Math.floor(maxH)}px`;
            mainVideo.style.width = "100%";
            mainVideo.style.height = "100%";
        }
        mainVideo.style.objectFit = "contain";
    }

    function onHoverSeek(e) {
        if (!previewVideo.duration || isNaN(previewVideo.duration)) return;
        if (!seekOverlay || !previewCanvasWrap || !previewCanvas) return;

        const overlayRect = seekOverlay.getBoundingClientRect();
        const xInOverlay = Math.min(Math.max(0, e.clientX - overlayRect.left), overlayRect.width);
        const t = (xInOverlay / overlayRect.width) * previewVideo.duration;

        previewCanvasWrap.style.left = "20px";
        previewCanvasWrap.style.top = "auto";
        previewCanvasWrap.style.bottom = "100px";
        previewCanvasWrap.style.display = "block";

        const now = performance.now();
        if (now - lastHoverTime < 60) return;
        lastHoverTime = now;

        previewVideo.currentTime = t;
        previewVideo.onseeked = () => {
            if (!ctx || !previewCanvas) return;
            try { ctx.drawImage(previewVideo, 0, 0, previewCanvas.width, previewCanvas.height); } catch { }
        };
    }
    function onLeaveSeek() { if (previewCanvasWrap) previewCanvasWrap.style.display = "none"; }

    function onClickSeek(e) {
        if (!mainVideo.duration || isNaN(mainVideo.duration)) return;
        const rect = seekOverlay.getBoundingClientRect();
        const x = Math.min(Math.max(0, e.clientX - rect.left), rect.width);
        const t = (x / rect.width) * mainVideo.duration;
        mainVideo.currentTime = t;

        if (e.ctrlKey || e.metaKey) {
            addTimestampMs(Math.round(t * 1000), MARKER_IMAGE);
        }
    }

    if (seekOverlay) {
        seekOverlay.addEventListener("mousemove", onHoverSeek);
        seekOverlay.addEventListener("mouseleave", onLeaveSeek);
        seekOverlay.addEventListener("click", onClickSeek);
        window.addEventListener("resize", renderTimestampDots);
    }

    function ensureDotsHost() {
        if (!seekOverlay) return null;
        let host = seekOverlay.querySelector(".ts-dots-host");
        if (!host) {
            host = document.createElement("div");
            host.className = "ts-dots-host";
            host.style.position = "absolute";
            host.style.left = "0";
            host.style.right = "0";
            host.style.top = "0";
            host.style.bottom = "0";
            host.style.pointerEvents = "none";
            seekOverlay.appendChild(host);
        }
        return host;
    }

    function clearTimestampDots() {
        const host = ensureDotsHost();
        if (!host) return;
        host.innerHTML = "";
    }

    function createDot(ms, type, dur) {
        const s = ms / 1000;
        if (s < 0 || s > dur) return null;
        const pct = s / dur;
        const dot = document.createElement("div");
        const isAudio = type === MARKER_AUDIO;
        dot.className = `ts-dot ${isAudio ? "ts-dot-audio" : "ts-dot-default"}`;
        dot.title = `${s.toFixed(2)}s — ${isAudio ? "Audio" : "Timestamp"}`;
        dot.style.position = "absolute";
        dot.style.bottom = "2px";
        dot.style.width = "6px";
        dot.style.height = "6px";
        dot.style.borderRadius = "50%";
        dot.style.left = `calc(${(pct * 100).toFixed(4)}% - 3px)`;
        return dot;
    }

    function renderTimestampDots() {
        const host = ensureDotsHost();
        if (!host) return;
        host.innerHTML = "";
        const dur = mainVideo && isFinite(mainVideo.duration) ? mainVideo.duration : 0;
        if (!dur || !markers.length) return;

        for (const m of markers) {
            if (m.type !== MARKER_IMAGE) continue;
            const dot = createDot(m.ms, m.type, dur);
            if (dot) host.appendChild(dot);
        }
        for (const m of markers) {
            if (m.type !== MARKER_AUDIO) continue;
            const dot = createDot(m.ms, m.type, dur);
            if (dot) host.appendChild(dot);
        }
    }

    const timeDisplayEl = document.getElementById("timeDisplay") || null;
    function formatTime(sec) {
        if (!sec || isNaN(sec) || !isFinite(sec)) return "0:00";
        const s = Math.floor(sec);
        const m = Math.floor(s / 60);
        const rem = s % 60;
        return `${m}:${String(rem).padStart(2, '0')}`;
    }
    if (timeDisplayEl && mainVideo) {
        const updateTimeDisplay = () => {
            const cur = mainVideo.currentTime || 0;
            const dur = mainVideo.duration && !isNaN(mainVideo.duration) && isFinite(mainVideo.duration) ? mainVideo.duration : 0;
            timeDisplayEl.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
        };
        mainVideo.addEventListener('timeupdate', updateTimeDisplay);
        mainVideo.addEventListener('loadedmetadata', updateTimeDisplay);
        mainVideo.addEventListener('durationchange', updateTimeDisplay);
        updateTimeDisplay();
    }

    function captureCurrentFramePngBlob() {
        if (!mainVideo?.videoWidth || !mainVideo?.videoHeight) return Promise.resolve(null);
        return new Promise((resolve, reject) => {
            try {
                const canvas = document.createElement("canvas");
                canvas.width = mainVideo.videoWidth;
                canvas.height = mainVideo.videoHeight;
                canvas.getContext("2d").drawImage(mainVideo, 0, 0, canvas.width, canvas.height);
                canvas.toBlob(blob => {
                    if (blob) resolve(blob);
                    else reject(new Error("png capture failed"));
                }, "image/png");
            } catch (e) {
                reject(e);
            }
        });
    }

    return {
        setCurrent,
        rotateVideoClockwise,
        getCurrentPath: () => currentPath,
        getMarkers: () => [...markers],
        getTimestamps: () => markers.map(m => m.ms),
        addCurrentTimestamp: () => {
            if (mainVideo && !isNaN(mainVideo.currentTime)) {
                addTimestampMs(Math.round(mainVideo.currentTime * 1000), MARKER_IMAGE);
            }
        },
        addCurrentAudioMarker: () => {
            if (mainVideo && !isNaN(mainVideo.currentTime)) {
                addTimestampMs(Math.round(mainVideo.currentTime * 1000), MARKER_AUDIO);
            }
        },
        captureCurrentFramePngBlob,
    };
}
