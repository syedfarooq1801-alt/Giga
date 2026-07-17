import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

import type { SenderType } from '../types/chat';

type MessageBubbleProps = {
  text: string;
  sender: SenderType;
  personalityEmoji?: string;
  /** Active persona's accent — tints the user bubble in dark mode. */
  accentColor?: string;
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({ text, sender, personalityEmoji, accentColor }) => {
  const { colors, isDark, radius } = useTheme();
  const isUser = sender === 'user';

  const bubbleBg = isUser
    ? (isDark ? (accentColor || colors.accent) : colors.userMessageBackground)
    : colors.botMessageBackground;
  const bubbleText = isUser ? colors.userMessageText : colors.botMessageText;
  const bubbleRadius = isUser
    ? { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.sm / 2 }
    : { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderBottomRightRadius: radius.lg, borderBottomLeftRadius: radius.sm / 2 };

  if (!isUser && personalityEmoji) {
    return (
      <View style={styles.row}>
        <Text style={styles.emoji}>{personalityEmoji}</Text>
        <View style={[styles.container, styles.botContainer, bubbleRadius, { backgroundColor: bubbleBg, marginLeft: 4 }]}>
          <Text style={[styles.text, { color: bubbleText }]}>{text}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.botContainer, bubbleRadius, { backgroundColor: bubbleBg }]}>
      <Text style={[styles.text, { color: bubbleText }]}>{text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '80%',
    marginVertical: 4,
    marginHorizontal: 8,
  },
  container: {
    maxWidth: '80%',
    paddingVertical: 10,
    paddingHorizontal: 14,
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
    fontSize: 15,
    lineHeight: 21,
  },
  emoji: {
    fontSize: 22,
    marginRight: 4,
    alignSelf: 'center',
  },
});
