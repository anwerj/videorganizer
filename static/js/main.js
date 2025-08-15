// /static/js/main.js
import { initTree } from "./tree.js";
import { initPlayer } from "./player.js";
import { initControls } from "./controls.js";
import { initModals } from "./modals.js";
import { initRenameFlow } from "./rename-flow.js";

const api = {
  tree: "/api/tree",
  stream: (p) => "/api/stream?path=" + encodeURIComponent(p),
  rename: "/api/rename",
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
const modals = initModals(elements);
const renameFlow = initRenameFlow(api, elements, { goToNextSibling: tree.goToNextSibling, player });

initControls({ player, tree, modals });

// wire events: when tree emits file-selected, update player
window.addEventListener('file-selected', (e) => {
  const path = e.detail;
  if (path) player.setCurrent?.(path, true);
  if (path) tree.expandToPath(path)
});

// handle hashchange
window.addEventListener('hashchange', () => {
  const h = location.hash ? decodeURIComponent(location.hash.slice(1)) : null;
  if (h) player.setCurrent?.(h, true);
});

// load tree (async); triggers initial selection
await tree.loadTree();
const h = location.hash ? decodeURIComponent(location.hash.slice(1)) : null;
if (h) {
  player.setCurrent?.(h, true);
  tree.expandToPath(h)
}




// expose for debugging
window._app = { api, tree, player, modals, renameFlow };

console.log("main.js initialized");
