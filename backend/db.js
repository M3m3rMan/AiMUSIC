// db.js
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
dotenv.config();

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();

export const db = client.db("aimusic");
export const chatsCollection = db.collection("chats");
