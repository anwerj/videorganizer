package api

import (
	"errors"
	"path/filepath"
	"strings"
)

func safeJoin(root, rel string) (string, error) {
	rel = strings.ReplaceAll(rel, "\\", "/")
	rel = strings.TrimLeft(rel, "/")
	joined := filepath.Join(root, filepath.FromSlash(rel))
	absJoined, err := filepath.Abs(joined)
	if err != nil {
		return "", err
	}
	absRoot, err := filepath.Abs(root)
	if err != nil {
		return "", err
	}
	if !strings.HasPrefix(absJoined, absRoot) {
		return "", errors.New("invalid path")
	}
	return absJoined, nil
}
