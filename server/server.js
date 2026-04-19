/**
 * SubBurner Server v2.0
 *
 * Endpoints:
 *   POST /auto-process      → Start OCR pipeline, returns { jobId }
 *   GET  /job-status/:id    → Poll OCR job progress
 *   POST /finalize/:id      → Burn subtitles after user review
 *   POST /process           → Manual transcript burn (unchanged)
 *   POST /validate          → Validate transcript format (unchanged)
 *   GET  /video/:filename   → Serve processed video
 *   GET  /health            → Health check
 */

'use strict';

const express    = require('express');
const cors       = require('cors');
const multer     = require('multer');
const path       = require('path');
const fs         = require('fs');
const ffmpeg     = require('fluent-ffmpeg');
const installer  = require('@ffmpeg-installer/ffmpeg');
ffmpeg.setFfmpegPath(installer.path);
const { v4: uuidv4 }    = require('uuid');
const { createWorker }  = require('tesseract.js');
const strSim            = require('string-similarity');

const app  = express();
const PORT = 5000;

// ── Directories ───────────────────────────────────────────────
const UPLOADS = path.join(__dirname, 'uploads');
const OUTPUTS = path.join(__dirname, 'outputs');
const FRAMES  = path.join(__dirname, 'frames');
[UPLOADS, OUTPUTS, FRAMES].forEach(d => fs.mkdirSync(d, { recursive: true }));

// ── In-memory Job Store ───────────────────────────────────────
// jobId → { jobId, videoPath, fps, stage, message,
//           totalFrames, processedFrames, subtitles, error }
const jobs = new Map();

// ── Middleware ────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use('/video', express.static(OUTPUTS));

// ── Multer ────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOADS),
  filename:    (_, f,  cb) => cb(null, uuidv4() + path.extname(f.originalname)),
});
const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const ok = /\.(mp4|mov|avi|mkv|webm)$/i.test(file.originalname);
    cb(ok ? null : new Error('Only video files allowed'), ok);
  },
});

// ── Time Helpers ──────────────────────────────────────────────
const p2 = n => String(Math.floor(n)).padStart(2, '0');
const p3 = n => String(Math.floor(n)).padStart(3, '0');

/** Decimal seconds → SRT timestamp HH:MM:SS,mmm */
function secToSRT(s) {
  s = Math.max(0, +s || 0);
  return `${p2(s / 3600)}:${p2((s % 3600) / 60)}:${p2(s % 60)},${p3((s % 1) * 1000)}`;
}

/** Validate HH:MM:SS or HH:MM:SS,mmm */
const isValidTs = ts => /^\d{2}:\d{2}:\d{2}(,\d{1,3})?$/.test((ts || '').trim());

/** HH:MM:SS[,mmm] → decimal seconds */
function tsToSec(ts) {
  const [h, m, s] = ts.trim().replace(',', '.').split(':');
  return +h * 3600 + +m * 60 + parseFloat(s);
}

/** Normalize timestamp to strict HH:MM:SS,mmm */
function normTs(ts) {
  const t = (ts || '').trim();
  if (/^\d{2}:\d{2}:\d{2},\d{3}$/.test(t))   return t;
  if (/^\d{2}:\d{2}:\d{2},\d{1,2}$/.test(t)) {
    const [d, ms] = t.split(',');
    return `${d},${ms.padEnd(3, '0')}`;
  }
  if (/^\d{2}:\d{2}:\d{2}$/.test(t))          return `${t},000`;
  return t;
}

// ── SRT Generators ────────────────────────────────────────────

/** OCR subtitles: { start: seconds, end: seconds, text } */
function makeSRTFromSecs(subs) {
  return subs
    .filter(s => s.text?.trim())
    .map((s, i) =>
      `${i + 1}\n${secToSRT(+s.start)} --> ${secToSRT(+s.end)}\n${s.text.trim()}\n`
    )
    .join('\n');
}

/** Manual subtitles: { index, start: "HH:MM:SS,mmm", end, text } */
function makeSRTFromManual(subs) {
  return subs.map(s => `${s.index}\n${s.start} --> ${s.end}\n${s.text}\n`).join('\n');
}

// ── OCR Helpers ───────────────────────────────────────────────

