import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, StyleProp, TextStyle, ViewStyle } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface BotMessageBubbleProps {
  messageText: string;
  personalityEmoji?: string;
  timestamp: string;
  typingSpeed?: number; // Milliseconds per word/char
  isNewMessage?: boolean; // Add this prop
  onTypingComplete?: () => void; // Callback when typing animation completes
}

const BotMessageBubble: React.FC<BotMessageBubbleProps> = ({
  messageText,
  personalityEmoji,
  timestamp,
  typingSpeed = 100, // Default speed: 100ms per word
  isNewMessage = false, // Default to false
  onTypingComplete
}) => {
  const [displayedText, setDisplayedText] = useState(isNewMessage ? '' : messageText);
  const { colors } = useTheme(); // Destructure colors from useTheme

  useEffect(() => {
    // Ensure messageText is a string
    const textToDisplay = typeof messageText === 'string' ? messageText : '';
    
    // If this is not a new message, just display the full text immediately
    if (!isNewMessage || !textToDisplay) {
      setDisplayedText(textToDisplay);
      return;
    }
    
    // For new messages, animate the typing
    setDisplayedText(''); // Reset for animation
    
    // Split the message into lines for better animation
    const lines = textToDisplay.split('\n');
    let currentLineIndex = 0;
    let currentWordIndex = 0;
    let currentLineWords: string[] = [];
    
    const showNextWord = () => {
      // Exit if we've processed all lines
      if (currentLineIndex >= lines.length) {
        // Make sure the full text is displayed at the end
        setDisplayedText(textToDisplay);
        if (onTypingComplete) {
          onTypingComplete(); // Notify when typing is complete
        }
        return;
      }

      // Split current line into words if starting new line
      if (currentWordIndex === 0) {
        currentLineWords = lines[currentLineIndex].split(' ');
      }

      // Add the next word
      setDisplayedText(prev => {
        const prevLines = prev.split('\n');
        // Build current line up to current word
        prevLines[currentLineIndex] = currentLineWords.slice(0, currentWordIndex + 1).join(' ');
        return prevLines.join('\n');
      });

      currentWordIndex++;

      // If we've shown all words in current line
      if (currentWordIndex >= currentLineWords.length) {
        currentWordIndex = 0;
        currentLineIndex++;
        // Add newline for next line if there is one
        if (currentLineIndex < lines.length) {
          setDisplayedText(prev => prev + '\n');
          setTimeout(showNextWord, typingSpeed); // Slight pause before next line
        } else {
          // Make sure the full text is displayed at the end
          setDisplayedText(textToDisplay);
          if (onTypingComplete) {
            onTypingComplete(); // Notify when typing is complete
          }
        }
      } else {
        // Show next word in current line
        setTimeout(showNextWord, typingSpeed / 2); // Adjust timing between words
      }
    };

    // Start showing words
    showNextWord();
  }, [messageText, typingSpeed, isNewMessage, onTypingComplete]);

  // Styles (can be adapted from ChatScreen.tsx or themed)
  const styles = StyleSheet.create({
    botMessageWrapper: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      marginBottom: 12,
      maxWidth: '100%',
    },
    personalityEmoji: {
      fontSize: 24,
      marginRight: 8,
      marginTop: 4,
      color: colors.text, // Use color from context
    },
    messageContainer: {
      flexDirection: 'row',
      maxWidth: '80%',
      borderRadius: 12,
      padding: 12,
      backgroundColor: colors.botMessageBackground, // Use color from context
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
      alignSelf: 'flex-start',
      borderBottomLeftRadius: 4,
    },
    messageContent: {
      flex: 1,
    },
    messageText: {
      fontSize: 16,
      marginBottom: 5,
      color: colors.botMessageText, // Use color from context
      lineHeight: 22, // Adjust for readability
    },
    timestamp: {
      fontSize: 12,
      opacity: 0.7,
      alignSelf: 'flex-end',
      color: colors.timestamp, // Use color from context
      marginTop: 4,
    },
  });

  // Check if the message is fully displayed
  const isFullyDisplayed = !isNewMessage || displayedText === messageText;

  return (
    <View style={styles.botMessageWrapper}>
      {personalityEmoji && <Text style={styles.personalityEmoji}>{personalityEmoji}</Text>}
      <View style={styles.messageContainer}>
        <View style={styles.messageContent}>
          <Text style={styles.messageText}>{displayedText}</Text>
          {/* Always show timestamp for old messages, and for new messages once typing is complete */}
          {isFullyDisplayed && (
            <Text style={styles.timestamp}>{new Date(parseInt(timestamp)).toLocaleTimeString()}</Text>
          )}
        </View>
      </View>
    </View>
  );
};

export default BotMessageBubble;
