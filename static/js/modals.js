// /static/js/modals.js
export function initModals(elms) {
    const renameModalEl = document.getElementById("renameModal");
    const fileListModalEl = document.getElementById("fileListModal");
    const renameModal = (typeof bootstrap !== "undefined" && renameModalEl) ? bootstrap.Modal.getOrCreateInstance(renameModalEl) : null;
    const fileListModal = (typeof bootstrap !== "undefined" && fileListModalEl) ? bootstrap.Modal.getOrCreateInstance(fileListModalEl) : null;

    function openRename(autofocus = true) {
        if (!renameModal) return;
        document.getElementById("curPath").textContent = elms.curPath?.textContent || "";
        renameModal.show();
        renameModalEl.addEventListener("shown.bs.modal", function once() {
            if (autofocus && elms.newName) { elms.newName.focus(); newName.setSelectionRange(0, 2); }
        }, { once: true });
    }
    function closeRename() { if (renameModal) renameModal.hide(); }

    function openFileList() {
        if (!fileListModal) return;
        // populate list — will be handled by tree module on event 'populate-filelist'
        fileListModal.show();
    }
    function closeFileList() { if (fileListModal) fileListModal.hide(); }

    // listen for events from tree to populate the file list
    window.addEventListener("populate-filelist", (ev) => {
        const container = elms.fullFileList;
        if (!container) return;
        container.innerHTML = "";
        const arr = ev.detail || [];
        const wrap = document.createElement("div");
        wrap.className = "list-group list-group-flush";
        arr.forEach(p => {
            const a = document.createElement("a");
            a.className = "list-group-item list-group-item-action bg-dark text-white";
            a.textContent = p.split("/").pop() + "  —  " + p;
            a.href = "javascript:void(0)";
            a.onclick = () => { location.hash = encodeURIComponent(p); renameModalEl && bootstrap.Modal.getOrCreateInstance(renameModalEl).hide(); fileListModal.hide(); window.dispatchEvent(new CustomEvent("file-selected", { detail: p })); };
            wrap.appendChild(a);
        });
        container.appendChild(wrap);
    });

    // window events mapping (for keyboard triggers)
    window.addEventListener("open-rename-modal", () => openRename(true));
    window.addEventListener("open-filelist-modal", () => openFileList());

    return { openRename, closeRename, openFileList, closeFileList };
}
