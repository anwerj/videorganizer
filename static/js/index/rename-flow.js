// /static/js/rename-flow.js
export function initRenameFlow(api, elms, { tree, player, editTags, modals }) {
    const newNameInput = elms.newName;
    const titleInput = elms.editTitle;
    const msg = elms.msg;
    const btnConfirm = document.getElementById("btnConfirmRename");
    function setMsg(s) { if (msg) msg.textContent = s || ""; }

    async function renameFlow() {
        const currentPath = player.getCurrentPath?.() || (location.hash ? decodeURIComponent(location.hash.slice(1)) : null);
        if (!currentPath) return setMsg("select a file first");
        const newName = (editTags?.getComposedName?.() || newNameInput?.value || "").trim();
        if (!newName) return setMsg("enter a title or tags");
        const payload = { path: currentPath, new_name: newName };
        const nextPath = tree?.nextSiblingPath?.(currentPath) ?? null;

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
            const data = await res.json();
            const newPath = data.new_path || currentPath.replace(/[^/]+$/, newName);
            tree?.updateFilePath?.(currentPath, newPath);
            modals?.closeRename?.();
            if (nextPath) {
                tree?.selectPath?.(nextPath);
            } else {
                tree?.selectPath?.(newPath);
            }
        } catch (e) {
            setMsg("rename failed");
            console.error(e);
        }
    }

    window.addEventListener("rename-enter", renameFlow);
    btnConfirm?.addEventListener("click", renameFlow);
    titleInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); renameFlow(); } });

    return { renameFlow };
}