/** Strip non-printable ASCII, collapse whitespace */
function cleanText(raw) {
  return (raw || '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Return true if texts are ≥ threshold similar (Dice bigram coefficient) */
function isSame(a, b, threshold = 0.80) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return strSim.compareTwoStrings(a, b) >= threshold;
}

// ── FFmpeg Helpers ────────────────────────────────────────────

function extractFrames(videoPath, framesDir, fps) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .outputOptions(['-vf', `fps=${fps}`, '-q:v', '2'])
      .output(path.join(framesDir, 'frame_%04d.png'))
      .on('end', () =>
        resolve(fs.readdirSync(framesDir).filter(f => f.endsWith('.png')).length)
      )
      .on('error', reject)
      .run();
  });
}

/** Convert hex #RRGGBB → ASS &HαBBGGRR (alpha 00=opaque, FF=transparent) */
function hexToAss(hex, alpha = '00') {
  const h = (hex || '#FFFFFF').replace('#', '');
  if (h.length !== 6) return `&H${alpha}FFFFFF`;
  return `&H${alpha}${h.slice(4)}${h.slice(2, 4)}${h.slice(0, 2)}`;
}

function burnSubtitles(videoPath, srtPath, outputPath, opts = {}) {
  const { fontSize = 26, fontColor = '#FFFFFF', alignment = 2 } = opts;
  const primary = hexToAss(fontColor, '00');
  const outline = hexToAss('#000000', '00');
  const relSrt  = path.relative(__dirname, srtPath).replace(/\\/g, '/');

  const filter =
    `subtitles=${relSrt}:force_style='` +
    `Alignment=${alignment},FontSize=${fontSize},FontName=Arial,` +
    `PrimaryColour=${primary},OutlineColour=${outline},` +
    `BackColour=&H00000000,BorderStyle=1,Outline=2,Shadow=0,MarginV=30'`;

  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .outputOptions(['-vf', filter, '-c:a', 'copy'])
      .output(outputPath)
      .on('progress', p => {
        if (p.percent) process.stdout.write(`\r  🔥 Burning: ${p.percent.toFixed(1)}%`);
      })
      .on('end',   () => { console.log('\n  ✅ Burn complete'); resolve(); })
      .on('error', err => { console.error('\n  ❌ FFmpeg error:', err.message); reject(err); })
      .run();
  });
}

// ── OCR Pipeline ──────────────────────────────────────────────

async function runOCR(jobId) {
  const job = jobs.get(jobId);
  if (!job) return;

  const framesDir = path.join(FRAMES, jobId);

  try {
    // 1. Extract frames ─────────────────────────────────────────
    fs.mkdirSync(framesDir, { recursive: true });
    job.stage   = 'extracting';
    job.message = 'Extracting frames from video…';
    console.log(`\n[${jobId}] Extracting frames at ${job.fps} fps…`);

    job.totalFrames = await extractFrames(job.videoPath, framesDir, job.fps);
    console.log(`[${jobId}] ${job.totalFrames} frames extracted`);

    if (job.totalFrames === 0) {
      throw new Error('No frames could be extracted. Check the video format.');
    }

    // 2. OCR each frame ─────────────────────────────────────────
    job.stage           = 'ocr';
    job.processedFrames = 0;
    job.message         = `Running OCR on ${job.totalFrames} frames…`;

    const frameFiles = fs
      .readdirSync(framesDir)
      .filter(f => f.endsWith('.png'))
      .sort();

    const worker = await createWorker('eng');

    const frameData = [];
    for (let i = 0; i < frameFiles.length; i++) {
      try {
        const { data: { text } } = await worker.recognize(
          path.join(framesDir, frameFiles[i])
        );
        frameData.push({ time: i / job.fps, text: cleanText(text) });
      } catch {
        frameData.push({ time: i / job.fps, text: '' }); // skip bad frames
      }
      job.processedFrames = i + 1;
      job.message = `OCR: frame ${i + 1} / ${job.totalFrames}`;
    }

    await worker.terminate();
    console.log(`[${jobId}] OCR complete`);

    // 3. Detect text changes → subtitle segments ────────────────
    job.stage   = 'analyzing';
    job.message = 'Detecting text changes and building subtitle segments…';

    const segments = [];
    let cur = null, segStart = 0;

    for (const { time, text } of frameData) {
      // Skip frames with no meaningful text (< 3 chars after cleaning)
      if (text.length < 3) {
        if (cur !== null) {
          segments.push({ start: segStart, end: time, text: cur });
          cur = null;
        }
        continue;
      }

      if (cur === null) {
        // Start new segment
        cur      = text;
        segStart = time;
      } else if (!isSame(cur, text)) {
        // Text changed significantly — close old, start new
        segments.push({ start: segStart, end: time, text: cur });
        cur      = text;
        segStart = time;
      }
      // Same text → extend segment implicitly
    }

    // Close final segment
    if (cur !== null) {
      const last = frameData.at(-1);
      segments.push({ start: segStart, end: last.time + 1 / job.fps, text: cur });
    }

    // 4. Cleanup frames ─────────────────────────────────────────
    try { fs.rmSync(framesDir, { recursive: true, force: true }); } catch {}

    job.stage     = 'done';
    job.subtitles = segments.map((s, i) => ({ ...s, id: i }));
    job.message   = `Found ${segments.length} subtitle block${segments.length !== 1 ? 's' : ''}.`;
    console.log(`[${jobId}] ✅ Done — ${segments.length} segments`);

  } catch (err) {
    console.error(`[${jobId}] ❌ Pipeline error:`, err.message);
    try { fs.rmSync(framesDir, { recursive: true, force: true }); } catch {}
    job.stage   = 'error';
    job.error   = err.message;
    job.message = `Error: ${err.message}`;
  }
}

