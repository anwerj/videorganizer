package api

import (
	"bytes"
	"embed"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/anwerj/videorganizer/config"
)

func TestTagsEndpoint(t *testing.T) {
	cfg := config.Config{
		Keywords: []string{"black background"},
		Tags: config.Tags{
			Sections: map[string]config.TagDef{
				"02": {Label: "Travel"},
				"00": {Label: "Public"},
			},
			Properties: map[string]config.TagDef{
				"m": {Label: "Must watch"},
				"a": {Label: "AA quality"},
			},
		},
	}
	a := New(cfg, "", embed.FS{})
	req := httptest.NewRequest(http.MethodGet, "/api/tags", nil)
	w := httptest.NewRecorder()
	a.Tags(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	var resp tagsResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatal(err)
	}
	if len(resp.Sections) != 2 || resp.Sections[0].Code != "00" || resp.Sections[1].Code != "02" {
		t.Fatalf("sections = %+v, want sorted 00 then 02", resp.Sections)
	}
	if len(resp.Properties) != 2 || resp.Properties[0].Code != "a" || resp.Properties[1].Code != "m" {
		t.Fatalf("properties = %+v, want sorted a then m", resp.Properties)
	}
	if len(resp.Keywords) != 1 || resp.Keywords[0] != "black background" {
		t.Fatalf("keywords = %+v", resp.Keywords)
	}
}

func TestPutTags(t *testing.T) {
	dir := t.TempDir()
	videoDir := t.TempDir()
	configPath := filepath.Join(dir, config.FileName)
	cfg := config.Config{
		Root: videoDir,
		Addr: "127.0.0.1:9898",
		Exts: map[string]bool{"mp4": true},
		Tags: config.Tags{
			Sections:   map[string]config.TagDef{"00": {Label: "Public"}},
			Properties: map[string]config.TagDef{"m": {Label: "Must watch"}},
		},
	}
	if err := config.Save(configPath, cfg); err != nil {
		t.Fatal(err)
	}

	a := New(cfg, configPath, embed.FS{})
	body := tagsResponse{
		Sections: []config.TagEntry{
			{Code: "00", Label: "Public"},
			{Code: "01", Label: "Park"},
		},
		Properties: []config.TagEntry{
			{Code: "m", Label: "Must watch"},
			{Code: "u", Label: "Underwater", Search: []string{"dive"}},
		},
		Keywords: []string{"clear sky", "black background"},
	}
	raw, err := json.Marshal(body)
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodPut, "/api/tags", bytes.NewReader(raw))
	w := httptest.NewRecorder()
	a.Tags(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d body = %s", w.Code, w.Body.String())
	}
	if len(a.cfg.Tags.Sections) != 2 || a.cfg.Tags.Properties["u"].Label != "Underwater" {
		t.Fatalf("cfg.Tags = %+v", a.cfg.Tags)
	}
	saved, err := os.ReadFile(configPath)
	if err != nil {
		t.Fatal(err)
	}
	var onDisk config.Config
	if err := json.Unmarshal(saved, &onDisk); err != nil {
		t.Fatal(err)
	}
	if onDisk.Root != videoDir || onDisk.Addr != "127.0.0.1:9898" {
		t.Fatalf("preserved fields changed: %+v", onDisk)
	}
	if onDisk.Tags.Sections["01"].Label != "Park" {
		t.Fatalf("sections on disk = %+v", onDisk.Tags.Sections)
	}
	if len(onDisk.Keywords) != 2 || onDisk.Keywords[0] != "black background" {
		t.Fatalf("keywords on disk = %v", onDisk.Keywords)
	}
}

func TestPutTagsValidation(t *testing.T) {
	dir := t.TempDir()
	videoDir := t.TempDir()
	configPath := filepath.Join(dir, config.FileName)
	cfg := config.Config{Root: videoDir, Addr: "127.0.0.1:9898", Exts: map[string]bool{"mp4": true}}
	if err := config.Save(configPath, cfg); err != nil {
		t.Fatal(err)
	}
	a := New(cfg, configPath, embed.FS{})

	tests := []tagsResponse{
		{Sections: []config.TagEntry{{Code: "x", Label: "Bad"}}},
		{Properties: []config.TagEntry{{Code: "m", Label: ""}}},
		{Sections: []config.TagEntry{{Code: "00", Label: "A"}, {Code: "00", Label: "B"}}},
		{Keywords: []string{"dup", "Dup"}},
		{Keywords: []string{"  "}},
	}
	for _, body := range tests {
		raw, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPut, "/api/tags", bytes.NewReader(raw))
		w := httptest.NewRecorder()
		a.Tags(w, req)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("body %+v: status = %d, want 400", body, w.Code)
		}
	}
}
