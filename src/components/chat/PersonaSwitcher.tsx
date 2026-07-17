import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { getPersonaAccent } from '../../theme/tokens';
import type { PersonalityType } from '../../types/chat';

type PersonaSwitcherProps = {
  personalities: PersonalityType[];
  selectedId: string;
  onSelect: (personality: PersonalityType) => void;
};

export const PersonaSwitcher: React.FC<PersonaSwitcherProps> = ({ personalities, selectedId, onSelect }) => {
  const { colors, isDark } = useTheme();

  return (
    <View style={styles.row}>
      {personalities.map((personality) => {
        const isActive = personality.id === selectedId;
        const accent = getPersonaAccent(personality.id, isDark);
        return (
          <TouchableOpacity
            key={personality.id}
            onPress={() => onSelect(personality)}
            style={[
              styles.chip,
              {
                backgroundColor: colors.surface,
                borderColor: isActive ? accent : 'transparent',
              },
            ]}
          >
            <Text style={styles.emoji}>{personality.emoji}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 15,
  },
});
