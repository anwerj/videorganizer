package main

import (
	"html/template"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

// HTML template with 2-column Masonry layout
const htmlTmpl = `
<!DOCTYPE html>
<html>
<head>
    <title>Screenshots - {{.Title}}</title>
    <style>
        body {
            font-family: sans-serif;
            background: #111;
            color: #eee;
            margin: 0;
            padding: 20px;
        }
        .gallery {
            /* Masonry layout using columns */
            column-count: 2;
            column-gap: 30px;
            max-width: 1200px;
            margin: 0 auto;
        }
        .item {
            /* Prevent breaking inside an item */
            break-inside: avoid;
            margin-bottom: 15px;
            background: #222;
            /* Padding and shadow removed as requested */
            padding: 0;
            border-radius: 4px;
        }
        img {
            width: 100%;
            height: auto;
            display: block;
            border-radius: 2px;
        }
        .meta {
            padding: 5px;
            font-size: 0.8rem;
            color: #888;
            text-align: right;
			margin-top: -30px;
        }
    </style>
</head>
<body>
    <!-- Title removed -->
    <div class="gallery">
        {{range .Images}}
        <div class="item">
            <img src="/images/{{.Filename}}" alt="{{.Filename}}" loading="lazy">
            <div class="meta">{{.Timestamp}}ms</div>
        </div>
        {{end}}
    </div>
</body>
</html>
`

type PageData struct {
	Title  string
	Images []ImageData
}

type ImageData struct {
	Filename  string
	Timestamp int64
}

func main() {
	if len(os.Args) < 2 {
		log.Fatal("Usage: go run serve_screenshots.go <directory_path>")
	}

	dirPath := os.Args[1]
	absDir, err := filepath.Abs(dirPath)
	if err != nil {
		log.Fatalf("Invalid path: %v", err)
	}
	if _, err := os.Stat(absDir); os.IsNotExist(err) {
		log.Fatalf("Directory not found: %s", absDir)
	}

	port := "8080"
	log.Printf("Serving directory: %s", absDir)
	log.Printf("Server running at http://localhost:%s", port)

	// Handler for the index page
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Only serve index for root path
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}

		images, err := scanImages(absDir)
		if err != nil {
			http.Error(w, "Failed to scan directory", http.StatusInternalServerError)
			return
		}

		data := PageData{
			Title:  filepath.Base(absDir),
			Images: images,
		}

		tmpl, err := template.New("index").Parse(htmlTmpl)
		if err != nil {
			http.Error(w, "Template error", http.StatusInternalServerError)
			return
		}
		tmpl.Execute(w, data)
	})

	// Handler for images
	// Serve files directly from the directory under /images/ prefix
	fs := http.StripPrefix("/images/", http.FileServer(http.Dir(absDir)))
	http.Handle("/images/", fs)

	log.Fatal(http.ListenAndServe(":"+port, nil))
}

func scanImages(dir string) ([]ImageData, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	var images []ImageData
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		name := e.Name()
		if !strings.HasSuffix(strings.ToLower(name), ".jpg") &&
			!strings.HasSuffix(strings.ToLower(name), ".png") &&
			!strings.HasSuffix(strings.ToLower(name), ".jpeg") {
			continue
		}

		// Try to extract timestamp from filename extraction script format: screenshot_12345.jpg
		var ts int64
		// Remove extension
		base := strings.TrimSuffix(name, filepath.Ext(name))
		// Remove prefix "screenshot_"
		if strings.HasPrefix(base, "screenshot_") {
			tsPart := strings.TrimPrefix(base, "screenshot_")
			parsed, err := strconv.ParseInt(tsPart, 10, 64)
			if err == nil {
				ts = parsed
			}
		}

		images = append(images, ImageData{
			Filename:  name,
			Timestamp: ts,
		})
	}

	// Sort by timestamp
	sort.Slice(images, func(i, j int) bool {
		return images[i].Timestamp < images[j].Timestamp
	})

	return images, nil
}
