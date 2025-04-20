import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';

// Function to convert audio to 16kHz mono WAV
export const convertToWav = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioChannels(1)
      .audioFrequency(16000)
      .format('wav')
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .save(outputPath);
  });
};