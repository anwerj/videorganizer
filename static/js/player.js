// /static/js/player.js
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

    // --- timestamps state (ms) ---
    let timestamps = []; // always sorted asc, de-duped (>=500ms apart)

    // ===== helpers: filename + ts handling =====
    function splitName(name) {
        const i = name.lastIndexOf('.');
        return i === -1 ? { base: name, ext: "" } : { base: name.slice(0, i), ext: name.slice(i) };
    }
    function extractTsFromBase(base) {
        // matches ...__ts_12_345_678 at the END of base (before extension)
        const m = base.match(/^(.*?)(__ts_[0-9_]+)$/);
        if (!m) return { baseNoTs: base, ts: [] };
        const raw = m[2]; // "__ts_..."
        const nums = raw.slice("__ts_".length).split('_').map(s => parseInt(s, 10)).filter(n => !isNaN(n));
        return { baseNoTs: m[1], ts: nums };
    }
    function normalizeTs(list) {
        if (!list || !list.length) return [];
        // sort asc, keep entries at least 500ms apart
        const sorted = [...list].sort((a, b) => a - b);
        const out = [];
        for (const t of sorted) {
            if (out.length === 0 || Math.abs(t - out[out.length - 1]) >= 500) out.push(t);
        }
        return out;
    }
    function rebuildNameWithTs(currentInputValue) {
        if (!currentInputValue) return currentInputValue;
        const { base, ext } = splitName(currentInputValue);
        const { baseNoTs } = extractTsFromBase(base);
        const ts = normalizeTs(timestamps);
        if (!ts.length) return baseNoTs + ext;
        return `${baseNoTs}__ts_${ts.join('_')}${ext}`;
    }
    function setInputNamePreservingUserBase(newFullNameMaybe) {
        if (!newNameInput) return;
        newNameInput.value = rebuildNameWithTs(newFullNameMaybe || newNameInput.value);
    }
    function initTsFromFilename(filename) {
        const { base } = splitName(filename);
        const { ts } = extractTsFromBase(base);
        timestamps = normalizeTs(ts);
    }
    function addTimestampMs(ms) {
        timestamps.push(ms);
        timestamps = normalizeTs(timestamps);
        // reflect in input immediately
        setInputNamePreservingUserBase();
        // re-render dots
        renderTimestampDots();
    }

    // ===== setCurrent / load playback =====
    function setCurrent(path, autoplay = false) {
        currentPath = path;

        if (curPathEl) curPathEl.textContent = path || "";
        if (fileLabel) fileLabel.textContent = path || "";

        // set rename input to filename and initialize timestamps from it (if it has __ts_)
        const fname = path ? path.split("/").pop() : "";
        if (newNameInput) {
            if (fname) newNameInput.value = fname;
            // parse timestamps from existing name (if any), then standardize input
            initTsFromFilename(newNameInput.value || "");
            setInputNamePreservingUserBase(newNameInput.value || "");
        }

        if (!path) {
            mainVideo.removeAttribute("src");
            previewVideo.removeAttribute("src");
            clearTimestampDots();
            return;
        }

        // Resize preview canvas when preview video loads
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

        // draw dots once duration is known
        if (!isFinite(mainVideo.duration) || isNaN(mainVideo.duration)) {
            mainVideo.addEventListener("loadedmetadata", () => renderTimestampDots(), { once: true });
        } else {
            renderTimestampDots();
        }
    }

    // ===== rotation (unchanged logic, tightened) =====
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

    // ===== preview hover / seek =====
    function onHoverSeek(e) {
        if (!previewVideo.duration || isNaN(previewVideo.duration)) return;
        if (!seekOverlay || !previewCanvasWrap || !previewCanvas) return;

        const overlayRect = seekOverlay.getBoundingClientRect();
        const xInOverlay = Math.min(Math.max(0, e.clientX - overlayRect.left), overlayRect.width);
        const t = (xInOverlay / overlayRect.width) * previewVideo.duration;

        // Position preview over the sidebar (left side of screen)
        // We use fixed positioning to break out of the player container
        previewCanvasWrap.style.position = "fixed";
        previewCanvasWrap.style.zIndex = "9999";

        // Target the sidebar area. Assuming sidebar is on the left.
        // We'll place it at left: 10px, bottom: 80px (above controls approx)
        // Or we can try to center it vertically in the sidebar if we want.
        // Let's stick to a fixed position at the bottom-left corner of the window,
        // which usually covers the bottom of the sidebar.
        previewCanvasWrap.style.left = "20px";
        previewCanvasWrap.style.top = "auto";
        previewCanvasWrap.style.bottom = "100px"; // Above the controls bar usually
        previewCanvasWrap.style.display = "block";
        previewCanvasWrap.style.transform = "none";

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

        // record timestamp if Ctrl/Cmd pressed
        if (e.ctrlKey || e.metaKey) {
            addTimestampMs(Math.round(t * 1000));
        }
    }

    if (seekOverlay) {
        seekOverlay.addEventListener("mousemove", onHoverSeek);
        seekOverlay.addEventListener("mouseleave", onLeaveSeek);
        seekOverlay.addEventListener("click", onClickSeek);
        // re-layout dots on resize
        window.addEventListener("resize", renderTimestampDots);
    }

    // ===== timestamp dots on seekOverlay =====
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
    function renderTimestampDots() {
        const host = ensureDotsHost();
        if (!host) return;
        host.innerHTML = "";
        const dur = mainVideo && isFinite(mainVideo.duration) ? mainVideo.duration : 0;
        if (!dur || !timestamps.length) return;
        const w = seekOverlay.clientWidth || 1;

        const uniq = normalizeTs(timestamps);
        for (const ms of uniq) {
            const s = ms / 1000;
            if (s < 0 || s > dur) continue;
            const pct = s / dur;
            const dot = document.createElement("div");
            dot.className = "ts-dot";
            dot.title = `${(s).toFixed(2)}s`;
            dot.style.position = "absolute";
            dot.style.bottom = "2px";
            dot.style.width = "6px";
            dot.style.height = "6px";
            dot.style.borderRadius = "50%";
            dot.style.background = "var(--accent, #e1f2ff)";
            dot.style.boxShadow = "0 0 4px rgba(255,255,255,0.6)";
            // center dot on time position
            dot.style.left = `calc(${(pct * 100).toFixed(4)}% - 3px)`;
            host.appendChild(dot);
        }
    }

    // ===== time display =====
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

    return {
        setCurrent,
        rotateVideoClockwise,
        getCurrentPath: () => currentPath,
        // expose read-only timestamps if you ever need them
        getTimestamps: () => [...timestamps],
        addCurrentTimestamp: () => {
            if (mainVideo && !isNaN(mainVideo.currentTime)) {
                addTimestampMs(Math.round(mainVideo.currentTime * 1000));
            }
        }
    };
}
