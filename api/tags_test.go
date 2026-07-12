package api

import (
	"embed"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/anwerj/videorganizer/config"
)

func TestTagsEndpoint(t *testing.T) {
	cfg := config.Config{
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
	a := New(cfg, embed.FS{})
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
}
