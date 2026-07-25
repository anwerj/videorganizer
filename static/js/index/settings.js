import { cloneCatalog, fetchCatalog, saveCatalog } from "../shared/catalog-api.js";
import { renderThemePicker } from "./themes.js";

function parseSearchInput(raw) {
    if (!raw?.trim()) return undefined;
    const terms = raw.split(",").map((s) => s.trim()).filter(Boolean);
    return terms.length ? terms : undefined;
}

function formatSearchInput(search) {
    return search?.length ? search.join(", ") : "";
}

export function initSettings(api, elms) {
    const sectionListEl = elms.settingsSectionList;
    const propertyPaletteEl = elms.settingsPropertyPalette;
    const keywordListEl = elms.settingsKeywordList;
    const keywordAddInput = elms.settingsKeywordAdd;
    const keywordAddBtn = elms.settingsKeywordAddBtn;
    const themesEl = elms.settingsThemes;
    const msgEl = elms.settingsMsg;

    let catalog = { sections: [], properties: [], keywords: [] };
    let activeForm = null;

    function setMsg(text) {
        if (msgEl) msgEl.textContent = text || "";
    }

    function sectionByCode(code) {
        return catalog.sections.find((s) => s.code === code);
    }

    function propertyByCode(code) {
        return catalog.properties.find((p) => p.code === code);
    }

    function cancelForm() {
        activeForm = null;
    }

    async function loadCatalog() {
        try {
            catalog = await fetchCatalog(api);
            setMsg("");
            renderAll();
        } catch (e) {
            console.error("failed to load catalog", e);
            setMsg(e.message || "failed to load settings");
        }
    }

    async function persist(next) {
        const prev = cloneCatalog(catalog);
        try {
            catalog = await saveCatalog(api, next);
            cancelForm();
            setMsg("");
            renderAll();
        } catch (e) {
            catalog = prev;
            setMsg(e.message || "save failed");
            throw e;
        }
    }

    function openForm(kind, mode, entry = null) {
        activeForm = { kind, mode, code: entry?.code || null };
        renderAll();
    }

    async function submitForm(kind, mode, { code, label, searchRaw }) {
        const trimmedCode = code.trim();
        const trimmedLabel = label.trim();
        const search = parseSearchInput(searchRaw);
        const next = cloneCatalog(catalog);
        const list = kind === "section" ? next.sections : next.properties;

        if (mode === "add") {
            if (list.some((e) => e.code === trimmedCode)) {
                setMsg(`code ${trimmedCode} already exists`);
                return;
            }
            list.push({ code: trimmedCode, label: trimmedLabel, search });
            list.sort((a, b) => a.code.localeCompare(b.code));
        } else {
            const idx = list.findIndex((e) => e.code === trimmedCode);
            if (idx === -1) return;
            list[idx] = { code: trimmedCode, label: trimmedLabel, search };
        }

        try {
            await persist(next);
        } catch {
            // setMsg in persist
        }
    }

    async function deleteTag(kind, code) {
        const def = kind === "section" ? sectionByCode(code) : propertyByCode(code);
        const label = def?.label || code;
        if (!confirm(`Delete "${label}" (${code})?`)) return;

        const next = cloneCatalog(catalog);
        if (kind === "section") {
            next.sections = next.sections.filter((e) => e.code !== code);
        } else {
            next.properties = next.properties.filter((e) => e.code !== code);
        }
        try {
            await persist(next);
        } catch {
            // setMsg in persist
        }
    }

    async function deleteKeyword(keyword) {
        if (!confirm(`Delete keyword "${keyword}"?`)) return;
        const next = cloneCatalog(catalog);
        next.keywords = next.keywords.filter((k) => k !== keyword);
        try {
            await persist(next);
        } catch {
            // setMsg in persist
        }
    }

    async function addKeyword(text) {
        const trimmed = text.trim();
        if (!trimmed) {
            setMsg("keyword must not be empty");
            return;
        }
        const lower = trimmed.toLowerCase();
        if (catalog.keywords.some((k) => k.toLowerCase() === lower)) {
            setMsg(`keyword "${trimmed}" already exists`);
            return;
        }
        const next = cloneCatalog(catalog);
        next.keywords = [...next.keywords, trimmed].sort((a, b) => a.localeCompare(b));
        try {
            await persist(next);
            if (keywordAddInput) keywordAddInput.value = "";
        } catch {
            // setMsg in persist
        }
    }

    function makeActionButton(title, text, onClick) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.title = title;
        btn.textContent = text;
        btn.onclick = (e) => { e.stopPropagation(); onClick(); };
        return btn;
    }

    function renderTagForm(parent, { kind, mode, entry }) {
        const card = document.createElement("div");
        card.className = "tag-form-card";

        const title = document.createElement("div");
        title.className = "tag-form-title";
        const kindLabel = kind === "section" ? "section" : "property";
        title.textContent = mode === "add" ? `Add ${kindLabel}` : `Edit ${kindLabel}`;
        card.appendChild(title);

        const codeInput = document.createElement("input");
        codeInput.type = "text";
        codeInput.className = "form-control form-control-sm edit-input tag-form-code";
        codeInput.placeholder = kind === "section" ? "00" : "a";
        codeInput.maxLength = kind === "section" ? 2 : 1;
        codeInput.value = entry?.code || "";
        codeInput.readOnly = mode === "edit";
        card.appendChild(codeInput);

        const labelInput = document.createElement("input");
        labelInput.type = "text";
        labelInput.className = "form-control form-control-sm edit-input tag-form-label";
        labelInput.placeholder = "Label";
        labelInput.value = entry?.label || "";
        card.appendChild(labelInput);

        const searchInput = document.createElement("input");
        searchInput.type = "text";
        searchInput.className = "form-control form-control-sm edit-input tag-form-search";
        searchInput.placeholder = "Search aliases (comma-separated, optional)";
        searchInput.value = formatSearchInput(entry?.search);
        card.appendChild(searchInput);

        const actions = document.createElement("div");
        actions.className = "tag-form-actions";

        const saveBtn = document.createElement("button");
        saveBtn.type = "button";
        saveBtn.className = "btn btn-primary btn-sm";
        saveBtn.textContent = "Save";
        saveBtn.onclick = () => submitForm(kind, mode, {
            code: codeInput.value,
            label: labelInput.value,
            searchRaw: searchInput.value,
        });

        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.className = "btn btn-outline-light btn-sm";
        cancelBtn.textContent = "Cancel";
        cancelBtn.onclick = () => { cancelForm(); renderAll(); };

        actions.append(saveBtn, cancelBtn);
        card.appendChild(actions);

        card.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                e.stopPropagation();
                cancelForm();
                renderAll();
            }
            if (e.key === "Enter" && e.target.tagName !== "BUTTON") {
                e.preventDefault();
                saveBtn.click();
            }
        });

        parent.appendChild(card);
        labelInput.focus();
    }

    function renderSectionList() {
        if (!sectionListEl) return;
        sectionListEl.innerHTML = "";

        const sorted = [...catalog.sections].sort((a, b) => a.code.localeCompare(b.code));
        if (!sorted.length && activeForm?.kind !== "section") {
            const empty = document.createElement("div");
            empty.className = "section-list-empty small-muted";
            empty.textContent = "No sections in config";
            sectionListEl.appendChild(empty);
        }

        for (const def of sorted) {
            const row = document.createElement("div");
            row.className = "section-row";

            const main = document.createElement("div");
            main.className = "section-row-main section-row-static";
            main.innerHTML = `<span class="section-row-code">${def.code}</span><span class="section-row-label">${def.label}</span>`;
            row.appendChild(main);

            const actions = document.createElement("span");
            actions.className = "section-row-actions";
            actions.append(
                makeActionButton("Edit section", "✎", () => openForm("section", "edit", def)),
                makeActionButton("Delete section", "×", () => deleteTag("section", def.code)),
            );
            row.appendChild(actions);
            sectionListEl.appendChild(row);
        }

        if (activeForm?.kind === "section") {
            const entry = activeForm.mode === "edit" ? sectionByCode(activeForm.code) : null;
            renderTagForm(sectionListEl, { kind: "section", mode: activeForm.mode, entry });
        }

        const addLink = document.createElement("button");
        addLink.type = "button";
        addLink.className = "tag-add-link";
        addLink.textContent = "+ Add section";
        addLink.onclick = () => openForm("section", "add");
        sectionListEl.appendChild(addLink);
    }

    function renderPropertyPalette() {
        if (!propertyPaletteEl) return;
        propertyPaletteEl.innerHTML = "";

        const sorted = [...catalog.properties].sort((a, b) => a.code.localeCompare(b.code));
        for (const p of sorted) {
            const wrap = document.createElement("div");
            wrap.className = "tag-btn-wrap";

            const btn = document.createElement("div");
            btn.className = "tag-btn tag-btn-static";
            btn.innerHTML = `<span class="tag-btn-code">${p.code}</span><span class="tag-btn-label">${p.label}</span>`;
            wrap.appendChild(btn);

            const actions = document.createElement("span");
            actions.className = "tag-btn-actions settings-tag-actions";
            actions.append(
                makeActionButton("Edit property", "✎", () => openForm("property", "edit", p)),
                makeActionButton("Delete property", "×", () => deleteTag("property", p.code)),
            );
            wrap.appendChild(actions);
            propertyPaletteEl.appendChild(wrap);
        }

        if (activeForm?.kind === "property") {
            const entry = activeForm.mode === "edit" ? propertyByCode(activeForm.code) : null;
            renderTagForm(propertyPaletteEl, { kind: "property", mode: activeForm.mode, entry });
        }

        const addLink = document.createElement("button");
        addLink.type = "button";
        addLink.className = "tag-add-link";
        addLink.textContent = "+ Add property";
        addLink.onclick = () => openForm("property", "add");
        propertyPaletteEl.appendChild(addLink);
    }

    function renderKeywordList() {
        if (!keywordListEl) return;
        keywordListEl.innerHTML = "";

        if (!catalog.keywords.length) {
            const empty = document.createElement("div");
            empty.className = "keyword-empty";
            empty.textContent = "No saved keywords";
            keywordListEl.appendChild(empty);
        } else {
            for (const kw of catalog.keywords) {
                const row = document.createElement("div");
                row.className = "keyword-row";
                const text = document.createElement("span");
                text.className = "keyword-row-text";
                text.textContent = kw;
                const del = makeActionButton("Delete keyword", "×", () => deleteKeyword(kw));
                row.append(text, del);
                keywordListEl.appendChild(row);
            }
        }
    }

    function renderThemes() {
        renderThemePicker(themesEl);
    }

    function renderAll() {
        renderThemes();
        renderSectionList();
        renderPropertyPalette();
        renderKeywordList();
    }

    keywordAddBtn?.addEventListener("click", () => addKeyword(keywordAddInput?.value || ""));
    keywordAddInput?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            addKeyword(keywordAddInput.value);
        }
    });

    return {
        loadCatalog,
        renderAll,
        cancelForm: () => { cancelForm(); },
    };
}
