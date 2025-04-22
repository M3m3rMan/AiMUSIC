// frontend/app/chats/new.tsx
import { View, Text, Button } from 'react-native';
import { useRouter } from 'expo-router';

export default function NewChatScreen() {
  const router = useRouter();

  const handleCreateChat = async () => {
    const newChatId = 'temp-id-' + Date.now(); // Replace with actual backend logic
    router.push(`/chats/${newChatId}`);
  };

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Start a New Chat</Text>
      <Button title="Create Chat" onPress={handleCreateChat} />
    </View>
  );
}
