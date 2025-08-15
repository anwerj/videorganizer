// static/app.js
(async function () {
    const api = {
        tree: "/api/tree",
        stream: (path) => "/api/stream?path=" + encodeURIComponent(path),
        rename: "/api/rename",
    };

    // DOM refs
    const leftTree = document.getElementById("leftTree");
    const mainVideo = document.getElementById("mainVideo");
    const seekOverlay = document.getElementById("seekOverlay");
    const previewCanvasWrap = document.getElementById("previewCanvasWrap");
    const previewCanvas = document.getElementById("previewCanvas");
    const curPathEl = document.getElementById("curPath");
    const newNameInput = document.getElementById("newName");
    const msg = document.getElementById("msg");
    const fileLabel = document.getElementById("fileLabel");
    const fullFileList = document.getElementById("fullFileList");

    // Ensure leftTree exists
    if (!leftTree) throw new Error("leftTree element not found");

    // Add search input to leftTree (fixed at top)
    const searchWrapper = document.createElement("div");
    searchWrapper.className = "mb-2";
    searchWrapper.innerHTML = `
    <div class="input-group">
      <input id="treeSearchInput" class="form-control form-control-sm" placeholder="Search (press Enter)" aria-label="Search library" />
      <button id="treeSearchBtn" class="btn btn-sm btn-outline-secondary" type="button">Search</button>
      <button id="treeClearBtn" class="btn btn-sm btn-outline-secondary" title="Clear search" type="button">×</button>
    </div>
  `;
    leftTree.appendChild(searchWrapper);

    const searchInput = document.getElementById("treeSearchInput");
    const searchBtn = document.getElementById("treeSearchBtn");
    const clearBtn = document.getElementById("treeClearBtn");

    // modal elements (Bootstrap must be loaded before this script)
    const renameModalEl = document.getElementById("renameModal");
    const fileListModalEl = document.getElementById("fileListModal");
    if (typeof bootstrap === "undefined") {
        console.warn("Bootstrap not found. Make sure you load bootstrap.bundle.min.js before app.js");
    }
    const renameModal = typeof bootstrap !== "undefined" && renameModalEl ? bootstrap.Modal.getOrCreateInstance(renameModalEl) : null;
    const fileListModal = typeof bootstrap !== "undefined" && fileListModalEl ? bootstrap.Modal.getOrCreateInstance(fileListModalEl) : null;

    // hidden preview video
    const previewVideo = document.createElement("video");
    previewVideo.muted = true;
    previewVideo.preload = "metadata";
    previewVideo.crossOrigin = "anonymous";
    previewVideo.style.display = "none";
    document.body.appendChild(previewVideo);

    let currentPath = null;
    let lastHoverTime = 0;
    let rotation = 0; // degrees

    function setMsg(s) {
        if (!msg) return;
        msg.textContent = s || "";
    }

    // set hash helpers
    function setHashPath(path) {
        if (!path) {
            history.replaceState(null, "", location.pathname + location.search);
            return;
        }
        location.hash = encodeURIComponent(path);
    }

    function getHashPath() {
        if (!location.hash) return null;
        let h = location.hash.slice(1);
        if (h.startsWith("path=")) h = h.slice(5);
        try {
            return decodeURIComponent(h);
        } catch (e) {
            return h;
        }
    }

    /**
     * Set current file to play.
     * @param {string|null} path - relative posix path like "00/01/file.mp4"
     * @param {boolean} autoplay - try to autoplay after metadata loads
     */
    function setCurrent(path, autoplay = false) {
        currentPath = path;
        if (curPathEl) curPathEl.textContent = path || "";
        if (fileLabel) fileLabel.textContent = path || "";
        if (newNameInput) newNameInput.value = path ? path.split("/").pop() : "";
        if (path) {
            const src = api.stream(path);
            mainVideo.src = src;
            previewVideo.src = src;
            previewVideo.load();
            mainVideo.load();

            if (autoplay) {
                const playAttempt = () => {
                    mainVideo.play().catch(() => { });
                };
                if (mainVideo.readyState >= 1) {
                    playAttempt();
                } else {
                    mainVideo.addEventListener(
                        "loadedmetadata",
                        function once() {
                            playAttempt();
                        },
                        { once: true }
                    );
                }
            }
        } else {
            mainVideo.removeAttribute("src");
            previewVideo.removeAttribute("src");
        }
    }

    // sanitize id for accordion elements
    function makeId(basePath, name) {
        const s = basePath ? basePath + "/" + name : name;
        return "id-" + s.replace(/[^a-zA-Z0-9]/g, "-");
    }

    // Render tree using Bootstrap accordion recursively
    async function loadTree() {
        // clear existing nodes below searchWrapper
        while (leftTree.childNodes.length > 1) leftTree.removeChild(leftTree.lastChild);

        const searchVal = (searchInput && searchInput.value) ? searchInput.value.trim() : "";
        const url = searchVal ? (api.tree + "?search=" + encodeURIComponent(searchVal)) : api.tree;

        const res = await fetch(url);
        if (!res.ok) {
            leftTree.appendChild(createErrorNode("Failed to load library"));
            return;
        }
        const tree = await res.json();

        // container for tree
        const container = document.createElement("div");
        container.className = "accordion mt-1";

        const rootKeys = Object.keys(tree).sort();
        if (rootKeys.length === 1) {
            const rootNode = tree[rootKeys[0]];
            renderFolderAccordion(rootNode, container, "");
        } else {
            for (const rn of rootKeys) {
                const sectionId = makeId("", rn);
                const item = document.createElement("div");
                item.className = "accordion-item";
                item.innerHTML = `
          <h2 class="accordion-header" id="heading-${sectionId}">
            <button class="accordion-button collapsed folder-title text-warning" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${sectionId}" aria-expanded="false" aria-controls="collapse-${sectionId}">
              ${rn}
            </button>
          </h2>
          <div id="collapse-${sectionId}" class="accordion-collapse collapse" aria-labelledby="heading-${sectionId}">
            <div class="accordion-body p-0"></div>
          </div>
        `;
                container.appendChild(item);
                const body = item.querySelector(".accordion-body");
                renderFolderAccordion(tree[rn], body, rn);
            }
        }

        leftTree.appendChild(container);

        // if hash present, respect it
        const hashPath = getHashPath();
        if (hashPath) {
            setCurrent(hashPath, true);
            expandToPath(hashPath);
            return;
        }

        const firstFile = leftTree.querySelector(".file-item");
        if (firstFile) firstFile.click();
    }

    function createErrorNode(text) {
        const n = document.createElement("div");
        n.className = "text-danger p-2";
        n.textContent = text;
        return n;
    }

    function renderFolderAccordion(node, parentEl, basePath) {
        const acc = document.createElement("div");
        acc.className = "accordion";

        const names = Object.keys(node).sort();
        for (const name of names) {
            const val = node[name];
            if (val !== null && typeof val === "object") {
                const id = makeId(basePath, name);
                const item = document.createElement("div");
                item.className = "accordion-item";
                item.innerHTML = `
          <h2 class="accordion-header" id="heading-${id}">
            <button class="accordion-button collapsed folder-title" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${id}" aria-expanded="false" aria-controls="collapse-${id}">
              ${name}
            </button>
          </h2>
          <div id="collapse-${id}" class="accordion-collapse collapse" aria-labelledby="heading-${id}">
            <div class="accordion-body p-0"></div>
          </div>
        `;
                acc.appendChild(item);
                const body = item.querySelector(".accordion-body");
                const childBase = basePath ? basePath + "/" + name : name;
                renderFolderAccordion(val, body, childBase);
            } else {
                const relPath = basePath ? basePath + "/" + name : name;
                const fileDiv = document.createElement("div");
                fileDiv.className = "file-item d-flex align-items-center justify-content-between py-1";
                fileDiv.dataset.path = relPath;

                const left = document.createElement("div");
                left.style.flex = "1";
                left.textContent = name;
                left.style.cursor = "pointer";
                left.onclick = () => {
                    setHashPath(relPath);
                    setCurrent(relPath, true);
                    expandToPath(relPath);
                };

                const right = document.createElement("small");
                right.style.marginLeft = "8px";
                right.className = "text-muted";
                right.textContent = typeof val === "number" ? humanSize(val) : "";

                fileDiv.appendChild(left);
                fileDiv.appendChild(right);
                acc.appendChild(fileDiv);
            }
        }

        parentEl.appendChild(acc);
    }

    function humanSize(n) {
        if (!n && n !== 0) return "";
        const units = ["B", "KB", "MB", "GB", "TB"];
        let i = 0;
        let num = n;
        while (num >= 1024 && i < units.length - 1) {
            num = num / 1024;
            i++;
        }
        return num.toFixed(i === 0 ? 0 : 1) + " " + units[i];
    }

    function expandToPath(relPath) {
        if (!relPath) return;
        const segments = relPath.split("/");
        let base = "";
        for (let i = 0; i < segments.length - 1; i++) {
            base = base ? base + "/" + segments[i] : segments[i];
            const folderId = "id-" + base.replace(/[^a-zA-Z0-9]/g, "-");
            const collapseEl = document.getElementById("collapse-" + folderId);
            if (collapseEl && collapseEl.classList.contains("collapse")) {
                try {
                    const bs = bootstrap.Collapse.getOrCreateInstance(collapseEl, { toggle: false });
                    bs.show();
                } catch (e) { }
            }
        }
        const target = leftTree.querySelector(`.file-item[data-path="${relPath}"]`);
        if (target) {
            setTimeout(() => {
                target.scrollIntoView({ block: "center", behavior: "smooth" });
            }, 120);
        }
    }

    function getSiblingPaths(path) {
        if (!path) return [];
        const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
        const nodes = leftTree.querySelectorAll(".file-item");
        const out = [];
        nodes.forEach((n) => {
            const p = n.dataset && n.dataset.path ? n.dataset.path : null;
            if (!p) return;
            const pdir = p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
            if (pdir === dir) out.push(p);
        });
        return out;
    }

    function goToNextSibling() {
        if (!currentPath) return false;
        const siblings = getSiblingPaths(currentPath);
        const idx = siblings.indexOf(currentPath);
        if (idx === -1) return false;
        if (idx < siblings.length - 1) {
            const next = siblings[idx + 1];
            setHashPath(next);
            setCurrent(next, true);
            expandToPath(next);
            return true;
        }
        return false;
    }

    function goToPrevSibling() {
        if (!currentPath) return false;
        const siblings = getSiblingPaths(currentPath);
        const idx = siblings.indexOf(currentPath);
        if (idx === -1) return false;
        if (idx > 0) {
            const prev = siblings[idx - 1];
            setHashPath(prev);
            setCurrent(prev, true);
            expandToPath(prev);
            return true;
        }
        return false;
    }

    // rename flow triggered by Enter (or button)
    async function renameFlow() {
        if (!currentPath) return setMsg("select a file first");
        const newName = newNameInput.value.trim();
        if (!newName) return setMsg("enter new filename");

        const payload = { path: currentPath, new_name: newName };

        // move to next first (same behavior as pressing 'C')
        goToNextSibling(); // ignore result

        // perform rename in background; do NOT refresh the tree or update list
        try {
            const res = await fetch(api.rename, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const txt = await res.text();
                setMsg("rename error: " + txt);
                return;
            }
            setMsg("renamed:" + newName);
        } catch (e) {
            setMsg("rename failed");
            console.error(e);
        }
    }

    // UI: open rename modal and autofocus newName input
    function openRenameModal(autofocus = true) {
        if (!renameModal) return;
        if (curPathEl) curPathEl.textContent = currentPath || "";
        renameModal.show();
        renameModalEl.addEventListener(
            "shown.bs.modal",
            function once() {
                if (autofocus && newNameInput) {
                    newNameInput.focus();
                    newNameInput.select();
                }
            },
            { once: true }
        );
    }

    function closeRenameModal() {
        if (!renameModal) return;
        renameModal.hide();
    }

    // UI: open file list modal and populate items
    function openFileListModal() {
        if (!fileListModal) return;
        populateFullFileList();
        fileListModal.show();
    }

    function closeFileListModal() {
        if (!fileListModal) return;
        fileListModal.hide();
    }

    function populateFullFileList() {
        if (!fullFileList) return;
        const arr = getOrderedFilePaths();
        fullFileList.innerHTML = "";
        const container = document.createElement("div");
        container.className = "list-group list-group-flush";
        arr.forEach((p) => {
            const a = document.createElement("a");
            a.href = "javascript:void(0)";
            a.className = "list-group-item list-group-item-action bg-dark text-white";
            a.style.cursor = "pointer";
            const bn = p.split("/").pop();
            a.textContent = bn + "  —  " + p;
            a.onclick = () => {
                setHashPath(p);
                setCurrent(p, true);
                expandToPath(p);
                if (fileListModal) fileListModal.hide();
            };
            container.appendChild(a);
        });
        fullFileList.appendChild(container);
    }

    // ordered file paths (flat)
    function getOrderedFilePaths() {
        const nodes = leftTree.querySelectorAll(".file-item");
        const out = [];
        nodes.forEach((n) => {
            if (n.dataset && n.dataset.path) out.push(n.dataset.path);
        });
        return out;
    }

    // preview draw
    const ctx = previewCanvas ? previewCanvas.getContext("2d") : null;

    function onHoverSeek(e) {
        if (!previewVideo.duration || isNaN(previewVideo.duration)) return;
        if (!seekOverlay || !previewCanvasWrap || !previewCanvas) return;

        // bounding rects
        const overlayRect = seekOverlay.getBoundingClientRect();
        const playerRect = previewCanvasWrap.parentElement.getBoundingClientRect(); // playerWrap
        const canvasRect = previewCanvas.getBoundingClientRect();

        // cursor inside overlay
        const xInOverlay = Math.min(Math.max(0, e.clientX - overlayRect.left), overlayRect.width);
        const t = (xInOverlay / overlayRect.width) * previewVideo.duration;

        // desired position: right-bottom corner of preview at cursor
        const previewW = canvasRect.width || previewCanvas.width;
        const previewH = canvasRect.height || previewCanvas.height;

        // compute coordinates relative to playerRect (parent)
        let left = e.clientX - playerRect.left - previewW; // place preview's right at cursor
        let top = e.clientY - playerRect.top - previewH;   // place preview's bottom at cursor

        // small offset so preview is slightly above/left if you want
        const extraX = 0; // positive to move preview further left
        const extraY = 0; // positive to move preview further up
        left -= extraX;
        top -= extraY;

        // clamp to player bounds so it never overflows playerWrap
        const margin = 6;
        left = Math.max(margin, Math.min(left, playerRect.width - previewW - margin));
        top = Math.max(margin, Math.min(top, playerRect.height - previewH - margin));

        // apply position (no transforms)
        previewCanvasWrap.style.transform = "none";
        previewCanvasWrap.style.display = "block";
        previewCanvasWrap.style.left = left + "px";
        previewCanvasWrap.style.top = top + "px";

        // throttle seeks
        const now = performance.now();
        if (now - lastHoverTime < 60) return;
        lastHoverTime = now;

        previewVideo.currentTime = t;
        previewVideo.onseeked = () => {
            if (!ctx || !previewCanvas) return;
            try {
                ctx.drawImage(previewVideo, 0, 0, previewCanvas.width, previewCanvas.height);
            } catch (err) { /* ignore */ }
        };
    }


    function onLeaveSeek() {
        if (!previewCanvasWrap) return;
        previewCanvasWrap.style.display = "none";
    }
    function onClickSeek(e) {
        if (!mainVideo.duration || isNaN(mainVideo.duration)) return;
        if (!seekOverlay) return;
        const rect = seekOverlay.getBoundingClientRect();
        const x = Math.min(Math.max(0, e.clientX - rect.left), rect.width);
        const t = (x / rect.width) * mainVideo.duration;
        mainVideo.currentTime = t;
    }

    // rotate video clockwise 90deg
    function rotateVideoClockwise() {
        rotation = (rotation + 90) % 360;
        mainVideo.style.transformOrigin = "center center";
        mainVideo.style.transform = `rotate(${rotation}deg)`;
        mainVideo.style.objectFit = "contain";
    }

    // keyboard shortcuts
    document.addEventListener("keydown", (ev) => {
        // ESC closes modals even if typing
        if (ev.key === "Escape") {
            if (renameModal) renameModal.hide();
            if (fileListModal) fileListModal.hide();
            return;
        }

        const active = document.activeElement;
        // allow Enter in newName to trigger renameFlow
        if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) {
            if (active === newNameInput && ev.key === "Enter") {
                ev.preventDefault();
                renameFlow();
            }
            return;
        }

        // letter keys
        const k = (ev.key || "").toString();
        // Space toggles playback
        if (k === " " || ev.code === "Space") {
            ev.preventDefault();
            if (mainVideo.paused) mainVideo.play();
            else mainVideo.pause();
            return;
        }
        if (ev.code === "ArrowRight") {
            mainVideo.currentTime = Math.min(mainVideo.duration || 0, mainVideo.currentTime + 5);
            return;
        }
        if (ev.code === "ArrowLeft") {
            mainVideo.currentTime = Math.max(0, mainVideo.currentTime - 5);
            return;
        }

        const lower = k.toLowerCase();
        // Check only one key pressed, not command, options, shift or anything. If combined keys are pressed return
        if (ev.ctrlKey || ev.metaKey || ev.altKey || ev.shiftKey) return;
        if (lower === "c" || lower === "v") {
            ev.preventDefault();
            if (!currentPath) return;
            if (lower === "c") goToNextSibling();
            else goToPrevSibling();
            return;
        }

        if (lower === "x") {
            mainVideo.currentTime = Math.min(mainVideo.duration || 0, mainVideo.currentTime + 3);
            return;
        }
        if (lower === "z") {
            mainVideo.currentTime = Math.max(0, mainVideo.currentTime - 3);
            return;
        }

        // E => open rename modal
        if (lower === "e") {
            ev.preventDefault();
            openRenameModal(true);
            return;
        }

        // L => open file list (fullscreen)
        if (lower === "l") {
            ev.preventDefault();
            openFileListModal();
            return;
        }

        // R => rotate video 90deg clockwise
        if (lower === "r") {
            ev.preventDefault();
            rotateVideoClockwise();
            return;
        }
    });

    // wire rename inputs/button
    if (newNameInput) {
        newNameInput.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter") {
                ev.preventDefault();
                renameFlow();
            }
        });
    }
    const renameBtn = document.getElementById("renameBtn");
    if (renameBtn) renameBtn.addEventListener("click", renameFlow);

    // search events
    function doSearchLoad() {
        loadTree();
    }
    if (searchInput) {
        searchInput.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter") {
                ev.preventDefault();
                doSearchLoad();
            }
        });
    }
    if (searchBtn) searchBtn.addEventListener("click", doSearchLoad);
    if (clearBtn) clearBtn.addEventListener("click", () => {
        if (searchInput) searchInput.value = "";
        doSearchLoad();
    });

    // hashchange support (back/forward)
    window.addEventListener("hashchange", () => {
        const p = getHashPath();
        if (p) {
            setCurrent(p, true);
            expandToPath(p);
        }
    });

    // wire seek preview (guard in case elements absent)
    if (seekOverlay) {
        seekOverlay.addEventListener("mousemove", onHoverSeek);
        seekOverlay.addEventListener("mouseleave", onLeaveSeek);
        seekOverlay.addEventListener("click", onClickSeek);
    }

    // initial load
    await loadTree();
})();
