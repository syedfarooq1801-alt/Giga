import React, { useMemo, useRef, useEffect } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, Animated } from 'react-native';
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
  /** Client-side only (not persisted) preview of an image attached to a
   *  user message -- see ChatMessage.imageUri. */
  imageUri?: string;
};

// Memoized so a parent re-render (e.g. the input box changing on every
// keystroke) doesn't force every visible bubble to redo Markdown parsing --
// only bubbles whose own props actually changed re-render.
export const MessageBubble: React.FC<MessageBubbleProps> = React.memo(({
  text,
  sender,
  personalityEmoji,
  accentColor,
  reactions,
  onReact,
  isLastAssistantMessage,
  onRegenerate,
  isRegenerating,
  imageUri,
}) => {
  const { colors, isDark, radius, typography } = useTheme();
  const isUser = sender === 'user';

  // Fades in once on mount only -- MessageBubble is memoized, so an
  // existing message re-rendering (e.g. a reaction toggling) doesn't
  // remount it and doesn't replay this, only a genuinely new bubble does.
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, [fadeAnim]);

  // User messages keep a bubble (right-aligned, uniform rounded corners --
  // the one visually "contained" element in the thread). Assistant replies
  // are flat: no background box, full-width text with a small avatar badge,
  // matching how ChatGPT reads as continuous prose rather than chat bubbles.
  const bubbleBg = isDark ? (accentColor || colors.accent) : colors.userMessageBackground;
  const bubbleText = colors.userMessageText;

  // Stable object identity across renders (only changes when the theme
  // actually does) -- otherwise Markdown treats every render as a fresh
  // style prop and redoes work it doesn't need to.
  const markdownStyles = useMemo(
    () => getMarkdownStyles(colors, colors.ink, typography),
    [colors, typography]
  );

  const assistantContent = (
    <Markdown style={markdownStyles}>{text || ' '}</Markdown>
  );

  const actionsRow = !isUser && (onReact || (isLastAssistantMessage && onRegenerate)) ? (
    <View style={styles.actionsRow}>
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

  if (isUser) {
    return (
      <Animated.View style={[styles.wrapper, { opacity: fadeAnim }]}>
        <View
          style={[
            styles.container,
            styles.userContainer,
            { backgroundColor: bubbleBg, borderRadius: radius.lg, borderBottomRightRadius: radius.sm },
          ]}
        >
          {imageUri && <Image source={{ uri: imageUri }} style={styles.attachedImage} resizeMode="cover" />}
          {!!text && <Text style={[styles.text, { color: bubbleText }]}>{text}</Text>}
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.wrapper, { opacity: fadeAnim }]}>
      <View style={styles.assistantRow}>
        <View style={[styles.avatar, { backgroundColor: accentColor || colors.accent }]}>
          <Text style={styles.avatarEmoji}>{personalityEmoji || '🤖'}</Text>
        </View>
        <View style={styles.assistantContent}>
          {assistantContent}
          {actionsRow}
        </View>
      </View>
    </Animated.View>
  );
});

// Code blocks styled off the token system (surface/line/mono stack), not
// hardcoded colors, so they stay consistent with the rest of the app.
const getMarkdownStyles = (colors: ReturnType<typeof useTheme>['colors'], textColor: string, typography: ReturnType<typeof useTheme>['typography']) => ({
  body: { color: textColor, fontSize: 15, lineHeight: 22 },
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
  text: {
    fontSize: 15,
    lineHeight: 22,
  },
  attachedImage: {
    width: 220,
    height: 220,
    borderRadius: 12,
    marginBottom: 6,
  },
  assistantRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 8,
    marginVertical: 6,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
    flexShrink: 0,
  },
  avatarEmoji: {
    fontSize: 14,
  },
  assistantContent: {
    flex: 1,
    minWidth: 0,
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: 2,
    gap: 12,
  },
  actionButton: {
    padding: 2,
  },
});
