import { useState, useRef, useCallback, useEffect } from 'react';
import './App.css';

const API_URL = 'http://localhost:5000';

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const TRANSCRIPT_PLACEHOLDER = `00:00:00 --> 00:00:03
Hello everyone, welcome to this video.

00:00:03 --> 00:00:07
Today we will learn how to add subtitles.

00:00:07 --> 00:00:12
Let's get started with the first step.

00:00:12 --> 00:00:16
Open your browser and navigate to the app.`;

/* ── Video Dropzone ──────────────────────────────────────── */
function VideoDropzone({ file, onFileSelect, onRemove }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped && dropped.type.startsWith('video/')) {
        onFileSelect(dropped);
      }
    },
    [onFileSelect]
  );

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
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            title="Remove file"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`dropzone ${dragOver ? 'drag-over' : ''}`}
      onClick={() => inputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/mov,video/avi,video/mkv,video/webm"
        onChange={(e) => e.target.files[0] && onFileSelect(e.target.files[0])}
      />
      <div className="dropzone-icon">📁</div>
      <div className="dropzone-text">
        Drop your video here or <strong>click to browse</strong>
      </div>
      <div className="dropzone-hint">MP4, MOV, AVI, MKV, WebM — Max 500 MB</div>
    </div>
  );
}

/* ── Parsing Preview Table ───────────────────────────────── */
function ParsingPreview({ subtitles, errors }) {
  if (!subtitles.length && !errors.length) return null;

  return (
    <div className="preview-section">
      {errors.length > 0 && (
        <div className="preview-errors">
          <div className="preview-errors-header">
            <span>⚠️</span>
            <span>
              {errors.length} parsing error{errors.length > 1 ? 's' : ''}
            </span>
          </div>
          <ul className="preview-errors-list">
            {errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {subtitles.length > 0 && (
        <div className="preview-table-wrap">
          <div className="preview-header">
            <span className="preview-badge">✅ {subtitles.length} subtitle{subtitles.length > 1 ? 's' : ''} parsed</span>
          </div>
          <table className="preview-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Start</th>
                <th>End</th>
                <th>Text</th>
              </tr>
            </thead>
            <tbody>
              {subtitles.map((sub) => (
                <tr key={sub.index}>
                  <td className="preview-index">{sub.index}</td>
                  <td className="preview-time">{sub.start}</td>
                  <td className="preview-time">{sub.end}</td>
                  <td className="preview-text">{sub.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Processing Indicator ────────────────────────────────── */
function ProcessingView() {
  const steps = [
    { label: 'Uploading video…', icon: '📤' },
    { label: 'Parsing transcript…', icon: '📝' },
    { label: 'Generating SRT file…', icon: '📄' },
    { label: 'Burning subtitles with FFmpeg…', icon: '🔥' },
  ];

  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const timers = steps.map((_, i) =>
      setTimeout(() => setActiveStep(i), i * 3000 + 500)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="processing-overlay">
      <div className="processing-card">
        <div className="processing-spinner" />
        <h2 className="processing-title">Processing Your Video</h2>
        <p className="processing-subtitle">
          Burning subtitles — this may take a minute depending on video length…
        </p>
        <div className="processing-steps">
          {steps.map((step, i) => (
            <div
              key={i}
              className={`processing-step ${
                i < activeStep ? 'done' : i === activeStep ? 'active' : ''
              }`}
            >
              <span className="step-icon">
                {i < activeStep ? '✓' : step.icon}
              </span>
              <span>{step.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Result View ─────────────────────────────────────────── */
function ResultView({ videoUrl, srtContent, processingTime, onReset }) {
  const [showSrt, setShowSrt] = useState(false);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = `${API_URL}${videoUrl}`;
    a.download = 'subtitled_video.mp4';
    a.click();
  };

  const handleDownloadSrt = () => {
    const blob = new Blob([srtContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'subtitles.srt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="result-section">
      <div className="result-card">
        <div className="result-header">
          <div className="result-header-icon">✅</div>
          <div className="result-header-text">
            <h3>Video Ready!</h3>
            <p>Processed in {processingTime}</p>
          </div>
        </div>

        <div className="video-container">
          <video controls preload="metadata" src={`${API_URL}${videoUrl}`}>
            Your browser does not support video playback.
          </video>
        </div>

        <div className="result-actions">
          <button className="btn btn-primary" onClick={handleDownload} id="download-video-btn">
            ⬇️ Download Video
          </button>
          <button className="btn btn-outline" onClick={handleDownloadSrt} id="download-srt-btn">
            📄 Download SRT
          </button>
          <button className="btn btn-outline" onClick={onReset} id="process-another-btn">
            🔄 Process Another
          </button>
        </div>
      </div>

      {srtContent && (
        <div className="srt-preview">
          <button className="srt-toggle" onClick={() => setShowSrt(!showSrt)}>
            <span className={`srt-toggle-arrow ${showSrt ? 'open' : ''}`}>▼</span>
            {showSrt ? 'Hide' : 'Show'} Generated SRT
          </button>
          {showSrt && <div className="srt-content">{srtContent}</div>}
        </div>
      )}
    </div>
  );
}

/* ── Main App ────────────────────────────────────────────── */
export default function App() {
  const [videoFile, setVideoFile] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Customization State
  const [fontSize, setFontSize] = useState(26);
  const [fontColor, setFontColor] = useState('#FFFFFF');
  const [alignment, setAlignment] = useState(2); // 2=Bottom Center, 5=Middle Center, 8=Top Center

  // Live validation state
  const [parsedPreview, setParsedPreview] = useState({ subtitles: [], errors: [] });
  const debounceRef = useRef(null);

  // ── Live transcript validation (debounced) ──────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!transcript.trim()) {
      setParsedPreview({ subtitles: [], errors: [] });
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/validate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript }),
        });
        const data = await res.json();
        setParsedPreview({
          subtitles: data.subtitles || [],
          errors: data.errors || [],
        });
      } catch {
        // Silently fail on validation — not critical
      }
    }, 600);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [transcript]);

  const canSubmit =
    videoFile &&
    parsedPreview.subtitles.length > 0 &&
    parsedPreview.errors.length === 0 &&
    !processing;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setProcessing(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append('video', videoFile);
    formData.append('transcript', transcript);
    formData.append('fontSize', fontSize.toString());
    formData.append('fontColor', fontColor);
    formData.append('alignment', alignment.toString());

    try {
      const response = await fetch(`${API_URL}/process`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        const errMsg = data.details
          ? `${data.error}: ${data.details.join(', ')}`
          : data.error;
        throw new Error(errMsg || 'Processing failed');
      }

      setResult(data);
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setProcessing(false);
    }
  };

  const handleReset = () => {
    setVideoFile(null);
    setTranscript('');
    setResult(null);
    setError(null);
    setParsedPreview({ subtitles: [], errors: [] });
  };

  // Determine submit button text
  let submitText = '🚀 Process Video & Burn Subtitles';
  if (!videoFile) submitText = '📁 Select a Video to Start';
  else if (!transcript.trim()) submitText = '📝 Enter Timestamped Transcript';
  else if (parsedPreview.errors.length > 0) submitText = '⚠️ Fix Transcript Errors First';
  else if (parsedPreview.subtitles.length === 0) submitText = '📝 Enter Valid Subtitle Blocks';

  return (
    <div className="app">
      {/* ── Header ──────────────────────────────────────────── */}
      <header className="header">
        <div className="header-brand">
          <div className="header-logo">🎬</div>
          <span className="header-title">SubBurner</span>
        </div>
        <span className="header-badge">v1.0</span>
      </header>

      {/* ── Main ────────────────────────────────────────────── */}
      <main className="main-content">
        {/* Hero */}
        <section className="hero-section">
          <h1 className="hero-title">
            Burn <span className="gradient-text">Subtitles</span> Into Your Videos
          </h1>
          <p className="hero-subtitle">
            Upload a video, paste your timestamped transcript, and get a
            professionally subtitled video — powered by FFmpeg.
          </p>
        </section>

        {/* Error Banner */}
        {error && (
          <div className="error-banner" role="alert">
            <span className="error-icon">⚠️</span>
            <span className="error-text">{error}</span>
            <button className="error-dismiss" onClick={() => setError(null)} aria-label="Dismiss error">
              ✕
            </button>
          </div>
        )}

        {/* Processing */}
        {processing && <ProcessingView />}

        {/* Result */}
        {result && !processing && (
          <ResultView
            videoUrl={result.videoUrl}
            srtContent={result.srtContent}
            processingTime={result.processingTime}
            onReset={handleReset}
          />
        )}

        {/* Upload Form */}
        {!processing && !result && (
          <>
            <div className="upload-grid animate-in">
              {/* Video Card */}
              <div className="card">
                <div className="card-header">
                  <div className="card-icon video">🎥</div>
                  <div>
                    <div className="card-label">Video File</div>
                    <div className="card-sublabel">Upload your source video</div>
                  </div>
                </div>
                <VideoDropzone
                  file={videoFile}
                  onFileSelect={setVideoFile}
                  onRemove={() => setVideoFile(null)}
                />
              </div>

              {/* Transcript Card */}
              <div className="card">
                <div className="card-header">
                  <div className="card-icon text">📝</div>
                  <div>
                    <div className="card-label">Timestamped Transcript</div>
                    <div className="card-sublabel">
                      Format: <code>HH:MM:SS --&gt; HH:MM:SS</code> then text
                    </div>
                  </div>
                </div>
                <textarea
                  id="transcript-input"
                  className="transcript-textarea"
                  placeholder={TRANSCRIPT_PLACEHOLDER}
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                />
                <div className="char-count">
                  {transcript.length} characters
                  {parsedPreview.subtitles.length > 0 && (
                    <span className="parse-status valid">
                      &nbsp;· {parsedPreview.subtitles.length} block{parsedPreview.subtitles.length > 1 ? 's' : ''} ✓
                    </span>
                  )}
                  {parsedPreview.errors.length > 0 && (
                    <span className="parse-status invalid">
                      &nbsp;· {parsedPreview.errors.length} error{parsedPreview.errors.length > 1 ? 's' : ''} ✕
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Subtitle Options Panel */}
            <div className="options-panel animate-in" style={{animationDelay: '0.1s'}}>
              <div className="card">
                <div className="card-header">
                  <div className="card-icon" style={{background: 'rgba(253, 203, 110, 0.15)', color: 'var(--warning)'}}>⚙️</div>
                  <div>
                    <div className="card-label">Subtitle Appearance</div>
                    <div className="card-sublabel">Customize how your subtitles look</div>
                  </div>
                </div>
                <div className="options-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                  <div className="option-group">
                    <label className="option-label"><span>🔤</span> Font Size</label>
                    <div className="font-size-control">
                      <input
                        type="range"
                        className="font-slider"
                        min="16"
                        max="72"
                        value={fontSize}
                        onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
                      />
                      <span className="font-value">{fontSize}px</span>
                    </div>
                  </div>

                  <div className="option-group">
                    <label className="option-label"><span>🎨</span> Text Color</label>
                    <div className="color-options" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {[
                        { label: 'White', value: '#FFFFFF' },
                        { label: 'Yellow', value: '#FFFF00' },
                        { label: 'Green', value: '#00FF00' },
                        { label: 'Cyan', value: '#00FFFF' }
                      ].map((c) => (
                        <button
                          key={c.value}
                          className={`color-btn ${fontColor === c.value ? 'active' : ''}`}
                          style={{
                            width: '28px', height: '28px', borderRadius: '50%',
                            backgroundColor: c.value, border: fontColor === c.value ? '2px solid var(--accent)' : '2px solid transparent',
                            cursor: 'pointer', padding: 0
                          }}
                          onClick={() => setFontColor(c.value)}
                          title={c.label}
                        />
                      ))}
                      <input
                        type="color"
                        style={{
                          width: '28px', height: '28px', padding: 0, border: 'none', background: 'none', cursor: 'pointer'
                        }}
                        value={fontColor}
                        onChange={(e) => setFontColor(e.target.value.toUpperCase())}
                        title="Custom Color"
                      />
                    </div>
                  </div>

                  <div className="option-group">
                    <label className="option-label"><span>📐</span> Position</label>
                    <div className="speed-options">
                       <button className={`speed-btn ${alignment === 8 ? 'active' : ''}`} onClick={() => setAlignment(8)}>Top</button>
                       <button className={`speed-btn ${alignment === 5 ? 'active' : ''}`} onClick={() => setAlignment(5)}>Middle</button>
                       <button className={`speed-btn ${alignment === 2 ? 'active' : ''}`} onClick={() => setAlignment(2)}>Bottom</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Parsing Preview */}
            <ParsingPreview
              subtitles={parsedPreview.subtitles}
              errors={parsedPreview.errors}
            />

            {/* Submit */}
            <div className="submit-section">
              <button
                className="submit-btn"
                onClick={handleSubmit}
                disabled={!canSubmit}
                id="submit-btn"
              >
                {submitText}
              </button>
            </div>
          </>
        )}
      </main>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="footer">
        SubBurner — Subtitle Burning Tool · Built with React + Express + FFmpeg
      </footer>
    </div>
  );
}
