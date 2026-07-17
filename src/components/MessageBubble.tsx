import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

import type { SenderType } from '../types/chat';
import type { MessageReactions } from '../types/ChatMessage';

type MessageBubbleProps = {
  text: string;
  sender: SenderType;
  personalityEmoji?: string;
  /** Active persona's accent — tints the user bubble in dark mode. */
  accentColor?: string;
  reactions?: MessageReactions | null;
  onReact?: (thumbsUp: boolean, thumbsDown: boolean) => void;
  isLastAssistantMessage?: boolean;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
};

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  text,
  sender,
  personalityEmoji,
  accentColor,
  reactions,
  onReact,
  isLastAssistantMessage,
  onRegenerate,
  isRegenerating,
}) => {
  const { colors, isDark, radius, typography } = useTheme();
  const isUser = sender === 'user';

  const bubbleBg = isUser
    ? (isDark ? (accentColor || colors.accent) : colors.userMessageBackground)
    : colors.botMessageBackground;
  const bubbleText = isUser ? colors.userMessageText : colors.botMessageText;
  const bubbleRadius = isUser
    ? { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.sm / 2 }
    : { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderBottomRightRadius: radius.lg, borderBottomLeftRadius: radius.sm / 2 };

  const bubbleContent = isUser ? (
    <Text style={[styles.text, { color: bubbleText }]}>{text}</Text>
  ) : (
    <Markdown style={getMarkdownStyles(colors, bubbleText, typography)}>{text || ' '}</Markdown>
  );

  const actionsRow = !isUser && (onReact || (isLastAssistantMessage && onRegenerate)) ? (
    <View style={[styles.actionsRow, personalityEmoji ? { marginLeft: 34 } : null]}>
      {onReact && (
        <>
          <TouchableOpacity
            testID="reaction-thumbs-up"
            onPress={() => onReact(!reactions?.thumbsUp, false)}
            style={styles.actionButton}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <MaterialCommunityIcons
              name={reactions?.thumbsUp ? 'thumb-up' : 'thumb-up-outline'}
              size={15}
              color={reactions?.thumbsUp ? colors.accent : colors.sub}
            />
          </TouchableOpacity>
          <TouchableOpacity
            testID="reaction-thumbs-down"
            onPress={() => onReact(false, !reactions?.thumbsDown)}
            style={styles.actionButton}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <MaterialCommunityIcons
              name={reactions?.thumbsDown ? 'thumb-down' : 'thumb-down-outline'}
              size={15}
              color={reactions?.thumbsDown ? colors.danger : colors.sub}
            />
          </TouchableOpacity>
        </>
      )}
      {isLastAssistantMessage && onRegenerate && (
        <TouchableOpacity
          testID="regenerate-button"
          onPress={onRegenerate}
          disabled={isRegenerating}
          style={styles.actionButton}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          {isRegenerating ? (
            <ActivityIndicator size={12} color={colors.sub} />
          ) : (
            <MaterialCommunityIcons name="refresh" size={15} color={colors.sub} />
          )}
        </TouchableOpacity>
      )}
    </View>
  ) : null;

  if (!isUser && personalityEmoji) {
    return (
      <View style={styles.wrapper}>
        <View style={styles.row}>
          <Text style={styles.emoji}>{personalityEmoji}</Text>
          <View style={[styles.container, styles.botContainer, bubbleRadius, { backgroundColor: bubbleBg, marginLeft: 4 }]}>
            {bubbleContent}
          </View>
        </View>
        {actionsRow}
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <View style={[styles.container, isUser ? styles.userContainer : styles.botContainer, bubbleRadius, { backgroundColor: bubbleBg }]}>
        {bubbleContent}
      </View>
      {actionsRow}
    </View>
  );
};

// Code blocks styled off the token system (surface/line/mono stack), not
// hardcoded colors, so they stay consistent with the rest of the app.
const getMarkdownStyles = (colors: ReturnType<typeof useTheme>['colors'], textColor: string, typography: ReturnType<typeof useTheme>['typography']) => ({
  body: { color: textColor, fontSize: 15, lineHeight: 21 },
  code_inline: {
    backgroundColor: colors.surface,
    color: textColor,
    fontFamily: typography.monoFontFamily,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  code_block: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontFamily: typography.monoFontFamily,
  },
  fence: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontFamily: typography.monoFontFamily,
  },
  link: { color: colors.accent },
});

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '80%',
    marginVertical: 2,
    marginHorizontal: 8,
  },
  container: {
    maxWidth: '80%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginVertical: 2,
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
  actionsRow: {
    flexDirection: 'row',
    marginLeft: 12,
    marginTop: 2,
    gap: 12,
  },
  actionButton: {
    padding: 2,
  },
});