// ── Manual Transcript Parser ──────────────────────────────────

function parseTranscript(raw) {
  const lines  = (raw || '').replace(/\r\n/g, '\n').split('\n');
  const subs   = [];
  const errors = [];
  let i = 0, idx = 1;

  while (i < lines.length) {
    if (!lines[i].trim()) { i++; continue; }

    const m = lines[i].trim().match(
      /^(\d{2}:\d{2}:\d{2}(?:,\d{1,3})?)\s*-->\s*(\d{2}:\d{2}:\d{2}(?:,\d{1,3})?)$/
    );
    if (!m) {
      errors.push(`Line ${i + 1}: Invalid format — "${lines[i].trim()}"`);
      i++;
      continue;
    }

    const [, rs, re] = m;
    if (!isValidTs(rs)) { errors.push(`Line ${i + 1}: Bad start time "${rs}"`);  i++; continue; }
    if (!isValidTs(re)) { errors.push(`Line ${i + 1}: Bad end time "${re}"`);    i++; continue; }
    if (tsToSec(rs) >= tsToSec(re)) {
      errors.push(`Line ${i + 1}: Start time must be before end time`);
      i++;
      continue;
    }

    i++;
    const textLines = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\d{2}:\d{2}:\d{2}/.test(lines[i].trim())
    ) {
      textLines.push(lines[i].trim());
      i++;
    }

    const text = textLines.join('\n');
    if (!text) { errors.push(`Block ${idx}: No subtitle text after timestamp`); continue; }

    subs.push({ index: idx, start: normTs(rs), end: normTs(re), text });
    idx++;
  }

  return { subtitles: subs, errors };
}

// ── API Routes ────────────────────────────────────────────────

/** POST /auto-process — start OCR pipeline, return { jobId } immediately */
app.post('/auto-process', upload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No video file uploaded' });

  const fps   = Math.min(Math.max(parseFloat(req.body.fps) || 1, 0.25), 4);
  const jobId = uuidv4();

  jobs.set(jobId, {
    jobId,
    fps,
    videoPath:       req.file.path,
    originalName:    req.file.originalname,
    stage:           'queued',
    message:         'Job queued, starting…',
    totalFrames:     0,
    processedFrames: 0,
    subtitles:       null,
    error:           null,
  });

  console.log(`\n🎯 OCR job ${jobId} | "${req.file.originalname}" | fps=${fps}`);
  setImmediate(() => runOCR(jobId));
  res.json({ jobId });
});

/** GET /job-status/:jobId — poll job progress */
app.get('/job-status/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  const { jobId, stage, message, totalFrames, processedFrames, subtitles, error } = job;
  res.json({ jobId, stage, message, totalFrames, processedFrames, subtitles, error });
});

