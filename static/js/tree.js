// /static/js/tree.js
export function initTree(api, elms) {
    const leftTree = elms.leftTree;

    // create search UI at top
    const searchWrapper = document.createElement("div");
    searchWrapper.className = "mb-2";
    searchWrapper.innerHTML = `
    <div class="input-group">
      <input id="treeSearchInput" class="form-control form-control-sm" placeholder="Search (press Enter)" />
      <button id="treeSearchBtn" class="btn btn-sm btn-outline-secondary" type="button">Search</button>
      <button id="treeClearBtn" class="btn btn-sm btn-outline-secondary" type="button">×</button>
    </div>
  `;
    leftTree.appendChild(searchWrapper);
    const searchInput = searchWrapper.querySelector("#treeSearchInput");
    const searchBtn = searchWrapper.querySelector("#treeSearchBtn");
    const clearBtn = searchWrapper.querySelector("#treeClearBtn");

    function makeId(basePath, name) {
        const s = basePath ? basePath + "/" + name : name;
        return "id-" + s.replace(/[^a-zA-Z0-9]/g, "-");
    }

    async function loadTree(search = "") {
        // clear below search wrapper
        while (leftTree.childNodes.length > 1) leftTree.removeChild(leftTree.lastChild);

        const url = search ? `${api.tree}?search=${encodeURIComponent(search)}` : api.tree;
        const res = await fetch(url);
        if (!res.ok) {
            const n = document.createElement("div");
            n.className = "text-danger p-2";
            n.textContent = "Failed to load library";
            leftTree.appendChild(n);
            return;
        }
        const treeJson = await res.json();
        const container = document.createElement("div");
        container.className = "accordion mt-1";

        const rootKeys = Object.keys(treeJson).sort();
        if (rootKeys.length === 1) {
            renderFolder(treeJson[rootKeys[0]], container, "");
        } else {
            for (const rn of rootKeys) {
                const sectionId = makeId("", rn);
                const item = document.createElement("div");
                item.className = "accordion-item";
                item.innerHTML = `
          <h2 class="accordion-header" id="heading-${sectionId}">
            <button class="accordion-button collapsed folder-title" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${sectionId}">
              ${rn}
            </button>
          </h2>
          <div id="collapse-${sectionId}" class="accordion-collapse collapse">
            <div class="accordion-body p-0"></div>
          </div>
        `;
                container.appendChild(item);
                const body = item.querySelector(".accordion-body");
                renderFolder(treeJson[rn], body, rn);
            }
        }

        leftTree.appendChild(container);

        // auto-select first file if no hash
        const hash = location.hash ? decodeURIComponent(location.hash.slice(1)) : null;
        if (!hash) {
            const first = leftTree.querySelector(".file-item");
            if (first) first.click();
        }
    }

    function renderFolder(node, parentEl, basePath) {
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
            <button class="accordion-button collapsed folder-title" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${id}">
              ${name}
            </button>
          </h2>
          <div id="collapse-${id}" class="accordion-collapse collapse">
            <div class="accordion-body p-0"></div>
          </div>
        `;
                acc.appendChild(item);
                const body = item.querySelector(".accordion-body");
                const childBase = basePath ? basePath + "/" + name : name;
                renderFolder(val, body, childBase);
            } else {
                const relPath = basePath ? basePath + "/" + name : name;
                const fileDiv = document.createElement("div");
                fileDiv.className = "file-item d-flex justify-content-between align-items-center py-1";
                fileDiv.dataset.path = relPath;
                const left = document.createElement("div");
                left.style.flex = "1";
                left.textContent = name;
                left.style.cursor = "pointer";
                left.onclick = () => {
                    location.hash = encodeURIComponent(relPath);
                    // dispatch a custom event to tell caller which file was clicked
                    window.dispatchEvent(new CustomEvent("file-selected", { detail: relPath }));
                };
                const right = document.createElement("small");
                right.className = "ms-2";
                right.textContent = typeof val === "number" ? humanSize(val) : "";
                fileDiv.appendChild(left);
                fileDiv.appendChild(right);
                acc.appendChild(fileDiv);
            }
        }
        parentEl.appendChild(acc);
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
        switchFileItemSelected(target)
        if (target) {
            setTimeout(() => {
                target.scrollIntoView({ block: "center", behavior: "smooth" });
            }, 120);
        }
    }

    function switchFileItemSelected(target) {
        const prevTarget = leftTree.querySelector(`.file-item-selected`);
        if (prevTarget) {
            prevTarget.classList.remove('file-item-selected');
        }
        target.classList.add("file-item-selected");
    }

    function humanSize(n) {
        if (!n && n !== 0) return "";
        const units = ["B", "KB", "MB", "GB", "TB"];
        let i = 0; let num = n;
        while (num >= 1024 && i < units.length - 1) { num /= 1024; i++; }
        return num.toFixed(i === 0 ? 0 : 1) + " " + units[i];
    }

    // helpers reading DOM
    function getOrderedFilePaths() {
        const nodes = leftTree.querySelectorAll(".file-item");
        return Array.from(nodes).map(n => n.dataset.path).filter(Boolean);
    }
    function getSiblingPaths(path) {
        if (!path) return [];
        const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
        return getOrderedFilePaths().filter(p => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "") === dir);
    }
    function goToNextSibling(currentPath) {
        const siblings = getSiblingPaths(currentPath);
        const idx = siblings.indexOf(currentPath);
        if (idx === -1) return false;
        if (idx < siblings.length - 1) {
            const next = siblings[idx + 1];
            location.hash = encodeURIComponent(next);
            window.dispatchEvent(new CustomEvent("file-selected", { detail: next }));
            return true;
        }
        return false;
    }
    function goToPrevSibling(currentPath) {
        const siblings = getSiblingPaths(currentPath);
        const idx = siblings.indexOf(currentPath);
        if (idx > 0) {
            const prev = siblings[idx - 1];
            location.hash = encodeURIComponent(prev);
            window.dispatchEvent(new CustomEvent("file-selected", { detail: prev }));
            return true;
        }
        return false;
    }

    // wire search controls
    searchInput.addEventListener("keydown", (e) => { if (e.key === "Enter") loadTree(searchInput.value.trim()); });
    searchBtn.addEventListener("click", () => loadTree(searchInput.value.trim()));
    clearBtn.addEventListener("click", () => { searchInput.value = ""; loadTree(); });

    // public API
    return {
        loadTree,
        expandToPath,
        getOrderedFilePaths,
        getSiblingPaths,
        goToNextSibling: (cur) => goToNextSibling(cur),
        goToPrevSibling: (cur) => goToPrevSibling(cur),
    };
}
