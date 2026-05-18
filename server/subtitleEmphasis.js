/**
 * Subtitle Emphasis Engine
 * Selectively highlights emotionally and psychologically important words.
 * Optimized for cinematic pacing and high retention without feeling chaotic.
 */

const EMOTIONAL_WORDS = new Set([
  'exhausted', 'overwhelmed', 'drained', 'anxious', 'trapped', 'distracted', 'restless',
  'tired', 'lonely', 'scared', 'afraid', 'angry', 'sad', 'depressed', 'hopeless'
]);

const PSYCHOLOGICAL_WORDS = new Set([
  'brain', 'attention', 'focus', 'memory', 'stimulation', 'dopamine', 'overload',
  'mind', 'subconscious', 'conscious', 'thought', 'thinking', 'mental'
]);

const CONTRAST_WORDS = new Set([
  'but', 'yet', 'still', 'somehow', 'never', 'always', 'rarely', 'suddenly'
]);

const ACTION_WORDS = new Set([
  'destroying', 'stealing', 'fragmenting', 'draining', 'overstimulating',
  'broken', 'healing', 'building', 'growing', 'changing'
]);

const RECOGNITION_WORDS = new Set([
  'you', 'your', 'everyone', 'we', 'us', 'they'
]);

const ALL_WORDS = new Set([
  ...EMOTIONAL_WORDS,
  ...PSYCHOLOGICAL_WORDS,
  ...CONTRAST_WORDS,
  ...ACTION_WORDS,
  ...RECOGNITION_WORDS
]);

/**
 * Emphasize words in a subtitle chunk.
 * Limits emphasis to max 2 words per chunk to preserve readability.
 * @param {string} text 
 * @returns {string}
 */
function emphasizeText(text) {
  const words = text.split(' ');
  let emphasizedCount = 0;
  const MAX_EMPHASIS = 2; // Keep it cinematic and calm

  const processedWords = words.map(word => {
    // Strip punctuation for matching
    const cleanWord = word.toLowerCase().replace(/[.,!?]/g, '');
    
    if (ALL_WORDS.has(cleanWord) && emphasizedCount < MAX_EMPHASIS) {
      emphasizedCount++;
      // Uppercase for emphasis as requested
      // Preserve punctuation attached to the word
      return word.toUpperCase();
    }
    return word;
  });

  return processedWords.join(' ');
}

module.exports = {
  emphasizeText,
};
