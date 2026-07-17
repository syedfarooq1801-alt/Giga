import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  FlatList, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator,
  Alert,
  FlatList as RNFlatList
} from 'react-native';
import { useAuth } from '../contexts/FirebaseAuthContext';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, DocumentData } from 'firebase/firestore';
import { db } from '../services/firebase';

// Define types for our chat messages
interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  timestamp: any; // Firestore timestamp
  isAI?: boolean;
}

const ChatComponent: React.FC = () => {

  // Use type assertion for the ref to avoid TypeScript errors
  const flatListRef = useRef<typeof RNFlatList>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Get auth context
  const { user: authUser } = useAuth();
  
  // Reference to the messages collection in Firestore
  const messagesRef = collection(db, 'messages');

  // Load messages from Firestore
  useEffect(() => {
    if (!authUser) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Create a query against the messages collection, ordered by timestamp
      const messagesQuery = query(
        messagesRef,
        orderBy('timestamp', 'asc')
      );
      
      // Subscribe to real-time updates
      const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
        const messagesData: ChatMessage[] = [];
        snapshot.forEach((doc) => {
          messagesData.push({
            id: doc.id,
            ...doc.data()
          } as ChatMessage);
        });
        
        setMessages(messagesData);
        setLoading(false);
        
        // Scroll to bottom when new messages arrive
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      });
      
      // Clean up subscription on unmount
      return () => unsubscribe();
    } catch (error) {
      console.error('Error loading messages:', error);
      Alert.alert('Error', 'Failed to load messages');
      setLoading(false);
    }
  }, [authUser]);

  // Handle sending a new message
  const handleSendMessage = async () => {
    if (!message.trim() || !authUser) return;
    
    try {
      setSending(true);
      
      // Create a new message object
      const newMessage: Omit<ChatMessage, 'id'> = {
        text: message.trim(),
        senderId: authUser.uid,
        senderName: authUser.displayName || 'Anonymous',
        timestamp: serverTimestamp(),
      };
      
      // Add message to Firestore
      await addDoc(messagesRef, newMessage);
      
      // Clear the input
      setMessage('');
      
      // Scroll to bottom
      flatListRef.current?.scrollToEnd({ animated: true });
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // Render a single chat message
  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isCurrentUser = item.senderId === authUser?.uid;
    
    return (
      <View 
        style={[
          styles.messageContainer, 
          isCurrentUser ? styles.currentUserMessage : styles.otherUserMessage
        ]}
      >
        {!isCurrentUser && (
          <Text style={styles.senderName}>{item.senderName}</Text>
        )}
        <View 
          style={[
            styles.messageBubble,
            isCurrentUser ? styles.currentUserBubble : styles.otherUserBubble
          ]}
        >
          <Text style={styles.messageText}>{item.text}</Text>
          <Text style={styles.timestamp}>
            {item.timestamp?.toDate?.().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  // Loading state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item: ChatMessage) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />
      
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={message}
          onChangeText={setMessage}
          placeholder="Type a message..."
          placeholderTextColor="#999"
          multiline
        />
        <TouchableOpacity 
          style={[styles.sendButton, (!message.trim() || sending) && styles.disabledButton]} 
          onPress={handleSendMessage}
          disabled={sending || !message.trim()}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.sendButtonText}>Send</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  messagesList: {
    padding: 10,
  },
  messageContainer: {
    marginBottom: 10,
  },
  currentUserMessage: {
    alignItems: 'flex-end',
  },
  otherUserMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 10,
    borderRadius: 15,
    marginTop: 5,
  },
  currentUserBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 0,
  },
  otherUserBubble: {
    backgroundColor: '#e5e5ea',
    borderBottomLeftRadius: 0,
  },
  senderName: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
    marginLeft: 10,
  },
  messageText: {
    fontSize: 16,
    color: '#000',
  },
  timestamp: {
    fontSize: 10,
    color: '#666',
    textAlign: 'right',
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    padding: 10,
    maxHeight: 100,
    marginRight: 10,
    backgroundColor: '#fff',
  },
  sendButton: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 20,
    paddingHorizontal: 20,
    minWidth: 70,
  },
  disabledButton: {
    backgroundColor: '#cccccc',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  }
});

export default ChatComponent;
