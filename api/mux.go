package api

import (
	"io"
	"log"
	"mime"
	"net/http"
	"path/filepath"
	"strings"
	"time"
)

func (a *API) serveHTML(path string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		f, err := a.staticFS.Open(path)
		if err != nil {
			handleError(w, "index not found", http.StatusInternalServerError, err)
			return
		}
		defer f.Close()
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		io.Copy(w, f)
	}
}

func (a *API) serveStatic(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/static/")
	if path == "" {
		http.NotFound(w, r)
		return
	}
	f, err := a.staticFS.Open("static/" + path)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()
	ext := filepath.Ext(path)
	if ext != "" {
		if t := mime.TypeByExtension(ext); t != "" {
			w.Header().Set("Content-Type", t)
		}
	}
	io.Copy(w, f)
}

func (a *API) Mux() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("/", a.serveHTML("static/index.html"))
	mux.HandleFunc("/static/", a.serveStatic)
	mux.HandleFunc("/ts", a.serveHTML("static/timestamps.html"))
	mux.HandleFunc("/api/tree", a.Tree)
	mux.HandleFunc("/api/stream", a.Stream)
	mux.HandleFunc("/api/rename", a.Rename)
	return mux
}

func logRequest(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		h.ServeHTTP(w, r)
		log.Printf("%s %s %s in %s", r.RemoteAddr, r.Method, r.URL.Path, time.Since(start))
	})
}

func (a *API) Handler() http.Handler {
	return logRequest(a.Mux())
}
