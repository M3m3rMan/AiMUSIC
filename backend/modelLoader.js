import wav from "wav-decoder"; // Install this library: npm install wav-decoder
import { pipeline } from "@huggingface/transformers";
import fs from "fs";


// import { pipeline } from '@xenova/transformers';

// class AudioClassifier {
//   static task = 'audio-classification';
//   // Using a known working model configuration
//   static model = {
//     name: 'dima806/music_genres_classification',
//     revision: 'main',
//     config: {
//       model_type: 'audio-classification',
//       feature_extractor_type: 'Wav2Vec2FeatureExtractor'
//     }
//   };
//   static instance = null;

//   static async getInstance() {
//     if (this.instance === null) {
//       try {
//         this.instance = await pipeline(this.task, this.model.name, {
//           revision: this.model.revision,
//           quantized: true,
//           progress_callback: (data) => {
//             if (data.total > 0) {
//               console.log(`Download progress: ${Math.round(data.loaded / data.total * 100)}%`);
//             }
//           }
//         });
//         console.log('Model successfully loaded');
//       } catch (err) {
//         console.error('Model loading failed:', err);
//         throw new Error(`Failed to load model: ${err.message}`);
//       }
//     }
//     return this.instance;
//   }
// }

export const classifyAudio = async (audioFilePath) => {
  const audioClassification = await pipeline(
    "audio-classification",
    "onnx-community/Musical-genres-Classification-Hubert-V1-ONNX"
  );

  console.log("Audio classification pipeline loaded");
  console.log("Audio file path:", audioFilePath);
  // Read and decode the WAV file
  const audioBuffer = fs.readFileSync(audioFilePath);
  const audioData = await wav.decode(audioBuffer);

  // Convert audio samples to Float32Array
  const float32Array = new Float32Array(audioData.channelData[0]);

  console.log("Audio data decoded:");
  // Classify the audio
  const results = await audioClassification(float32Array);
  return results;
};
