package api

import (
	"embed"
	"net/http"
	"time"

	"github.com/anwerj/videorganizer/config"
)

func NewServer(cfg config.Config, staticFS embed.FS) *http.Server {
	a := New(cfg, staticFS)
	return &http.Server{
		Addr:         cfg.Addr,
		Handler:      a.Handler(),
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 0,
		IdleTimeout:  120 * time.Second,
	}
}
