const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 5000;

// ── Directories ────────────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const OUTPUTS_DIR = path.join(__dirname, 'outputs');
[UPLOADS_DIR, OUTPUTS_DIR].forEach((d) => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// ── Middleware ──────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use('/video', express.static(OUTPUTS_DIR));

// ── Multer config ──────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
  fileFilter: (_req, file, cb) => {
    const allowed = /mp4|mov|avi|mkv|webm/;
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (allowed.test(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed (mp4, mov, avi, mkv, webm)'));
    }
  },
});

// ── Helpers ────────────────────────────────────────────────────

/**
 * Validate a timestamp string in HH:MM:SS or HH:MM:SS,mmm format.
 * Returns true if valid.
 */
function isValidTimestamp(ts) {
  return /^\d{2}:\d{2}:\d{2}(,\d{1,3})?$/.test(ts.trim());
}

/**
 * Convert HH:MM:SS or HH:MM:SS,mmm to total seconds.
 */
function timestampToSeconds(ts) {
  const cleaned = ts.trim().replace(',', '.');
  const parts = cleaned.split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const s = parseFloat(parts[2]);
  return h * 3600 + m * 60 + s;
}

/**
 * Normalize a timestamp to SRT format: HH:MM:SS,mmm
 */
function normalizeTimestamp(ts) {
  const cleaned = ts.trim();
  // If already has comma with ms
  if (/^\d{2}:\d{2}:\d{2},\d{3}$/.test(cleaned)) return cleaned;
  // If has comma but less than 3 ms digits
  if (/^\d{2}:\d{2}:\d{2},\d{1,2}$/.test(cleaned)) {
    const [time, ms] = cleaned.split(',');
    return `${time},${ms.padEnd(3, '0')}`;
  }
  // No comma — just HH:MM:SS
  if (/^\d{2}:\d{2}:\d{2}$/.test(cleaned)) return `${cleaned},000`;
  return cleaned;
}

/**
 * Parse a timestamped transcript into structured subtitle data.
 *
 * Expected format:
 *   HH:MM:SS --> HH:MM:SS
 *   Subtitle text here
 *
 *   HH:MM:SS --> HH:MM:SS
 *   Next subtitle line
 *
 * @param {string} transcript
 * @returns {{ subtitles: Array, errors: string[] }}
 */
function parseTimestampedTranscript(transcript) {
  const lines = transcript.replace(/\r\n/g, '\n').split('\n');
  const subtitles = [];
  const errors = [];

  let i = 0;
  let blockIndex = 1;

  while (i < lines.length) {
    // Skip empty lines
    if (lines[i].trim() === '') {
      i++;
      continue;
    }

    const currentLine = lines[i].trim();

    // Try to match timestamp line: HH:MM:SS --> HH:MM:SS
    const timestampMatch = currentLine.match(
      /^(\d{2}:\d{2}:\d{2}(?:,\d{1,3})?)\s*-->\s*(\d{2}:\d{2}:\d{2}(?:,\d{1,3})?)$/
    );

    if (!timestampMatch) {
      errors.push(`Line ${i + 1}: Invalid timestamp format: "${currentLine}"`);
      i++;
      continue;
    }

    const rawStart = timestampMatch[1];
    const rawEnd = timestampMatch[2];

    // Validate timestamps
    if (!isValidTimestamp(rawStart)) {
      errors.push(`Line ${i + 1}: Invalid start time: "${rawStart}"`);
      i++;
      continue;
    }
    if (!isValidTimestamp(rawEnd)) {
      errors.push(`Line ${i + 1}: Invalid end time: "${rawEnd}"`);
      i++;
      continue;
    }

    // Check start < end
    const startSec = timestampToSeconds(rawStart);
    const endSec = timestampToSeconds(rawEnd);
    if (startSec >= endSec) {
      errors.push(
        `Line ${i + 1}: Start time (${rawStart}) must be before end time (${rawEnd})`
      );
      i++;
      continue;
    }

    // Collect subtitle text lines (everything until next blank line or timestamp)
    i++;
    const textLines = [];

    while (i < lines.length && lines[i].trim() !== '') {
      // Check if this line is another timestamp (next block)
      if (
        /^\d{2}:\d{2}:\d{2}(,\d{1,3})?\s*-->\s*\d{2}:\d{2}:\d{2}(,\d{1,3})?$/.test(
          lines[i].trim()
        )
      ) {
        break;
      }
      textLines.push(lines[i].trim());
      i++;
    }

    const text = textLines.join('\n');

    if (!text) {
      errors.push(`Block ${blockIndex}: Missing subtitle text after timestamp`);
      continue;
    }

    subtitles.push({
      index: blockIndex,
      start: normalizeTimestamp(rawStart),
      end: normalizeTimestamp(rawEnd),
      text,
    });

    blockIndex++;
  }

  return { subtitles, errors };
}

/**
 * Generate SRT content string from parsed subtitles.
 */
function generateSRT(subtitles) {
  return subtitles
    .map(
      (s) => `${s.index}\n${s.start} --> ${s.end}\n${s.text}\n`
    )
    .join('\n');
}

/**
 * Convert #RRGGBB hex color to ASS format &H[Alpha]BBGGRR
 */
function hexToAssColor(hex, alpha = '40') {
  if (!hex) return `&H${alpha}FFFFFF`;
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length !== 6) return `&H${alpha}FFFFFF`;
  const r = cleanHex.substring(0, 2);
  const g = cleanHex.substring(2, 4);
  const b = cleanHex.substring(4, 6);
  // ASS format expects Blue then Green then Red -> BBGGRR
  return `&H${alpha}${b}${g}${r}`;
}

