package api

import (
	"encoding/json"
	"net/http"
	"sort"

	"github.com/anwerj/videorganizer/config"
)

type tagsResponse struct {
	Sections   []config.TagEntry `json:"sections"`
	Properties []config.TagEntry `json:"properties"`
	Keywords   []string          `json:"keywords"`
}

func catalogFromConfig(cfg config.Config) tagsResponse {
	resp := tagsResponse{
		Sections:   make([]config.TagEntry, 0, len(cfg.Tags.Sections)),
		Properties: make([]config.TagEntry, 0, len(cfg.Tags.Properties)),
		Keywords:   cfg.Keywords,
	}
	if resp.Keywords == nil {
		resp.Keywords = []string{}
	}
	for code, def := range cfg.Tags.Sections {
		resp.Sections = append(resp.Sections, config.TagEntry{Code: code, Label: def.Label, Search: def.Search})
	}
	sort.Slice(resp.Sections, func(i, j int) bool { return resp.Sections[i].Code < resp.Sections[j].Code })

	for code, def := range cfg.Tags.Properties {
		resp.Properties = append(resp.Properties, config.TagEntry{Code: code, Label: def.Label, Search: def.Search})
	}
	sort.Slice(resp.Properties, func(i, j int) bool { return resp.Properties[i].Code < resp.Properties[j].Code })

	return resp
}

func (a *API) Tags(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, catalogFromConfig(a.cfg))
	case http.MethodPut:
		a.putTags(w, r)
	default:
		handleError(w, "method not allowed", http.StatusMethodNotAllowed, nil)
	}
}

func (a *API) putTags(w http.ResponseWriter, r *http.Request) {
	var body tagsResponse
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		handleError(w, "invalid request body", http.StatusBadRequest, err)
		return
	}
	tags, err := config.TagsFromEntries(body.Sections, body.Properties)
	if err != nil {
		handleError(w, err.Error(), http.StatusBadRequest, nil)
		return
	}
	keywords, err := config.KeywordsFromList(body.Keywords)
	if err != nil {
		handleError(w, err.Error(), http.StatusBadRequest, nil)
		return
	}
	a.cfg.Tags = tags
	a.cfg.Keywords = keywords
	if err := config.Save(a.configPath, a.cfg); err != nil {
		handleError(w, "could not save config", http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, catalogFromConfig(a.cfg))
}
