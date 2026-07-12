package config

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
)

const FileName = "videorganizer.config.json"

var defaultJSON = `{
    "Addr" : "127.0.0.1:9898",
    "Exts" : {
        "mp4":  true,
        "mkv":  true,
        "mov":  true,
        "webm": true
    }
}`

type Config struct {
	Root string          `json:"Root"`
	Addr string          `json:"Addr"`
	Exts map[string]bool `json:"Exts"`
}

func (c Config) IsExtDisabled(name string) bool {
	ext := strings.TrimPrefix(strings.ToLower(filepath.Ext(name)), ".")
	return !c.Exts[ext]
}

// Load reads videorganizer.config.json from the executable directory
// (home directory when running via go run). Video root comes from the
// "Root" field in that file.
func Load() (Config, error) {
	configDir, err := resolveConfigDir()
	if err != nil {
		return Config{}, err
	}
	return loadFromDir(configDir)
}

func loadFromDir(configDir string) (Config, error) {
	absConfigDir, err := filepath.Abs(configDir)
	if err != nil {
		return Config{}, fmt.Errorf("invalid config directory %q: %w", configDir, err)
	}

	configPath := filepath.Join(absConfigDir, FileName)
	content, err := os.ReadFile(configPath)
	if err != nil {
		if os.IsNotExist(err) {
			log.Printf("could not find config %s: %v; using defaults", configPath, err)
			content = []byte(defaultJSON)
		} else {
			return Config{}, fmt.Errorf("could not read config: %w", err)
		}
	}
	fmt.Println("Starting with config:\n" + string(content))

	var cfg Config
	if err := json.Unmarshal(content, &cfg); err != nil {
		return Config{}, fmt.Errorf("could not load config: %w", err)
	}
	if strings.TrimSpace(cfg.Root) == "" {
		cfg.Root = absConfigDir
	}
	absRoot, err := filepath.Abs(cfg.Root)
	if err != nil {
		return Config{}, fmt.Errorf("invalid root directory %q: %w", cfg.Root, err)
	}
	cfg.Root = absRoot
	if _, err := os.Stat(cfg.Root); os.IsNotExist(err) {
		return Config{}, fmt.Errorf("root directory %q not found. create it and add videos", cfg.Root)
	}
	return cfg, nil
}

func resolveConfigDir() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", err
	}
	dir := filepath.Dir(exe)
	if isGoBuildPath(dir) {
		return os.UserHomeDir()
	}
	return dir, nil
}

func isGoBuildPath(path string) bool {
	return strings.Contains(filepath.ToSlash(path), "/go-build")
}
