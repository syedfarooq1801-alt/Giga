import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { MessageBubble } from '../components/MessageBubble';
import { PERSONALITIES } from '../constants/personalities';
import { API_URL } from '../constants';
import type { BackendMessage } from '../types/ChatMessage';

type SharedConversationScreenProps = {
  route: { params?: { token?: string } };
};

export const SharedConversationScreen: React.FC<SharedConversationScreenProps> = ({ route }) => {
  const { colors, typography } = useTheme();
  const token = route?.params?.token;
  const [messages, setMessages] = useState<BackendMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token) {
      setError(true);
      setLoading(false);
      return;
    }
    fetch(`${API_URL}/api/shared/${token}`)
      .then(res => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json();
      })
      .then(data => setMessages(data.messages || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [token]);

  const styles = makeStyles(colors, typography);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.paper }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: colors.paper }]}>
        <Text style={styles.errorText}>This link is invalid or has expired.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.paper }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Shared conversation</Text>
        <Text style={styles.headerSub}>Read-only — from Giga BhAI</Text>
      </View>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 10 }}
        renderItem={({ item }) => (
          <MessageBubble
            text={item.text}
            sender={item.sender}
            personalityEmoji={
              item.sender === 'assistant' ? PERSONALITIES[item.personality || 'default']?.emoji : undefined
            }
          />
        )}
      />
    </View>
  );
};

const makeStyles = (colors: any, typography: any) =>
  StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    errorText: { color: colors.sub, fontSize: 15, textAlign: 'center' },
    header: {
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    headerTitle: { color: colors.ink, fontWeight: '800', fontSize: 16, fontFamily: typography.fontFamily },
    headerSub: { color: colors.sub, fontSize: 12, marginTop: 2 },
  });
