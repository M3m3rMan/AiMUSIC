// Add this import at the top
import path from 'path';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';

export async function convertToWav(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      // Validate input file
      if (!fs.existsSync(inputPath)) {
        throw new Error(`Input file not found: ${inputPath}`);
      }

      const stats = fs.statSync(inputPath);
      if (stats.size === 0) {
        throw new Error('Input file is empty');
      }

      // Create output directory if it doesn't exist
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      ffmpeg(inputPath)
        .audioChannels(1)
        .audioFrequency(16000)
        .audioCodec('pcm_s16le')
        .output(outputPath)
        .on('end', () => {
          // Verify conversion was successful
          if (!fs.existsSync(outputPath)) {
            reject(new Error('Conversion failed - no output file created'));
            return;
          }
          if (fs.statSync(outputPath).size === 0) {
            reject(new Error('Conversion failed - empty output file'));
            return;
          }
          resolve(outputPath);
        })
        .on('error', (err) => {
          console.error('FFmpeg conversion error:', err);
          reject(new Error(`Audio conversion failed: ${err.message}`));
        })
        .run();
    } catch (err) {
      reject(err);
    }
  });
}