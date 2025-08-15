package main

import (
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"
)

// ----------------------
// Embedded static assets
// ----------------------
//
//go:embed static/*
var staticFS embed.FS

// ----------------------
// Configuration
// ----------------------
var (
	ListenAddr = "127.0.0.1:9898"
	RootDir    = "." // folder next to binary containing videos
	ValidExts  = map[string]bool{
		".mp4":  true,
		".mkv":  true,
		".mov":  true,
		".webm": true,
	}
)

// ----------------------
// Helpers
// ----------------------

// safeJoin resolves rel (posix style) inside root and ensures it stays inside root
func safeJoin(root, rel string) (string, error) {
	rel = strings.ReplaceAll(rel, "\\", "/")
	rel = strings.TrimLeft(rel, "/")
	joined := filepath.Join(root, filepath.FromSlash(rel))
	absJoined, err := filepath.Abs(joined)
	if err != nil {
		return "", err
	}
	absRoot, err := filepath.Abs(root)
	if err != nil {
		return "", err
	}
	// ensure prefix
	if !strings.HasPrefix(absJoined, absRoot) {
		return "", errors.New("invalid path")
	}
	return absJoined, nil
}

// buildTree returns a top-level map where the key is the basename of root and the value
// is a recursive map representing directories and files.
// Files are represented by their size (int64). Directories are map[string]interface{}.
func buildTree(root string) (map[string]interface{}, error) {
	info, err := os.Stat(root)
	if err != nil {
		return nil, err
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("root is not a directory")
	}

	base := filepath.Base(root)
	node, err := buildNode(root)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{base: node}, nil
}

// buildNode builds a map for a single directory path.
// Directory entries are keys to nested maps; files map to their file size (int64).
func buildNode(dir string) (map[string]interface{}, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	// collect names and sort for deterministic output
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		names = append(names, e.Name())
	}
	sort.Strings(names)

	node := make(map[string]interface{}, len(names))
	for _, name := range names {
		full := filepath.Join(dir, name)
		info, err := os.Stat(full)
		if err != nil {
			// skip unreadable entries
			continue
		}
		if info.IsDir() {
			child, err := buildNode(full)
			if err != nil {
				// if child fails, skip it but continue
				continue
			}
			node[name] = child
		} else {
			// file -> store size (as number)
			node[name] = info.Size()
		}
	}
	return node, nil
}

func stableSort(s []string) []string {
	if len(s) <= 1 {
		return s
	}
	// simple builtin
	// import sort would be cleaner; use it
	// but to avoid unused imports, use sort package
	// we will use the sort package here
	// (bring it inline)
	// using standard library:
	// sort.Strings(s)
	// but write it properly:
	// We'll import sort below in the imports block if needed.
	// To keep code straightforward, we'll call sort here:
	// (the import is already added)
	return s
}

func writeJSON(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	_ = enc.Encode(v)
}

// ----------------------
// Handlers
// ----------------------

// serveIndex serves embedded index.html
func serveIndex(w http.ResponseWriter, r *http.Request) {
	// Serve static/index.html
	f, err := staticFS.Open("static/index.html")
	if err != nil {
		http.Error(w, "index not found", http.StatusInternalServerError)
		return
	}
	defer f.Close()
	// set content type
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	io.Copy(w, f)
}

// serveStatic serves embedded static files under /static/
func serveStatic(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/static/")
	if path == "" {
		http.NotFound(w, r)
		return
	}
	f, err := staticFS.Open("static/" + path)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()
	// set content type based on extension
	ext := filepath.Ext(path)
	if ext != "" {
		if t := mime.TypeByExtension(ext); t != "" {
			w.Header().Set("Content-Type", t)
		}
	}
	io.Copy(w, f)
}

// apiTree returns JSON directory tree
func apiTree(w http.ResponseWriter, _ *http.Request) {
	tree, err := buildTree(RootDir)
	if err != nil {
		http.Error(w, "failed to build tree", http.StatusInternalServerError)
		return
	}
	writeJSON(w, tree)
}

// parseRange parses a single Range header of form "bytes=start-end"
func parseRange(rangeHeader string, size int64) (start, end int64, err error) {
	rangeHeader = strings.TrimSpace(rangeHeader)
	if rangeHeader == "" {
		return 0, 0, errors.New("empty")
	}
	if !strings.HasPrefix(rangeHeader, "bytes=") {
		return 0, 0, errors.New("invalid")
	}
	spec := strings.TrimPrefix(rangeHeader, "bytes=")
	parts := strings.SplitN(spec, "-", 2)
	if len(parts) != 2 {
		return 0, 0, errors.New("invalid")
	}
	if parts[0] == "" {
		// suffix-length: "-500" means last 500 bytes
		suffix, err := strconv.ParseInt(parts[1], 10, 64)
		if err != nil {
			return 0, 0, err
		}
		if suffix > size {
			suffix = size
		}
		return size - suffix, size - 1, nil
	}
	start, err = strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		return 0, 0, err
	}
	if parts[1] == "" {
		// "start-"
		return start, size - 1, nil
	}
	end, err = strconv.ParseInt(parts[1], 10, 64)
	if err != nil {
		return 0, 0, err
	}
	return start, end, nil
}

