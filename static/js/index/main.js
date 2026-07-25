// /static/js/main.js
import { initTree } from "./tree.js";
import { initPlayer } from "./player.js";
import { initControls } from "./controls.js";
import { initModals } from "./modals.js";
import { initRenameFlow } from "./rename-flow.js";

import { initEditTags } from "./edit-tags.js";
import { initSettings } from "./settings.js";
import { initThemes } from "./themes.js";

const api = {
  tree: "/api/tree",
  stream: (p) => "/api/stream?path=" + encodeURIComponent(p),
  rename: "/api/rename",
  tags: "/api/tags",
  putTags: "/api/tags",
};

const el = id => document.getElementById(id);

const elements = {
  leftTree: el("leftTree"),
  treeScroll: el("treeScroll"),
  mainVideo: el("mainVideo"),
  seekOverlay: el("seekOverlay"),
  previewCanvasWrap: el("previewCanvasWrap"),
  previewCanvas: el("previewCanvas"),
  curPath: el("curPath"),
  newName: el("newName"),
  editTitle: el("editTitle"),
  filenamePreview: el("filenamePreview"),
  sectionList: el("sectionList"),
  propertyPalette: el("propertyPalette"),
  msg: el("msg"),
  fileLabel: el("fileLabel"),
  fullFileList: el("fullFileList"),
  settingsThemes: el("settingsThemes"),
  settingsSectionList: el("settingsSectionList"),
  settingsPropertyPalette: el("settingsPropertyPalette"),
  settingsKeywordList: el("settingsKeywordList"),
  settingsKeywordAdd: el("settingsKeywordAdd"),
  settingsKeywordAddBtn: el("settingsKeywordAddBtn"),
  settingsMsg: el("settingsMsg"),
};

if (!elements.leftTree) {
  console.error("main.js: required element #leftTree missing");
  throw new Error("Missing #leftTree");
}

initThemes();
const settings = initSettings(api, elements);
const tree = initTree(api, elements);
const player = initPlayer(api, elements, { getSiblingPaths: tree.getSiblingPaths });
const editTags = initEditTags(api, elements, { player });
const modals = initModals(elements, { editTags, player, settings });
const renameFlow = initRenameFlow(api, elements, { tree, player, editTags, modals });

initControls({ player, tree, modals });

window.addEventListener('file-selected', async (e) => {
  const path = e.detail;
  if (path) player.setCurrent?.(path, true);
  if (path) tree.expandToPath(path);
  await editTags.reloadFromPlayer?.();
});

window.addEventListener('hashchange', async () => {
  const h = location.hash ? decodeURIComponent(location.hash.slice(1)) : null;
  if (h) player.setCurrent?.(h, true);
  await editTags.reloadFromPlayer?.();
});

await tree.loadTree();
const h = location.hash ? decodeURIComponent(location.hash.slice(1)) : null;
if (h) {
  player.setCurrent?.(h, true);
  tree.expandToPath(h);
  await editTags.reloadFromPlayer?.();
}

window._app = { api, tree, player, modals, renameFlow, editTags, settings };

console.log("main.js initialized");
