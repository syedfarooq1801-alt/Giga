import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTheme } from '@react-navigation/native';



export const TypingBubble: React.FC = () => {
  const { colors } = useTheme();
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
    <View style={{ flexDirection: 'row', alignItems: 'center', maxWidth: '80%', marginVertical: 4, marginHorizontal: 8, justifyContent: 'flex-start' }}>
      <View style={[styles.container, styles.botContainer, { backgroundColor: colors.primary, minWidth: 48, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }]}>  
        {[0, 1, 2].map(i => (
          <Animated.Text
            key={i}
            style={{
              transform: [{ scale: dotScales[i] }],
              color: '#fff',
              fontSize: 26,
              marginHorizontal: 2,
              fontWeight: 'bold',
            }}>
            .
          </Animated.Text>
        ))}
      </View>
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
    alignSelf: 'flex-start',
  },
  botContainer: {
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 16,
  },
});