/**
 * Burn subtitles into the video using FFmpeg.
 */
function burnSubtitles(videoPath, srtPath, outputPath, options = {}) {
  const { fontSize = 26, fontColor = '#FFFFFF', alignment = 2 } = options;
  // Use a translucent alpha format (&H40 for text)
  const assColor = hexToAssColor(fontColor, '40');

  return new Promise((resolve, reject) => {
    // Make the SRT path relative to __dirname to avoid absolute path and space issues in ffmpeg filters on Windows
    const relativeSrt = path.relative(__dirname, srtPath).replace(/\\/g, '/');

    const subtitleFilter =
      `subtitles=${relativeSrt}:force_style='` +
      `Alignment=${alignment},` +
      `FontSize=${fontSize},` +
      `FontName=Arial,` +
      `PrimaryColour=${assColor},` +
      `OutlineColour=&H90000000,` +
      `BackColour=&H00000000,` +
      `BorderStyle=3,` +
      `Outline=0,` +
      `Shadow=0,` +
      `MarginV=30'`;

    ffmpeg(videoPath)
      .outputOptions(['-vf', subtitleFilter, '-c:a', 'copy'])
      .output(outputPath)
      .on('start', (cmd) => console.log('  FFmpeg command:', cmd))
      .on('progress', (p) => {
        if (p.percent) {
          process.stdout.write(`\r  Progress: ${p.percent.toFixed(1)}%`);
        }
      })
      .on('end', () => {
        console.log('\n  ✅ Subtitles burned successfully');
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('\n  ❌ FFmpeg error:', err.message);
        reject(err);
      })
      .run();
  });
}

// ── Routes ─────────────────────────────────────────────────────

/**
 * POST /process
 * Accepts: video file + timestamped transcript
 */
app.post('/process', upload.single('video'), async (req, res) => {
  const startTime = Date.now();

  try {
    // Validate inputs
    if (!req.file) {
      return res.status(400).json({ error: 'No video file uploaded' });
    }

    const transcript = req.body.transcript;
    const fontSize = parseInt(req.body.fontSize, 10) || 26;
    const fontColor = req.body.fontColor || '#FFFFFF';
    const alignment = parseInt(req.body.alignment, 10) || 2;

    if (!transcript || !transcript.trim()) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Transcript text is required' });
    }

    const videoPath = req.file.path;
    const jobId = uuidv4();

    console.log(`\n🎬 Processing job ${jobId}`);
    console.log(`  Video: ${req.file.originalname}`);

    // 1. Parse timestamped transcript
    console.log('  📝 Parsing transcript...');
    const { subtitles, errors } = parseTimestampedTranscript(transcript);

    if (errors.length > 0) {
      fs.unlinkSync(videoPath);
      return res.status(400).json({
        error: 'Transcript parsing failed',
        details: errors,
      });
    }

    if (subtitles.length === 0) {
      fs.unlinkSync(videoPath);
      return res.status(400).json({
        error: 'No valid subtitle blocks found in transcript',
      });
    }

    console.log(`  Found ${subtitles.length} subtitle blocks`);

    // 2. Generate SRT file
    const srtContent = generateSRT(subtitles);
    const srtPath = path.join(UPLOADS_DIR, `${jobId}.srt`);
    fs.writeFileSync(srtPath, srtContent, 'utf-8');
    console.log(`  💾 SRT saved: ${srtPath}`);

    // 3. Burn subtitles into video
    const outputFilename = `output_${jobId}.mp4`;
    const outputPath = path.join(OUTPUTS_DIR, outputFilename);

    console.log(`  🔥 Burning subtitles (Size: ${fontSize}, Color: ${fontColor}, Align: ${alignment})...`);
    await burnSubtitles(videoPath, srtPath, outputPath, { fontSize, fontColor, alignment });

    // 4. Cleanup temp files
    fs.unlinkSync(videoPath);
    fs.unlinkSync(srtPath);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`  ⏱️  Total processing time: ${elapsed}s`);

    // 5. Send response
    res.json({
      videoUrl: `/video/${outputFilename}`,
      subtitles,
      srtContent,
      processingTime: `${elapsed}s`,
    });
  } catch (err) {
    console.error('Processing error:', err);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: `Processing failed: ${err.message}` });
  }
});

/**
 * POST /validate
 * Validates transcript without processing video — for live preview.
 */
app.post('/validate', express.json(), (req, res) => {
  const { transcript } = req.body;
  if (!transcript || !transcript.trim()) {
    return res.status(400).json({ error: 'Transcript is required' });
  }

  const { subtitles, errors } = parseTimestampedTranscript(transcript);

  res.json({
    valid: errors.length === 0 && subtitles.length > 0,
    subtitles,
    errors,
    count: subtitles.length,
  });
});

/**
 * GET /video/:filename
 * Serve processed videos
 */
app.get('/video/:filename', (req, res) => {
  const filePath = path.join(OUTPUTS_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Video not found' });
  }
  res.sendFile(filePath);
});

/**
 * GET /health
 */
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// ── Start ──────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Subtitle Burner Server running on http://localhost:${PORT}`);
  console.log(`   Uploads → ${UPLOADS_DIR}`);
  console.log(`   Outputs → ${OUTPUTS_DIR}\n`);
});
