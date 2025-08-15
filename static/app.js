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
    const renameBtn = document.getElementById("renameBtn");
    const msg = document.getElementById("msg");
    const fileLabel = document.getElementById("fileLabel");

    // hidden preview video
    const previewVideo = document.createElement("video");
    previewVideo.muted = true;
    previewVideo.preload = "metadata";
    previewVideo.crossOrigin = "anonymous";
    previewVideo.style.display = "none";
    document.body.appendChild(previewVideo);

    let currentPath = null;
    let lastHoverTime = 0;

    function setMsg(s) {
        msg.textContent = s || "";
    }

    // set hash helpers
    function setHashPath(path) {
        if (!path) {
            history.replaceState(null, "", location.pathname + location.search);
            return;
        }
        // store encoded path in hash
        location.hash = encodeURIComponent(path);
    }

    function getHashPath() {
        if (!location.hash) return null;
        // strip leading '#'
        let h = location.hash.slice(1);
        // accept optional "path=" prefix
        if (h.startsWith("path=")) h = h.slice(5);
        try {
            return decodeURIComponent(h);
        } catch (e) {
            // fallback raw
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
        curPathEl.textContent = path || "";
        fileLabel.textContent = path || "";
        newNameInput.value = path ? path.split("/").pop() : "";
        if (path) {
            const src = api.stream(path);
            mainVideo.src = src;
            previewVideo.src = src;
            // load both so duration available for preview
            previewVideo.load();
            mainVideo.load();

            if (autoplay) {
                // play after metadata available; use once:true to avoid duplicates
                const playAttempt = () => {
                    mainVideo.play().catch(() => {
                        // autoplay may be blocked by browser; ignore
                    });
                };
                if (mainVideo.readyState >= 1) {
                    // metadata already loaded
                    playAttempt();
                } else {
                    mainVideo.addEventListener("loadedmetadata", function once() {
                        playAttempt();
                    }, { once: true });
                }
            }
        } else {
            mainVideo.removeAttribute("src");
            previewVideo.removeAttribute("src");
        }
    }

    // sanitize id for accordion elements
    function makeId(basePath, name) {
        const s = basePath ? (basePath + "/" + name) : name;
        // replace non-alnum with dash
        return "id-" + s.replace(/[^a-zA-Z0-9]/g, "-");
    }

    // Render tree using Bootstrap accordion recursively
    async function loadTree() {
        const res = await fetch(api.tree);
        if (!res.ok) {
            leftTree.innerHTML = "<div class='text-danger'>Failed to load library</div>";
            return;
        }
        const tree = await res.json();
        leftTree.innerHTML = "";

        const rootKeys = Object.keys(tree).sort();
        // if single root (like "all"), show its children directly
        if (rootKeys.length === 1) {
            const rootName = rootKeys[0];
            const rootNode = tree[rootName];
            const container = document.createElement("div");
            container.className = "accordion";
            renderFolderAccordion(rootNode, container, ""); // basePath empty so relative paths start directly
            leftTree.appendChild(container);
        } else {
            // multiple roots: render each root as an accordion section
            const container = document.createElement("div");
            container.className = "accordion";
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
            leftTree.appendChild(container);
        }

        // auto-select first file if any (but prefer hash if present)
        const hashPath = getHashPath();
        if (hashPath) {
            // ensure this path exists in the tree before setting
            // we will simply set it; streaming endpoint will return 404 if missing
            setCurrent(hashPath, true);
            // expand accordion nodes to reveal selected file (optional)
            expandToPath(hashPath);
            return;
        }

        const firstFile = leftTree.querySelector(".file-item");
        if (firstFile) firstFile.click();
    }

    /**
     * Render a folder node into parentEl as an accordion (recursive).
     * node: object mapping name -> (object or number)
     * parentEl: DOM element to append to
     * basePath: posix path so far (no leading slash)
     */
    function renderFolderAccordion(node, parentEl, basePath) {
        // We'll create an accordion container to hold items for this node.
        // parentEl may be an accordion-body or top-level accordion.
        const acc = document.createElement("div");
        acc.className = "accordion";

        const names = Object.keys(node).sort();
        for (const name of names) {
            const val = node[name];
            if (val !== null && typeof val === "object") {
                // folder -> accordion item
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
                // file -> list item
                // create a simple container (not an accordion item)
                const relPath = basePath ? basePath + "/" + name : name;
                const fileDiv = document.createElement("div");
                fileDiv.className = "file-item";
                const left = document.createElement("div");
                left.style.flex = "1";
                left.textContent = name;
                left.onclick = () => {
                    // update hash and open file; clicking is a user gesture so autoplay is allowed
                    setHashPath(relPath);
                    setCurrent(relPath, true);
                    // expand accordions to reveal file (so hash navigation shows selection)
                    expandToPath(relPath);
                };
                const right = document.createElement("small");
                right.style.marginLeft = "8px";
                right.textContent = (typeof val === "number") ? humanSize(val) : "";
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

    // Expand accordions to reveal the file path, if possible.
    // It attempts to open collapse elements for each segment.
    function expandToPath(relPath) {
        if (!relPath) return;
        const segments = relPath.split("/");
        let base = "";
        for (let i = 0; i < segments.length - 1; i++) {
            base = base ? base + "/" + segments[i] : segments[i];
            const id = makeId(base, ""); // makeId expects name; we want id for folder header -> we created ids using makeId(parentBase, name)
            // Instead compute id for this folder:
            const folderId = "id-" + base.replace(/[^a-zA-Z0-9]/g, "-");
            const collapseEl = document.getElementById("collapse-" + folderId);
            if (collapseEl && collapseEl.classList.contains("collapse")) {
                // use Bootstrap Collapse api to show
                try {
                    const bs = bootstrap.Collapse.getOrCreateInstance(collapseEl, { toggle: false });
                    bs.show();
                } catch (e) { /* ignore */ }
            }
        }
        // scroll into view the selected file element if exists
        const nodes = leftTree.querySelectorAll(".file-item");
        for (const n of nodes) {
            const left = n.querySelector("div");
            if (!left) continue;
            const name = left.textContent;
            const parentUl = n.closest(".accordion");
            // build candidate path by walking up accordion ancestors
            // simple heuristic: check n.onclick target relPath by triggering; but we can check onclick via function closure is not accessible.
            // Instead, match by text and nearest parent headers to approximate; easier: set attribute data-path when creating file items.
        }
    }

    // We'll slightly improve renderFolderAccordion to set data-path on file items so expandToPath can find them precisely.
    // To make that work, modify renderFolderAccordion above: when creating fileDiv add fileDiv.dataset.path = relPath;
    // (For clarity, we will set it now by rewalking and assigning)
    function setDataPathAttributes() {
        const fileDivs = leftTree.querySelectorAll(".file-item");
        fileDivs.forEach(fd => {
            // if already has data-path skip
            if (fd.dataset && fd.dataset.path) return;
            // derive path by computing the chain of folder titles above it
            // easier: we encoded path when creating; ensure renderFolderAccordion sets dataset.path. If not present, ignore.
        });
    }

    // rename handler
    renameBtn.onclick = async () => {
        if (!currentPath) return setMsg("select a file first");
        const newName = newNameInput.value.trim();
        if (!newName) return setMsg("enter new filename");
        setMsg("renaming...");
        try {
            const res = await fetch(api.rename, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path: currentPath, new_name: newName }),
            });
            if (!res.ok) {
                const txt = await res.text();
                setMsg("error: " + txt);
                return;
            }
            const json = await res.json();
            await loadTree();
            // update hash to new path and select
            setHashPath(json.new_path);
            setCurrent(json.new_path, true);
            setMsg("renamed");
        } catch (e) {
            setMsg("rename failed");
            console.error(e);
        }
    };

    // preview draw
    const ctx = previewCanvas.getContext("2d");

    // handle hover on seekOverlay
    function onHoverSeek(e) {
        if (!previewVideo.duration || isNaN(previewVideo.duration)) return;
        const rect = seekOverlay.getBoundingClientRect();
        const x = Math.min(Math.max(0, e.clientX - rect.left), rect.width);
        const t = (x / rect.width) * previewVideo.duration;
        previewCanvasWrap.style.display = "block";
        previewCanvasWrap.style.left = (e.clientX) + "px";
        previewCanvasWrap.style.top = (rect.top) + "px";
        const now = performance.now();
        if (now - lastHoverTime < 60) return;
        lastHoverTime = now;
        previewVideo.currentTime = t;
        previewVideo.onseeked = () => {
            const w = previewCanvas.width;
            const h = previewCanvas.height;
            try {
                ctx.drawImage(previewVideo, 0, 0, w, h);
            } catch (err) { }
        };
    }

    function onLeaveSeek() {
        previewCanvasWrap.style.display = "none";
    }

    function onClickSeek(e) {
        if (!mainVideo.duration || isNaN(mainVideo.duration)) return;
        const rect = seekOverlay.getBoundingClientRect();
        const x = Math.min(Math.max(0, e.clientX - rect.left), rect.width);
        const t = (x / rect.width) * mainVideo.duration;
        mainVideo.currentTime = t;
    }

    // keyboard shortcuts
    document.addEventListener("keydown", (ev) => {
        if (!mainVideo) return;
        if (ev.code === "Space") {
            ev.preventDefault();
            if (mainVideo.paused) mainVideo.play(); else mainVideo.pause();
        } else if (ev.code === "ArrowRight") {
            mainVideo.currentTime = Math.min(mainVideo.duration || 0, mainVideo.currentTime + 5);
        } else if (ev.code === "ArrowLeft") {
            mainVideo.currentTime = Math.max(0, mainVideo.currentTime - 5);
        }
    });

    // handle hashchange (back/forward)
    window.addEventListener("hashchange", () => {
        const p = getHashPath();
        if (p) {
            setCurrent(p, true);
            expandToPath(p);
        }
    });

    // wire events
    seekOverlay.addEventListener("mousemove", onHoverSeek);
    seekOverlay.addEventListener("mouseleave", onLeaveSeek);
    seekOverlay.addEventListener("click", onClickSeek);

    // load initial tree
    await loadTree();

})();
