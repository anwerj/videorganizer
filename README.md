# Videorganizer

**The blazing fast, privacy-first video organizer for your local collection.**

Videorganizer is a self-hosted tool designed for power users who need to review, rename, and organize large video collections efficiently. It runs locally, keeps your data private, and is optimized for a mouse-free workflow.

## ✨ Features

*   **🚀 Rapid Workflow**: Rename a file and automatically jump to the next one. Never lose your flow.
*   **🏷️ Smart Organization**:
    *   **Timestamp Marking**: Press `t` for a default timestamp or `a` for an audio-specific mark. Saved in the filename using a compact centisecond format (e.g., `video-ts_4500_3300_a_5200.mp4`), so they are portable and zero-lock-in.
    *   **Auto-Hide**: Files with timestamps (`-ts_`) are automatically hidden from the list so you can focus on what's left. Toggle them back on with the "Organized" checkbox.
*   **📂 Tree-Based Browser**: Navigate deep directory structures with ease.
*   **🎥 Pro Player**:
    *   **Frame-Accurate Seeking**: Hover the seek bar for a precise preview.
    *   **Portrait Support**: Rotate videos 90° on the fly (`r`).
    *   **Preview Pane**: Smart positioning ensures the preview never blocks the video.
    *   **Timestamp Dots**: Default timestamps (blue) and audio marks (green) on the seek bar.
*   **🖻 Screenshot View**: Open the timestamps page to extract frames for default timestamp marks (audio marks are seekbar-only).
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

1.  **Place the binary** and `videorganizer.config.json` together (e.g. next to the executable).

2.  **Set `Root`** in the config to the absolute path of your video folder.

3.  **Run the server**:
    ```bash
    ./videorganizer-darwin-arm64
    ```

4.  **Open in Browser**:
    Go to `http://127.0.0.1:9898`

### Configuration

`videorganizer.config.json` lives next to the binary. The `Root` field points at your video library (absolute path):

```json
{
    "Root": "/Users/you/videos",
    "Addr" : "127.0.0.1:9898",
    "Exts" : {
        "mp4":  true,
        "mkv":  true,
        "mov":  true,
        "webm": true
    }
}
```

On Windows use a path like `C:\\Users\\you\\videos`. If `Root` is omitted, it defaults to the directory containing the config file. During development (`go run main.go`), the config file is read from your home directory.

### Timestamp Filename Format

Timestamps are stored in the filename suffix after `-ts_`:

```
{basename}-ts_{defaultBlock}[_a_{audioBlock}]{ext}
```

- Times are in **centiseconds** (1 cs = 10ms) for frame-accurate capture.
- Within each block, the first value is absolute; subsequent values are deltas from the previous mark in that block.
- Default timestamps come first; audio marks follow after `_a_`.

Examples:

```
clip-ts_4500_3300_2400.mp4           → timestamps at 45.00s, 78.00s, 102.00s
clip-ts_4500_3300_a_5200_4500.mp4    → timestamps + audio at 52.00s, 97.00s
```

## ⌨️ Key Bindings

Master these shortcuts to fly through your collection:

| Key | Action |
| :--- | :--- |
| **Space** | Play / Pause |
| **z** / **x** | Seek -3s / +3s |
| **c** / **v** | Next / Previous Video |
| **r** | Rotate Video (90° Clockwise) |
| **t** | **Add Timestamp** (default; updates filename) |
| **a** | **Add Audio Mark** (updates filename) |
| **e** | Open **Rename** Modal |
| **l** | Open **File List** Modal |
| **Esc** | Close Modal |
| **Enter** | (In Rename Modal) Confirm & Next |

## 💡 The "Organized" Workflow

1.  **Watch**: Play a video.
2.  **Mark**: Press `t` for a default timestamp. Press `a` for an audio-specific mark. The rename field updates with the suffix.
3.  **Rename**: Press `e`, then **Enter** to save and jump to the next video.
4.  **Filter**: The "Organized" checkbox in the sidebar is unchecked by default, so the video you just marked disappears from the list.
5.  **Repeat**: Keep going until the list is empty!

## License

[MIT License](LICENSE)
