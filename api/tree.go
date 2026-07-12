package api

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

func (a *API) Tree(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodGet {
		handleError(w, "method not allowed", http.StatusMethodNotAllowed, nil)
		return
	}
	search := req.URL.Query().Get("search")
	organized := req.URL.Query().Get("organized") == "true"
	fmt.Printf("Building Tree with root:%s search:%s organized:%v\n", a.cfg.Root, search, organized)
	tree, err := a.buildTree(search, organized)
	if err != nil {
		handleError(w, "failed to build tree", http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, tree)
}

func (a *API) buildTree(search string, includeOrganized bool) (map[string]any, error) {
	info, err := os.Stat(a.cfg.Root)
	if err != nil {
		return nil, err
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("root is not a directory")
	}

	base := filepath.Base(a.cfg.Root)
	node, err := a.buildNode(a.cfg.Root, search, includeOrganized)
	if err != nil {
		return nil, err
	}
	return map[string]any{base: node}, nil
}

func (a *API) buildNode(dir string, search string, includeOrganized bool) (map[string]any, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	names := make([]string, 0, len(entries))
	for _, e := range entries {
		names = append(names, e.Name())
	}
	sort.Strings(names)

	node := make(map[string]any, len(names))
	for _, name := range names {
		full := filepath.Join(dir, name)

		info, err := os.Stat(full)
		if err != nil {
			continue
		}
		if info.IsDir() {
			child, err := a.buildNode(full, search, includeOrganized)
			if err != nil {
				continue
			}
			if len(child) < 1 {
				continue
			}
			node[name] = child
		} else {
			if !searching(full, search) {
				continue
			}
			if a.cfg.IsExtDisabled(name) {
				continue
			}
			if !includeOrganized && strings.Contains(name, "-ts_") {
				continue
			}
			node[name] = info.Size()
		}
	}
	return node, nil
}

func searching(in string, search string) bool {
	if strings.TrimSpace(search) == "" {
		return true
	}
	in = strings.ToLower(in)
	parts := strings.FieldsSeq(strings.ToLower(search))
	for part := range parts {
		if part == "" {
			continue
		}
		if !strings.Contains(in, part) {
			return false
		}
	}
	return true
}
