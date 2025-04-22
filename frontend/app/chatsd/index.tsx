// frontend/app/chats/index.tsx
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

export default function ChatListScreen() {
  const router = useRouter();
  const [chats, setChats] = useState<{ _id: string; name: string }[]>([]);

  useEffect(() => {
    const fetchChats = async () => {
      const res = await fetch('http://192.168.1.78:3000/chats');
      const data = await res.json();
      setChats(data);
    };

    fetchChats();
  }, []);

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Chat List</Text>
      <FlatList
        data={chats}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => router.push(`/chats/${item._id}`)}
            style={{
              padding: 12,
              marginTop: 10,
              backgroundColor: '#eee',
              borderRadius: 8,
            }}
          >
            <Text>{item.name || 'Untitled Chat'}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
