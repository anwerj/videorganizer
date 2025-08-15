
build-windows-amd64:
	rm videorganizer-windows-amd64.exe
	GOOS=windows GOARCH=amd64 go build -o videorganizer-windows-amd64.exe main.go

build-darwin-arm64:
	rm videorganizer-darwin-arm64
	GOOS=darwin GOARCH=arm64 go build -o videorganizer-darwin-arm64 main.go

build:
	$(MAKE) build-windows-amd64
	$(MAKE) build-darwin-arm64

watch-command:
	echo "watchexec --restart --exts go,html,css,js --ignore .git -- go run main.go" | pbcopy

.PHONY: build build-windows-amd64 build-darwin-arm64 watch
