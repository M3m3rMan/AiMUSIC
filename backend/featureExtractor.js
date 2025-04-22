// featureExtractor.js
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { v4 as uuidv4 } from 'uuid';
import { HfInference } from '@huggingface/inference';
import fs from 'fs';
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);
import { existsSync, createReadStream } from 'fs';
import fetch from 'node-fetch';

export async function extractFeatures(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error('File does not exist');
  }

  try {
    const result = await hf.audioClassification({
      model: 'dima806/music_genres_classification',
      data: fs.readFileSync(filePath),
    });

    return result;
    console.log("Audio classification result:", result);
  } catch (err) {
    console.error("HF audio classification failed:", err);
    throw new Error(`HF API error: ${err.message}`);
  }
};

function buildImprovementPrompt(classification, userPrompt) {
  console.log("Building improvement prompt with classification:", classification);
  const topGenres = classification
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(item => `${item.label} (${(item.score * 100).toFixed(1)}%)`)
    .join(', ');

  return `You are a professional music producer.

This track blends elements of: ${topGenres}.

User's question: "${userPrompt}"

Give 3 specific, technical, and actionable suggestions to improve this track. 
Avoid restating the question. Be concise and direct.`;
}


async function generateSuggestion(prompt) {
  try {
    const result = await hf.textGeneration({
      model: 'HuggingFaceH4/zephyr-7b-beta',
      inputs: `<|system|>You are a professional music producer. Answer user requests clearly and use bullet points when needed.<|user|>${prompt}<|assistant|>`,
      parameters: {
        max_new_tokens: 200,
        temperature: 0.7,
        top_p: 0.9,
        repetition_penalty: 1.1
      },
    });

    return extractAssistantReply(result.generated_text);
    function extractAssistantReply(generatedText) {
      const parts = generatedText.split('<|assistant|>');
      return parts[parts.length - 1].trim();
    }    
  } catch (err) {
    console.error("Text generation failed:", err);
    throw err;
  }
}


export { buildImprovementPrompt, generateSuggestion };
// export async function extractFeatures(audioPath, prompt) {
//   try {
//     console.log('Reading file from path:', audioPath);
//     const audioBuffer = await readFileAsync(audioPath);
//     console.log('File size:', audioBuffer.length, 'bytes');
    
//     // Convert the buffer to a Blob-like object that HuggingFace can process
//     const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });
    
//     // Use a different audio classification model that's better suited for general audio analysis
//     const result = await hf.audioClassification({
//       model: 'MIT/ast-finetuned-audioset-10-10-0.4593',
//       data: audioBuffer,
//     });
    
//     return {
//       classification: result,
//       suggestions: `Prompt response based on: "${prompt}"`,
//     };
//   } catch (err) {
//     console.error('Analysis error:', err);
//     throw err;
//   }
// }