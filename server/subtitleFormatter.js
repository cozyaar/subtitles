/**
 * Format Whisper word-level timestamps into cinematic subtitle chunks.
 * 
 * Rules:
 * 1. Short chunks (1-3 words preferred, max 5-6).
 * 2. Max duration per chunk ~2.5 seconds.
 * 3. Split on natural pauses (gap > 0.4s).
 * 4. Split on punctuation (. , ! ?).
 */

const { emphasizeText } = require('./subtitleEmphasis');

const p2 = n => String(Math.floor(n)).padStart(2, '0');
const p3 = n => String(Math.floor(n)).padStart(3, '0');

/** Decimal seconds → SRT timestamp HH:MM:SS,mmm */
function secToSRT(s) {
  s = Math.max(0, +s || 0);
  return `${p2(s / 3600)}:${p2((s % 3600) / 60)}:${p2(s % 60)},${p3((s % 1) * 1000)}`;
}

function formatSubtitles(whisperData) {
  const words = whisperData.words;
  if (!words || words.length === 0) {
    // Fallback to segments if words are not available
    if (whisperData.segments) {
      return whisperData.segments.map((seg, i) => {
        return `${secToSRT(seg.start)} --> ${secToSRT(seg.end)}\n${seg.text.trim()}\n`;
      }).join('\n');
    }
    return '';
  }

  const chunks = [];
  let currentChunk = [];
  let currentStart = words[0].start;

  const MAX_WORDS = 5;
  const MAX_DURATION = 2.5;
  const PAUSE_THRESHOLD = 0.4;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    currentChunk.push(word.word);

    const duration = word.end - currentStart;
    const nextWord = words[i + 1];
    const hasPause = nextWord ? (nextWord.start - word.end) > PAUSE_THRESHOLD : false;
    const hasPunctuation = /[.,!?]/.test(word.word);

    const shouldSplit = 
      currentChunk.length >= MAX_WORDS || 
      duration >= MAX_DURATION || 
      hasPause || 
      hasPunctuation;

    if (shouldSplit || !nextWord) {
      chunks.push({
        start: currentStart,
        end: word.end,
        text: currentChunk.join(' ').trim()
      });
      
      if (nextWord) {
        currentChunk = [];
        currentStart = nextWord.start;
      }
    }
  }

  // Convert chunks to SRT-like string format used by SubBurner
  return chunks.map(chunk => {
    const emphasizedText = emphasizeText(chunk.text);
    return `${secToSRT(chunk.start)} --> ${secToSRT(chunk.end)}\n${emphasizedText}\n`;
  }).join('\n');
}

module.exports = {
  formatSubtitles,
};
