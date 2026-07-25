package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestDefaultConfig(t *testing.T) {
	var cnf Config
	if err := json.Unmarshal([]byte(defaultJSON), &cnf); err != nil {
		t.Fatal(err)
	}
	if got := cnf.Tags.Sections["01"].Label; got != "Park" {
		t.Fatalf("Tags.Sections[01].Label = %q, want Park", got)
	}
	if got := cnf.Tags.Properties["h"].Search; len(got) != 2 || got[0] != "hindi" {
		t.Fatalf("Tags.Properties[h].Search = %v, want [hindi urdu]", got)
	}
	tests := [][]string{
		{"/videos/movie.mp4", "true"},
		{"/videos/movie.Mp4", "true"},
		{"/videos/movie.MP4", "true"},
		{"/videos/movie.mkv", "true"},
		{"/videos/movie.webm", "true"},
		{"/videos/.DStore", "false"},
	}
	for _, test := range tests {
		enabled := !cnf.IsExtDisabled(test[0])
		expected := test[1] == "true"
		if enabled != expected {
			t.Fatalf("Expected %v for `%s`, got %v", expected, test[0], enabled)
		}
	}
}

func TestIsGoBuildPath(t *testing.T) {
	if !isGoBuildPath(`/var/folders/xx/T/go-build123456789/b001/exe/main`) {
		t.Fatal("expected go-build temp path to match")
	}
	if isGoBuildPath(`/usr/local/bin/videorganizer`) {
		t.Fatal("expected normal install path not to match")
	}
}

func TestLoadMissingConfig(t *testing.T) {
	dir := t.TempDir()
	cfg, path, err := loadFromDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	if path != filepath.Join(dir, FileName) {
		t.Fatalf("path = %q, want %q", path, filepath.Join(dir, FileName))
	}
	if cfg.Root != dir {
		t.Fatalf("Root = %q, want %q", cfg.Root, dir)
	}
	if cfg.Addr != "127.0.0.1:9898" {
		t.Fatalf("Addr = %q, want default", cfg.Addr)
	}
	if !cfg.Exts["mp4"] {
		t.Fatal("expected mp4 enabled in defaults")
	}
}

func TestLoadValidConfig(t *testing.T) {
	configDir := t.TempDir()
	videoDir := t.TempDir()
	content, err := json.Marshal(map[string]any{
		"Root": videoDir,
		"Addr": "127.0.0.1:9999",
		"Exts": map[string]bool{"mp4": true},
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(configDir, FileName), content, 0644); err != nil {
		t.Fatal(err)
	}
	cfg, path, err := loadFromDir(configDir)
	if err != nil {
		t.Fatal(err)
	}
	if path != filepath.Join(configDir, FileName) {
		t.Fatalf("path = %q", path)
	}
	if cfg.Root != videoDir {
		t.Fatalf("Root = %q, want %q", cfg.Root, videoDir)
	}
	if cfg.Addr != "127.0.0.1:9999" {
		t.Fatalf("Addr = %q, want 127.0.0.1:9999", cfg.Addr)
	}
}

func TestLoadInvalidJSON(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, FileName), []byte("{bad"), 0644); err != nil {
		t.Fatal(err)
	}
	_, _, err := loadFromDir(dir)
	if err == nil {
		t.Fatal("expected error for invalid JSON")
	}
}

func TestLoadMissingVideoRoot(t *testing.T) {
	configDir := t.TempDir()
	content := `{"Root":"/nonexistent/videos"}`
	if err := os.WriteFile(filepath.Join(configDir, FileName), []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
	_, _, err := loadFromDir(configDir)
	if err == nil {
		t.Fatal("expected error for missing video root")
	}
}

func TestSaveRoundTrip(t *testing.T) {
	dir := t.TempDir()
	videoDir := t.TempDir()
	cfg := Config{
		Root: videoDir,
		Addr: "127.0.0.1:9898",
		Exts: map[string]bool{"mp4": true},
		Tags: Tags{
			Sections:   map[string]TagDef{"00": {Label: "Public"}},
			Properties: map[string]TagDef{"m": {Label: "Must watch"}},
		},
	}
	path := filepath.Join(dir, FileName)
	if err := Save(path, cfg); err != nil {
		t.Fatal(err)
	}
	loaded, loadedPath, err := loadFromDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	if loadedPath != path {
		t.Fatalf("loadedPath = %q, want %q", loadedPath, path)
	}
	if loaded.Addr != cfg.Addr || loaded.Root != videoDir {
		t.Fatalf("loaded = %+v", loaded)
	}
	if loaded.Tags.Sections["00"].Label != "Public" {
		t.Fatalf("sections = %+v", loaded.Tags.Sections)
	}
}

func TestTagsFromEntriesValidation(t *testing.T) {
	_, err := TagsFromEntries(
		[]TagEntry{{Code: "1", Label: "Bad"}},
		nil,
	)
	if err == nil {
		t.Fatal("expected error for invalid section code")
	}
	_, err = TagsFromEntries(nil, []TagEntry{{Code: "A", Label: "Bad"}})
	if err == nil {
		t.Fatal("expected error for invalid property code")
	}
	_, err = TagsFromEntries([]TagEntry{{Code: "00", Label: "  "}}, nil)
	if err == nil {
		t.Fatal("expected error for empty label")
	}
	_, err = TagsFromEntries(
		[]TagEntry{{Code: "00", Label: "A"}, {Code: "00", Label: "B"}},
		nil,
	)
	if err == nil {
		t.Fatal("expected error for duplicate section")
	}
	tags, err := TagsFromEntries(
		[]TagEntry{{Code: "00", Label: "Public", Search: []string{" pub ", ""}}},
		[]TagEntry{{Code: "m", Label: "Must"}},
	)
	if err != nil {
		t.Fatal(err)
	}
	if got := tags.Sections["00"].Search; len(got) != 1 || got[0] != "pub" {
		t.Fatalf("search = %v", got)
	}
}

func TestKeywordsFromList(t *testing.T) {
	got, err := KeywordsFromList([]string{" clear sky ", "black background", "clear sky"})
	if err == nil {
		t.Fatal("expected duplicate error")
	}
	got, err = KeywordsFromList([]string{" clear sky ", "black background"})
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 || got[0] != "black background" || got[1] != "clear sky" {
		t.Fatalf("keywords = %v", got)
	}
	_, err = KeywordsFromList([]string{"  "})
	if err == nil {
		t.Fatal("expected empty keyword error")
	}
}

func TestSaveKeywordsRoundTrip(t *testing.T) {
	dir := t.TempDir()
	videoDir := t.TempDir()
	cfg := Config{
		Root:     videoDir,
		Addr:     "127.0.0.1:9898",
		Exts:     map[string]bool{"mp4": true},
		Keywords: []string{"clear sky", "black background"},
	}
	path := filepath.Join(dir, FileName)
	if err := Save(path, cfg); err != nil {
		t.Fatal(err)
	}
	loaded, _, err := loadFromDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(loaded.Keywords) != 2 || loaded.Keywords[0] != "clear sky" {
		t.Fatalf("keywords = %v", loaded.Keywords)
	}
}
