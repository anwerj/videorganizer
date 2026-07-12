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
	cfg, err := loadFromDir(dir)
	if err != nil {
		t.Fatal(err)
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
	cfg, err := loadFromDir(configDir)
	if err != nil {
		t.Fatal(err)
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
	_, err := loadFromDir(dir)
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
	_, err := loadFromDir(configDir)
	if err == nil {
		t.Fatal("expected error for missing video root")
	}
}
