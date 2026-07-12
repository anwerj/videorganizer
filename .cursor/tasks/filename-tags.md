---
title: Filename tags (digits + alpha)
status: backlog
---

Config-defined tags encoded in video filenames. Complements the existing `-ts_` timestamp suffix. No database — portable, zero lock-in.

## Motivation

Today tags are applied manually when renaming:

```
00-01-02-a-h-m-My visit to Lalbagh-ts_12_2323_234131.mp4
```

- **Digit tags** (`00`, `01`, `02`…) — category labels; **order in the filename is subjective per video** (not a parent hierarchy).
- **Alpha tags** (`a`, `m`, `h`…) — metadata (quality, language, priority, etc.).
- **Title** — human-readable name.
- **`-ts_…`** — timestamp markers (already implemented; out of scope here except parse/compose boundaries).

Folder layout mirrors digit-tag order literally, e.g. `videos/00/01/02/00-01-02-a-h-m-….mp4`. Same tags in different order → different path (`01/00/02/…`).

## Filename grammar

```
{digits}-{alpha}-{title}[-ts_{markers}]{ext}
```

| Segment | Pattern | Notes |
|---------|---------|-------|
| digits | `(NN-)+` | Two-digit codes from config, hyphen-separated; **sequence matters** |
| alpha | `([a-z]-)+` | Single lowercase letters from config, hyphen-separated |
| title | free text | Remaining basename before `-ts_` or extension |
| timestamps | `-ts_…` | Existing format; parsed by `static/js/shared/utils.js` |

**Parse order (left to right):**

1. Repeated `NN-` while `NN` is a known digit tag in config.
2. Repeated `x-` while `x` is a known alpha tag in config.
3. Rest is title (trim trailing `-` if any).
4. Optional `-ts_{…}` suffix before extension.

Unknown codes during parse: stop tag consumption; treat remainder as title (tolerant of config changes and legacy files).

**Compose order:** digits (user-chosen order) → alpha → title → optional `-ts_` → ext.

### Examples

```
00-01-02-a-h-m-My visit to Lalbagh.mp4
01-00-02-m-a-Another clip-ts_4500_3300.mp4
My visit to Lalbagh-ts_4500.mp4          → no tags; title only
00-unknown-Title.mp4                     → digit 00, then title starts at "unknown-Title" if 01 not in config
```

## Config schema

Extend `videorganizer.config.json`:

```json
{
  "Addr": "127.0.0.1:9898",
  "Exts": { "mp4": true, "mkv": true },
  "Tags": {
    "digits": {
      "00": { "label": "Public" },
      "01": { "label": "Park" },
      "02": { "label": "Travel" }
    },
    "alpha": {
      "a": { "label": "AA quality", "search": ["quality", "aa"] },
      "m": { "label": "Must watch" },
      "h": { "label": "Hindustani", "search": ["hindi", "urdu"] }
    }
  }
}
```

- **Flat maps only** — no `parent` field. Digit tags are a vocabulary; ordering lives in each filename.
- **`label`** — display name in UI.
- **`search`** (optional on alpha, optionally on digits) — extra terms for search matching beyond the single-letter code.

Config is read at server start (`config.Load()` in [`config/config.go`](config/config.go)). Expose tag definitions to the frontend (embed in page, or `GET /api/config`).

## Search

Current search (`searching` in `main.go`) matches substrings in the full path/filename.

Enhancements for tags:

- Match tag **codes** in filename (`h`, `00`) — already works.
- Match **labels** and **search aliases** from config (e.g. query `hindustani` matches file with `h-` prefix).
- Consider matching digit labels (`park`) even when only `01` appears in the name.

Search expansion should be server-side so tree API stays consistent.

## UI / workflow

Integrate with existing rename flow (`static/js/index/rename-flow.js`, rename modal, `e` shortcut).

1. **Parse on open** — when a file is selected or rename modal opens, split current basename into digit tags, alpha tags, title, timestamp suffix.
2. **Tag picker** — checklist or chips from config; digit tags support **reorder** (drag or move up/down) before confirm.
3. **Live preview** — show resulting basename and target folder path from digit order.
4. **Confirm rename** — `POST /api/rename` with composed name; existing auto-advance-to-next behavior unchanged.
5. **Display** — optional: show tag badges in file tree or file list (read-only parse).

Keyboard-first: tag toggles should not break existing shortcuts (`t`, `1`, `e`, Enter).

## Folder move (optional phase)

When digit tags are applied or reordered, optionally move file under `{root}/{d0}/{d1}/…/filename`.

- Path follows **filename digit order**, not config hierarchy.
- Use `safeJoin` / existing rename API; extend rename handler if move + rename must be atomic.
- Decide: always move, only when digits change, or user toggle.

## Implementation phases

### Phase 1 — Parse & compose (no UI)

- [ ] Config struct + defaults in `main.go`
- [ ] Shared parse/compose in Go (tests in `main_test.go` or `tags_test.go`)
- [ ] Mirror logic in `static/js/shared/` for client preview (or `scripts/test_tags_codec.js` for parity)
- [ ] Document grammar in README

### Phase 2 — Config to frontend + search

- [ ] Expose `Tags` to static UI
- [ ] Search alias expansion in `searching()`
- [ ] Tests for label/alias matching

### Phase 3 — Rename UI

- [ ] Tag picker in rename modal
- [ ] Digit reorder
- [ ] Compose basename preserving existing `-ts_` suffix when only tags/title change
- [ ] Timestamp hotkeys (`t`, `1`) update suffix without stripping tags/title

### Phase 4 — Folder mirroring

- [ ] Move file to digit-path on rename (if in scope)
- [ ] Handle collisions, missing intermediate dirs

### Phase 5 — Polish

- [ ] Tag badges in tree / file list
- [ ] Filter by tag (beyond free-text search)

## Edge cases

- File has tags not in current config → parse as title segment; don’t lose data on save unless user edits.
- Duplicate digit or alpha in filename → define policy (dedupe on compose, or reject).
- Alpha tag order — **TBD**: treat as unordered set (sort on compose) or preserve user order like digits.
- Title contains `-` → only consume known tag prefixes; never split title on hyphens blindly.
- Rename with only timestamp change → preserve tag prefix and title.
- Extension filtering (`Exts`) unchanged.

## Out of scope

- Timestamp encoding changes (see `timestamp-revisit.md`)
- Split markers (`split-markers.md`)
- Sidecar files, DB, or embedded metadata in video container

## Acceptance criteria

- Tags defined in config; manual filenames like `00-01-02-a-h-m-Title.mp4` parse correctly.
- User can add/remove/reorder digit tags and toggle alpha tags via UI; confirm writes valid filename.
- Existing `-ts_` suffix preserved and composable with tags + title.
- Search finds files by tag code, label, or configured aliases.
- README documents filename grammar and config `Tags` block.

## References

- Config today: [`config/config.go`](config/config.go) (`config.Load`, `Config`)
- Search: `searching()` in `main.go`
- Timestamp codec: `static/js/shared/utils.js`
- Rename: `static/js/index/rename-flow.js`, `/api/rename`
