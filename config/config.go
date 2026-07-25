package config

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

const FileName = "videorganizer.config.json"

var (
	sectionCodeRE  = regexp.MustCompile(`^\d{2}$`)
	propertyCodeRE = regexp.MustCompile(`^[a-z]$`)
)

var defaultJSON = `{
    "Addr" : "127.0.0.1:9898",
    "Exts" : {
        "mp4":  true,
        "mkv":  true,
        "mov":  true,
        "webm": true
    },
    "Tags": {
        "sections": {
            "00": { "label": "Public" },
            "01": { "label": "Park" },
            "02": { "label": "Travel" }
        },
        "properties": {
            "a": { "label": "AA quality", "search": ["quality", "aa"] },
            "m": { "label": "Must watch" },
            "h": { "label": "Hindustani", "search": ["hindi", "urdu"] }
        }
    },
    "Keywords": ["black background", "clear sky"]
}`

type TagDef struct {
	Label  string   `json:"label"`
	Search []string `json:"search,omitempty"`
}

type Tags struct {
	Sections   map[string]TagDef `json:"sections"`
	Properties map[string]TagDef `json:"properties"`
}

type Config struct {
	Root     string          `json:"Root"`
	Addr     string          `json:"Addr"`
	Exts     map[string]bool `json:"Exts"`
	Tags     Tags            `json:"Tags"`
	Keywords []string        `json:"Keywords,omitempty"`
}

func (c Config) IsExtDisabled(name string) bool {
	ext := strings.TrimPrefix(strings.ToLower(filepath.Ext(name)), ".")
	return !c.Exts[ext]
}

// Load reads videorganizer.config.json from the executable directory
// (home directory when running via go run). Video root comes from the
// "Root" field in that file. The returned path is the absolute config file path.
func Load() (Config, string, error) {
	configDir, err := resolveConfigDir()
	if err != nil {
		return Config{}, "", err
	}
	return loadFromDir(configDir)
}

func loadFromDir(configDir string) (Config, string, error) {
	absConfigDir, err := filepath.Abs(configDir)
	if err != nil {
		return Config{}, "", fmt.Errorf("invalid config directory %q: %w", configDir, err)
	}

	configPath := filepath.Join(absConfigDir, FileName)
	content, err := os.ReadFile(configPath)
	if err != nil {
		if os.IsNotExist(err) {
			log.Printf("could not find config %s: %v; using defaults", configPath, err)
			content = []byte(defaultJSON)
		} else {
			return Config{}, "", fmt.Errorf("could not read config: %w", err)
		}
	}
	fmt.Println("Starting with config:\n" + string(content))

	var cfg Config
	if err := json.Unmarshal(content, &cfg); err != nil {
		return Config{}, "", fmt.Errorf("could not load config: %w", err)
	}
	if strings.TrimSpace(cfg.Root) == "" {
		cfg.Root = absConfigDir
	}
	absRoot, err := filepath.Abs(cfg.Root)
	if err != nil {
		return Config{}, "", fmt.Errorf("invalid root directory %q: %w", cfg.Root, err)
	}
	cfg.Root = absRoot
	if _, err := os.Stat(cfg.Root); os.IsNotExist(err) {
		return Config{}, "", fmt.Errorf("root directory %q not found. create it and add videos", cfg.Root)
	}
	return cfg, configPath, nil
}

// Save writes cfg to path atomically.
func Save(path string, cfg Config) error {
	data, err := json.MarshalIndent(cfg, "", "    ")
	if err != nil {
		return fmt.Errorf("could not marshal config: %w", err)
	}
	data = append(data, '\n')
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0644); err != nil {
		return fmt.Errorf("could not write config: %w", err)
	}
	if err := os.Rename(tmp, path); err != nil {
		_ = os.Remove(tmp)
		return fmt.Errorf("could not save config: %w", err)
	}
	return nil
}

func ValidateSectionCode(code string) error {
	if !sectionCodeRE.MatchString(code) {
		return fmt.Errorf("section code %q must be two digits (00-99)", code)
	}
	return nil
}

