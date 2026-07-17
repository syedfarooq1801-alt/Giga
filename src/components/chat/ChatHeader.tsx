import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { PersonaSwitcher } from './PersonaSwitcher';
import type { PersonalityType } from '../../types/chat';

const GigaLogo = require('../../Giga-logo1.png');

type ChatHeaderProps = {
  onPressConversations: () => void;
  personalities: PersonalityType[];
  selectedPersonality: PersonalityType;
  onSelectPersonality: (personality: PersonalityType) => void;
  isDefaultPersonality: boolean;
  onShare?: () => void;
  /** Persistent sidebar (wide web) already exposes conversation history --
   *  the hamburger/modal path is redundant there. */
  hideMenuButton?: boolean;
};

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  onPressConversations,
  personalities,
  selectedPersonality,
  onSelectPersonality,
  isDefaultPersonality,
  onShare,
  hideMenuButton,
}) => {
  const { colors, typography } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.paper, borderBottomColor: colors.line }]}>
      {!hideMenuButton && (
        <TouchableOpacity onPress={onPressConversations} style={styles.menuButton}>
          <View style={styles.hamburger}>
            <View style={[styles.hamburgerLine, { backgroundColor: colors.ink }]} />
            <View style={[styles.hamburgerLine, { backgroundColor: colors.ink }]} />
            <View style={[styles.hamburgerLine, { backgroundColor: colors.ink }]} />
          </View>
        </TouchableOpacity>
      )}

      <Image source={GigaLogo} style={[styles.logo, { backgroundColor: colors.surface }]} resizeMode="contain" />

      <View style={styles.textBlock}>
        <Text style={[styles.appName, { color: colors.ink, fontFamily: typography.fontFamily }]}>Giga BhAI</Text>
        <Text style={[styles.tagline, { color: colors.sub }]} numberOfLines={1}>
          {isDefaultPersonality ? 'Desi dimaag, Giga level swag' : selectedPersonality.description}
        </Text>
      </View>

      {onShare && (
        <TouchableOpacity onPress={onShare} style={styles.shareButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="share-variant-outline" size={19} color={colors.sub} />
        </TouchableOpacity>
      )}

      <PersonaSwitcher personalities={personalities} selectedId={selectedPersonality.id} onSelect={onSelectPersonality} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  menuButton: {
    padding: 6,
    marginRight: 6,
  },
  hamburger: {
    width: 22,
    height: 16,
    justifyContent: 'space-between',
  },
  hamburgerLine: {
    height: 2,
    borderRadius: 1,
  },
  logo: {
    width: 34,
    height: 34,
    marginRight: 10,
    borderRadius: 10,
  },
  textBlock: {
    flex: 1,
    marginRight: 8,
  },
  shareButton: {
    padding: 4,
    marginRight: 8,
  },
  appName: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  tagline: {
    fontSize: 11,
    marginTop: 1,
  },
});
