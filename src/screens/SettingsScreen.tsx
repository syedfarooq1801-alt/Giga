import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  Modal,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/FirebaseAuthContext'; // Make sure this is the correct AuthContext
import { uploadFeedback } from '../services/feedback';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../navigation/types';
import { PERSONALITIES, DEFAULT_PERSONALITY_ID } from '../constants/personalities';
import { getPersonaAccent } from '../theme/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';

const APP_VERSION = '0.01';
const APP_TAGLINE = 'Desi dimaag, Giga level swag';

export const SettingsScreen: React.FC = () => {
  const scrollViewRef = useRef<any>(null);

  const { colors, radius, typography, toggleTheme, isDark } = useTheme();
  const { signOut, user, userProfile } = useAuth();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [feedback, setFeedback] = useState('');
  const [defaultPersonality, setDefaultPersonality] = useState<string>(DEFAULT_PERSONALITY_ID);
  const [saveChats, setSaveChats] = useState(true);
  const [showTerms, setShowTerms] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    Keyboard.dismiss();
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  }, [showTerms, showAbout]);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await AsyncStorage.getItem('userSettings');
      if (settings) {
        const currentSettings = JSON.parse(settings);
        setDefaultPersonality(currentSettings.defaultPersonality || DEFAULT_PERSONALITY_ID);
        setSaveChats(currentSettings.saveChats ?? true);
      } else {
        setDefaultPersonality(DEFAULT_PERSONALITY_ID);
        setSaveChats(true);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      setDefaultPersonality(DEFAULT_PERSONALITY_ID);
      setSaveChats(true);
    }
  };

  const saveSettings = async (overrides: { defaultPersonality?: string; saveChats?: boolean } = {}) => {
    try {
      const settings = {
        defaultPersonality: overrides.defaultPersonality ?? defaultPersonality,
        saveChats: overrides.saveChats ?? saveChats,
      };
      await AsyncStorage.setItem('userSettings', JSON.stringify(settings));
      Toast.show({
        type: 'success',
        text1: 'Settings saved successfully!',
        position: 'bottom',
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to save settings',
        position: 'bottom',
      });
    }
  };

  const submitFeedback = async () => {
    if (!feedback.trim()) {
      Alert.alert('Empty Feedback', 'Please enter your feedback before submitting.');
      return;
    }
    if (!user) {
      Alert.alert('Not logged in', 'You must be logged in to submit feedback.');
      return;
    }
    setIsLoading(true);
    try {
      const email = user.email || '';
      const name = user.displayName || '';
      let username = '';
      let profileId = '';
      if (userProfile && userProfile.username) {
        username = userProfile.username;
      }
      if (userProfile && userProfile.id) {
        profileId = userProfile.id;
      } else if (user.providerData && user.providerData.length > 0) {
        profileId = `${user.uid}_${user.providerData[0].providerId}`;
      } else {
        profileId = user.uid;
      }
      await uploadFeedback(feedback, { email, name, username, profileId });
      setFeedback('');
      Toast.show({
        type: 'success',
        text1: 'Feedback submitted!',
        text2: 'Thank you for your feedback.',
        position: 'bottom',
      });
    } catch (error) {
      console.error('Error submitting feedback:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to submit feedback',
        text2: (error as Error).message,
        position: 'bottom',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePersonalityChange = (personalityId: string) => {
    setDefaultPersonality(personalityId);
    saveSettings({ defaultPersonality: personalityId });
  };

  const handleSaveChatToggle = () => {
    const next = !saveChats;
    setSaveChats(next);
    saveSettings({ saveChats: next });
  };

  const handleLogout = async () => {
    try {
      setIsLoading(true);
      Toast.show({ type: 'info', text1: 'Logging out...' });
      await signOut();
      Toast.show({
        type: 'success',
        text1: 'Logged out successfully',
        position: 'bottom',
      });
      setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Auth' } as const],
        });
      }, 500);
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Logout Error', error instanceof Error ? error.message : 'Unknown error');
      Toast.show({
        type: 'error',
        text1: 'Failed to log out',
        position: 'bottom',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const styles = makeStyles(colors, radius, typography);

  return (
    <View style={[styles.container, { backgroundColor: colors.paper }]}>
      <LinearGradient colors={[colors.paper, colors.surface]} style={{ flex: 1 }}>
        <ScrollView style={styles.scrollContent} ref={scrollViewRef}>
          {/* Theme Toggle */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Appearance</Text>
            <View style={styles.themeToggleContainer}>
              <Text style={styles.themeText}>Dark Mode</Text>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: colors.line, true: colors.accent }}
                thumbColor={colors.paper}
                ios_backgroundColor={colors.line}
              />
            </View>
          </View>

          {/* Personality Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Default Personality</Text>
            <View style={styles.personalityContainer}>
              {Object.values(PERSONALITIES).map((personality) => {
                const isSelected = defaultPersonality === personality.id;
                const accent = getPersonaAccent(personality.id, isDark);
                return (
                  <TouchableOpacity
                    key={personality.id}
                    style={styles.personalityOption}
                    onPress={() => handlePersonalityChange(personality.id)}
                  >
                    <Ionicons
                      name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                      size={22}
                      color={isSelected ? accent : colors.sub}
                    />
                    <Text style={styles.personalityEmoji}>{personality.emoji}</Text>
                    <Text style={[styles.personalityText, { color: isSelected ? accent : colors.ink }]}>
                      {personality.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Chat History */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Chat History</Text>
            <View style={styles.saveChatContainer}>
              <Text style={styles.saveChatText}>Save Chat History</Text>
              <Switch
                value={saveChats}
                onValueChange={handleSaveChatToggle}
                trackColor={{ false: colors.line, true: colors.accent }}
                thumbColor={colors.paper}
                ios_backgroundColor={colors.line}
              />
            </View>
          </View>

          {/* Feedback */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Send Feedback</Text>
            <TextInput
              style={styles.feedbackInput}
              placeholder="Share your thoughts or report issues..."
              placeholderTextColor={colors.sub}
              value={feedback}
              onChangeText={setFeedback}
              multiline
            />
            <TouchableOpacity
              style={[styles.submitButton, { opacity: isLoading ? 0.7 : 1 }]}
              onPress={submitFeedback}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.accentContrast} size="small" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Feedback</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* About Button */}
        <TouchableOpacity style={styles.aboutButton} onPress={() => setShowAbout(true)}>
          <Text style={styles.aboutButtonText}>About</Text>
        </TouchableOpacity>

        {/* Terms Button */}
        <TouchableOpacity style={styles.termsButton} onPress={() => setShowTerms(true)}>
          <Text style={styles.termsButtonText}>Terms &amp; Conditions</Text>
        </TouchableOpacity>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>

        {/* Terms & Conditions Modal */}
        <Modal visible={showTerms} animationType="slide" onRequestClose={() => setShowTerms(false)}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Terms &amp; Privacy Policy</Text>
              <TouchableOpacity onPress={() => setShowTerms(false)}>
                <Ionicons name="close" size={24} color={colors.ink} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              <Text style={styles.termsText}>
                📜 Giga Bhai — Terms and Conditions{'\n'}
                Last Updated: 07-06-25{'\n'}
                {'\n'}
                Welcome to Giga Bhai — your desi AI chatbot with giga-level swag. Before you start chatting with our quirky personalities, please take a moment to read these Terms and Conditions carefully. By accessing or using the Giga Bhai app ("App"), you agree to be bound by these terms.{'\n'}
                {'\n'}
                1. Acceptance of Terms{'\n'}
                By creating an account, logging in, or using Giga Bhai in any capacity, you agree to these Terms and our Privacy Policy. If you do not agree, please do not use the app.{'\n'}
                {'\n'}
                2. Eligibility{'\n'}
                To use Giga Bhai, you must:{'\n'}
                - Be at least 13 years old.{'\n'}
                - Have a valid email address to create an account.{'\n'}
                - Not use the app for any illegal or abusive purposes.{'\n'}
                {'\n'}
                3. Account Registration{'\n'}
                You must sign up using your email address.{'\n'}
                - Keep your login credentials secure and do not share them.{'\n'}
                - You are responsible for all activity under your account.{'\n'}
                {'\n'}
                4. User Content and Conduct{'\n'}
                You agree not to:{'\n'}
                - Upload or share offensive, abusive, or adult content.{'\n'}
                - Harass or impersonate others.{'\n'}
                - Abuse any feature (e.g., sending spammy or abusive messages).{'\n'}
                - Use the app for any unlawful purpose.{'\n'}
                We reserve the right to suspend or delete any account violating these rules.{'\n'}
                {'\n'}
                5. AI Personalities{'\n'}
                Giga Bhai offers 5 personalities for entertainment and utility:{'\n'}
                - Swag Bhai{'\n'}
                - CEO Bhai{'\n'}
                - Roast Bhai{'\n'}
                - Vidhyarthi Bhai{'\n'}
                - Jugadu Bhai{'\n'}
                Each personality provides responses using artificial intelligence (AI). While we strive to ensure useful and funny replies, these personalities are fictional, and no advice given should be considered professional, legal, financial, or medical guidance.{'\n'}
                {'\n'}
                6. Data & Chat Storage{'\n'}
                Your chats are stored securely in Firebase Firestore and linked to your account.{'\n'}
                We use this data to improve your experience and may use it anonymously for app improvement or training AI models in the future.{'\n'}
                You can request deletion of your data at any time by emailing us.{'\n'}
                {'\n'}
                7. App Updates & Feature Changes{'\n'}
                We may:{'\n'}
                - Add, modify, or remove features (like voice, memes, Rasa training) without prior notice.{'\n'}
                - Change the personalities or themes for improvement or policy compliance.{'\n'}
                {'\n'}
                8. Termination{'\n'}
                We reserve the right to suspend or terminate your access to the app at any time, without notice, if you:{'\n'}
                - Violate any part of these Terms.{'\n'}
                - Misuse the platform.{'\n'}
                - Create harm or disruption to the service or its users.{'\n'}
                {'\n'}
                9. Intellectual Property{'\n'}
                The Giga Bhai brand, personalities, logos, and content are owned by [Your Name/Company].{'\n'}
                You may not copy, modify, distribute, or reuse any content from the app without permission.{'\n'}
                {'\n'}
                10. Limitation of Liability{'\n'}
                Giga Bhai is offered as-is. We do not guarantee:{'\n'}
                - 100% accurate or appropriate responses{'\n'}
                - Uninterrupted or error-free service{'\n'}
                - That responses won’t be offensive or inappropriate on rare occasions{'\n'}
                In no event shall we be liable for any damages arising from the use of the app.{'\n'}
                {'\n'}
                11. Privacy Policy{'\n'}
                By using Giga Bhai, you also agree to our Privacy Policy. It explains how we collect, store, and use your data.{'\n'}
                {'\n'}
                12. Changes to These Terms{'\n'}
                We may update these Terms occasionally. Users will be notified of major changes. Continued use of the app after changes implies acceptance.{'\n'}
                {'\n'}
                13. Contact Us{'\n'}
                If you have questions about these Terms or the app, reach out to us at:{'\n'}
                📧 Email: bhaigiga01@gmail.com{'\n'}
                📍 Location: Bangalore, India{'\n'}
                {'\n'}
                🙏 Thank You!{'\n'}
                Thanks for trusting Giga Bhai — whether you need a laugh, a roast, or some smart advice, we’re here to deliver with full desi swag!{'\n'}
              </Text>
            </ScrollView>
          </View>
        </Modal>

        {/* About Modal */}
        <Modal visible={showAbout} animationType="slide" onRequestClose={() => setShowAbout(false)}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>About Giga Bhai</Text>
              <TouchableOpacity onPress={() => setShowAbout(false)}>
                <Ionicons name="close" size={24} color={colors.ink} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              <Text style={styles.aboutText}>
                Giga Bhai is not just another chatbot — it’s your ultimate desi digital dost with giga-level swag. Built for the new-age Indian user, Giga Bhai blends intelligent conversation with personality-driven fun. Whether you need life advice, tech help, motivation, or just some casual banter to make your day better, Giga Bhai’s got your back — with style.{"\n\n"}Inspired by the vibe of Instagram DMs, Giga Bhai gives you a smooth, familiar chat experience but with a powerful AI twist. Each conversation happens inside a clean, intuitive interface where you feel like you're chatting with a real bro — not a boring bot.{"\n\n"}What makes Giga Bhai truly unique is its 5 hilarious and relatable AI personalities, each offering a different flavor of interaction:{"\n\n"}🧢 Swag Bhai – Your cool, confident dost who keeps it casual and stylish.{"\n\n"}💼 CEO Bhai – All about ambition, strategy, and giving gyaan like a boss.{"\n\n"}🔥 Roast Bhai – Savage, sarcastic, and ready to burn you (lovingly) with words.{"\n\n"}📚 Vidhyarthi Bhai – A fellow student and nerdy companion who understands the exam stress.{"\n\n"}🧠 Jugadu Bhai – The ultimate hack master who always has a shortcut or solution to every problem.{"\n\n"}You can switch between these personalities anytime with just a tap, and your conversations are saved — so you can pick up right where you left off. All your chats are securely stored using Firebase, and you can log in easily via your email to keep your data and vibe in sync across sessions.{"\n\n"}Whether you’re coding, chilling, ranting, or just vibing — Giga Bhai is there to listen, respond, and entertain. No complicated menus, no distractions — just real-time, smart, and very desi conversations that make your everyday digital life 10x more fun.{"\n"}
              </Text>
              <Text style={[styles.aboutText, { marginTop: 10 }]}>{APP_TAGLINE}</Text>
              <Text style={styles.versionText}>Version {APP_VERSION}</Text>
            </ScrollView>
          </View>
        </Modal>
      </LinearGradient>
    </View>
  );
};

const makeStyles = (colors: any, radius: any, typography: any) =>
  StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { padding: 20 },
    section: { marginBottom: 24 },
    sectionTitle: {
      fontSize: typography.size.md,
      fontWeight: typography.weight.bold,
      marginBottom: 12,
      color: colors.ink,
    },
    themeToggleContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    themeText: { fontSize: typography.size.base, color: colors.ink },
    personalityContainer: { marginTop: 8 },
    personalityOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    personalityEmoji: { fontSize: 18, marginLeft: 10 },
    personalityText: { fontSize: typography.size.base, marginLeft: 8, fontWeight: typography.weight.medium },
    feedbackInput: {
      height: 100,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radius.md,
      padding: 10,
      marginTop: 8,
      textAlignVertical: 'top',
      backgroundColor: colors.surface,
      color: colors.ink,
    },
    submitButton: {
      backgroundColor: colors.accent,
      padding: 13,
      borderRadius: radius.pill,
      alignItems: 'center',
      marginTop: 12,
    },
    submitButtonText: { color: colors.accentContrast, fontWeight: typography.weight.bold, fontSize: typography.size.base },
    saveChatContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
    saveChatText: { fontSize: typography.size.base, color: colors.ink },
    versionText: { fontSize: typography.size.xs, color: colors.sub, marginTop: 16, textAlign: 'center' },
    termsButton: { alignItems: 'center', padding: 12, marginVertical: 6 },
    termsButtonText: { fontSize: typography.size.base, color: colors.accent, fontWeight: typography.weight.medium },
    aboutButton: { alignItems: 'center', padding: 12, marginVertical: 6 },
    aboutButtonText: { fontSize: typography.size.base, color: colors.accent, fontWeight: typography.weight.medium },
    logoutButton: {
      backgroundColor: colors.danger,
      padding: 14,
      borderRadius: radius.pill,
      alignItems: 'center',
      marginHorizontal: 20,
      marginBottom: 24,
    },
    logoutButtonText: { color: '#ffffff', fontWeight: typography.weight.bold, fontSize: typography.size.base },
    modalContainer: { flex: 1, backgroundColor: colors.paper },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    modalTitle: { fontSize: typography.size.md, fontWeight: typography.weight.bold, color: colors.ink },
    modalContent: { padding: 16 },
    termsText: { fontSize: 15, lineHeight: 22, color: colors.ink },
    aboutText: { fontSize: 15, lineHeight: 22, color: colors.ink },
  });
