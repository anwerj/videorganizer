// /static/js/player.js
export function initPlayer(api, elms, helpers = {}) {
    const mainVideo = elms.mainVideo;
    const previewCanvas = elms.previewCanvas;
    const previewCanvasWrap = elms.previewCanvasWrap;
    const seekOverlay = elms.seekOverlay;
    const curPathEl = elms.curPath;
    const newNameInput = elms.newName;
    const fileLabel = elms.fileLabel;

    // preview video (hidden)
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

    function setCurrent(path, autoplay = false) {
        currentPath = path;
        if (curPathEl) curPathEl.textContent = path || "";
        if (fileLabel) fileLabel.textContent = path || "";
        if (newNameInput) newNameInput.value = path ? path.split("/").pop() : "";
        if (!path) {
            mainVideo.removeAttribute("src");
            previewVideo.removeAttribute("src");
            return;
        }
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
    }

    function rotateVideoClockwise() {
        rotation = (rotation + 90) % 360;
        mainVideo.style.transformOrigin = "center center";
        mainVideo.style.transform = `rotate(${rotation}deg)`;

        // determine available space from parent element and set max dimensions
        const parentEl = mainVideo.parentElement || mainVideo.parentNode;
        let maxW = mainVideo.clientWidth;
        let maxH = mainVideo.clientHeight;
        try {
            if (parentEl && typeof parentEl.getBoundingClientRect === 'function') {
                const pr = parentEl.getBoundingClientRect();
                maxW = pr.width;
                maxH = pr.height;
            }
        } catch (e) { /* ignore */ }



        // adjust sizing mode: when rotated 90/270 we let width auto and limit by maxHeight/Width
        if (rotation % 180 !== 0) {
            // set explicit max constraints so rotated video stays within parent
            mainVideo.style.maxWidth = `${Math.floor(maxH)}px`;
            mainVideo.style.maxHeight = `${Math.floor(maxW)}px`;
            // rotated: prefer height-based sizing so video fits inside parent
            mainVideo.style.width = "auto";
            mainVideo.style.height = "auto";
            mainVideo.style.objectFit = "contain";
        } else {
            // set explicit max constraints so rotated video stays within parent
            mainVideo.style.maxWidth = `${Math.floor(maxW)}px`;
            mainVideo.style.maxHeight = `${Math.floor(maxH)}px`;
            // normal orientation: fill available width/height but respect max constraints
            mainVideo.style.width = "100%";
            mainVideo.style.height = "100%";
            mainVideo.style.objectFit = "contain";
        }
    }

    // preview hover handler (same relative-to-player logic we fixed earlier)
    function onHoverSeek(e) {
        if (!previewVideo.duration || isNaN(previewVideo.duration)) return;
        if (!seekOverlay || !previewCanvasWrap || !previewCanvas) return;
        const overlayRect = seekOverlay.getBoundingClientRect();
        const playerRect = seekOverlay.closest(".player-wrap").getBoundingClientRect();
        const canvasRect = previewCanvas.getBoundingClientRect();
        const xInOverlay = Math.min(Math.max(0, e.clientX - overlayRect.left), overlayRect.width);
        const t = (xInOverlay / overlayRect.width) * previewVideo.duration;
        const previewW = canvasRect.width || previewCanvas.width;
        const previewH = canvasRect.height || previewCanvas.height;
        let left = e.clientX - playerRect.left - previewW;
        let top = e.clientY - playerRect.top - previewH;
        const margin = 6;
        left = Math.max(margin, Math.min(left, playerRect.width - previewW - margin));
        top = Math.max(margin, Math.min(top, playerRect.height - previewH - margin));
        previewCanvasWrap.style.transform = "none";
        previewCanvasWrap.style.display = "block";
        previewCanvasWrap.style.left = left + "px";
        previewCanvasWrap.style.top = top + "px";
        const now = performance.now();
        if (now - lastHoverTime < 60) return;
        lastHoverTime = now;
        previewVideo.currentTime = t;
        previewVideo.onseeked = () => {
            if (!ctx || !previewCanvas) return;
            try { ctx.drawImage(previewVideo, 0, 0, previewCanvas.width, previewCanvas.height); }
            catch (e) { }
        };
    }
    function onLeaveSeek() { if (previewCanvasWrap) previewCanvasWrap.style.display = "none"; }
    function onClickSeek(e) {
        if (!mainVideo.duration || isNaN(mainVideo.duration)) return;
        const rect = seekOverlay.getBoundingClientRect();
        const x = Math.min(Math.max(0, e.clientX - rect.left), rect.width);
        const t = (x / rect.width) * mainVideo.duration;
        mainVideo.currentTime = t;
    }

    if (seekOverlay) {
        seekOverlay.addEventListener("mousemove", onHoverSeek);
        seekOverlay.addEventListener("mouseleave", onLeaveSeek);
        seekOverlay.addEventListener("click", onClickSeek);
    }

    // expose API
    return {
        setCurrent,
        rotateVideoClockwise,
        getCurrentPath: () => currentPath,
        // helper proxies if needed in other modules
    };
}
