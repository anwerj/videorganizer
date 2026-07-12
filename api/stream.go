package api

import (
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

func (a *API) Stream(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		handleError(w, "method not allowed", http.StatusMethodNotAllowed, nil)
		return
	}
	q := r.URL.Query()
	path := q.Get("path")
	if path == "" {
		handleError(w, "path required", http.StatusBadRequest, nil)
		return
	}
	filePath, err := safeJoin(a.cfg.Root, path)
	if err != nil {
		handleError(w, "invalid path", http.StatusBadRequest, err)
		return
	}
	fi, err := os.Stat(filePath)
	if err != nil || fi.IsDir() {
		handleError(w, "file not found", http.StatusNotFound, err)
		return
	}

	f, err := os.Open(filePath)
	if err != nil {
		handleError(w, "cannot open file", http.StatusInternalServerError, err)
		return
	}
	defer f.Close()

	ctype := mime.TypeByExtension(strings.ToLower(filepath.Ext(filePath)))
	if ctype == "" {
		ctype = "application/octet-stream"
	}
	w.Header().Set("Content-Type", ctype)
	http.ServeContent(w, r, fi.Name(), fi.ModTime(), f)
}
