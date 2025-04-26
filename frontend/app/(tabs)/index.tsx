import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Platform, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, StyleSheet, Modal } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import axios from 'axios';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaProvider, useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { v4 as uuidv4 } from 'uuid';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Sidebar from './Sidebar';
import 'react-native-get-random-values';
import Markdown from 'react-native-markdown-display';

interface Chat {
  _id: string;
  name: string;
  createdAt: string;
  formattedTime?: string;
}

interface Message {
  _id: string;
  role: string;
  text: string;
  audio?: string;
  audioId?: string;
  createdAt?: string;
}

const formatChatTime = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
};

function formatTextWithTitle(text: string): string {
  return `Here's how you can improve your track:\n\n${text}`;
}


const App = () => {
  const [selectedAudio, setSelectedAudio] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isAIResponding, setIsAIResponding] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(false);

  const BACKEND_URL = 'http://IPDRESS CHANGE THIS FIRST GODDAMN IT:3001';
  const flatListRef = useRef<FlatList>(null);
  const insets = useSafeAreaInsets();

  // Load all chats when component mounts
  useEffect(() => {
    loadChats();
  }, []);

  // Load messages when current chat changes
  useEffect(() => {
    if (currentChatId) {
      loadMessages(currentChatId);
    } else {
      setMessages([]);
      setSelectedAudio(null);
    }
  }, [currentChatId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const loadChats = async () => {
    try {
      const res = await axios.get(`${BACKEND_URL}/chats/getAllChats`);
      const chatsWithTimes = res.data.map((chat: Chat) => ({
        ...chat,
        formattedTime: formatChatTime(chat.createdAt)
      }));
      setChats(chatsWithTimes);
    } catch (err) {
      console.error('Failed to load chats:', err);
    }
  };

  const loadMessages = async (chatId: string) => {
    try {
      const res = await axios.get(`${BACKEND_URL}/chats/${chatId}/messages`);
      setMessages(res.data || []); // Ensure it's always an array
      const firstUserMessage = res.data?.find((msg: Message) => msg.role === 'user' && msg.audio);
      if (firstUserMessage) {
        setSelectedAudio(firstUserMessage.audio);
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
      setMessages([]); // Reset to empty array on error
    }
  };

  const handleNewChat = async () => {
    try {
      const now = new Date();
      const timeString = formatChatTime(now.toString());
      
      const res = await axios.post(`${BACKEND_URL}/chats/create`, {
        name: `Chat at ${timeString}`,
      });
      
      const chatWithTime = {
        ...res.data,
        formattedTime: timeString
      };
      
      setCurrentChatId(chatWithTime._id);
      setMessages([]);
      setSelectedAudio(null);
      setChats(prev => [chatWithTime, ...prev]);
      setIsSidebarVisible(false);
    } catch (err) {
      console.error('Error creating chat:', err);
    }
  };

  const handleSelectChat = (chatId: string) => {
    setCurrentChatId(chatId);
    setIsSidebarVisible(false);
  };

  const handleDeleteChat = async (chatId: string) => {
    try {
      await axios.delete(`${BACKEND_URL}/chats/${chatId}`);
      setChats(prev => prev.filter(chat => chat._id !== chatId));
      if (currentChatId === chatId) {
        setCurrentChatId(null);
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleSelectAudio = async () => {
    try {
      setSelectedAudio(null);
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
        multiple: false
      });

      if (result.canceled) return;
      if (!result.assets || result.assets.length === 0) return;

      const audioFile = result.assets[0];
      const fileInfo = await FileSystem.getInfoAsync(audioFile.uri);
      if (!fileInfo.exists) throw new Error('File does not exist');

      setSelectedAudio(audioFile.uri);

      if (currentChatId) {
        const audioMessage = {
          role: 'user',
          text: 'Audio file uploaded',
          audio: audioFile.uri,
          audioId: uuidv4()
        };

        const res = await axios.post(
          `${BACKEND_URL}/chats/${currentChatId}/messages`,
          audioMessage
        );
        setMessages(prev => [...prev, res.data]);
      }
    } catch (error) {
      console.error('Audio selection error:', error);
      alert(`Failed to select audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleSend = async () => {
    if (!input || !selectedAudio || !currentChatId) return;
    
    setIsSending(true);
    const userMessage = {
      role: 'user',
      text: input,
      audio: selectedAudio,
    };

    try {
      // Save user message immediately
      const userRes = await axios.post(
        `${BACKEND_URL}/chats/${currentChatId}/messages`,
        userMessage
      );
      setMessages(prev => [...prev, userRes.data]);
      setInput('');
      
      // Show loading state for AI response
      setIsAIResponding(true);

      // Prepare and send audio for analysis
      const formData = new FormData();
      formData.append('audio', {
        uri: selectedAudio,
        type: 'audio/wav',
        name: 'input.wav',
      } as any);
      formData.append('prompt', input);

      const analysisRes = await axios.post(
        `${BACKEND_URL}/analyze`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      // Save and display AI response
      const assistantMessage = {
        role: 'assistant',
        text: analysisRes.data.suggestions,
      };
      const assistantRes = await axios.post(
        `${BACKEND_URL}/chats/${currentChatId}/messages`,
        assistantMessage
      );
      setMessages(prev => [...prev, assistantRes.data]);
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: Message = {
        _id: uuidv4(),
        role: 'assistant',
        text: 'Sorry, I encountered an error processing your request.',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsSending(false);
      setIsAIResponding(false);
    }
  };

  const togglePlay = async (uri: string) => {
    if (!uri) return;
    
    try {
      if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
          await sound.playAsync();
          setIsPlaying(true);
        }
      } else {
        const { sound: newSound } = await Audio.Sound.createAsync({ uri });
        setSound(newSound);
        await newSound.playAsync();
        setIsPlaying(true);
        
        newSound.setOnPlaybackStatusUpdate(status => {
          if ('isPlaying' in status && !status.isPlaying) {
            setIsPlaying(false);
          }
        });
      }
    } catch (error) {
      console.error('Playback error:', error);
    }
  };
  



  const renderItem = ({ item, index }: { item: Message; index: number }) => {
    const isUser = item.role === 'user';
    const isLastMessage = index === messages.length - 1;
    const isFirstWithAudio = messages.findIndex(m => m.audio === item.audio) === index;

    return (
      <View style={{ marginBottom: 10, alignSelf: isUser ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
        {/* Audio player for user messages */}
        {isUser && isFirstWithAudio && item.audio && (
          <View style={styles.audioContainer}>
            <Text style={styles.audioFilename} numberOfLines={1}>
              {item.audio.split('/').pop()}
            </Text>
            <TouchableOpacity onPress={() => togglePlay(item.audio!)}>
              <Ionicons 
                name={isPlaying ? 'pause' : 'play'} 
                size={24} 
                color="#2563eb" 
              />
            </TouchableOpacity>
          </View>
        )}

        {/* Loading indicator for pending AI responses */}
        {!isUser && isAIResponding && isLastMessage && (
          <View style={styles.loadingBubble}>
            <ActivityIndicator size="small" color="#2563eb" />
            <Text style={styles.loadingText}>AI is thinking...</Text>
          </View>
        )}

        {/* Message bubble */}
        <View
          style={[
            styles.messageBubble,
            { backgroundColor: isUser ? '#2563eb' : '#e5e7eb', alignSelf: isUser ? 'flex-end' : 'flex-start' }
          ]}
        >
          {isUser ? (
            <Text style={{ color: '#fff' }}>{item.text}</Text>
          ) : (
            <Markdown style={markdownStyles}>
              {formatTextWithTitle(item.text)}
            </Markdown>
          )}
        </View>
      </View>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: 'white' }}>
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
          {/* Sidebar */}
          <Sidebar
            isVisible={isSidebarVisible}
            chats={chats}
            onSelectChat={handleSelectChat}
            onCreateNewChat={handleNewChat}
            onDeleteChat={handleDeleteChat}
            onClose={() => setIsSidebarVisible(false)}
          />

          {/* Main Content */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={{ flex: 1 }}>
                {/* Header */}
                <View style={styles.header}>
                  <TouchableOpacity onPress={() => setIsSidebarVisible(true)}>
                    <Ionicons name="menu" size={28} color="#2563eb" />
                  </TouchableOpacity>
                  <View style={styles.headerTitleContainer}>
                    <Text style={styles.headerTitle}>
                      {currentChatId ? (
                        chats.find(c => c._id === currentChatId)?.name || 'Chat'
                      ) : 'New Chat'}
                    </Text>
                    {currentChatId && (
                      <Text style={styles.timeText}>
                        {chats.find(c => c._id === currentChatId)?.formattedTime || ''}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={handleNewChat}>
                    <Ionicons name="add-circle" size={28} color="#2563eb" />
                  </TouchableOpacity>
                </View>

                {/* Messages List */}
                <FlatList
                  ref={flatListRef}
                  data={messages}
                  renderItem={renderItem}
                  keyExtractor={(item) => item._id}
                  contentContainerStyle={styles.messagesContainer}
                  style={{ backgroundColor: 'white' }}
                />

                {/* Input Area */}
                <View style={styles.inputContainer}>
                  <TouchableOpacity 
                    onPress={handleSelectAudio}
                    disabled={!currentChatId || isSending}
                    style={styles.attachButton}
                  >
                    <Ionicons
                      name="attach"
                      size={28}
                      color={currentChatId && !isSending ? '#2563eb' : '#ccc'}
                    />
                  </TouchableOpacity>
                  
                  <TextInput
                    value={input}
                    onChangeText={setInput}
                    placeholder={currentChatId ? "Ask about your track..." : "Create or select a chat"}
                    style={styles.input}
                    editable={!!currentChatId}  // Removed the !isSending check
                    placeholderTextColor="#9ca3af"
                  />
                  
                  <TouchableOpacity
                    onPress={handleSend}
                    disabled={!input || !currentChatId || isSending}  // Keep isSending check here
                    style={styles.sendButton}
                  >
                    {isSending ? (
                      <ActivityIndicator size="small" color="#2563eb" />
                    ) : (
                      <Ionicons
                        name="send"
                        size={24}
                        color={input && currentChatId ? '#2563eb' : '#ccc'}
                      />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

const markdownStyles: StyleSheet.NamedStyles<any> = {
  body: {
    color: '#111827',
    fontSize: 16,
  },
  code_block: {
    backgroundColor: '#f3f4f6',
    padding: 10,
    borderRadius: 8,
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace' }),
  },
  inlineCode: {
    backgroundColor: '#f3f4f6',
    padding: 4,
    borderRadius: 4,
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace' }),
  },
  strong: {
    fontWeight: 'bold' as 'bold',
  },
  em: {
    fontStyle: 'italic',
  },
};



const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: 'white',
    flexWrap: 'wrap',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    maxWidth: '95%',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2563eb',
    textAlign: 'center',
  },
  timeText: {
    fontSize: 14,
    fontWeight: 'normal',
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 2,
  },
  messagesContainer: {
    paddingHorizontal: 15,
    paddingBottom: 15,
    paddingTop: 10,
  },
  audioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#f0f4ff',
    borderRadius: 8,
    marginBottom: 8,
  },
  audioFilename: {
    flex: 1,
    marginRight: 10,
    color: '#2563eb',
  },
  messageContainer: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  userMessage: {
    backgroundColor: '#2563eb',
  },
  assistantMessage: {
    backgroundColor: '#e5e7eb',
  },
  messageText: {
    fontSize: 16,
    color: '#111827',
    flexWrap: 'wrap',
    overflow: 'hidden',
    maxWidth: '100%',
  },
  userMessageText: {
    color: 'white',
  },
  assistantMessageText: {
    color: 'black',
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
    marginBottom: 8,
  },
  loadingText: {
    marginLeft: 8,
    color: '#6b7280',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderTopWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: 'white',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#f9fafb',
  },
  attachButton: {
    padding: 8,
    marginRight: 10,
  },
  sendButton: {
    marginLeft: 10,
  },
});

export default App;
