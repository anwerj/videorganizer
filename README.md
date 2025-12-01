# Videorganizer

**The blazing fast, privacy-first video organizer for your local collection.**

Videorganizer is a self-hosted tool designed for power users who need to review, rename, and organize large video collections efficiently. It runs locally, keeps your data private, and is optimized for a mouse-free workflow.

## ✨ Features

*   **🚀 Rapid Workflow**: Rename a file and automatically jump to the next one. Never lose your flow.
*   **🏷️ Smart Organization**:
    *   **Timestamp Marking**: Press `t` to mark interesting moments. Timestamps are saved directly in the filename (e.g., `video__ts_12345.mp4`), so they are portable and zero-lock-in.
    *   **Auto-Hide**: Files with timestamps (`_ts_`) are automatically hidden from the list so you can focus on what's left. Toggle them back on with the "Organized" checkbox.
*   **📂 Tree-Based Browser**: Navigate deep directory structures with ease.
*   **🎥 Pro Player**:
    *   **Frame-Accurate Seeking**: Hover the seek bar for a precise preview.
    *   **Portrait Support**: Rotate videos 90° on the fly (`r`).
    *   **Preview Pane**: Smart positioning ensures the preview never blocks the video.
*   **🌑 Dark Mode**: A clean, distraction-free UI for long sessions.

## 🛠️ Installation

### Build from Source

Requirements: Go 1.18+

```bash
# Clone the repository
git clone https://github.com/yourusername/videorganizer.git
cd videorganizer

# Build for your platform
make build
# Or specifically:
# make build-darwin-arm64  # macOS Apple Silicon
# make build-windows-amd64 # Windows
```

## 🚀 Usage

1.  **Run the server**:
    ```bash
    ./videorganizer-darwin-arm64 /path/to/your/videos
    ```
    If no path is provided, it defaults to the current directory.

2.  **Open in Browser**:
    Go to `http://127.0.0.1:9898`

### Configuration

Create a `videorganizer.config.json` in your video root directory to customize settings:

```json
{
    "Addr" : "127.0.0.1:9898",
    "Exts" : {
        "mp4":  true,
        "mkv":  true,
        "mov":  true,
        "webm": true
    }
}
```

## ⌨️ Key Bindings

Master these shortcuts to fly through your collection:

| Key | Action |
| :--- | :--- |
| **Space** | Play / Pause |
| **z** / **x** | Seek -3s / +3s |
| **c** / **v** | Next / Previous Video |
| **r** | Rotate Video (90° Clockwise) |
| **t** | **Add Timestamp** (Updates filename) |
| **e** | Open **Rename** Modal |
| **l** | Open **File List** Modal |
| **Esc** | Close Modal |
| **Enter** | (In Rename Modal) Confirm & Next |

## 💡 The "Organized" Workflow

1.  **Watch**: Play a video.
2.  **Mark**: Found something interesting? Press `t`. The file is renamed to include the timestamp.
3.  **Next**: Press `c` to move to the next video.
4.  **Filter**: The "Organized" checkbox in the sidebar is unchecked by default, so the video you just marked disappears from the list.
5.  **Repeat**: Keep going until the list is empty!

## License

[MIT License](LICENSE)
