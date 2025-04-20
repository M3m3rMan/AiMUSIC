import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import cors from 'cors';
import { extractFeatures, buildImprovementPrompt } from './featureExtractor.js';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import ffmpeg from 'fluent-ffmpeg';
import dotenv from 'dotenv';
import fsSync from 'fs';
import { convertToWav } from './convertAudio.js';
import { classifyPrompt } from './nlp.js';
import OpenAI from 'openai';
import { ObjectId } from 'mongodb';
dotenv.config();
import { MongoClient, ServerApiVersion } from 'mongodb';
import bodyParser from 'body-parser';
const uri = process.env.MONGODB_URI;
const app = express();
const PORT = 3001;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
const upload = multer({ dest: 'uploads/' });
app.use(cors());
let dbInstance;
const mongoClient = new MongoClient(uri, {
  serverApi: ServerApiVersion.v1,
});

async function connectToMongo() {
  if (!dbInstance) {
    await mongoClient.connect();
    dbInstance = mongoClient.db('chatApp'); // You can name this whatever
  }
  return dbInstance;
}
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const convertAudio = (inputPath) => {
  return new Promise((resolve, reject) => {
    const outputFilename = `converted_${uuidv4()}.wav`;
    const outputPath = join(__dirname, 'converted', outputFilename);

    ffmpeg(inputPath)
      .audioChannels(1)
      .audioFrequency(16000)
      .toFormat('wav')
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .save(outputPath);
  });
};

app.post('/analyze', upload.single('audio'), async (req, res) => {
  try {
    const originalPath = req.file.path;
    const wavPath = path.join('uploads', `${Date.now()}-converted.wav`);

    await convertToWav(originalPath, wavPath);
    console.log('File converted to WAV at:', wavPath);

    const genreResults = await extractFeatures(wavPath);
    const userPrompt = req.body.prompt;

    const prompt = buildImprovementPrompt(genreResults, userPrompt);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a helpful music production assistant. Based on features like genre, tempo, and user prompts, give detailed, creative, and actionable suggestions (3 to 5 items) to improve tracks. Be specific about techniques, tools, effects, and structure improvements.`,
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.8,
      max_tokens: 800,
    });

    const suggestions = completion.choices[0].message.content;
    res.json({ genre: genreResults, suggestions });
  } catch (err) {
    console.error('Error during analysis:', err);
    res.status(500).json({ error: err.message });
  }
  await fs.unlink(wavPath).catch(console.error);
});

app.post('/chats', async (req, res) => {
  const { role, text, audio, audioId } = req.body;

  try {
    const db = await connectToMongo();
    const result = await db.collection('chats').insertOne({
      role,
      text,
      audio: audio || null,
      audioId: audioId || null,
      timestamp: new Date(),
    });
    res.json({ success: true, insertedId: result.insertedId });
  } catch (err) {
    console.error('Error inserting message:', err);
    res.status(500).json({ error: 'Failed to insert message' });
  }
});


app.put('/chats/:id', async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;

  try {
    const db = await connectToMongo();
    const result = await db.collection('chats').updateOne(
      { _id: new ObjectId(id) },
      { $set: { text } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error updating message:', err);
    res.status(500).json({ error: 'Failed to update message' });
  }
});
app.get('/chats/getAllChats', async (req, res) => {
  try {
    const db = await connectToMongo();
    const chats = await db.collection('chats').find({}).toArray();
    res.json(chats);
  } catch (err) {
    console.error('Error fetching all chats:', err);
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

app.delete('/chats/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const db = await connectToMongo();
    const result = await db.collection('chats').deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting message:', err);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
