package main

import (
	"encoding/json"
	"testing"
)

func TestSearching(t *testing.T) {
	tests := [][]string{
		{"/videos/movie.mp4", "movie", "true"},
		{"/videos/movie.mp4", "MOVIE", "true"},
		{"/videos/movie.mp4", "mov mp4", "true"},
		{"/videos/movie.mp4", "mov mkv", "false"},
		{"/videos/holiday_trip_2023.mp4", "holiday 2023", "true"},
		{"/videos/holiday_trip_2023.mp4", "trip 2022", "false"},
		{"/videos/holiday_trip_2023.mp4", "", "true"},
		{"/videos/holiday_trip_2023.mp4", "   ", "true"},
		{"/videos/holiday_trip_2023.mp4", "holiday_trip", "true"},
		{"/videos/holiday_trip_2023.mp4", "holiday trip", "true"},
		{"/videos/holiday_trip_2023.mp4", "holiday_trip_2023", "true"},
		{"/videos/holiday_trip_2023.mp4", "holiday_trip_2024", "false"},
		{"/videos/holiday_trip_2023.mp4", "holiday_trip_2023.mp4", "true"},
		{"/videos/holiday_trip_2023.mp4", "holiday_trip_2023.mkv", "false"},
		{"/videos/series/episode01.mkv", "series episode", "true"},
		{"/videos/series/episode01.mkv", "series episode02", "false"},
		{"/videos/series/episode01.mkv", "series", "true"},
		{"/videos/series/episode01.mkv", "episode", "true"},
		{"/videos/series/episode01.mkv", "episo", "true"},
		{"/videos/series/episode01.mkv", "episo 01", "true"},
		{"/videos/series/episode01.mkv", "episo 02", "false"},
		{"/videos/series/episode01.mkv", "01", "true"},
		{"/videos/series/episode01.mkv", "02", "false"},
		{"/videos/series/episode01.mkv", "mkv", "true"},
		{"/videos/series/episode01.mkv", "mp4", "false"},
		{"/videos/series/episode01.mkv", "SERIES EPISODE01", "true"},
		{"/videos/series/episode01.mkv", "SERIES   EPISODE01", "true"},
		{"/videos/series/episode01.mkv", "SERIES   EPISODE02", "false"},
		{"/videos/series/episode01.mkv", "series episode01 mkv", "true"},
		{"/videos/series/episode01.mkv", "series episode01 mp4", "false"},
		{"/videos/series/episode01.mkv", "series episode01.mkv", "true"},
		{"/videos/series/episode01.mkv", "series episode01.mkv extra", "false"},
		{"/videos/series/episode01.mkv", "series/episode01.mkv", "true"},
		{"/videos/Äpfel_und_Öl.mp4", "äpfel", "true"},
		{"/videos/Äpfel_und_Öl.mp4", "Öl", "true"},
		{"/videos/Äpfel_und_Öl.mp4", "apfel", "false"},
		{"/videos/Äpfel_und_Öl.mp4", "öl", "true"},
		{"/videos/Äpfel_und_Öl.mp4", "banana", "false"},
		{"/videos/スペシャル/映画.mp4", "映画", "true"},
		{"/videos/スペシャル/映画.mp4", "スペシャル", "true"},
		{"/videos/スペシャル/映画.mp4", "えいが", "false"},
		{"/videos/!@#$_file-123.MP4", "!@#$", "true"},
		{"/videos/!@#$_file-123.MP4", "file-123", "true"},
		{"/videos/!@#$_file-123.MP4", "file 123", "true"},
		{"/videos/!@#$_file-123.MP4", "file_124", "false"},
		{"/videos/CapitalCASE/FiLe.Mp4", "file", "true"},
		{"/videos/CapitalCASE/FiLe.Mp4", "FILE", "true"},
		{"/videos/CapitalCASE/FiLe.Mp4", "capitalcase", "true"},
		{"/videos/CapitalCASE/FiLe.Mp4", "Capital FiLe", "true"},
		{"/videos/CapitalCASE/FiLe.Mp4", "capital file", "true"},
		{"/videos/CapitalCASE/FiLe.Mp4", "capitalcase file.mp4", "true"},
		{"/videos/CapitalCASE/FiLe.Mp4", "capitalcase file.mkv", "false"},
		{"/videos/emoji/🎬_movie.mp4", "🎬", "true"},
		{"/videos/emoji/🎬_movie.mp4", "movie", "true"},
		{"/videos/emoji/🎬_movie.mp4", "🎬 movie", "true"},
		{"/videos/emoji/🎬_movie.mp4", "🎥", "false"},
	}

	for _, test := range tests {
		result := searching(test[0], test[1])
		want := test[2] == "true"
		if result != want {
			t.Fatalf("Expected %v for `%s` in `%s`, got %v", want, test[1], test[0], result)
		}
	}
}

func TestDefaultConfig(t *testing.T) {
	cnf := Config{}
	err := json.Unmarshal([]byte(defaultConfig), &cnf)
	if err != nil {
		t.Fatal(err)
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
			t.Fatalf("Expected %v for `%s` in `%s`, got %v", expected, test[1], test[0], enabled)
		}
	}
}