/** POST /finalize/:jobId — burn edited subtitles into video */
app.post('/finalize/:jobId', async (req, res) => {
  const jobId = req.params.jobId;
  const job   = jobs.get(jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.stage !== 'done') {
    return res.status(400).json({ error: `Job not ready for finalization (stage: ${job.stage})` });
  }

  try {
    const subs      = req.body.subtitles || job.subtitles;
    const fontSize  = parseInt(req.body.fontSize,  10) || 26;
    const fontColor = req.body.fontColor  || '#FFFFFF';
    const alignment = parseInt(req.body.alignment, 10) || 2;

    if (!subs?.length) return res.status(400).json({ error: 'No subtitles provided' });

    const srtContent = makeSRTFromSecs(subs);
    const srtPath    = path.join(UPLOADS, `${jobId}.srt`);
    fs.writeFileSync(srtPath, srtContent, 'utf-8');
    console.log(`\n[${jobId}] SRT written (${subs.length} subtitles)`);

    const outFile = `output_${jobId}.mp4`;
    const outPath = path.join(OUTPUTS, outFile);
    await burnSubtitles(job.videoPath, srtPath, outPath, { fontSize, fontColor, alignment });

    try { fs.unlinkSync(job.videoPath); } catch {}
    try { fs.unlinkSync(srtPath); } catch {}

    // Auto-clean job from memory after 30 minutes
    setTimeout(() => jobs.delete(jobId), 30 * 60 * 1000);

    res.json({ videoUrl: `/video/${outFile}`, srtContent, subtitles: subs });

  } catch (err) {
    console.error(`[${jobId}] Finalize error:`, err);
    res.status(500).json({ error: `Burning failed: ${err.message}` });
  }
});

/** POST /process — manual transcript → parse → burn */
app.post('/process', upload.single('video'), async (req, res) => {
  const t0 = Date.now();
  if (!req.file) return res.status(400).json({ error: 'No video file uploaded' });

  const transcript = req.body.transcript;
  const videoPath  = req.file.path;

  if (!transcript?.trim()) {
    try { fs.unlinkSync(videoPath); } catch {}
    return res.status(400).json({ error: 'Transcript is required' });
  }

  const jobId = uuidv4();
  console.log(`\n📝 Manual job ${jobId} | "${req.file.originalname}"`);

  try {
    const { subtitles, errors } = parseTranscript(transcript);

    if (errors.length) {
      try { fs.unlinkSync(videoPath); } catch {}
      return res.status(400).json({ error: 'Transcript parsing failed', details: errors });
    }
    if (!subtitles.length) {
      try { fs.unlinkSync(videoPath); } catch {}
      return res.status(400).json({ error: 'No valid subtitle blocks found' });
    }

    const srtContent = makeSRTFromManual(subtitles);
    const srtPath    = path.join(UPLOADS, `${jobId}.srt`);
    fs.writeFileSync(srtPath, srtContent, 'utf-8');

    const outFile = `output_${jobId}.mp4`;
    const outPath = path.join(OUTPUTS, outFile);

    await burnSubtitles(videoPath, srtPath, outPath, {
      fontSize:  parseInt(req.body.fontSize,  10) || 26,
      fontColor: req.body.fontColor  || '#FFFFFF',
      alignment: parseInt(req.body.alignment, 10) || 2,
    });

    try { fs.unlinkSync(videoPath); } catch {}
    try { fs.unlinkSync(srtPath); } catch {}

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    res.json({ videoUrl: `/video/${outFile}`, subtitles, srtContent, processingTime: `${elapsed}s` });

  } catch (err) {
    console.error('Manual process error:', err);
    try { fs.unlinkSync(videoPath); } catch {}
    res.status(500).json({ error: `Processing failed: ${err.message}` });
  }
});

/** POST /validate — live transcript validation (no video needed) */
app.post('/validate', (req, res) => {
  const { transcript } = req.body;
  if (!transcript?.trim()) return res.status(400).json({ error: 'Transcript required' });
  const { subtitles, errors } = parseTranscript(transcript);
  res.json({
    valid:     !errors.length && subtitles.length > 0,
    subtitles,
    errors,
    count:     subtitles.length,
  });
});

/** GET /health */
app.get('/health', (_, res) =>
  res.json({ status: 'ok', uptime: process.uptime(), activeJobs: jobs.size })
);

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 SubBurner Server  →  http://localhost:${PORT}`);
  console.log(`   uploads : ${UPLOADS}`);
  console.log(`   outputs : ${OUTPUTS}`);
  console.log(`   frames  : ${FRAMES}\n`);
});
