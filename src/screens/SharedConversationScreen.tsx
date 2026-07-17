import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { getAuth } from 'firebase/auth';
import Toast from 'react-native-toast-message';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { MessageBubble } from '../components/MessageBubble';
import { PERSONALITIES } from '../constants/personalities';
import { API_URL } from '../constants';
import { setPendingConversationId } from '../utils/pendingConversation';
import type { BackendMessage } from '../types/ChatMessage';

type SharedConversationScreenProps = {
  route: { params?: { token?: string } };
  navigation: any;
};

export const SharedConversationScreen: React.FC<SharedConversationScreenProps> = ({ route, navigation }) => {
  const { colors, typography } = useTheme();
  const { session } = useAuth();
  const token = route?.params?.token;
  const [messages, setMessages] = useState<BackendMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [continuing, setContinuing] = useState(false);

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

  const handleContinue = async () => {
    if (!token) return;
    if (!session.user) {
      Toast.show({ type: 'info', text1: 'Sign in to continue this chat', position: 'bottom' });
      navigation.navigate('Auth');
      return;
    }
    setContinuing(true);
    try {
      const idToken = await getAuth().currentUser?.getIdToken();
      const res = await fetch(`${API_URL}/api/shared/${token}/continue`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setPendingConversationId(data.conversation_id);
      navigation.navigate('Main', { screen: 'Chat' });
    } catch {
      Toast.show({ type: 'error', text1: 'Could not continue this chat', text2: 'Try again in a moment.', position: 'bottom' });
    } finally {
      setContinuing(false);
    }
  };

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
        contentContainerStyle={{ padding: 10, paddingBottom: 90 }}
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
      <View style={[styles.continueBar, { backgroundColor: colors.paper, borderTopColor: colors.line }]}>
        <TouchableOpacity
          style={[styles.continueButton, { backgroundColor: colors.accent }, continuing && { opacity: 0.7 }]}
          onPress={handleContinue}
          disabled={continuing}
        >
          {continuing ? (
            <ActivityIndicator size="small" color={colors.accentContrast} />
          ) : (
            <Text style={[styles.continueButtonText, { color: colors.accentContrast }]}>Continue this chat</Text>
          )}
        </TouchableOpacity>
      </View>
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
    continueBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      padding: 12,
      borderTopWidth: 1,
    },
    continueButton: {
      paddingVertical: 14,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
    },
    continueButtonText: {
      fontSize: 15,
      fontWeight: '700',
    },
  });
