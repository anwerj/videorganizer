
build-windows-amd64:
	rm -f videorganizer-windows-amd64.exe
	# static, reproducible cross build (no cgo)
	env CGO_ENABLED=0 GOOS=windows GOARCH=amd64 \
		go build -trimpath -ldflags="-s -w" \
		-o videorganizer-windows-amd64.exe main.go

build-darwin-arm64:
	rm -f videorganizer-darwin-arm64
	GOOS=darwin GOARCH=arm64 go build -o videorganizer-darwin-arm64 main.go

build:
	$(MAKE) build-windows-amd64
	$(MAKE) build-darwin-arm64

run-darwin-arm64:
	$(MAKE) build-darwin-arm64
	./videorganizer-darwin-arm64

watch-command:
	echo "watchexec --restart --exts go,html,css,js --ignore .git -- make run-darwin-arm64" | pbcopy

.PHONY: build build-windows-amd64 build-darwin-arm64 run-darwin-arm64 watch-command
