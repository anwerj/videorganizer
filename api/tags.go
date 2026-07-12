package api

import (
	"net/http"
	"sort"

	"github.com/anwerj/videorganizer/config"
)

type tagEntry struct {
	Code   string   `json:"code"`
	Label  string   `json:"label"`
	Search []string `json:"search,omitempty"`
}

type tagsResponse struct {
	Sections   []tagEntry `json:"sections"`
	Properties []tagEntry `json:"properties"`
}

func tagsFromConfig(tags config.Tags) tagsResponse {
	sections := make([]tagEntry, 0, len(tags.Sections))
	for code, def := range tags.Sections {
		sections = append(sections, tagEntry{Code: code, Label: def.Label, Search: def.Search})
	}
	sort.Slice(sections, func(i, j int) bool { return sections[i].Code < sections[j].Code })

	properties := make([]tagEntry, 0, len(tags.Properties))
	for code, def := range tags.Properties {
		properties = append(properties, tagEntry{Code: code, Label: def.Label, Search: def.Search})
	}
	sort.Slice(properties, func(i, j int) bool { return properties[i].Code < properties[j].Code })

	return tagsResponse{Sections: sections, Properties: properties}
}

func (a *API) Tags(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		handleError(w, "method not allowed", http.StatusMethodNotAllowed, nil)
		return
	}
	writeJSON(w, tagsFromConfig(a.cfg.Tags))
}
