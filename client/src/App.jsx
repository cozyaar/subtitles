import { useState, useRef, useCallback, useEffect } from 'react';
import './App.css';

const API = 'http://localhost:5000';

// ── Time Helpers ──────────────────────────────────────────────

const pad2 = n => String(Math.floor(Math.abs(+n || 0))).padStart(2, '0');

/** Decimal seconds → display string "HH:MM:SS.s" */
function fmtTime(secs) {
  secs = Math.max(0, +secs || 0);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${pad2(h)}:${pad2(m)}:${s.toFixed(1).padStart(4, '0')}`;
}

/** Parse "HH:MM:SS[.s]" or "HH:MM:SS,mmm" → decimal seconds */
function parseTime(str) {
  if (!str) return 0;
  const clean = String(str).replace(',', '.').trim();
  const parts = clean.split(':');
  if (parts.length !== 3) return 0;
  return Math.max(0, +parts[0] * 3600 + +parts[1] * 60 + parseFloat(parts[2]));
}

function formatFileSize(bytes) {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Shared Sub-Components ─────────────────────────────────────

function VideoDropzone({ file, onFileSelect, onRemove }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(e => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith('video/')) onFileSelect(f);
  }, [onFileSelect]);

  if (file) {
    return (
      <div className="dropzone has-file">
        <div className="file-info">
          <span className="file-info-icon">🎬</span>
          <div className="file-info-details">
            <div className="file-info-name">{file.name}</div>
            <div className="file-info-size">{formatFileSize(file.size)}</div>
          </div>
          <button
            className="file-remove"
            onClick={e => { e.stopPropagation(); onRemove(); }}
            title="Remove file"
          >✕</button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`dropzone ${dragOver ? 'drag-over' : ''}`}
      onClick={() => inputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/mov,video/avi,video/mkv,video/webm"
        onChange={e => e.target.files[0] && onFileSelect(e.target.files[0])}
      />
      <div className="dropzone-icon">📁</div>
      <div className="dropzone-text">Drop video here or <strong>click to browse</strong></div>
      <div className="dropzone-hint">MP4, MOV, AVI, MKV, WebM — max 500 MB</div>
    </div>
  );
}

function AppearanceOptions({ fontSize, fontColor, alignment, setFontSize, setFontColor, setAlignment }) {
  const COLORS = [
    { label: 'White',  value: '#FFFFFF' },
    { label: 'Yellow', value: '#FFFF00' },
    { label: 'Green',  value: '#00FF7F' },
    { label: 'Cyan',   value: '#00FFFF' },
  ];

  return (
    <div className="options-panel">
      <div className="options-grid">
        {/* Font size */}
        <div className="option-group">
          <label className="option-label">Font Size</label>
          <div className="font-size-control">
            <input
              type="range" className="font-slider"
              min="14" max="72" value={fontSize}
              onChange={e => setFontSize(+e.target.value)}
            />
            <span className="font-value">{fontSize}px</span>
          </div>
        </div>

        {/* Color */}
        <div className="option-group">
          <label className="option-label">Text Color</label>
          <div className="color-options">
            {COLORS.map(c => (
              <button
                key={c.value}
                className={`color-swatch ${fontColor === c.value ? 'active' : ''}`}
                style={{ backgroundColor: c.value }}
                onClick={() => setFontColor(c.value)}
                title={c.label}
              />
            ))}
            <input
              type="color" value={fontColor}
              onChange={e => setFontColor(e.target.value.toUpperCase())}
              title="Custom color"
              className="color-picker-input"
            />
          </div>
        </div>

        {/* Position */}
        <div className="option-group">
          <label className="option-label">Position</label>
          <div className="speed-options">
            {[{v:8,l:'Top'},{v:5,l:'Mid'},{v:2,l:'Bot'}].map(({v,l}) => (
              <button
                key={v}
                className={`speed-btn ${alignment === v ? 'active' : ''}`}
                onClick={() => setAlignment(v)}
              >{l}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Subtitle Editor ───────────────────────────────────────────

function SubtitleEditor({ subtitles, setSubtitles }) {
  const update = (index, patch) =>
    setSubtitles(prev => prev.map((s, i) => i === index ? { ...s, ...patch } : s));

  const remove = index =>
    setSubtitles(prev => prev.filter((_, i) => i !== index));

  const addRow = () => {
    const last  = subtitles[subtitles.length - 1];
    const start = last ? last.end + 0.5 : 0;
    setSubtitles(prev => [...prev, { id: Date.now(), start, end: start + 3, text: '' }]);
  };

  if (subtitles.length === 0) {
    return (
      <div className="subtitle-editor empty-editor">
        <p className="empty-msg">No text was detected in the video frames.</p>
        <p className="empty-hint">Try increasing the frame rate or use Manual mode.</p>
        <button className="add-sub-btn" onClick={addRow}>+ Add Subtitle Manually</button>
      </div>
    );
  }

  return (
    <div className="subtitle-editor">
      <div className="sub-editor-header">
        <span className="sub-count">{subtitles.length} subtitle{subtitles.length !== 1 ? 's' : ''} detected</span>
        <span className="sub-hint">Edit timing or text, then burn into video.</span>
      </div>

      <div className="sub-list">
        {subtitles.map((sub, i) => (
          <div key={sub.id ?? i} className="sub-row">
            <span className="sub-num">{i + 1}</span>

            <div className="sub-times">
              <input
                className="time-input"
                title="Start time (HH:MM:SS.s)"
                defaultValue={fmtTime(sub.start)}
                onBlur={e => {
                  const secs = parseTime(e.target.value);
                  if (!isNaN(secs)) update(i, { start: secs });
                }}
              />
              <span className="time-sep">→</span>
              <input
                className="time-input"
                title="End time (HH:MM:SS.s)"
                defaultValue={fmtTime(sub.end)}
                onBlur={e => {
                  const secs = parseTime(e.target.value);
                  if (!isNaN(secs)) update(i, { end: secs });
                }}
              />
            </div>

            <textarea
              className="sub-text"
              value={sub.text}
              onChange={e => update(i, { text: e.target.value })}
              rows={2}
              placeholder="Subtitle text…"
            />

            <button className="sub-delete" onClick={() => remove(i)} title="Delete row">✕</button>
          </div>
        ))}
      </div>

      <button className="add-sub-btn" onClick={addRow}>+ Add Subtitle</button>
    </div>
  );
}

// ── Processing Views ──────────────────────────────────────────

function OCRProgressView({ jobData }) {
  const STAGES = [
    { key: 'extracting', label: 'Extracting Frames'     },
    { key: 'ocr',        label: 'Running OCR'           },
    { key: 'analyzing',  label: 'Building Segments'     },
  ];

  const curKey = jobData?.stage;
  const curIdx = STAGES.findIndex(s => s.key === curKey);
  const pct    =
    curKey === 'ocr' && jobData?.totalFrames > 0
      ? Math.round((jobData.processedFrames / jobData.totalFrames) * 100)
      : null;

  return (
    <div className="processing-overlay">
      <div className="processing-card">
        <div className="processing-spinner" />
        <h2 className="processing-title">Analyzing Video</h2>
        <p className="processing-subtitle">{jobData?.message || 'Starting…'}</p>

        {pct !== null && (
          <div className="progress-wrap">
            <div className="progress-bar" style={{ width: `${pct}%` }} />
            <span className="progress-pct">{pct}%</span>
          </div>
        )}

        <div className="processing-steps">
          {STAGES.map(({ key, label }, idx) => {
            const done   = idx < curIdx;
            const active = idx === curIdx;
            return (
              <div key={key} className={`processing-step ${done ? 'done' : active ? 'active' : ''}`}>
                <span>{label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BurningView() {
  return (
    <div className="processing-overlay">
      <div className="processing-card">
        <div className="processing-spinner" />
        <h2 className="processing-title">Burning Subtitles</h2>
        <p className="processing-subtitle">FFmpeg is rendering subtitles into your video…</p>
        <div className="processing-steps">
          <div className="processing-step active"><span>Encoding with FFmpeg…</span></div>
        </div>
      </div>
    </div>
  );
}

function ManualProcessingView() {
  const STEPS = [
    'Uploading video…',
    'Parsing transcript…',
    'Generating SRT file…',
    'Burning subtitles with FFmpeg…',
  ];
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timers = STEPS.map((_, i) => setTimeout(() => setActive(i), i * 3500 + 500));
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="processing-overlay">
      <div className="processing-card">
        <div className="processing-spinner" />
        <h2 className="processing-title">Processing Video</h2>
        <p className="processing-subtitle">This may take a moment…</p>
        <div className="processing-steps">
          {STEPS.map((step, i) => (
            <div key={i} className={`processing-step ${i < active ? 'done' : i === active ? 'active' : ''}`}>
              <span>{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Result View ───────────────────────────────────────────────

function ResultView({ videoUrl, srtContent, processingTime, onReset }) {
  const [showSrt, setShowSrt] = useState(false);

  const dlVideo = () => {
    const a = document.createElement('a');
    a.href     = `${API}${videoUrl}`;
    a.download = 'subtitled_video.mp4';
    a.click();
  };

  const dlSrt = () => {
    const blob = new Blob([srtContent], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'subtitles.srt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="result-section animate-in">
      <div className="result-card">
        <div className="result-header">
          <div className="result-success-icon">✅</div>
          <div className="result-header-text">
            <h3>Video Ready!</h3>
            {processingTime && <p>Processed in {processingTime}</p>}
          </div>
        </div>

        <div className="video-container">
          <video controls preload="metadata" src={`${API}${videoUrl}`}>
            Your browser does not support video playback.
          </video>
        </div>

        <div className="result-actions">
          <button className="btn btn-primary" onClick={dlVideo} id="download-video-btn">
            ⬇ Download Video
          </button>
          {srtContent && (
            <button className="btn btn-outline" onClick={dlSrt} id="download-srt-btn">
              📄 Download SRT
            </button>
          )}
          <button className="btn btn-outline" onClick={onReset} id="process-another-btn">
            🔄 Process Another
          </button>
        </div>
      </div>

      {srtContent && (
        <div className="srt-preview">
          <button className="srt-toggle" onClick={() => setShowSrt(v => !v)}>
            <span className={`srt-arrow ${showSrt ? 'open' : ''}`}>▼</span>
            {showSrt ? 'Hide' : 'Show'} Generated SRT
          </button>
          {showSrt && <pre className="srt-content">{srtContent}</pre>}
        </div>
      )}
    </div>
  );
}

// ── Manual Transcript Preview Table ──────────────────────────

function TranscriptPreview({ subtitles, errors }) {
  if (!subtitles.length && !errors.length) return null;

  return (
    <div className="preview-section">
      {errors.length > 0 && (
        <div className="preview-errors">
          <div className="preview-errors-header">
            ⚠️ {errors.length} parsing error{errors.length > 1 ? 's' : ''}
          </div>
          <ul className="preview-errors-list">
            {errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {subtitles.length > 0 && (
        <div className="preview-table-wrap">
          <div className="preview-header">
            <span className="preview-badge">
              ✅ {subtitles.length} subtitle{subtitles.length > 1 ? 's' : ''} parsed
            </span>
          </div>
          <table className="preview-table">
            <thead>
              <tr><th>#</th><th>Start</th><th>End</th><th>Text</th></tr>
            </thead>
            <tbody>
              {subtitles.map(s => (
                <tr key={s.index}>
                  <td className="preview-index">{s.index}</td>
                  <td className="preview-time">{s.start}</td>
                  <td className="preview-time">{s.end}</td>
                  <td className="preview-text">{s.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────

const MANUAL_PLACEHOLDER = `00:00:00 --> 00:00:03
Hello everyone, welcome to this video.

00:00:03 --> 00:00:07
Today we learn how to add subtitles.

00:00:07 --> 00:00:12
Let's get started right away.`;

export default function App() {
  // ── Mode ──────────────────────────────────────────────────────
  const [mode, setMode] = useState('auto'); // 'auto' | 'manual'

  // ── Auto OCR state ────────────────────────────────────────────
  // autoStep: 'upload' | 'processing' | 'review' | 'burning' | 'result'
  const [autoStep,   setAutoStep]   = useState('upload');
  const [autoFile,   setAutoFile]   = useState(null);
  const [fps,        setFps]        = useState(1);
  const [jobId,      setJobId]      = useState(null);
  const [jobData,    setJobData]    = useState(null);
  const [subtitles,  setSubtitles]  = useState([]);
  const [autoError,  setAutoError]  = useState(null);

  // ── Manual state ──────────────────────────────────────────────
  const [manualFile,       setManualFile]       = useState(null);
  const [transcript,       setTranscript]       = useState('');
  const [manualProcessing, setManualProcessing] = useState(false);
  const [manualError,      setManualError]      = useState(null);
  const [manualParsed,     setManualParsed]     = useState({ subtitles: [], errors: [] });

  // ── Shared appearance ─────────────────────────────────────────
  const [fontSize,   setFontSize]   = useState(26);
  const [fontColor,  setFontColor]  = useState('#FFFFFF');
  const [alignment,  setAlignment]  = useState(2);

  // ── Result ────────────────────────────────────────────────────
  const [result, setResult] = useState(null);

  // ── Refs ──────────────────────────────────────────────────────
  const pollRef     = useRef(null);
  const debounceRef = useRef(null);

  // ── Polling (Auto OCR) ────────────────────────────────────────
  useEffect(() => {
    if (autoStep !== 'processing' || !jobId) return;

    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`${API}/job-status/${jobId}`);
        const data = await res.json();
        setJobData(data);

        if (data.stage === 'done') {
          clearInterval(pollRef.current);
          const subs = (data.subtitles || []).map((s, i) => ({ ...s, id: i }));
          setSubtitles(subs);
          setAutoStep('review');
        } else if (data.stage === 'error') {
          clearInterval(pollRef.current);
          setAutoError(data.error || 'OCR processing failed');
          setAutoStep('upload');
        }
      } catch (err) {
        console.error('Poll error:', err);
      }
    }, 1500);

    return () => clearInterval(pollRef.current);
  }, [autoStep, jobId]);

  // ── Live validation (Manual) ──────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!transcript.trim()) {
      setManualParsed({ subtitles: [], errors: [] });
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const res  = await fetch(`${API}/validate`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ transcript }),
        });
        const data = await res.json();
        setManualParsed({ subtitles: data.subtitles || [], errors: data.errors || [] });
      } catch { /* silent */ }
    }, 600);

    return () => clearTimeout(debounceRef.current);
  }, [transcript]);

  // ── Handlers ──────────────────────────────────────────────────

  async function startAutoOCR() {
    if (!autoFile) return;
    setAutoError(null);
    const form = new FormData();
    form.append('video', autoFile);
    form.append('fps', String(fps));

    try {
      const res  = await fetch(`${API}/auto-process`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start OCR job');
      setJobId(data.jobId);
      setJobData({ stage: 'queued', message: 'Starting…', totalFrames: 0, processedFrames: 0 });
      setAutoStep('processing');
    } catch (err) {
      setAutoError(err.message);
    }
  }

  async function finalize() {
    if (!jobId || !subtitles.length) return;
    setAutoStep('burning');
    setAutoError(null);

    try {
      const res  = await fetch(`${API}/finalize/${jobId}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ subtitles, fontSize, fontColor, alignment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Finalization failed');
      setResult(data);
      setAutoStep('result');
    } catch (err) {
      setAutoError(err.message);
      setAutoStep('review');
    }
  }

  async function handleManualSubmit() {
    if (!manualFile || !transcript.trim() || !manualParsed.subtitles.length) return;
    setManualProcessing(true);
    setManualError(null);

    const form = new FormData();
    form.append('video',     manualFile);
    form.append('transcript', transcript);
    form.append('fontSize',   String(fontSize));
    form.append('fontColor',  fontColor);
    form.append('alignment',  String(alignment));

    try {
      const res  = await fetch(`${API}/process`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.details ? `${data.error}: ${data.details.join(', ')}` : (data.error || 'Processing failed')
        );
      }
      setResult(data);
    } catch (err) {
      setManualError(err.message);
    } finally {
      setManualProcessing(false);
    }
  }

  function resetAll() {
    clearInterval(pollRef.current);
    setMode('auto');
    setAutoStep('upload');
    setAutoFile(null);
    setFps(1);
    setJobId(null);
    setJobData(null);
    setSubtitles([]);
    setAutoError(null);
    setManualFile(null);
    setTranscript('');
    setManualProcessing(false);
    setManualError(null);
    setManualParsed({ subtitles: [], errors: [] });
    setResult(null);
  }

  function switchMode(m) {
    if (autoStep === 'processing' || autoStep === 'burning') return; // lock during processing
    clearInterval(pollRef.current);
    setMode(m);
    setAutoError(null);
    setManualError(null);
    setResult(null);
    if (m === 'auto' && autoStep !== 'upload') setAutoStep('upload');
  }

  // ── Derived state ─────────────────────────────────────────────
  const manualCanSubmit =
    manualFile &&
    manualParsed.subtitles.length > 0 &&
    manualParsed.errors.length === 0 &&
    !manualProcessing;

  let manualBtnText = '🚀 Process Video & Burn Subtitles';
  if (!manualFile)                          manualBtnText = '📁 Upload a Video First';
  else if (!transcript.trim())              manualBtnText = '📝 Enter Timestamped Transcript';
  else if (manualParsed.errors.length > 0)  manualBtnText = '⚠️ Fix Transcript Errors';
  else if (!manualParsed.subtitles.length)  manualBtnText = '📝 Enter Valid Subtitle Blocks';

  const activeError   = mode === 'auto' ? autoError : manualError;
  const inTransit     = autoStep === 'processing' || autoStep === 'burning' || manualProcessing;
  const showModeSwitch = !result && autoStep === 'upload' && !manualProcessing;

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="app">
      {/* ── Header ──────────────────────────────────────────── */}
      <header className="header">
        <div className="header-brand">
          <div className="header-logo">🎬</div>
          <span className="header-title">SubBurner</span>
        </div>
        <span className="header-badge">v2.0</span>
      </header>

      <main className="main-content">
        {/* Hero (hidden when showing result) */}
        {!result && !inTransit && (
          <section className="hero-section animate-in">
            <h1 className="hero-title">
              Generate <span className="gradient-text">Subtitles</span> Automatically
            </h1>
            <p className="hero-subtitle">
              Upload a video and let OCR detect on-screen text — or paste a manual transcript.
              Edit, then burn with FFmpeg.
            </p>
          </section>
        )}

        {/* Error banner */}
        {activeError && (
          <div className="error-banner" role="alert">
            <span className="error-text">⚠️ {activeError}</span>
            <button
              className="error-dismiss"
              onClick={() => mode === 'auto' ? setAutoError(null) : setManualError(null)}
            >✕</button>
          </div>
        )}

        {/* ── Result ────────────────────────────────────────── */}
        {result && (
          <ResultView
            videoUrl={result.videoUrl}
            srtContent={result.srtContent}
            processingTime={result.processingTime}
            onReset={resetAll}
          />
        )}

        {/* ── Main form (hidden when result is shown) ────────── */}
        {!result && (
          <>
            {/* Mode Selector */}
            {showModeSwitch && (
              <div className="mode-selector animate-in">
                <button
                  className={`mode-btn ${mode === 'auto' ? 'active' : ''}`}
                  onClick={() => switchMode('auto')}
                  id="mode-auto-btn"
                >
                  <span className="mode-icon">🔍</span>
                  <div className="mode-text">
                    <span className="mode-label">Auto OCR</span>
                    <span className="mode-sub">Detect text from video frames</span>
                  </div>
                </button>
                <button
                  className={`mode-btn ${mode === 'manual' ? 'active' : ''}`}
                  onClick={() => switchMode('manual')}
                  id="mode-manual-btn"
                >
                  <span className="mode-icon">📝</span>
                  <div className="mode-text">
                    <span className="mode-label">Manual</span>
                    <span className="mode-sub">Paste timestamped transcript</span>
                  </div>
                </button>
              </div>
            )}

            {/* ══ AUTO OCR MODE ══════════════════════════════════ */}
            {mode === 'auto' && (
              <>
                {/* Step 1: Upload */}
                {autoStep === 'upload' && (
                  <div className="animate-in">
                    <div className="card" style={{ marginBottom: '2rem' }}>
                      <div className="card-header">
                        <div className="card-label">Video File</div>
                        <div className="card-sublabel">Upload the video to analyze for text</div>
                      </div>
                      <VideoDropzone
                        file={autoFile}
                        onFileSelect={setAutoFile}
                        onRemove={() => setAutoFile(null)}
                      />
                    </div>

                    <div className="card" style={{ marginBottom: '2rem' }}>
                      <div className="card-header">
                        <div className="card-label">Frame Rate</div>
                        <div className="card-sublabel">Frames analyzed per second — higher is more accurate but slower</div>
                      </div>
                      <div className="fps-options">
                        {[
                          { v: 0.5, l: '0.5 fps', h: 'Fast · coarse' },
                          { v: 1,   l: '1 fps',   h: 'Recommended'  },
                          { v: 2,   l: '2 fps',   h: 'Precise · slow'},
                        ].map(({ v, l, h }) => (
                          <button
                            key={v}
                            className={`fps-btn ${fps === v ? 'active' : ''}`}
                            onClick={() => setFps(v)}
                          >
                            <span className="fps-label">{l}</span>
                            <span className="fps-hint">{h}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="submit-section">
                      <button
                        className="submit-btn"
                        disabled={!autoFile}
                        onClick={startAutoOCR}
                        id="start-ocr-btn"
                      >
                        {autoFile ? '🎯 Start Auto Subtitle Generation' : '📁 Upload a Video to Start'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 2: Processing */}
                {autoStep === 'processing' && <OCRProgressView jobData={jobData} />}

                {/* Step 3: Review & Edit */}
                {autoStep === 'review' && (
                  <div className="animate-in">
                    <div className="review-header">
                      <div>
                        <h2 className="review-title">Review Detected Subtitles</h2>
                        <p className="review-sub">
                          Edit timing or text below, then burn into the video.
                        </p>
                      </div>
                    </div>

                    <SubtitleEditor subtitles={subtitles} setSubtitles={setSubtitles} />

                    <div style={{ marginTop: '2rem' }}>
                      <AppearanceOptions
                        fontSize={fontSize} fontColor={fontColor} alignment={alignment}
                        setFontSize={setFontSize} setFontColor={setFontColor} setAlignment={setAlignment}
                      />
                    </div>

                    <div className="review-actions">
                      <button className="btn btn-outline" onClick={() => setAutoStep('upload')}>
                        ← Back
                      </button>
                      <button
                        className="submit-btn"
                        disabled={!subtitles.length}
                        onClick={finalize}
                        id="burn-btn"
                      >
                        {subtitles.length ? '🔥 Burn Subtitles Into Video' : 'No Subtitles to Burn'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 4: Burning */}
                {autoStep === 'burning' && <BurningView />}
              </>
            )}

            {/* ══ MANUAL MODE ════════════════════════════════════ */}
            {mode === 'manual' && (
              <>
                {manualProcessing && <ManualProcessingView />}

                {!manualProcessing && (
                  <div className="animate-in">
                    <div className="upload-grid">
                      {/* Video upload */}
                      <div className="card">
                        <div className="card-header">
                          <div className="card-label">Video File</div>
                          <div className="card-sublabel">Upload your source video</div>
                        </div>
                        <VideoDropzone
                          file={manualFile}
                          onFileSelect={setManualFile}
                          onRemove={() => setManualFile(null)}
                        />
                      </div>

                      {/* Transcript */}
                      <div className="card">
                        <div className="card-header">
                          <div className="card-label">Timestamped Transcript</div>
                          <div className="card-sublabel">
                            Format: <code>HH:MM:SS --&gt; HH:MM:SS</code> then text on next line
                          </div>
                        </div>
                        <textarea
                          id="transcript-input"
                          className="transcript-textarea"
                          placeholder={MANUAL_PLACEHOLDER}
                          value={transcript}
                          onChange={e => setTranscript(e.target.value)}
                        />
                        <div className="char-count">
                          {transcript.length} characters
                          {manualParsed.subtitles.length > 0 && (
                            <span className="parse-status valid">
                              &nbsp;· {manualParsed.subtitles.length} block{manualParsed.subtitles.length > 1 ? 's' : ''} ✓
                            </span>
                          )}
                          {manualParsed.errors.length > 0 && (
                            <span className="parse-status invalid">
                              &nbsp;· {manualParsed.errors.length} error{manualParsed.errors.length > 1 ? 's' : ''} ✕
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Appearance */}
                    <AppearanceOptions
                      fontSize={fontSize} fontColor={fontColor} alignment={alignment}
                      setFontSize={setFontSize} setFontColor={setFontColor} setAlignment={setAlignment}
                    />

                    {/* Live parse preview */}
                    <TranscriptPreview
                      subtitles={manualParsed.subtitles}
                      errors={manualParsed.errors}
                    />

                    {/* Submit */}
                    <div className="submit-section">
                      <button
                        className="submit-btn"
                        disabled={!manualCanSubmit}
                        onClick={handleManualSubmit}
                        id="submit-btn"
                      >
                        {manualBtnText}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="footer">
        SubBurner v2.0 — Auto OCR + Manual Subtitle Burning · React + Express + FFmpeg + Tesseract.js
      </footer>
    </div>
  );
}
