const MAX_SUGGESTIONS = 8;

export function getTokenAtCursor(value, caret) {
    const pos = Math.max(0, Math.min(caret ?? value.length, value.length));
    let start = pos;
    while (start > 0 && value[start - 1] !== " ") start -= 1;
    let end = pos;
    while (end < value.length && value[end] !== " ") end += 1;
    return { start, end, text: value.slice(start, end) };
}

function filterKeywords(keywords, token) {
    if (!token) return [];
    const lower = token.toLowerCase();
    return keywords
        .filter((kw) => kw.toLowerCase().startsWith(lower))
        .slice(0, MAX_SUGGESTIONS);
}

function highlightMatch(keyword, token) {
    const span = document.createElement("span");
    if (!token) {
        span.textContent = keyword;
        return span;
    }
    const len = token.length;
    const head = keyword.slice(0, len);
    const tail = keyword.slice(len);
    if (head.toLowerCase() !== token.toLowerCase()) {
        span.textContent = keyword;
        return span;
    }
    span.innerHTML = `<strong>${escapeHtml(head)}</strong>${escapeHtml(tail)}`;
    return span;
}

function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function initTitleAutocomplete(input, getKeywords) {
    if (!input) return { destroy: () => {} };

    const wrap = input.closest(".title-input-wrap") || input.parentElement;
    const list = document.createElement("div");
    list.className = "title-autocomplete";
    list.hidden = true;
    wrap.appendChild(list);

    let activeIndex = -1;
    let matches = [];

    function hide() {
        list.hidden = true;
        list.innerHTML = "";
        activeIndex = -1;
        matches = [];
    }

    function accept(keyword) {
        const value = input.value;
        const caret = input.selectionStart ?? value.length;
        const { start, end } = getTokenAtCursor(value, caret);
        input.value = value.slice(0, start) + keyword + value.slice(end);
        const newCaret = start + keyword.length;
        input.setSelectionRange(newCaret, newCaret);
        hide();
        input.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function render() {
        const value = input.value;
        const caret = input.selectionStart ?? value.length;
        const { text } = getTokenAtCursor(value, caret);
        const keywords = getKeywords() || [];
        matches = filterKeywords(keywords, text);
        if (!matches.length || !text) {
            hide();
            return;
        }
        list.innerHTML = "";
        matches.forEach((kw, i) => {
            const item = document.createElement("button");
            item.type = "button";
            item.className = "title-ac-item" + (i === activeIndex ? " active" : "");
            item.appendChild(highlightMatch(kw, text));
            item.onclick = (e) => {
                e.preventDefault();
                accept(kw);
            };
            list.appendChild(item);
        });
        list.hidden = false;
        if (activeIndex < 0 || activeIndex >= matches.length) activeIndex = 0;
        updateActive();
    }

    function updateActive() {
        const items = list.querySelectorAll(".title-ac-item");
        items.forEach((el, i) => el.classList.toggle("active", i === activeIndex));
    }

    function onInput() {
        activeIndex = 0;
        render();
    }

    function onKeyDown(e) {
        if (list.hidden || !matches.length) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            activeIndex = (activeIndex + 1) % matches.length;
            updateActive();
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            activeIndex = (activeIndex - 1 + matches.length) % matches.length;
            updateActive();
        } else if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            accept(matches[activeIndex]);
        } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            hide();
        }
    }

    function onBlur() {
        setTimeout(hide, 150);
    }

    input.addEventListener("input", onInput);
    input.addEventListener("keydown", onKeyDown);
    input.addEventListener("blur", onBlur);

    return {
        destroy() {
            input.removeEventListener("input", onInput);
            input.removeEventListener("keydown", onKeyDown);
            input.removeEventListener("blur", onBlur);
            list.remove();
        },
    };
}
