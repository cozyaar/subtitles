# SubBurner — Video Subtitle Burning Tool

Upload a video, paste your timestamped transcript, and get a professionally subtitled video
burned with FFmpeg — all running locally.

![Stack](https://img.shields.io/badge/React-Vite-blue)
![Stack](https://img.shields.io/badge/Express-Node.js-green)
![Stack](https://img.shields.io/badge/FFmpeg-Video-red)

---

## ✨ Features

- 📁 **Video Upload** — Drag & drop or click to upload (MP4, MOV, AVI, MKV, WebM)
- 📝 **Timestamped Transcript** — Paste transcripts with exact timings.
- ✅ **Live Validation** — See exactly how your transcript parses before burning.
- 🔥 **FFmpeg Burn** — White text, black outline, bottom-center alignment.
- 📄 **SRT Export** — Download the generated `.srt` file separately.
- 🎬 **Preview & Download** — Watch the result and download the final video.

---

## 📁 Project Structure

```
VIDEO EDITOR/
├── client/                 # React (Vite) frontend
│   ├── src/
│   │   ├── App.jsx         # Main application component
│   │   ├── App.css         # Component styles
│   │   ├── index.css       # Global styles & design tokens
│   │   └── main.jsx        # React entry point
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── server/                 # Express backend
│   ├── server.js           # API server + FFmpeg processing + Parsing
│   ├── uploads/            # Temporary uploaded files
│   ├── outputs/            # Processed videos
│   └── package.json
└── README.md
```

---

## 📝 Transcript Format

The application uses **strict** user-provided timestamps. Do not auto-generate timing. Valid formats include `HH:MM:SS` or `HH:MM:SS,mmm`.

**Format Rules:**
- Line 1: `Start_Time --> End_Time`
- Lines below: `Subtitle Text`
- *Empty Line* to separate subtitle blocks.

**Example:**
```
00:00:00 --> 00:00:03
Hello everyone, welcome to this video.

00:00:03 --> 00:00:07
Today we will learn how to add subtitles.
```

---

## 🛠️ Prerequisites

### 1. Node.js (v18+)

Download from [nodejs.org](https://nodejs.org/)

### 2. FFmpeg

FFmpeg must be installed and accessible from your system PATH.

**Windows (via winget):**
```bash
winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements
```

**Verify installation:**
```bash
ffmpeg -version
```

---

## 🚀 Setup & Run

### 1. Install dependencies

Open **two terminals**:

**Terminal 1 — Server:**
```bash
cd server
npm install
```

**Terminal 2 — Client:**
```bash
cd client
npm install
```

### 2. Start the application

**Terminal 1 — Start server (port 5000):**
```bash
cd server
npm run dev
```
*(Use `npm start` to run outside watch mode)*

**Terminal 2 — Start client (port 3000):**
```bash
cd client
npm run dev
```

### 3. Open in browser

Navigate to: **http://localhost:3000**

---

## 🔁 Processing Flow

1. **Upload** — Select a video file (up to 500 MB)
2. **Transcript** — Paste your timestamped transcript
3. **Parse** — The frontend previews the subtitle blocks and warns of format errors
4. **Process** — Click "Process Video & Burn Subtitles"
5. **Backend Pipeline:**
   - Validates correct timestamp formatting (`Start < End`)
   - Generates an exact SRT file
   - Burns subtitles onto the video using FFmpeg
6. **Result** — Preview and download

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/process` | Upload video + transcript, returns processed video URL |
| `POST` | `/validate`| Validates transcript formatting for the frontend live preview |
| `GET`  | `/video/:filename` | Serve processed video file |
| `GET`  | `/health` | Health check |

---

## ⚠️ Notes

- Processing time relies on video complexity and CPU speeds.
- All intermediary files (originals, `.srt`) are cleaned up when the process completes.

---

## 📜 License

MIT
