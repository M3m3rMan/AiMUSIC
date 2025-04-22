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

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());
const upload = multer({ dest: 'uploads/' });

// MongoDB Connection
let dbInstance;
const mongoClient = new MongoClient(uri, {
  serverApi: ServerApiVersion.v1,
});

async function connectToMongo() {
  if (!dbInstance) {
    await mongoClient.connect();
    dbInstance = mongoClient.db('chatApp');
  }
  return dbInstance;
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Audio Processing
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

// Routes
app.post('/analyze', upload.single('audio'), async (req, res) => {
  try {
    const originalPath = req.file.path;
    const wavPath = path.join('uploads', `${Date.now()}-converted.wav`);

    console.log('Original file path:', originalPath);
    console.log('WAV file path:', wavPath);

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
    await fs.unlink(wavPath).catch(console.error);
    console.log('Deleted temporary WAV file:', wavPath);

    res.json({ genre: genreResults, suggestions });
  } catch (err) {
    console.error('Error during analysis:', err);
    res.status(500).json({ error: err.message });
  } 
});

// Chat CRUD Operations
app.post('/chats/create', async (req, res) => {
  try {
    const db = await connectToMongo();
    const newChat = {
      name: req.body.name || `Chat ${new Date().toLocaleDateString()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const result = await db.collection('chats').insertOne(newChat);
    res.status(201).json({ ...newChat, _id: result.insertedId });
  } catch (err) {
    console.error('Error creating chat:', err);
    res.status(500).json({ error: 'Failed to create chat' });
  }
});

app.get('/chats/getAllChats', async (req, res) => {
  try {
    const db = await connectToMongo();
    const chats = await db.collection('chats')
      .find()
      .sort({ createdAt: -1 })
      .toArray();
    res.json(chats);
  } catch (err) {
    console.error('Error fetching chats:', err);
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

app.get('/chats/:chatId', async (req, res) => {
  try {
    const db = await connectToMongo();
    const chat = await db.collection('chats').findOne({ 
      _id: new ObjectId(req.params.chatId) 
    });
    
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    res.json(chat);
  } catch (err) {
    console.error('Error fetching chat:', err);
    res.status(500).json({ error: 'Failed to fetch chat' });
  }
});

// Message CRUD Operations
app.post('/chats/:chatId/messages', async (req, res) => {
  try {
    const db = await connectToMongo();
    const newMessage = {
      chatId: req.params.chatId,
      ...req.body,
      createdAt: new Date(),
    };
    
    // Insert message
    const result = await db.collection('messages').insertOne(newMessage);
    
    // Update chat's updatedAt
    await db.collection('chats').updateOne(
      { _id: new ObjectId(req.params.chatId) },
      { $set: { updatedAt: new Date() } }
    );
    
    res.status(201).json({ ...newMessage, _id: result.insertedId });
  } catch (err) {
    console.error('Error adding message:', err);
    res.status(500).json({ error: 'Failed to add message' });
  }
});

app.get('/chats/:chatId/messages', async (req, res) => {
  try {
    const db = await connectToMongo();
    const messages = await db.collection('messages')
      .find({ chatId: req.params.chatId })
      .sort({ createdAt: 1 })
      .toArray();
    res.json(messages);
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.delete('/chats/:chatId', async (req, res) => {
  try {
    const db = await connectToMongo();
    
    // Delete chat
    const chatResult = await db.collection('chats').deleteOne({ 
      _id: new ObjectId(req.params.chatId) 
    });
    
    if (chatResult.deletedCount === 0) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    // Delete associated messages
    await db.collection('messages').deleteMany({ 
      chatId: req.params.chatId 
    });
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting chat:', err);
    res.status(500).json({ error: 'Failed to delete chat' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});