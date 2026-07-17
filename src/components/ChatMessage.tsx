import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle, Platform } from 'react-native';
import { Message } from '../types';
import { Ionicons } from '@expo/vector-icons';

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  return (
    <View style={[
      styles.messageContainer,
      message.isUser ? styles.userMessage : styles.botMessage
    ]}>
      {!message.isUser && (
        <View style={styles.botIcon}>
          <Ionicons name="chatbubble-ellipses" size={20} color="#FF6B6B" />
        </View>
      )}
      <View style={[
        styles.messageBubble,
        message.isUser ? styles.userBubble : styles.botBubble
      ]}>
        <Text style={[
          styles.messageText,
          message.isUser ? styles.userMessageText : styles.botMessageText
        ]}>
          {message.text}
        </Text>
      </View>
      {message.isUser && (
        <View style={styles.userIcon}>
          <Ionicons name="person" size={20} color="#fff" />
        </View>
      )}
    </View>
  );
};

interface Styles {
  messageContainer: ViewStyle;
  userMessage: ViewStyle;
  botMessage: ViewStyle;
  messageBubble: ViewStyle;
  userBubble: ViewStyle;
  botBubble: ViewStyle;
  messageText: TextStyle;
  userMessageText: TextStyle;
  botMessageText: TextStyle;
  botIcon: ViewStyle;
  userIcon: ViewStyle;
}

const styles = StyleSheet.create<Styles>({
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
    maxWidth: '85%',
  },
  userMessage: {
    alignSelf: 'flex-end',
  },
  botMessage: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 20,
    maxWidth: '100%',
  },
  userBubble: {
    backgroundColor: '#FF6B6B',
    borderTopRightRadius: 4,
  },
  botBubble: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 4,
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 4px rgba(0,0,0,0.1)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
      }
    }),
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  userMessageText: {
    color: '#fff',
  },
  botMessageText: {
    color: '#333',
  },
  botIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    ...Platform.select({
      web: {
        boxShadow: '0px 2px 4px rgba(0,0,0,0.1)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
      }
    }),
  },
  userIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});

export default ChatMessage; 