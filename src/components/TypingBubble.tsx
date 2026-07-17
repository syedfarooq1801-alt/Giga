import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

export const TypingBubble: React.FC = () => {
  const { colors, radius } = useTheme();
  const dotScales = [useRef(new Animated.Value(1)).current, useRef(new Animated.Value(1)).current, useRef(new Animated.Value(1)).current];

  useEffect(() => {
    dotScales.forEach((scale, idx) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(idx * 100),
          Animated.timing(scale, {
            toValue: 1.5,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.delay(300 - idx * 100),
        ])
      ).start();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.row}>
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.botMessageBackground,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            borderBottomRightRadius: radius.lg,
            borderBottomLeftRadius: radius.sm / 2,
          },
        ]}
      >
        {[0, 1, 2].map((i) => (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              { backgroundColor: colors.sub, transform: [{ scale: dotScales[i] }] },
            ]}
          />
        ))}
      </View>
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
    justifyContent: 'flex-start',
  },
  container: {
    minWidth: 52,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 3,
  },
});
