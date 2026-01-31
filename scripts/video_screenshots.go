package main

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
)

func main() {
	if len(os.Args) < 3 {
		log.Fatal("Usage: go run video_screenshots.go <video_path> <timestamps_ms_separated_by_underscore>")
	}

	videoPath := os.Args[1]
	tsString := os.Args[2]

	// 1. Validate video path
	absVideoPath, err := filepath.Abs(videoPath)
	if err != nil {
		log.Fatalf("Failed to resolve absolute path: %v", err)
	}
	if _, err := os.Stat(absVideoPath); os.IsNotExist(err) {
		log.Fatalf("Video file not found: %s", absVideoPath)
	}

	// 2. Create output directory
	// Name is same as video filename without extension
	fileName := filepath.Base(absVideoPath)
	ext := filepath.Ext(fileName)
	baseName := strings.TrimSuffix(fileName, ext)
	outputDir := filepath.Join(filepath.Dir(absVideoPath), baseName)

	if err := os.MkdirAll(outputDir, 0755); err != nil {
		log.Fatalf("Failed to create output directory: %v", err)
	}
	fmt.Printf("Output directory: %s\n", outputDir)

	// 3. Parse timestamps
	parts := strings.Split(tsString, "_")
	var timestamps []int64
	for _, part := range parts {
		if part == "" {
			continue
		}
		ts, err := strconv.ParseInt(part, 10, 64)
		if err != nil {
			log.Printf("Warning: skipping invalid timestamp '%s': %v", part, err)
			continue
		}
		timestamps = append(timestamps, ts)
	}

	if len(timestamps) == 0 {
		log.Fatal("No valid timestamps found.")
	}

	// 4. Process each timestamp
	log.Printf("Processing %d timestamps...", len(timestamps))

	// Check if ffmpeg is available
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		log.Fatal("ffmpeg is not installed or not in PATH.")
	}

	for i, tsMs := range timestamps {
		// Convert ms to seconds string for ffmpeg -ss
		seconds := float64(tsMs) / 1000.0
		ssPos := fmt.Sprintf("%f", seconds)

		outFilename := fmt.Sprintf("screenshot_%d.jpg", tsMs)
		outPath := filepath.Join(outputDir, outFilename)

		// Command: ffmpeg -ss <seconds> -i <video> -frames:v 1 -q:v 2 <out> -y
		// -q:v 2 is for high quality jpeg
		cmd := exec.Command("ffmpeg",
			"-ss", ssPos,
			"-i", absVideoPath,
			"-frames:v", "1",
			"-q:v", "2",
			"-y",          // overwrite
			"-v", "error", // less output
			outPath,
		)

		// Connect stderr to see errors if any
		cmd.Stderr = os.Stderr

		if err := cmd.Run(); err != nil {
			log.Printf("[%d/%d] Failed to extract frame at %sms: %v", i+1, len(timestamps), ssPos, err)
		} else {
			fmt.Printf("[%d/%d] Extracted: %s\n", i+1, len(timestamps), outFilename)
		}
	}

	fmt.Println("Done.")
}
