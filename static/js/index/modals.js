// /static/js/modals.js
export function initModals(elms, { editTags, player, settings } = {}) {
    const renameModalEl = document.getElementById("renameModal");
    const fileListModalEl = document.getElementById("fileListModal");
    const settingsModalEl = document.getElementById("settingsModal");
    const renameModal = (typeof bootstrap !== "undefined" && renameModalEl) ? bootstrap.Modal.getOrCreateInstance(renameModalEl) : null;
    const fileListModal = (typeof bootstrap !== "undefined" && fileListModalEl) ? bootstrap.Modal.getOrCreateInstance(fileListModalEl) : null;
    const settingsModal = (typeof bootstrap !== "undefined" && settingsModalEl) ? bootstrap.Modal.getOrCreateInstance(settingsModalEl) : null;
    const titleInput = elms.editTitle;
    const msgEl = elms.msg;

    function isRenameOpen() {
        return renameModalEl?.classList.contains("show");
    }

    async function refreshEditForm() {
        const path = player?.getCurrentPath?.() || elms.curPath?.textContent || "";
        if (elms.curPath) elms.curPath.textContent = path;
        await editTags?.reloadFromPlayer?.();
    }

    async function openRename(autofocus = true) {
        if (!renameModal) return;
        await refreshEditForm();
        renameModal.show();
        renameModalEl.addEventListener("shown.bs.modal", function once() {
            if (autofocus && titleInput) {
                titleInput.focus();
                titleInput.select();
            }
        }, { once: true });
    }
    function closeRename() { if (renameModal) renameModal.hide(); }

    renameModalEl?.addEventListener("hidden.bs.modal", () => {
        if (msgEl) msgEl.textContent = "";
        editTags?.reloadFromPlayer?.();
    });

    async function openSettings() {
        if (!settingsModal) return;
        await settings?.loadCatalog?.();
        settingsModal.show();
    }
    function closeSettings() { if (settingsModal) settingsModal.hide(); }

    settingsModalEl?.addEventListener("hidden.bs.modal", () => {
        if (elms.settingsMsg) elms.settingsMsg.textContent = "";
        settings?.cancelForm?.();
        settings?.renderAll?.();
    });

    document.getElementById("btnSettings")?.addEventListener("click", () => openSettings());

    function openFileList() {
        if (!fileListModal) return;
        fileListModal.show();
    }
    function closeFileList() { if (fileListModal) fileListModal.hide(); }

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

    window.addEventListener("open-rename-modal", () => openRename(true));
    window.addEventListener("open-filelist-modal", () => openFileList());
    window.addEventListener("open-settings-modal", () => openSettings());

    return { openRename, closeRename, openFileList, closeFileList, openSettings, closeSettings, refreshEditForm, isRenameOpen };
}