// apiStream streams with Range support
func apiStream(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	path := q.Get("path")
	if path == "" {
		http.Error(w, "path required", http.StatusBadRequest)
		return
	}
	filePath, err := safeJoin(RootDir, path)
	if err != nil {
		http.Error(w, "invalid path", http.StatusBadRequest)
		return
	}
	fi, err := os.Stat(filePath)
	if err != nil || fi.IsDir() {
		http.Error(w, "file not found", http.StatusNotFound)
		return
	}
	size := fi.Size()
	f, err := os.Open(filePath)
	if err != nil {
		http.Error(w, "cannot open file", http.StatusInternalServerError)
		return
	}
	defer f.Close()

	// content-type
	ctype := mime.TypeByExtension(strings.ToLower(filepath.Ext(filePath)))
	if ctype == "" {
		ctype = "application/octet-stream"
	}
	w.Header().Set("Accept-Ranges", "bytes")
	w.Header().Set("Content-Type", ctype)

	rangeHeader := r.Header.Get("Range")
	if rangeHeader == "" {
		// send whole file
		w.Header().Set("Content-Length", fmt.Sprintf("%d", size))
		http.ServeContent(w, r, fi.Name(), fi.ModTime(), f)
		return
	}
	// parse range
	start, end, err := parseRange(rangeHeader, size)
	if err != nil || start < 0 || end >= size || start > end {
		w.Header().Set("Content-Range", fmt.Sprintf("bytes */%d", size))
		http.Error(w, "Requested Range Not Satisfiable", http.StatusRequestedRangeNotSatisfiable)
		return
	}
	chunkSize := end - start + 1
	_, err = f.Seek(start, io.SeekStart)
	if err != nil {
		http.Error(w, "seek failed", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", start, end, size))
	w.Header().Set("Content-Length", fmt.Sprintf("%d", chunkSize))
	w.WriteHeader(http.StatusPartialContent)

	// copy chunk
	buf := make([]byte, 32*1024)
	remaining := chunkSize
	for remaining > 0 {
		toRead := int64(len(buf))
		if remaining < toRead {
			toRead = remaining
		}
		n, err := f.Read(buf[:toRead])
		if n > 0 {
			_, werr := w.Write(buf[:n])
			if werr != nil {
				return
			}
			remaining -= int64(n)
		}
		if err != nil {
			if err == io.EOF {
				return
			}
			return
		}
	}
}

// apiRename renames a file safely
func apiRename(w http.ResponseWriter, r *http.Request) {
	// Expect JSON body
	type Req struct {
		Path    string `json:"path"`
		NewName string `json:"new_name"`
	}
	var req Req
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	if req.Path == "" || req.NewName == "" {
		http.Error(w, "path and new_name required", http.StatusBadRequest)
		return
	}
	// new_name must be filename only (no slashes)
	if strings.ContainsAny(req.NewName, "/\\") {
		http.Error(w, "new_name must be filename only", http.StatusBadRequest)
		return
	}

	// Resolve the existing path safely inside RootDir
	oldPath, err := safeJoin(RootDir, req.Path)
	if err != nil {
		http.Error(w, "invalid path", http.StatusBadRequest)
		return
	}
	if _, err := os.Stat(oldPath); err != nil {
		http.Error(w, "file not found", http.StatusNotFound)
		return
	}

	// Build new path using the base directory of the existing path and the new name
	dir := filepath.Dir(oldPath)
	newPath := filepath.Join(dir, req.NewName)

	// Ensure newPath stays inside RootDir
	absNew, err := filepath.Abs(newPath)
	if err != nil {
		http.Error(w, "invalid new name", http.StatusBadRequest)
		return
	}
	absRoot, err := filepath.Abs(RootDir)
	if err != nil {
		http.Error(w, "server error", http.StatusInternalServerError)
		return
	}
	// allow exact root match or prefix with path separator to avoid partial matches
	if !(absNew == absRoot || strings.HasPrefix(absNew, absRoot+string(os.PathSeparator))) {
		http.Error(w, "invalid new name", http.StatusBadRequest)
		return
	}

	if err := os.Rename(oldPath, newPath); err != nil {
		http.Error(w, "rename failed", http.StatusInternalServerError)
		return
	}
	resp := map[string]interface{}{
		"ok":       true,
		"new_path": filepath.ToSlash(strings.TrimPrefix(absNew, absRoot+string(os.PathSeparator))),
	}
	writeJSON(w, resp)
}

// ----------------------
// main
// ----------------------

func main() {
	// allow optional root dir as first positional argument; default to current directory
	if len(os.Args) > 1 {
		RootDir = os.Args[1]
	} else {
		RootDir = "."
	}

	// resolve to absolute path for consistency
	absRoot, err := filepath.Abs(RootDir)
	if err != nil {
		log.Fatalf("invalid root directory %q: %v", RootDir, err)
	}
	RootDir = absRoot

	// ensure root exists
	if _, err := os.Stat(RootDir); os.IsNotExist(err) {
		log.Fatalf("root directory %q not found. create it and add videos", RootDir)
	}

	mux := http.NewServeMux()
	// UI
	mux.HandleFunc("/", serveIndex)
	mux.HandleFunc("/static/", serveStatic)

	// API
	mux.HandleFunc("/api/tree", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		apiTree(w, r)
	})
	mux.HandleFunc("/api/stream", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		apiStream(w, r)
	})
	mux.HandleFunc("/api/rename", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		apiRename(w, r)
	})

	srv := &http.Server{
		Addr:         ListenAddr,
		Handler:      logRequest(mux),
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 0, // streaming may take long
		IdleTimeout:  120 * time.Second,
	}
	log.Printf("starting server on http://%s  (root=%s)\n", ListenAddr, RootDir)
	log.Fatal(srv.ListenAndServe())
}

// logRequest is a simple logger
func logRequest(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		h.ServeHTTP(w, r)
		log.Printf("%s %s %s in %s", r.RemoteAddr, r.Method, r.URL.Path, time.Since(start))
	})
}
