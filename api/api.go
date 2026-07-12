package api

import (
	"embed"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/anwerj/videorganizer/config"
)

type API struct {
	cfg      config.Config
	staticFS embed.FS
}

func New(cfg config.Config, staticFS embed.FS) *API {
	return &API{cfg: cfg, staticFS: staticFS}
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	_ = enc.Encode(v)
}

func handleError(w http.ResponseWriter, message string, code int, err error) {
	if err != nil {
		message += ": " + err.Error()
	}
	fmt.Printf("[Error] (%d) %s\n", code, message)
	if w != nil {
		http.Error(w, message, code)
	}
}
