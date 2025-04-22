// frontend/app/chats/[chatId].tsx
import { useLocalSearchParams } from 'expo-router';
import { View, Text } from 'react-native';

export default function ChatDetailScreen() {
  const { chatId } = useLocalSearchParams();

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>
        Chat ID: {chatId}
      </Text>
      {/* Render actual chat messages and input UI here */}
    </View>
  );
}
