package api

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

func (a *API) Rename(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		handleError(w, "method not allowed", http.StatusMethodNotAllowed, nil)
		return
	}
	type Req struct {
		Path    string `json:"path"`
		NewName string `json:"new_name"`
	}
	var req Req
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		handleError(w, "invalid json", http.StatusBadRequest, err)
		return
	}
	if req.Path == "" || req.NewName == "" {
		handleError(w, "path and new_name required", http.StatusBadRequest, nil)
		return
	}
	if strings.ContainsAny(req.NewName, "/\\") {
		handleError(w, "new_name must be filename only", http.StatusBadRequest, nil)
		return
	}

	oldPath, err := safeJoin(a.cfg.Root, req.Path)
	if err != nil {
		handleError(w, "invalid path", http.StatusBadRequest, err)
		return
	}
	if _, err := os.Stat(oldPath); err != nil {
		handleError(w, "file not found", http.StatusNotFound, err)
		return
	}

	dir := filepath.Dir(oldPath)
	newPath := filepath.Join(dir, req.NewName)

	absNew, err := filepath.Abs(newPath)
	if err != nil {
		handleError(w, "invalid new name", http.StatusBadRequest, err)
		return
	}
	absRoot, err := filepath.Abs(a.cfg.Root)
	if err != nil {
		handleError(w, "server error", http.StatusInternalServerError, err)
		return
	}
	if !(absNew == absRoot || strings.HasPrefix(absNew, absRoot+string(os.PathSeparator))) {
		handleError(w, "invalid new name", http.StatusBadRequest, err)
		return
	}

	if err := os.Rename(oldPath, newPath); err != nil {
		handleError(w, "rename failed:"+err.Error(), http.StatusInternalServerError, err)
		return
	}
	resp := map[string]any{
		"ok":       true,
		"old_path": oldPath,
		"new_path": filepath.ToSlash(strings.TrimPrefix(absNew, absRoot+string(os.PathSeparator))),
	}
	writeJSON(w, resp)
}
