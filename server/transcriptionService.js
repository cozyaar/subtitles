const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { exec } = require('child_process');

/**
 * Extract audio from video file using FFmpeg
 * @param {string} videoPath 
 * @param {string} audioPath 
 * @returns {Promise<string>}
 */
function extractAudio(videoPath, audioPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .outputOptions(['-vn', '-acodec', 'libmp3lame', '-q:a', '4']) // Extract audio as MP3
      .output(audioPath)
      .on('end', () => resolve(audioPath))
      .on('error', (err) => reject(err))
      .run();
  });
}

/**
 * Transcribe audio using local Faster-Whisper
 * @param {string} audioPath 
 * @returns {Promise<object>} Transcription result
 */
async function transcribeAudio(audioPath) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'transcribe.py');
    const command = `python "${scriptPath}" "${audioPath}"`;

    console.log(`  Executing: ${command}`);

    // Increase buffer size to 50MB to handle large outputs
    exec(command, { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
      if (error) {
        console.error(`  Python error: ${stderr}`);
        return reject(new Error(`Python script failed: ${stderr || error.message}`));
      }
      try {
        const data = JSON.parse(stdout);
        resolve(data);
      } catch (e) {
        reject(new Error(`Failed to parse Python output: ${e.message}`));
      }
    });
  });
}

module.exports = {
  extractAudio,
  transcribeAudio,
};
