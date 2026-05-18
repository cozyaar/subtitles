const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

/**
 * Remove watermark using FFmpeg delogo filter
 * @param {string} inputPath 
 * @param {string} outputPath 
 * @param {object} options { x, y, w, h, band }
 * @returns {Promise<string>}
 */
function removeWatermark(inputPath, outputPath, options = {}) {
  const {
    x = 1615,
    y = 965,
    w = 250,
    h = 70
  } = options;

  const filter = `delogo=x=${x}:y=${y}:w=${w}:h=${h}:show=0`;

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoFilters(filter)
      .output(outputPath)
      .on('end', () => {
        console.log(`  ✅ Watermark removed: ${outputPath}`);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('  ❌ Delogo error:', err.message);
        reject(err);
      })
      .run();
  });
}

module.exports = {
  removeWatermark,
};
