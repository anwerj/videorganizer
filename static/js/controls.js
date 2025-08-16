// /static/js/controls.js
export function initControls({ player, tree, modals }) {
    const mainVideo = document.getElementById("mainVideo");
    const btnPlay = document.getElementById("btnPlay");
    const btnPrev = document.getElementById("btnPrev");
    const btnNext = document.getElementById("btnNext");
    const progressBar = document.getElementById("progressBar");
    const progressFill = document.getElementById("progressFill");
    const vol = document.getElementById("vol");
    const btnFull = document.getElementById("btnFull");
    const btnRotate = document.getElementById("btnRotate");
    const newNameInput = document.getElementById("newName");

    // ensure native controls off if previously set
    if (mainVideo.hasAttribute("controls")) mainVideo.removeAttribute("controls");

    // Play / pause
    function togglePlay() {
        if (mainVideo.paused) mainVideo.play().catch(() => { });
        else mainVideo.pause();
    }

    function forward(duration) {
        mainVideo.currentTime = Math.min(mainVideo.duration || 0, mainVideo.currentTime + duration);
    }

    function backward(duration) {
        mainVideo.currentTime = Math.max(0, mainVideo.currentTime - 3);
    }

    btnPlay?.addEventListener("click", togglePlay);
    mainVideo.addEventListener("play", () => { if (btnPlay) btnPlay.textContent = "❚❚"; });
    mainVideo.addEventListener("pause", () => { if (btnPlay) btnPlay.textContent = "►"; });
    mainVideo.addEventListener("click", togglePlay)

    // prev / next
    btnPrev?.addEventListener("click", () => {
        const cur = player.getCurrentPath?.() || location.hash ? decodeURIComponent(location.hash.slice(1)) : null;
        tree.goToPrevSibling(cur);
    });
    btnNext?.addEventListener("click", () => {
        const cur = player.getCurrentPath?.() || location.hash ? decodeURIComponent(location.hash.slice(1)) : null;
        tree.goToNextSibling(cur);
    });

    // progress/time updating
    mainVideo.addEventListener("timeupdate", () => {
        const dur = mainVideo.duration || 0;
        const cur = mainVideo.currentTime || 0;
        if (progressFill && dur > 0) progressFill.style.width = (cur / dur * 100) + "%";
    });

    progressBar?.addEventListener("click", (ev) => {
        if (!mainVideo.duration) return;
        const r = progressBar.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
        mainVideo.currentTime = x * mainVideo.duration;
    });

    // volume
    vol?.addEventListener("input", () => { mainVideo.volume = parseFloat(vol.value); });

    // fullscreen
    btnFull?.addEventListener("click", () => {
        const el = document.getElementById("playerWrap");
        if (!document.fullscreenElement) el.requestFullscreen?.();
        else document.exitFullscreen?.();
    });

    // rotate
    btnRotate?.addEventListener("click", () => { player.rotateVideoClockwise?.(); });

    // global keyboard shortcuts (small set)
    document.addEventListener("keydown", (ev) => {
        const active = document.activeElement;
        if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) {
            if (active === newNameInput && ev.key === "Enter") {
                // prevent duplicate handling: the rename-flow module wires its own Enter handler
                ev.preventDefault();
                // do not dispatch anything here
            }
            return;
        }
        const k = (ev.key || "").toLowerCase();
        if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.shiftKey) {return}
        if (k === " ") { ev.preventDefault(); togglePlay(); return; }
        if (k === "c") { ev.preventDefault(); btnNext?.click(); return; }
        if (k === "v") { ev.preventDefault(); btnPrev?.click(); return; }
        if (k === "r") { ev.preventDefault(); player.rotateVideoClockwise?.(); return; }
        if (k === "e") { ev.preventDefault(); window.dispatchEvent(new CustomEvent("open-rename-modal")); return; }
        if (k === "l") { ev.preventDefault(); window.dispatchEvent(new CustomEvent("open-filelist-modal")); return; }
        if (k === "z") {ev.preventDefault(); backward(3); return}
        if (k === "x") {ev.preventDefault(); forward(3); return}
    });

    return { togglePlay };
}
