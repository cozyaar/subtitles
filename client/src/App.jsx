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

function AppearanceOptions({ 
  fontSize, fontColor, alignment, setFontSize, setFontColor, setAlignment,
  fontName, setFontName, backgroundColor, setBackgroundColor,
  borderStyle, setBorderStyle, outlineWidth, setOutlineWidth, shadowDepth, setShadowDepth,
  boxOpacity, setBoxOpacity
}) {
  const COLORS = [
    { label: 'White',  value: '#FFFFFF' },
    { label: 'Yellow', value: '#FFFF00' },
    { label: 'Green',  value: '#00FF7F' },
    { label: 'Cyan',   value: '#00FFFF' },
  ];

  const FONTS = ['Arial', 'Impact', 'Montserrat', 'Roboto', 'Times New Roman'];

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

        {/* Font Name */}
        <div className="option-group">
          <label className="option-label">Font</label>
          <select
            value={fontName}
            onChange={e => setFontName(e.target.value)}
            className="transcript-textarea"
            style={{ height: 'auto', padding: '0.5rem', width: '100%' }}
          >
            {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>

        {/* Style (Outline vs Box) */}
        <div className="option-group">
          <label className="option-label">Style</label>
          <div className="speed-options">
            {[{v:1,l:'Outline'},{v:3,l:'Opaque Box'}].map(({v,l}) => (
              <button
                key={v}
                className={`speed-btn ${borderStyle === v ? 'active' : ''}`}
                onClick={() => setBorderStyle(v)}
              >{l}</button>
            ))}
          </div>
        </div>

        {/* Background Color */}
        <div className="option-group">
          <label className="option-label">{borderStyle === 1 ? 'Shadow Color' : 'Box Color'}</label>
          <div className="color-options">
            <input
              type="color" value={backgroundColor}
              onChange={e => setBackgroundColor(e.target.value.toUpperCase())}
              title="Custom color"
              className="color-picker-input"
            />
          </div>
        </div>

        {/* Box Opacity (Only for Box style) */}
        {borderStyle === 3 && (
          <div className="option-group">
            <label className="option-label">Box Opacity</label>
            <div className="font-size-control">
              <input
                type="range" className="font-slider"
                min="0" max="100" value={boxOpacity * 100}
                onChange={e => setBoxOpacity(+e.target.value / 100)}
              />
              <span className="font-value">{Math.floor(boxOpacity * 100)}%</span>
            </div>
          </div>
        )}

        {/* Outline Width */}
        <div className="option-group">
          <label className="option-label">Outline Width</label>
          <div className="font-size-control">
            <input
              type="range" className="font-slider"
              min="0" max="10" value={outlineWidth}
              onChange={e => setOutlineWidth(+e.target.value)}
            />
            <span className="font-value">{outlineWidth}px</span>
          </div>
        </div>

        {/* Shadow Depth */}
        <div className="option-group">
          <label className="option-label">Shadow Depth</label>
          <div className="font-size-control">
            <input
              type="range" className="font-slider"
              min="0" max="10" value={shadowDepth}
              onChange={e => setShadowDepth(+e.target.value)}
            />
            <span className="font-value">{shadowDepth}px</span>
          </div>
        </div>

        {/* Live Preview */}
        <div className="option-group" style={{ gridColumn: 'span 2', marginTop: '1rem' }}>
          <label className="option-label">Live Preview</label>
          <div style={{
            background: '#111',
            padding: '2rem',
            borderRadius: '8px',
            border: '1px solid #333',
            display: 'flex',
            justifyContent: alignment === 2 ? 'center' : alignment === 1 ? 'flex-start' : 'flex-end',
            alignItems: 'center',
            minHeight: '100px',
            overflow: 'hidden'
          }}>
            <div style={{
              fontFamily: fontName,
              fontSize: `${fontSize}px`,
              color: fontColor,
              textAlign: alignment === 2 ? 'center' : alignment === 1 ? 'left' : 'right',
              padding: borderStyle === 3 ? '0.4rem 0.8rem' : '0',
              background: borderStyle === 3 ? `${backgroundColor}${Math.floor(boxOpacity * 255).toString(16).padStart(2, '0').toUpperCase()}` : 'transparent',
              borderRadius: '4px',
              fontWeight: 'bold',
              textShadow: borderStyle === 1 
                ? `-${outlineWidth}px -${outlineWidth}px 0 #000, ${outlineWidth}px -${outlineWidth}px 0 #000, -${outlineWidth}px ${outlineWidth}px 0 #000, ${outlineWidth}px ${outlineWidth}px 0 #000`
                : 'none'
            }}>
              Sample Subtitle Text
            </div>
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
  const [mode, setMode] = useState('auto'); // 'auto' | 'manual' | 'audio'
  const [removeWatermark, setRemoveWatermark] = useState(true); // Default enabled for NotebookLM

  // ── Live Edit state ───────────────────────────────────────────
  const [trimStart, setTrimStart] = useState('');
  const [trimEnd, setTrimEnd] = useState('');
  const [cropX, setCropX] = useState('');
  const [cropY, setCropY] = useState('');
  const [cropW, setCropW] = useState('');
  const [cropH, setCropH] = useState('');

  const [cropBox, setCropBox] = useState({ x: 10, y: 10, w: 80, h: 80 }); // Percentages
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDir, setResizeDir] = useState('br');

  const [trimStartPct, setTrimStartPct] = useState(10);
  const [trimEndPct, setTrimEndPct] = useState(90);
  const [isDraggingTrimStart, setIsDraggingTrimStart] = useState(false);
  const [isDraggingTrimEnd, setIsDraggingTrimEnd] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [isCropMode, setIsCropMode] = useState(false); // false = Trim Mode, true = Crop Mode
  const [hasCustomCrop, setHasCustomCrop] = useState(false);

  const formatTime = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  useEffect(() => {
    const handleWindowMouseMove = (e) => {
      if (isDraggingCrop) {
        const videoEl = document.getElementById('live-edit-video');
        if (!videoEl) return;
        const rect = videoEl.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        
        setCropBox(prev => {
          const newX = Math.max(0, Math.min(100 - prev.w, x - prev.w / 2));
          const newY = Math.max(0, Math.min(100 - prev.h, y - prev.h / 2));
          setHasCustomCrop(true);
          return { ...prev, x: newX, y: newY };
        });
      } else if (isResizing && resizeDir === 'br') {
        const videoEl = document.getElementById('live-edit-video');
        if (!videoEl) return;
        const rect = videoEl.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        
        setCropBox(prev => {
          const newW = Math.max(10, Math.min(100 - prev.x, x - prev.x));
          const newH = Math.max(10, Math.min(100 - prev.y, y - prev.y));
          setHasCustomCrop(true);
          return { ...prev, w: newW, h: newH };
        });
      } else if (isDraggingTrimStart || isDraggingTrimEnd) {
        const timelineEl = document.getElementById('timeline-bar');
        if (!timelineEl) return;
        const rect = timelineEl.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        
        const videoEl = document.getElementById('live-edit-video');
        
        if (isDraggingTrimStart) {
          const val = Math.max(0, Math.min(trimEndPct - 5, x));
          setTrimStartPct(val);
          if (videoEl && videoEl.duration) {
            videoEl.currentTime = (val / 100) * videoEl.duration;
          }
        } else if (isDraggingTrimEnd) {
          const val = Math.max(trimStartPct + 5, Math.min(100, x));
          setTrimEndPct(val);
          if (videoEl && videoEl.duration) {
            videoEl.currentTime = (val / 100) * videoEl.duration;
          }
        }
      }
    };

    const handleWindowMouseUp = () => {
      setIsDraggingCrop(false);
      setIsResizing(false);
      setIsDraggingTrimStart(false);
      setIsDraggingTrimEnd(false);
    };

    if (isDraggingCrop || isResizing || isDraggingTrimStart || isDraggingTrimEnd) {
      window.addEventListener('mousemove', handleWindowMouseMove);
      window.addEventListener('mouseup', handleWindowMouseUp);
      
      // Pause video if cropping
      if (isDraggingCrop || isResizing) {
        const videoEl = document.getElementById('live-edit-video');
        if (videoEl) videoEl.pause();
      }
    }

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [isDraggingCrop, isResizing, isDraggingTrimStart, isDraggingTrimEnd, resizeDir, trimStartPct, trimEndPct]);

  // ── Subtitle Styling state ────────────────────────────────────
  const [fontName, setFontName] = useState('Arial');
  const [backgroundColor, setBackgroundColor] = useState('#000000');
  const [boxOpacity, setBoxOpacity] = useState(0.8);
  const [borderStyle, setBorderStyle] = useState(1); // 1 = Outline, 3 = Box
  const [outlineWidth, setOutlineWidth] = useState(2);
  const [shadowDepth, setShadowDepth] = useState(0);

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

  async function startAutoAudio() {
    if (!manualFile) return;
    setAutoError(null);
    setAutoStep('processing');
    
    const form = new FormData();
    form.append('video', manualFile);

    try {
      const res  = await fetch(`${API}/transcribe`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to transcribe audio');
      
      setTranscript(data.transcript);
      setAutoStep('upload');
    } catch (err) {
      setAutoError(err.message);
      setAutoStep('upload');
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
        body:    JSON.stringify({ 
          subtitles, fontSize, fontColor, alignment,
          fontName, backgroundColor, borderStyle, outlineWidth, shadowDepth, boxOpacity 
        }),
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
    form.append('removeWatermark', String(removeWatermark));
    form.append('trimStart', trimStart);
    form.append('trimEnd', trimEnd);
    form.append('fontName', fontName);
    form.append('backgroundColor', backgroundColor);
    form.append('borderStyle', String(borderStyle));
    form.append('outlineWidth', String(outlineWidth));
    form.append('shadowDepth', String(shadowDepth));
    form.append('boxOpacity', String(boxOpacity));
    form.append('cropX', cropX);
    form.append('cropY', cropY);
    form.append('cropW', cropW);
    form.append('cropH', cropH);

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
                  className={`mode-btn ${mode === 'audio' ? 'active' : ''}`}
                  onClick={() => switchMode('audio')}
                  id="mode-audio-btn"
                >
                  <span className="mode-icon">🎙️</span>
                  <div className="mode-text">
                    <span className="mode-label">Auto Audio</span>
                    <span className="mode-sub">Transcribe spoken audio</span>
                  </div>
                </button>
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
                <button
                  className={`mode-btn ${mode === 'live' ? 'active' : ''}`}
                  onClick={() => switchMode('live')}
                  id="mode-live-btn"
                >
                  <span className="mode-icon">✂️</span>
                  <div className="mode-text">
                    <span className="mode-label">Live Edit</span>
                    <span className="mode-sub">Visual trim & crop</span>
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
                        fontName={fontName} setFontName={setFontName}
                        backgroundColor={backgroundColor} setBackgroundColor={setBackgroundColor}
                        borderStyle={borderStyle} setBorderStyle={setBorderStyle}
                        outlineWidth={outlineWidth} setOutlineWidth={setOutlineWidth}
                        shadowDepth={shadowDepth} setShadowDepth={setShadowDepth}
                        boxOpacity={boxOpacity} setBoxOpacity={setBoxOpacity}
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

            {/* ══ AUTO AUDIO MODE ══════════════════════════════════ */}
            {mode === 'audio' && (
              <>
                {autoStep === 'processing' && (
                  <div className="processing-overlay">
                    <div className="processing-card">
                      <div className="processing-spinner" />
                      <h2 className="processing-title">Transcribing Audio</h2>
                      <p className="processing-subtitle">Extracting audio and running Whisper…</p>
                    </div>
                  </div>
                )}

                {autoStep === 'upload' && (
                  <div className="animate-in">
                    <div className="upload-grid">
                      {/* Video upload */}
                      <div className="card">
                        <div className="card-header">
                          <div className="card-label">Video File</div>
                          <div className="card-sublabel">Upload video for transcription</div>
                        </div>
                        <VideoDropzone
                          file={manualFile}
                          onFileSelect={setManualFile}
                          onRemove={() => setManualFile(null)}
                        />
                      </div>

                      {/* Transcript or Generate Button */}
                      <div className="card">
                        <div className="card-header">
                          <div className="card-label">Transcript</div>
                          <div className="card-sublabel">Generated or manual subtitles</div>
                        </div>
                        
                        {!transcript && (
                          <div className="generate-placeholder">
                            <button
                              className="submit-btn"
                              disabled={!manualFile}
                              onClick={startAutoAudio}
                              id="generate-subtitles-btn"
                            >
                              {manualFile ? '🎙️ Generate Subtitles' : '📁 Upload a Video First'}
                            </button>
                          </div>
                        )}

                        {transcript && (
                          <>
                            <textarea
                              id="transcript-input-audio"
                              className="transcript-textarea"
                              placeholder="Generated subtitles will appear here…"
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
                            </div>
                          </>
                        )}
                      </div>

                      {/* ✂️ Live Edit Card */}
                      <div className="card">
                        <div className="card-header">
                          <div className="card-label">✂️ Live Edit</div>
                          <div className="card-sublabel">Trim and Crop video</div>
                        </div>
                        
                        <div style={{ marginBottom: '1rem' }}>
                          <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Trim</div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                              type="text"
                              placeholder="Start (00:00:00)"
                              value={trimStart}
                              onChange={e => setTrimStart(e.target.value)}
                              className="transcript-textarea"
                              style={{ height: 'auto', padding: '0.5rem' }}
                            />
                            <input
                              type="text"
                              placeholder="End (00:00:10)"
                              value={trimEnd}
                              onChange={e => setTrimEnd(e.target.value)}
                              className="transcript-textarea"
                              style={{ height: 'auto', padding: '0.5rem' }}
                            />
                          </div>
                        </div>

                        <div>
                          <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Crop</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                            <input
                              type="number"
                              placeholder="X"
                              value={cropX}
                              onChange={e => setCropX(e.target.value)}
                              className="transcript-textarea"
                              style={{ height: 'auto', padding: '0.5rem' }}
                            />
                            <input
                              type="number"
                              placeholder="Y"
                              value={cropY}
                              onChange={e => setCropY(e.target.value)}
                              className="transcript-textarea"
                              style={{ height: 'auto', padding: '0.5rem' }}
                            />
                            <input
                              type="number"
                              placeholder="Width"
                              value={cropW}
                              onChange={e => setCropW(e.target.value)}
                              className="transcript-textarea"
                              style={{ height: 'auto', padding: '0.5rem' }}
                            />
                            <input
                              type="number"
                              placeholder="Height"
                              value={cropH}
                              onChange={e => setCropH(e.target.value)}
                              className="transcript-textarea"
                              style={{ height: 'auto', padding: '0.5rem' }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Watermark Removal Section */}
                    <div className="card" style={{ marginTop: '2rem' }}>
                      <div className="card-header">
                        <div className="card-label">🧼 Watermark Removal</div>
                        <div className="card-sublabel">Remove static NotebookLM watermark from bottom-right</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={removeWatermark}
                            onChange={e => setRemoveWatermark(e.target.checked)}
                            style={{ width: '1.2rem', height: '1.2rem' }}
                          />
                          <span>Remove NotebookLM Watermark</span>
                        </label>
                      </div>
                      
                      {removeWatermark && (
                        <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#888' }}>
                          Default coordinates for 1920x1080: x=1615, y=965, w=250, h=70
                        </div>
                      )}
                    </div>

                    {transcript && (
                      <div style={{ marginTop: '2rem' }}>
                        <AppearanceOptions
                          fontSize={fontSize} fontColor={fontColor} alignment={alignment}
                          setFontSize={setFontSize} setFontColor={setFontColor} setAlignment={setAlignment}
                          fontName={fontName} setFontName={setFontName}
                          backgroundColor={backgroundColor} setBackgroundColor={setBackgroundColor}
                          borderStyle={borderStyle} setBorderStyle={setBorderStyle}
                          outlineWidth={outlineWidth} setOutlineWidth={setOutlineWidth}
                          shadowDepth={shadowDepth} setShadowDepth={setShadowDepth}
                          boxOpacity={boxOpacity} setBoxOpacity={setBoxOpacity}
                        />
                      </div>
                    )}

                    <div className="submit-section" style={{ marginTop: '2rem' }}>
                      <button
                        className="submit-btn"
                        disabled={!manualFile || !transcript.trim() || manualParsed.errors.length > 0}
                        onClick={handleManualSubmit}
                        id="burn-audio-btn"
                      >
                        {manualFile ? '🔥 Burn Subtitles Into Video' : '📁 Upload a Video First'}
                      </button>
                    </div>
                  </div>
                )}
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

                      {/* Video Player in Manual Mode for Preview */}
                      {manualFile && (
                        <div className="card" style={{ marginTop: '2rem' }}>
                          <div className="card-header">
                            <div className="card-label">📺 Subtitle Preview</div>
                            <div className="card-sublabel">See how subtitles look on the video</div>
                          </div>
                          <div style={{ position: 'relative', width: '100%', maxWidth: '640px', margin: '0 auto' }}>
                            <video 
                              id="manual-preview-video"
                              src={URL.createObjectURL(manualFile)}
                              controls
                              style={{ width: '100%', borderRadius: '8px', display: 'block' }}
                            />
                            {/* Subtitle Overlay */}
                            <div style={{
                              position: 'absolute',
                              bottom: '10%',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              width: '80%',
                              textAlign: alignment === 2 ? 'center' : alignment === 1 ? 'left' : 'right',
                              pointerEvents: 'none'
                            }}>
                              <span style={{
                                fontFamily: fontName,
                                fontSize: `${fontSize}px`,
                                color: fontColor,
                                padding: borderStyle === 3 ? '0.4rem 0.8rem' : '0',
                                background: borderStyle === 3 ? `${backgroundColor}${Math.floor(boxOpacity * 255).toString(16).padStart(2, '0').toUpperCase()}` : 'transparent',
                                borderRadius: '4px',
                                fontWeight: 'bold',
                                textShadow: borderStyle === 1 
                                  ? `-${outlineWidth}px -${outlineWidth}px 0 #000, ${outlineWidth}px -${outlineWidth}px 0 #000, -${outlineWidth}px ${outlineWidth}px 0 #000, ${outlineWidth}px ${outlineWidth}px 0 #000`
                                  : 'none'
                              }}>
                                Sample Subtitle Text
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

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

                    {/* Watermark Removal Section */}
                    <div className="card" style={{ marginTop: '2rem' }}>
                      <div className="card-header">
                        <div className="card-label">🧼 Watermark Removal</div>
                        <div className="card-sublabel">Remove static NotebookLM watermark from bottom-right</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={removeWatermark}
                            onChange={e => setRemoveWatermark(e.target.checked)}
                            style={{ width: '1.2rem', height: '1.2rem' }}
                          />
                          <span>Remove NotebookLM Watermark</span>
                        </label>
                      </div>
                      
                      {removeWatermark && (
                        <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#888' }}>
                          Default coordinates for 1920x1080: x=1615, y=965, w=250, h=70
                        </div>
                      )}
                    </div>

                    {/* Appearance */}
                    <AppearanceOptions
                      fontSize={fontSize} fontColor={fontColor} alignment={alignment}
                      setFontSize={setFontSize} setFontColor={setFontColor} setAlignment={setAlignment}
                      fontName={fontName} setFontName={setFontName}
                      backgroundColor={backgroundColor} setBackgroundColor={setBackgroundColor}
                      borderStyle={borderStyle} setBorderStyle={setBorderStyle}
                      outlineWidth={outlineWidth} setOutlineWidth={setOutlineWidth}
                      shadowDepth={shadowDepth} setShadowDepth={setShadowDepth}
                      boxOpacity={boxOpacity} setBoxOpacity={setBoxOpacity}
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

            {/* ══ LIVE EDIT MODE ════════════════════════════════════ */}
            {mode === 'live' && (
              <div className="animate-in">
                {!manualFile ? (
                  <div className="card">
                    <div className="card-header">
                      <div className="card-label">Upload Video</div>
                      <div className="card-sublabel">Select a video to edit</div>
                    </div>
                    <VideoDropzone 
                      file={manualFile} 
                      onFileSelect={setManualFile} 
                      onRemove={() => setManualFile(null)} 
                    />
                  </div>
                ) : (
                  <div className="card">
                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div className="card-label">✂️ Live Edit</div>
                        <div className="card-sublabel">Visual Trim and Crop</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.85rem', color: '#aaa' }}>{isCropMode ? 'Crop Mode' : 'Trim Mode'}</span>
                        <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '40px', height: '20px' }}>
                          <input 
                            type="checkbox" 
                            checked={isCropMode} 
                            onChange={e => setIsCropMode(e.target.checked)}
                            style={{ opacity: 0, width: 0, height: 0 }}
                          />
                          <span style={{
                            position: 'absolute',
                            cursor: 'pointer',
                            top: 0, left: 0, right: 0, bottom: 0,
                            background: isCropMode ? '#00FF7F' : '#007bff',
                            transition: '.4s',
                            borderRadius: '20px'
                          }}>
                            <span style={{
                              position: 'absolute',
                              height: '16px', 
                              width: '16px',
                              left: isCropMode ? '22px' : '2px',
                              bottom: '2px',
                              background: '#fff',
                              transition: '.4s',
                              borderRadius: '50%',
                              display: 'block'
                            }} />
                          </span>
                        </label>
                      </div>
                    </div>
                    
                    <div style={{ position: 'relative', width: '100%', maxWidth: '640px', margin: '0 auto' }}>
                      <video 
                        id="live-edit-video"
                        controls 
                        style={{ width: '100%', display: 'block' }}
                        src={manualFile ? URL.createObjectURL(manualFile) : ''}
                        onLoadedMetadata={e => setVideoDuration(e.target.duration)}
                      />
                      {/* Visual Crop Overlay */}
                      {isCropMode && (
                        <div 
                          style={{
                            position: 'absolute',
                            top: `${cropBox.y}%`,
                            left: `${cropBox.x}%`,
                            width: `${cropBox.w}%`,
                            height: `${cropBox.h}%`,
                            border: '2px dashed #00FF7F',
                            boxSizing: 'border-box',
                            cursor: 'move',
                            background: 'rgba(0, 255, 127, 0.1)'
                          }}
                          onMouseDown={e => {
                            if (e.target.className.includes('resize-handle')) return;
                            e.preventDefault();
                            setIsDraggingCrop(true);
                          }}
                        >
                          <div style={{ position: 'absolute', top: 0, left: 0, background: '#00FF7F', color: '#000', fontSize: '0.8rem', padding: '0.2rem' }}>Crop Area</div>
                          
                          {/* Bottom-Right Handle for Resizing */}
                          <div 
                            className="resize-handle"
                            style={{ 
                              position: 'absolute', 
                              bottom: -5, 
                              right: -5, 
                              width: 10, 
                              height: 10, 
                              background: '#fff', 
                              border: '1px solid #00FF7F', 
                              cursor: 'nwse-resize' 
                            }} 
                            onMouseDown={e => { 
                              e.stopPropagation(); 
                              setIsResizing(true); 
                              setResizeDir('br'); 
                            }} 
                          />
                        </div>
                      )}
                    </div>

                    {/* Video Timeline Overlay */}
                    {!isCropMode && (
                      <div style={{ marginTop: '2.5rem', padding: '0 1rem' }}>
                        <label style={{ fontSize: '0.85rem', color: '#aaa', display: 'block', marginBottom: '1rem' }}>Timeline Trim</label>
                        <div 
                          id="timeline-bar"
                          style={{ 
                            position: 'relative', 
                            width: '100%', 
                            height: '40px', 
                            background: '#1a1a1a', 
                            borderRadius: '4px',
                            overflow: 'visible', /* Allow labels to float above */
                            border: '1px solid #333'
                          }}
                        >
                          {/* Active Area */}
                          <div style={{ 
                            position: 'absolute', 
                            left: `${trimStartPct}%`, 
                            width: `${trimEndPct - trimStartPct}%`, 
                            height: '100%', 
                            background: 'rgba(0, 255, 127, 0.2)',
                            borderLeft: '2px solid #00FF7F',
                            borderRight: '2px solid #00FF7F'
                          }} />
                          
                          {/* Floating Time Labels */}
                          <div 
                            style={{ 
                              position: 'absolute', 
                              left: `${trimStartPct}%`, 
                              top: '-25px', 
                              transform: 'translateX(-50%)',
                              fontSize: '0.75rem',
                              color: '#00FF7F',
                              background: '#1a1a1a',
                              padding: '0.1rem 0.3rem',
                              borderRadius: '2px',
                              border: '1px solid #333',
                              whiteSpace: 'nowrap',
                              cursor: 'pointer'
                            }}
                            onClick={() => document.getElementById('trim-start-input').focus()}
                          >
                            {formatTime((trimStartPct / 100) * videoDuration)}
                          </div>
                          
                          <div 
                            style={{ 
                              position: 'absolute', 
                              left: `${trimEndPct}%`, 
                              top: '-25px', 
                              transform: 'translateX(-50%)',
                              fontSize: '0.75rem',
                              color: '#00FF7F',
                              background: '#1a1a1a',
                              padding: '0.1rem 0.3rem',
                              borderRadius: '2px',
                              border: '1px solid #333',
                              whiteSpace: 'nowrap',
                              cursor: 'pointer'
                            }}
                            onClick={() => document.getElementById('trim-end-input').focus()}
                          >
                            {formatTime((trimEndPct / 100) * videoDuration)}
                          </div>
                          
                          {/* Trim Handles */}
                          <div 
                            style={{ 
                              position: 'absolute', 
                              left: `${trimStartPct}%`, 
                              width: '16px', 
                              height: '100%', 
                              background: '#00FF7F', 
                              cursor: 'col-resize',
                              transform: 'translateX(-50%)',
                              zIndex: 10
                            }}
                            onMouseDown={e => { e.stopPropagation(); setIsDraggingTrimStart(true); }}
                          />
                          <div 
                            style={{ 
                              position: 'absolute', 
                              left: `${trimEndPct}%`, 
                              width: '16px', 
                              height: '100%', 
                              background: '#00FF7F', 
                              cursor: 'col-resize',
                              transform: 'translateX(-50%)',
                              zIndex: 10
                            }}
                            onMouseDown={e => { e.stopPropagation(); setIsDraggingTrimEnd(true); }}
                          />
                          
                          {/* Mock Thumbnails */}
                          <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', height: '100%', opacity: 0.3 }}>
                            <span>🎞️</span><span>🎞️</span><span>🎞️</span><span>🎞️</span>
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#888', marginTop: '0.25rem' }}>
                          <span>{trimStartPct.toFixed(0)}%</span>
                          <span>{trimEndPct.toFixed(0)}%</span>
                        </div>
                      </div>
                    )}

                    {/* Precision Inputs */}
                    <div className="options-panel" style={{ marginTop: '1rem' }}>
                      <div className="options-grid">
                        <div className="option-group">
                          <label className="option-label">Trim Start</label>
                          <input id="trim-start-input" type="text" value={trimStart} onChange={e => setTrimStart(e.target.value)} className="transcript-textarea" style={{ height: 'auto', padding: '0.5rem' }} placeholder="00:00:00" />
                        </div>
                        <div className="option-group">
                          <label className="option-label">Trim End</label>
                          <input id="trim-end-input" type="text" value={trimEnd} onChange={e => setTrimEnd(e.target.value)} className="transcript-textarea" style={{ height: 'auto', padding: '0.5rem' }} placeholder="00:00:10" />
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="submit-section" style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
                      <button
                        className="submit-btn"
                        style={{ background: '#333', color: '#fff' }}
                        onClick={() => {
                          const videoEl = document.getElementById('live-edit-video');
                          if (!videoEl) return;
                          
                          // Convert Trim Pct to Time Strings
                          const duration = videoEl.duration || 0;
                          const startSec = (trimStartPct / 100) * duration;
                          const endSec = (trimEndPct / 100) * duration;
                          
                          const formatTime = (s) => {
                            const h = Math.floor(s / 3600);
                            const m = Math.floor((s % 3600) / 60);
                            const sec = Math.floor(s % 60);
                            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
                          };
                          
                          setTrimStart(formatTime(startSec));
                          setTrimEnd(formatTime(endSec));
                          
                          // Convert Crop Box Pct to Pixels if customized
                          if (hasCustomCrop) {
                            const actualW = videoEl.videoWidth;
                            const actualH = videoEl.videoHeight;
                            
                            setCropX(String(Math.floor((cropBox.x / 100) * actualW)));
                            setCropY(String(Math.floor((cropBox.y / 100) * actualH)));
                            setCropW(String(Math.floor((cropBox.w / 100) * actualW)));
                            setCropH(String(Math.floor((cropBox.h / 100) * actualH)));
                          } else {
                            setCropX('');
                            setCropY('');
                            setCropW('');
                            setCropH('');
                          }
                          
                          alert('Edits applied! You can now switch to Audio or Manual mode to process.');
                        }}
                      >
                        💾 Save Edits
                      </button>
                      
                      <button
                        className="submit-btn"
                        onClick={async () => {
                          const videoEl = document.getElementById('live-edit-video');
                          if (!videoEl) return;
                          
                          const duration = videoEl.duration || 0;
                          const startSec = (trimStartPct / 100) * duration;
                          const endSec = (trimEndPct / 100) * duration;
                          
                          const formatTime = (s) => {
                            const h = Math.floor(s / 3600);
                            const m = Math.floor((s % 3600) / 60);
                            const sec = Math.floor(s % 60);
                            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
                          };
                          
                          const actualW = videoEl.videoWidth;
                          const actualH = videoEl.videoHeight;
                          
                          const form = new FormData();
                          form.append('video', manualFile);
                          form.append('trimStart', formatTime(startSec));
                          form.append('trimEnd', formatTime(endSec));
                          
                          if (hasCustomCrop) {
                            form.append('cropX', String(Math.floor((cropBox.x / 100) * actualW)));
                            form.append('cropY', String(Math.floor((cropBox.y / 100) * actualH)));
                            form.append('cropW', String(Math.floor((cropBox.w / 100) * actualW)));
                            form.append('cropH', String(Math.floor((cropBox.h / 100) * actualH)));
                          }
                          
                          setManualProcessing(true);
                          
                          try {
                            const res = await fetch('http://localhost:5000/edit-only', {
                              method: 'POST',
                              body: form
                            });
                            const data = await res.json();
                            if (data.error) throw new Error(data.error);
                            
                            // Trigger automatic download
                            const a = document.createElement('a');
                            a.href = `http://localhost:5000${data.videoUrl}`;
                            a.download = 'edited_video.mp4';
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);

                            setResult({
                              videoUrl: data.videoUrl, // Fix: don't double include domain
                              srtContent: '',
                              processingTime: data.processingTime
                            });
                          } catch (err) {
                            alert(`Failed: ${err.message}`);
                          } finally {
                            setManualProcessing(false);
                          }
                        }}
                      >
                        ✂️ Process & Download
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
