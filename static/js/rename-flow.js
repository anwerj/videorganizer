// /static/js/rename-flow.js
export function initRenameFlow(api, elms, { goToNextSibling, player }) {
    const newNameInput = elms.newName;
    const msg = elms.msg;
    function setMsg(s) { if (msg) msg.textContent = s || ""; }
    async function renameFlow() {
        const currentPath = player.getCurrentPath?.() || (location.hash ? decodeURIComponent(location.hash.slice(1)) : null);
        if (!currentPath) return setMsg("select a file first");
        const newName = newNameInput.value.trim();
        if (!newName) return setMsg("enter new filename");
        const payload = { path: currentPath, new_name: newName };

        // move to next first (same as C)
        goToNextSibling(currentPath);

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
            setMsg("renamed:" + payload.path + " to " + payload.new_name );
        } catch (e) {
            setMsg("rename failed");
            console.error(e);
            setMsg("rename failed");
        }
    }

    // wire events
    window.addEventListener("rename-enter", renameFlow);
    if (newNameInput) newNameInput.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); renameFlow(); } });

    return { renameFlow };
}
