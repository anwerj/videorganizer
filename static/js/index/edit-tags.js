import { splitName, extractTsFromBase, encodeMarkers } from "../shared/utils.js";
import { parseFilename, composeFilenameBase, basenameFromPath } from "../shared/filename-tags.js";
import { initTitleAutocomplete } from "../shared/title-autocomplete.js";
import { fetchCatalog, normalizeCatalog } from "../shared/catalog-api.js";

export function initEditTags(api, elms, { player } = {}) {
    const newNameInput = elms.newName;
    const titleInput = elms.editTitle;
    const previewEl = elms.filenamePreview;
    const sectionListEl = elms.sectionList;
    const propertyPaletteEl = elms.propertyPalette;
    const msgEl = elms.msg;

    let catalog = { sections: [], properties: [], keywords: [] };
    let catalogLoaded = false;
    let selectedSections = [];
    let selectedProperties = new Set();
    let ext = "";
    let parsedPath = null;

    async function loadCatalog() {
        try {
            catalog = await fetchCatalog(api);
            catalogLoaded = true;
        } catch (e) {
            console.error("failed to load tags", e);
        }
        return catalog;
    }

    async function ensureCatalog() {
        if (catalogLoaded) return catalog;
        return loadCatalog();
    }

    function sectionByCode(code) {
        return catalog.sections.find((s) => s.code === code);
    }

    function getTitle() {
        return (titleInput?.value ?? "").trim();
    }

    function syncOutput() {
        const path = player?.getCurrentPath?.() || "";
        if (!parsedPath || path !== parsedPath) return;
        const base = composeFilenameBase({
            sections: selectedSections,
            properties: [...selectedProperties],
            title: getTitle(),
        });
        const markers = player?.getMarkers?.() || [];
        let suffix = markers.length ? encodeMarkers(markers) : "";
        if (!suffix && newNameInput?.value) {
            const { base: curBase } = splitName(newNameInput.value);
            suffix = encodeMarkers(extractTsFromBase(curBase).markers);
        }
        const full = `${base}${suffix}${ext}`;
        if (newNameInput) newNameInput.value = full;
        if (previewEl) previewEl.textContent = full || "—";
    }

    function pruneSelections() {
        const sectionCodes = new Set(catalog.sections.map((s) => s.code));
        const propertyCodes = new Set(catalog.properties.map((p) => p.code));
        selectedSections = selectedSections.filter((c) => sectionCodes.has(c));
        selectedProperties = new Set([...selectedProperties].filter((c) => propertyCodes.has(c)));
    }

    function sectionListOrder() {
        const selectedSet = new Set(selectedSections);
        const unselected = catalog.sections
            .map((s) => s.code)
            .filter((c) => !selectedSet.has(c));
        return [...selectedSections, ...unselected];
    }

    function toggleSection(code) {
        const idx = selectedSections.indexOf(code);
        if (idx === -1) {
            selectedSections = [...selectedSections, code];
        } else {
            selectedSections = selectedSections.filter((c) => c !== code);
        }
        renderAll();
    }

    function moveSection(code, dir) {
        const idx = selectedSections.indexOf(code);
        if (idx === -1) return;
        const next = [...selectedSections];
        const j = idx + dir;
        if (j < 0 || j >= next.length) return;
        [next[idx], next[j]] = [next[j], next[idx]];
        selectedSections = next;
        renderAll();
    }

    function makeActionButton(title, text, onClick) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.title = title;
        btn.textContent = text;
        btn.onclick = (e) => { e.stopPropagation(); onClick(); };
        return btn;
    }

    function renderSectionList() {
        if (!sectionListEl) return;
        sectionListEl.innerHTML = "";

        if (!catalog.sections.length) {
            const empty = document.createElement("div");
            empty.className = "section-list-empty small-muted";
            empty.textContent = "No sections in config";
            sectionListEl.appendChild(empty);
        }

        for (const code of sectionListOrder()) {
            const def = sectionByCode(code);
            const idx = selectedSections.indexOf(code);
            const isSelected = idx !== -1;

            const row = document.createElement("div");
            row.className = "section-row" + (isSelected ? " selected" : "");

            const main = document.createElement("button");
            main.type = "button";
            main.className = "section-row-main";
            main.innerHTML = isSelected
                ? `<span class="section-row-order">${idx + 1}</span><span class="section-row-code">${code}</span><span class="section-row-label">${def?.label || code}</span>`
                : `<span class="section-row-code">${code}</span><span class="section-row-label">${def?.label || code}</span>`;
            main.title = isSelected ? "Click to remove" : "Click to add";
            main.onclick = () => toggleSection(code);
            row.appendChild(main);

            if (isSelected) {
                const actions = document.createElement("span");
                actions.className = "section-row-actions";
                const up = makeActionButton("Move up", "↑", () => moveSection(code, -1));
                up.disabled = idx === 0;
                const down = makeActionButton("Move down", "↓", () => moveSection(code, 1));
                down.disabled = idx === selectedSections.length - 1;
                actions.append(up, down);
                row.appendChild(actions);
            }

            sectionListEl.appendChild(row);
        }
    }

    function renderPropertyPalette() {
        if (!propertyPaletteEl) return;
        propertyPaletteEl.innerHTML = "";

        for (const p of catalog.properties) {
            const btn = document.createElement("button");
            btn.type = "button";
            const active = selectedProperties.has(p.code);
            btn.className = "tag-btn" + (active ? " active" : "");
            btn.innerHTML = `<span class="tag-btn-code">${p.code}</span><span class="tag-btn-label">${p.label}</span>`;
            btn.onclick = () => {
                const next = new Set(selectedProperties);
                if (next.has(p.code)) next.delete(p.code);
                else next.add(p.code);
                selectedProperties = next;
                renderAll();
            };
            propertyPaletteEl.appendChild(btn);
        }
    }

    function renderAll() {
        renderSectionList();
        renderPropertyPalette();
        syncOutput();
    }

    async function loadFromFilename(filename) {
        await ensureCatalog();
        const parsed = parseFilename(filename, catalog);
        ext = parsed.ext;
        selectedSections = parsed.sections;
        selectedProperties = new Set(parsed.properties);
        if (titleInput) titleInput.value = parsed.title;
        parsedPath = player?.getCurrentPath?.() || null;
        renderAll();
    }

    async function reloadFromPlayer() {
        const path = player?.getCurrentPath?.() || "";
        const fname = basenameFromPath(path);
        if (msgEl) msgEl.textContent = "";
        if (!fname) {
            parsedPath = null;
            selectedSections = [];
            selectedProperties = new Set();
            ext = "";
            if (titleInput) titleInput.value = "";
            if (previewEl) previewEl.textContent = "—";
            return "";
        }
        await loadFromFilename(fname);
        return fname;
    }

    async function onCatalogChanged(ev) {
        if (ev.detail) {
            catalog = normalizeCatalog(ev.detail);
            catalogLoaded = true;
        } else {
            catalogLoaded = false;
            await loadCatalog();
        }
        pruneSelections();
        renderAll();
    }

    titleInput?.addEventListener("input", () => syncOutput());
    window.addEventListener("markers-changed", () => syncOutput());
    window.addEventListener("catalog-changed", onCatalogChanged);

    initTitleAutocomplete(titleInput, () => catalog.keywords || []);

    return {
        loadFromFilename,
        reloadFromPlayer,
        ensureCatalog,
        getComposedName: () => newNameInput?.value?.trim() || "",
    };
}
