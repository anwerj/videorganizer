package main

import (
	"embed"
	"log"

	"github.com/anwerj/videorganizer/api"
	"github.com/anwerj/videorganizer/config"
)

//go:embed static/*
var staticFS embed.FS

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal(err)
	}

	srv := api.NewServer(cfg, staticFS)
	log.Printf("starting server on http://%s  (root=%s)\n", cfg.Addr, cfg.Root)
	log.Fatal(srv.ListenAndServe())
}
