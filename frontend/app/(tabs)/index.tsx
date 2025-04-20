import React, { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Platform, KeyboardAvoidingView, KeyboardEvent, TouchableWithoutFeedback, Keyboard, } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { Audio } from "expo-av";
import axios from "axios";
import { Ionicons } from "@expo/vector-icons";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { v4 as uuidv4 } from 'uuid';
import Markdown from "react-native-markdown-display";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-gesture-handler';
import { Swipeable } from 'react-native-gesture-handler';

export default function App() {
  const [selectedAudio, setSelectedAudio] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<
    {
      role: string;
      text: string;
      audio?: string | null;
      audioId?: string;
      expanded?: boolean;
      _id?: string; // Added _id property
    }[]
  >([]);
  const BACKEND_URL = 'http://IPADRESS:3001'; // or your actual backend URL
  const [currentAudioId, setCurrentAudioId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false); // NEW
  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();
  const [chats, setChats] = useState<{ _id: string; name: string }[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const loadChat = async (chatId: string) => {
    try {
      const response = await axios.get(`${BACKEND_URL}/chat/${chatId}`);
      setMessages(response.data.messages);
      setCurrentChatId(chatId);
    } catch (err) {
      console.error("Failed to load chat:", err);
    }
  };
  const startNewChat = async () => {
    try {
      const response = await axios.post(`${BACKEND_URL}/chat`);
      const newChat = response.data;
      setCurrentChatId(newChat._id);
      setMessages([]);
      setChats((prev) => [newChat, ...prev]);  // Add new chat to the top of the list
    } catch (err) {
      console.error("Failed to start new chat:", err);
    }
  };

  
    

  const preprocessMarkdown = (text: string) => {
  // Ensure there is a blank line before the list
  return text.replace(/([^\n])\n(1\.)/g, '$1\n\n$2');
};
    useEffect(() => {
      const loadChatHistory = async () => {
        try {
          const res = await axios.get("http://IPADRESS:3001/api/getAllChats");
          setChats(res.data);
        } catch (error) {
          console.error("Failed to load chat history:", error);
        }
      };
  loadChatHistory();
  }, []);
  

  // Keyboard visibility listeners
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      "keyboardDidShow",
      () => {
        setKeyboardVisible(true);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      "keyboardDidHide",
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  useEffect(() => {
    if (sound) {
      return () => {
        sound.unloadAsync();
      };
    }
  }, [sound]);

  const generateAudioId = () => Date.now().toString();

  const handleSelectAudio = async () => {
    const file = await DocumentPicker.getDocumentAsync({ type: "audio/*" });
    if (file.assets && file.assets.length > 0) {
      const audioUri = file.assets[0].uri;
      const newAudioId = generateAudioId();
      setSelectedAudio(audioUri);
      setCurrentAudioId(newAudioId);
      if (selectedAudio) {
        setMessages(prev => [
          ...prev,
          {
            _id: uuid(),
            role: "user", // Added role to match the expected type
            text: "", // Added text to match the expected type
            audio: selectedAudio, // Use selectedAudio directly as it's a string
            audioId: generateAudioId(), // Ensure audioId is included
            expanded: false, // Optional: default value for expanded
          }
        ]);
      }
      
    }
  };

  const handleEditMessage = async (messageId: string, newText: string) => {
    try {
      await axios.put(`http://IPADRESS:3001/chats/${messageId}`, { text: newText });
      setMessages((prev) =>
        prev.map((msg) => (msg._id === messageId ? { ...msg, text: newText } : msg))
      );
    } catch (err) {
      console.error("Failed to update message", err);
    }
  };

  const handleDeleteChat = async (chatId: string) => {
    try {
      await axios.delete(`${BACKEND_URL}/chat/${chatId}`);
      setChats((prev) => prev.filter((chat) => chat._id !== chatId));  // Remove deleted chat from state
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };
  
  

  const handleSend = async () => {
    if (!input || !selectedAudio || !currentAudioId) return;
    setLoading(true);
  
    const userMessage = {
      role: "user",
      text: input,
      audio: selectedAudio,
      audioId: currentAudioId,
    };
    
    setMessages((prev) => [...prev, userMessage]);    
  
    
    setInput("");
  
    try {
      const fileInfo = await FileSystem.getInfoAsync(selectedAudio);
      if (!fileInfo.exists) {
        alert("File does not exist");
        return;
      }
  
      const formData = new FormData();
      formData.append("audio", {
        uri: selectedAudio,
        type: "audio/wav",
        name: "input.wav",
      } as any);
      formData.append("prompt", input);
  
      // ✅ 2. Save user message to DB
      
      
      // After getting response:
      // ✅ 1. Send audio to backend for analysis      
      const res = await axios.post(
        "http://IPADRESS:3001/analyze",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      await axios.post("http://IPADRESS:3001/chats", {
        role: "assistant",
        text: res.data.suggestions,
        audio: selectedAudio,
        audioId: currentAudioId,
      });
  
      const assistantMessage = {
        role: "assistant",
        text: res.data.suggestions,
        audio: selectedAudio,
        audioId: currentAudioId,
      };
  
      // ✅ 4. Add assistant message to UI
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error("Error during analysis:", err);
      const errorMsg = {
        role: "assistant",
        text: "Error analyzing audio.",
        audioId: currentAudioId,
      };
      await axios.post("http://IPADRESS:3001/chats", userMessage); // Save user message

      setMessages((prev) => [...prev, userMessage]); // Local state update
      // ✅ 5. Optionally save error to DB
      await axios.post("http://IPADRESS:3001/messages", errorMsg);

      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };
  

  const togglePlay = async (uri: string) => {
    if (sound) {
      await sound.unloadAsync();
      setSound(null);
      setIsPlaying(false);
    }
  
    const { sound: newSound } = await Audio.Sound.createAsync({ uri });
    setSound(newSound);
    await newSound.playAsync();
    setIsPlaying(true);
  
    newSound.setOnPlaybackStatusUpdate((status) => {
      if ('isPlaying' in status && !status.isPlaying) {
        setIsPlaying(false);
      }
    });
  };
  

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const isFirstMsgOfAudio =
      messages.findIndex((m) => m.audioId === item.audioId) === index;
    const isUser = item.role === "user";
    console.log("RAW MODEL RESPONSE:", item.text);

    console.log('Rendering item:', item);
    return (
      <View
        style={{
          marginBottom: 1,
          alignSelf: item.role === "user" ? "flex-end" : "flex-start",
          maxWidth: "80%",
        }}
      >
        <Swipeable
        renderRightActions={() => (
          <TouchableOpacity onPress={() => handleDeleteChat(item._id)} style={{ backgroundColor: 'red', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
            <Text style={{ color: 'white', padding: 20 }}>Delete</Text>
          </TouchableOpacity>
        )}
      > <TouchableOpacity onPress={() => loadChat(item._id)}>
      <View style={{ padding: 15, borderBottomWidth: 1, borderColor: '#ccc' }}>
      <Text>{item.name || `Chat ${item._id?.slice(-4) || "XXXX"}`}</Text>
      </View>
        </TouchableOpacity>
    </Swipeable>
        <TouchableOpacity onLongPress={() => handleDeleteChat(item._id)}>
        {/* existing message bubble */}
      </TouchableOpacity>
        {item.audio && isFirstMsgOfAudio && (
          <View
            style={{
              padding: 12,
              backgroundColor: "white",
              borderRadius: 16,
              shadowColor: "#000",
              shadowOpacity: 0.1,
              shadowRadius: 6,
              marginBottom: 4,
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: "bold",
                color: "black",
                marginBottom: 6,
              }}
            >
              🎵 Audio Preview
            </Text>
            <Text
              numberOfLines={1}
              style={{ color: "gray", fontSize: 14, marginBottom: 6 }}
            >
              {item.audio.split("/").pop()}
            </Text>
            <TouchableOpacity
            onPress={() => togglePlay(item.audio)}
              style={{
                backgroundColor: "#2563eb",
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 12,
              }}
            >
              <Text style={{ color: "white", fontWeight: "bold" }}>
                {isPlaying ? "Pause" : "Play"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {!isFirstMsgOfAudio && item.expanded && item.audio && (
          <View
            style={{
              padding: 12,
              backgroundColor: "white",
              borderRadius: 12,
              marginBottom: 4,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "600" }}>
              🎧 {item.audio.split("/").pop()}
            </Text>
            <TouchableOpacity
              onPress={() => togglePlay(item.audio)} // corrected to use 'item.audio'
                style={{
                marginTop: 6,
                backgroundColor: "#2563eb",
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 12,
              }}
            >
              <Text style={{ color: "white", fontWeight: "bold" }}>
                {isPlaying ? "Pause" : "Play"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

          {loading && (
  <ActivityIndicator size="large" color="#2563eb" style={{ margin: 16 }} />
          )}

{chats.map((chat) => (
  <Text key={chat._id}>{chat.name || `Chat ${chat._id.slice(-4)}`}</Text>
))}
<TouchableOpacity onPress={startNewChat}>
  <Text style={{ color: "blue" }}>+ New Chat</Text>
</TouchableOpacity>
  

        <View
          style={{
            backgroundColor: isUser ? "#2563eb" : "#e5e7eb",
            padding: 12,
            borderRadius: 16,
            width: "100%",
          }}
        >
          {isUser ? (
  <Text style={{ color: "white" }}>{item.text}</Text>
) : (
<Text>{item.text}</Text>

            // <Markdown
            //   style={{
            //     body: { color: 'black' },
            //     bullet_list: { marginLeft: 8 },
            //     ordered_list: { marginLeft: 8 },
            //     list_item: { marginBottom: 4 },
            //     paragraph: { marginBottom: 8 },
            //     code_block: { backgroundColor: '#f4f4f5', padding: 8, borderRadius: 8, fontFamily: 'Courier' },
            //   }}
            // >
            //   {testMarkdown}
            // </Markdown>
          )}
        </View>
      </View>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View
              style={{
                flex: 1,
                justifyContent: "space-between",
                paddingTop: insets.top,
                paddingBottom: isKeyboardVisible ? 0 : 20,
                paddingHorizontal: 15,
                backgroundColor: "white",
              }}
            >
              <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderItem}
                keyExtractor={(item, index) => item._id || index.toString()}
              />
              {loading && (
                <ActivityIndicator
                  style={{ marginVertical: 12 }}
                  size="large"
                  color="#2563eb"
                />
              )}
  
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 12,
                  borderTopWidth: isKeyboardVisible ? 0 : 1,
                  borderColor: "#e5e7eb",
                  backgroundColor: "white",
                }}
              >
                <TouchableOpacity
                  onPress={handleSelectAudio}
                  style={{ marginRight: 12 }}
                >
                  <Ionicons name="add-circle-outline" size={32} color="#2563eb" />
                </TouchableOpacity>
  
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  placeholder="Ask something about your track..."
                  style={{
                    flex: 1,
                    borderWidth: 1,
                    borderColor: "#e5e7eb",
                    borderRadius: 24,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    backgroundColor: "#fff",
                  }}
                />
  
                <TouchableOpacity
                  onPress={handleSend}
                  disabled={!selectedAudio || loading || !input.trim()}
                  style={{ marginLeft: 12 }}
                >
                  <Ionicons
                    name="arrow-up-circle"
                    size={32}
                    color={selectedAudio && input.trim() ? "#2563eb" : "#9ca3af"}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
function handleDeleteChat(_id: any): void {
  throw new Error("Function not implemented.");
}

function uuid(): string | undefined {
  throw new Error("Function not implemented.");
}

