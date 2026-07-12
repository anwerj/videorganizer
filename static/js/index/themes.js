const STORAGE_KEY = "videorganizer.theme";
const DEFAULT_THEME = "azure";

export const THEMES = ["azure", "violet", "jade", "ember", "minimal"];

const THEME_LABELS = {
    azure: "Azure",
    violet: "Violet",
    jade: "Jade",
    ember: "Ember",
    minimal: "Minimal",
};

const THEME_HINTS = {
    azure: "Blue glass (default)",
    violet: "Purple glass",
    jade: "Teal glass",
    ember: "Warm orange chrome",
    minimal: "Plain dark",
};

const LEGACY_THEMES = {
    slate: "azure",
    compact: "ember",
    default: "azure",
};

export function normalizeTheme(id) {
    if (THEMES.includes(id)) return id;
    if (LEGACY_THEMES[id]) return LEGACY_THEMES[id];
    return DEFAULT_THEME;
}

export function applyTheme(id) {
    const theme = normalizeTheme(id);
    document.documentElement.dataset.theme = theme;
    return theme;
}

export function saveTheme(id) {
    try {
        localStorage.setItem(STORAGE_KEY, normalizeTheme(id));
    } catch (e) {
        console.warn("could not save theme", e);
    }
}

export function loadTheme() {
    try {
        const t = localStorage.getItem(STORAGE_KEY);
        if (t) return normalizeTheme(t);
    } catch (e) {
        console.warn("could not load theme", e);
    }
    return DEFAULT_THEME;
}

export function initThemes() {
    const bar = document.getElementById("themeBar");
    if (!bar) return;

    const current = applyTheme(loadTheme());

    const label = document.createElement("span");
    label.className = "theme-bar-label";
    label.textContent = "Themes";

    const options = document.createElement("div");
    options.className = "theme-bar-options";

    function pickTheme(id) {
        const theme = normalizeTheme(id);
        if (theme === loadTheme()) return;
        saveTheme(theme);
        location.reload();
    }

    for (const id of THEMES) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "theme-btn" + (id === current ? " active" : "");
        btn.textContent = THEME_LABELS[id] || id;
        btn.dataset.theme = id;
        btn.title = THEME_HINTS[id] || id;
        btn.onclick = () => pickTheme(id);
        options.appendChild(btn);
    }

    bar.appendChild(label);
    bar.appendChild(options);

    return { pickTheme, loadTheme, applyTheme };
}
