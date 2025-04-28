import { HfInference } from '@huggingface/inference';
import fs from 'fs/promises';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { v4 as uuidv4 } from 'uuid';
import { classifyAudio } from './modelLoader.js';

const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

// Audio conversion helper
async function convertToWav(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioChannels(1)
      .audioFrequency(16000)
      .toFormat('wav')
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .save(outputPath);
  });
}

export async function extractFeatures(filePath) {
  try {
    // 1. Verify file exists
    // await fs.access(filePath);

    // // 2. Convert to standard format
    // const wavPath = path.join(path.dirname(filePath), `${uuidv4()}.wav`);
    // await new Promise((resolve, reject) => {
    //   ffmpeg(filePath)
    //     .audioChannels(1)
    //     .audioFrequency(16000)
    //     .toFormat('wav')
    //     .on('end', () => resolve(wavPath))
    //     .on('error', reject)
    //     .save(wavPath);
    // });

    // 3. Classify audio
    const results = await classifyAudio(filePath);

    console.log("Classification results:", results);

    // 4. Clean up
    // await fs.unlink(filePath);

    return results;

  } catch (err) {
    console.error("Feature extraction failed:", err);
    throw new Error(`Audio analysis error: ${err.message}`);
  }
}

// Properly exported prompt builder
export function buildImprovementPrompt(classificationResults) {
  const topGenres = classificationResults
    .map(item => `${item.label} (${Math.round(item.score * 100)}%)`)
    .join(', ');

  return `Analyze this music track with these characteristics and provide the answer in a Markdown format:
  Primary Genres: ${topGenres}

  Provide 1-3 specific production suggestions focusing on:
  - Mixing improvements
  - Sound design enhancements
  - Arrangement adjustments
  - Recommended effects processing
  - Reference tracks for inspiration`;
}

// Add this if you need direct suggestion generation
export async function generateSuggestions(prompt) {
  try {
    const response = await hf.textGeneration({
      model: 'mistralai/Mistral-7B-Instruct-v0.1',
      inputs: prompt,
      parameters: {
        max_new_tokens: 500,
        temperature: 0.7
      }
    });
    return response.generated_text;
  } catch (err) {
    console.error("Suggestion generation failed:", err);
    throw err;
  }
}