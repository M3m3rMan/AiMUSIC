import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import Ionicons from '@expo/vector-icons/Ionicons';

interface Chat {
  _id: string;
  name: string;
  createdAt: string;
}

interface SidebarProps {
  isVisible: boolean;
  chats: Chat[];
  onSelectChat: (chatId: string) => void;
  onCreateNewChat: () => void;
  onDeleteChat: (chatId: string) => void;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  isVisible,
  chats,
  onSelectChat,
  onCreateNewChat,
  onDeleteChat,
  onClose,
}) => {
  if (!isVisible) return null;

  const renderRightActions = (progress: any, dragX: any, chatId: string) => {
    const scale = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [1, 0.5],
      extrapolate: 'clamp',
    });

    return (
      <TouchableOpacity onPress={() => onDeleteChat(chatId)}>
        <Animated.View style={[styles.deleteButton, { transform: [{ scale }] }]}>
          <Ionicons name="trash" size={24} color="white" />
        </Animated.View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Chats</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={24} color="#2563eb" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.newChatButton} onPress={onCreateNewChat}>
        <Ionicons name="add" size={20} color="#2563eb" />
        <Text style={styles.newChatText}>New Chat</Text>
      </TouchableOpacity>

      <View style={styles.chatList}>
        {chats.map((chat) => (
          <Swipeable
            key={chat._id}
            renderRightActions={(progress, dragX) =>
              renderRightActions(progress, dragX, chat._id)
            }
            onSwipeableRightOpen={() => onDeleteChat(chat._id)}
          >
            <TouchableOpacity
              style={styles.chatItem}
              onPress={() => onSelectChat(chat._id)}
            >
              <Ionicons name="chatbubble-ellipses" size={20} color="#2563eb" />
              <Text style={styles.chatName} numberOfLines={1}>
                {chat.name || `Chat ${chat._id.slice(-4)}`}
              </Text>
              <Text style={styles.chatDate}>
                {new Date(chat.createdAt).toLocaleDateString()}
              </Text>
            </TouchableOpacity>
          </Swipeable>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: '80%',
        backgroundColor: 'white', // Ensure white background
        padding: 20,
        zIndex: 100,
        borderRightWidth: 1,
        borderRightColor: '#e5e7eb',
        shadowColor: '#000',
        shadowOffset: { width: 2, height: 0 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 5,
      },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f0f4ff',
    borderRadius: 8,
    marginBottom: 20,
  },
  newChatText: {
    marginLeft: 10,
    color: '#2563eb',
    fontWeight: '500',
  },
  chatList: {
    flex: 1,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  chatName: {
    flex: 1,
    marginLeft: 10,
    color: '#1f2937',
  },
  chatDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  deleteButton: {
    backgroundColor: 'red',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
  },
});

export default Sidebar;