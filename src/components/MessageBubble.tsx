import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@react-navigation/native';

import type { SenderType } from '../types/chat';

type MessageBubbleProps = {
  text: string;
  sender: SenderType;
  personalityEmoji?: string;
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({ text, sender, personalityEmoji }) => {
  const { colors } = useTheme();
  const isUser = sender === 'user';

  if (!isUser && personalityEmoji) {
    // Bot message with emoji
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', maxWidth: '80%', marginVertical: 4, marginHorizontal: 8 }}>
        <Text style={styles.emoji}>{personalityEmoji}</Text>
        <View style={[
          styles.container,
          styles.botContainer,
          { backgroundColor: colors.primary, marginLeft: 4 }
        ]}>
          <Text style={[
            styles.text,
            { color: '#fff' }
          ]}>
            {text}
          </Text>
        </View>
      </View>
    );
  }

  // User or bot message without emoji
  return (
    <View style={[
      styles.container,
      isUser ? styles.userContainer : styles.botContainer,
      { backgroundColor: colors.primary }
    ]}>
      <Text style={[
        styles.text,
        { color: '#fff' }
      ]}>
        {text}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginVertical: 4,
    marginHorizontal: 8,
  },
  userContainer: {
    alignSelf: 'flex-end',
  },
  botContainer: {
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 16,
  },
  emoji: {
    fontSize: 24,
    marginRight: 4,
    alignSelf: 'center',
  },
});
