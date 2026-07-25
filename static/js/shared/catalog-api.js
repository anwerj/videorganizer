export function cloneCatalog(c) {
    return {
        sections: (c.sections || []).map((e) => ({ ...e, search: e.search ? [...e.search] : undefined })),
        properties: (c.properties || []).map((e) => ({ ...e, search: e.search ? [...e.search] : undefined })),
        keywords: [...(c.keywords || [])],
    };
}

export function normalizeCatalog(c) {
    const catalog = cloneCatalog(c || {});
    if (!catalog.keywords) catalog.keywords = [];
    return catalog;
}

export async function fetchCatalog(api) {
    const res = await fetch(api.tags);
    if (!res.ok) throw new Error(await res.text());
    return normalizeCatalog(await res.json());
}

export async function saveCatalog(api, catalog) {
    const url = api.putTags || api.tags;
    const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalizeCatalog(catalog)),
    });
    if (!res.ok) throw new Error(await res.text());
    const saved = normalizeCatalog(await res.json());
    window.dispatchEvent(new CustomEvent("catalog-changed", { detail: saved }));
    return saved;
}
