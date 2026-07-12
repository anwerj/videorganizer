// /static/js/main.js
import { initTree } from "./tree.js";
import { initPlayer } from "./player.js";
import { initControls } from "./controls.js";
import { initModals } from "./modals.js";
import { initRenameFlow } from "./rename-flow.js";

import { initEditTags } from "./edit-tags.js";

const api = {
  tree: "/api/tree",
  stream: (p) => "/api/stream?path=" + encodeURIComponent(p),
  rename: "/api/rename",
  tags: "/api/tags",
};

const el = id => document.getElementById(id);

// required DOM nodes
const elements = {
  leftTree: el("leftTree"),
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
};

if (!elements.leftTree) {
  console.error("main.js: required element #leftTree missing");
  throw new Error("Missing #leftTree");
}

// init
const tree = initTree(api, elements);
const player = initPlayer(api, elements, { getSiblingPaths: tree.getSiblingPaths });
const editTags = initEditTags(api, elements, { player });
const modals = initModals(elements, { editTags, player });
const renameFlow = initRenameFlow(api, elements, { tree, player, editTags, modals });

initControls({ player, tree, modals });

// wire events: when tree emits file-selected, update player
window.addEventListener('file-selected', async (e) => {
  const path = e.detail;
  if (path) player.setCurrent?.(path, true);
  if (path) tree.expandToPath(path);
  await editTags.reloadFromPlayer?.();
});

// handle hashchange
window.addEventListener('hashchange', async () => {
  const h = location.hash ? decodeURIComponent(location.hash.slice(1)) : null;
  if (h) player.setCurrent?.(h, true);
  await editTags.reloadFromPlayer?.();
});

// load tree (async); triggers initial selection
await tree.loadTree();
const h = location.hash ? decodeURIComponent(location.hash.slice(1)) : null;
if (h) {
  player.setCurrent?.(h, true);
  tree.expandToPath(h);
  await editTags.reloadFromPlayer?.();
}




// expose for debugging
window._app = { api, tree, player, modals, renameFlow, editTags };

console.log("main.js initialized");