func ValidatePropertyCode(code string) error {
	if !propertyCodeRE.MatchString(code) {
		return fmt.Errorf("property code %q must be a single lowercase letter (a-z)", code)
	}
	return nil
}

func ValidateTagLabel(label string) error {
	if strings.TrimSpace(label) == "" {
		return fmt.Errorf("label must not be empty")
	}
	return nil
}

func NormalizeSearch(terms []string) []string {
	if len(terms) == 0 {
		return nil
	}
	out := make([]string, 0, len(terms))
	for _, t := range terms {
		t = strings.TrimSpace(t)
		if t == "" {
			continue
		}
		out = append(out, t)
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

// ValidateTags checks section/property codes, labels, and uniqueness.
func ValidateTags(tags Tags) error {
	if tags.Sections == nil {
		tags.Sections = map[string]TagDef{}
	}
	if tags.Properties == nil {
		tags.Properties = map[string]TagDef{}
	}
	for code, def := range tags.Sections {
		if err := ValidateSectionCode(code); err != nil {
			return err
		}
		if err := ValidateTagLabel(def.Label); err != nil {
			return fmt.Errorf("section %s: %w", code, err)
		}
	}
	for code, def := range tags.Properties {
		if err := ValidatePropertyCode(code); err != nil {
			return err
		}
		if err := ValidateTagLabel(def.Label); err != nil {
			return fmt.Errorf("property %s: %w", code, err)
		}
		for _, s := range def.Search {
			if strings.TrimSpace(s) == "" {
				return fmt.Errorf("property %s: search term must not be empty", code)
			}
		}
	}
	return nil
}

func TagsFromEntries(sections, properties []TagEntry) (Tags, error) {
	tags := Tags{
		Sections:   make(map[string]TagDef, len(sections)),
		Properties: make(map[string]TagDef, len(properties)),
	}
	seen := map[string]bool{}
	for _, e := range sections {
		code := strings.TrimSpace(e.Code)
		if seen["s:"+code] {
			return Tags{}, fmt.Errorf("duplicate section code %q", code)
		}
		seen["s:"+code] = true
		if err := ValidateSectionCode(code); err != nil {
			return Tags{}, err
		}
		label := strings.TrimSpace(e.Label)
		if err := ValidateTagLabel(label); err != nil {
			return Tags{}, fmt.Errorf("section %s: %w", code, err)
		}
		tags.Sections[code] = TagDef{Label: label, Search: NormalizeSearch(e.Search)}
	}
	for _, e := range properties {
		code := strings.TrimSpace(e.Code)
		if seen["p:"+code] {
			return Tags{}, fmt.Errorf("duplicate property code %q", code)
		}
		seen["p:"+code] = true
		if err := ValidatePropertyCode(code); err != nil {
			return Tags{}, err
		}
		label := strings.TrimSpace(e.Label)
		if err := ValidateTagLabel(label); err != nil {
			return Tags{}, fmt.Errorf("property %s: %w", code, err)
		}
		search := NormalizeSearch(e.Search)
		for _, s := range search {
			if strings.TrimSpace(s) == "" {
				return Tags{}, fmt.Errorf("property %s: search term must not be empty", code)
			}
		}
		tags.Properties[code] = TagDef{Label: label, Search: search}
	}
	return tags, nil
}

// TagEntry is the wire format for tag catalog entries.
type TagEntry struct {
	Code   string   `json:"code"`
	Label  string   `json:"label"`
	Search []string `json:"search,omitempty"`
}

// KeywordsFromList validates and normalizes a keyword list.
func KeywordsFromList(keywords []string) ([]string, error) {
	if keywords == nil {
		return nil, nil
	}
	seen := map[string]string{}
	out := make([]string, 0, len(keywords))
	for _, kw := range keywords {
		trimmed := strings.TrimSpace(kw)
		if trimmed == "" {
			return nil, fmt.Errorf("keyword must not be empty")
		}
		key := strings.ToLower(trimmed)
		if prev, ok := seen[key]; ok {
			return nil, fmt.Errorf("duplicate keyword %q and %q", prev, trimmed)
		}
		seen[key] = trimmed
		out = append(out, trimmed)
	}
	sort.Strings(out)
	return out, nil
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
