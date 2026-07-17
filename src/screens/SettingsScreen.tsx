import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Platform,
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
import { PERSONALITIES } from '../constants';
import { Personality } from '../types';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';

const APP_VERSION = '0.01';
const APP_TAGLINE = 'Desi dimaag, Giga level swag';

// Define the styles type to avoid TypeScript errors
type SettingsStylesType = {
  container: any;
  scrollContent: any;
  section: any;
  sectionTitle: any;
  themeToggleContainer: any;
  themeText: any;
  personalityContainer: any;
  personalityOption: any;
  personalityText: any;
  feedbackInput: any;
  submitButton: any;
  submitButtonText: any;
  saveChatContainer: any;
  saveChatText: any;
  aboutSection: any;
  aboutText: any;
  versionText: any;
  termsButton: any;
  termsButtonText: any;
  logoutButton: any;
  logoutButtonText: any;
  modalContainer: any;
  modalHeader: any;
  modalTitle: any;
  modalContent: any;
  termsText: any;
  privacyText: any;
  debugButtonsContainer: any;
  debugButton: any;
  debugButtonText: any;
  debuggerContainer: any;
  aboutButton: any;
  aboutButtonText: any;
};

const styles = StyleSheet.create<SettingsStylesType>({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  themeToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  themeText: {
    fontSize: 16,
  },
  personalityContainer: {
    marginTop: 8,
  },
  personalityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  personalityText: {
    fontSize: 16,
    marginLeft: 10,
  },
  feedbackInput: {
    height: 100,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#0095f6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  saveChatContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  saveChatText: {
    fontSize: 16,
  },
  aboutSection: {
    backgroundColor: '#f9f9f9',
    padding: 16,
    borderRadius: 8,
  },
  aboutText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#333',
  },
  versionText: {
    fontSize: 12,
    color: '#888',
    marginTop: 16,
    textAlign: 'center',
  },
  termsButton: {
    alignItems: 'center',
    padding: 12,
    marginVertical: 16,
  },
  termsButtonText: {
    fontSize: 16,
    color: '#0095f6',
    fontWeight: '500',
  },
  aboutButton: {
    alignItems: 'center',
    padding: 12,
    marginVertical: 8,
  },
  aboutButtonText: {
    fontSize: 16,
    color: '#0095f6',
    fontWeight: '500',
  },
  logoutButton: {
    backgroundColor: '#FF3B30',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 30,
  },
  logoutButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalContent: {
    padding: 16,
  },
  termsText: {
    fontSize: 15,
    lineHeight: 22,
  },
  privacyText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
  },
  // Debug tools styles
  debugButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  debugButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  debugButtonText: {
    fontWeight: '600',
  },
  debuggerContainer: {
    marginTop: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 10,
    maxHeight: 400,
  },
});

export const SettingsScreen: React.FC = () => {
  const scrollViewRef = useRef<any>(null);

  const { theme, toggleTheme, isDark } = useTheme();
  const { signOut, user, userProfile } = useAuth();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [feedback, setFeedback] = useState('');
  const [defaultPersonality, setDefaultPersonality] = useState<string>('swag');
  const [saveChats, setSaveChats] = useState(true);
  const [showTerms, setShowTerms] = useState(false);
const [showAbout, setShowAbout] = useState(false);

  useEffect(() => {
    Keyboard.dismiss();
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  }, [showTerms, showAbout]);

  useEffect(() => {
    Keyboard.dismiss();
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  }, [showTerms, showAbout]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await AsyncStorage.getItem('userSettings');
      if (settings) {
        const currentSettings = JSON.parse(settings);
        const normalizedSettings = {
          ...currentSettings,
          lastUpdated: currentSettings.lastUpdated?.toDate ? 
            currentSettings.lastUpdated.toDate() : 
            new Date(currentSettings.lastUpdated || Date.now())
        };
        setDefaultPersonality(normalizedSettings.defaultPersonality || 'swag');
        setSaveChats(normalizedSettings.saveChats ?? true);
      } else {
        // Initialize with default values if no settings exist
        setDefaultPersonality('swag');
        setSaveChats(true);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      // Set default values on error
      setDefaultPersonality('swag');
      setSaveChats(true);
    }
  };

  const saveSettings = async () => {
    try {
      const settings = {
        defaultPersonality,
        saveChats,
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
      // Gather user info for feedback
      const email = user.email || '';
      const name = user.displayName || '';
      // Try to get username and profileId from userProfile if available
      // Try to get username and profileId from userProfile if available
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

  const handlePersonalityChange = (personality: string) => {
    setDefaultPersonality(personality);
    saveSettings();
  };

  const handleSaveChatToggle = () => {
    setSaveChats(!saveChats);
    saveSettings();
  };

  const handleLogout = async () => {
  console.log('[SettingsScreen] handleLogout called');
  console.log('[SettingsScreen] isLoading before:', isLoading);
  try {
    setIsLoading(true);
    Toast.show({
      type: 'info',
      text1: 'Logging out...'
    });
    console.log('[SettingsScreen] Calling signOut()');
    const result = await signOut();
    console.log('[SettingsScreen] signOut() finished, result:', result);
    // Check user state from closure
    setTimeout(() => {
      if (user) {
        Alert.alert('Logout Problem', 'User is still set after signOut!');
      }
    }, 500);
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
    console.log('[SettingsScreen] isLoading after setIsLoading(false):', isLoading);
  }
};

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#121212' : '#fff' }]}>
      <LinearGradient
        colors={isDark ? ['#121212', '#1a1a1a'] : ['#fff', '#f5f5f5']}
        style={{ flex: 1 }}
      >
        <ScrollView style={styles.scrollContent}>
          {/* Theme Toggle */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : '#333' }]}>
              Appearance
            </Text>
            <View style={styles.themeToggleContainer}>
              <Text style={[styles.themeText, { color: isDark ? '#fff' : '#333' }]}>
                Dark Mode
              </Text>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: '#767577', true: '#81b0ff' }}
                thumbColor={isDark ? '#f5dd4b' : '#f4f3f4'}
                ios_backgroundColor="#3e3e3e"
              />
            </View>
          </View>

          {/* Personality Selection */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : '#333' }]}>
              Default Personality
            </Text>
            <View style={styles.personalityContainer}>
              {Object.entries(PERSONALITIES).map(([key, personality]) => (
                <TouchableOpacity
                  key={key}
                  style={styles.personalityOption}
                  onPress={() => handlePersonalityChange(key)}
                >
                  <Ionicons
                    name={
                      defaultPersonality === key
                        ? 'radio-button-on'
                        : 'radio-button-off'
                    }
                    size={24}
                    color={defaultPersonality === key ? '#0095f6' : '#999'}
                  />
                  <Text
                    style={[
                      styles.personalityText,
                      {
                        color: defaultPersonality === key 
                               ? '#0095f6' 
                               : (isDark ? '#fff' : '#333'),
                      },
                    ]}
                  >
                    {(personality as Personality).name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Chat History */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : '#333' }]}>
              Chat History
            </Text>
            <View style={styles.saveChatContainer}>
              <Text style={[styles.saveChatText, { color: isDark ? '#fff' : '#333' }]}>
                Save Chat History
              </Text>
              <Switch
                value={saveChats}
                onValueChange={handleSaveChatToggle}
                trackColor={{ false: '#767577', true: '#81b0ff' }}
                thumbColor={saveChats ? '#f5dd4b' : '#f4f3f4'}
                ios_backgroundColor="#3e3e3e"
              />
            </View>
          </View>

          {/* Feedback */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : '#333' }]}>
              Send Feedback
            </Text>
            <TextInput
              style={[
                styles.feedbackInput,
                {
                  backgroundColor: isDark ? '#333' : '#fff',
                  color: isDark ? '#fff' : '#333',
                  borderColor: isDark ? '#444' : '#ddd',
                },
              ]}
              placeholder="Share your thoughts or report issues..."
              placeholderTextColor={isDark ? '#aaa' : '#999'}
              value={feedback}
              onChangeText={setFeedback}
              multiline
            />
            <TouchableOpacity
              style={[
                styles.submitButton,
                { opacity: isLoading ? 0.7 : 1 },
              ]}
              onPress={submitFeedback}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
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
        <Text style={styles.termsButtonText}>Terms & Conditions</Text>
      </TouchableOpacity>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>

      {/* Terms & Conditions Modal */}
      <Modal
        visible={showTerms}
        animationType="slide"
        onRequestClose={() => setShowTerms(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: isDark ? '#121212' : '#fff' }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: isDark ? '#fff' : '#333' }]}>
              Terms & Privacy Policy
            </Text>
            <TouchableOpacity onPress={() => setShowTerms(false)}>
              <Ionicons
                name="close"
                size={24}
                color={isDark ? '#fff' : '#333'}
              />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={[styles.termsText, { color: isDark ? '#fff' : '#333' }]}>
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
      <Modal
        visible={showAbout}
        animationType="slide"
        onRequestClose={() => setShowAbout(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: isDark ? '#121212' : '#fff' }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: isDark ? '#fff' : '#333' }]}>About Giga Bhai</Text>
            <TouchableOpacity onPress={() => setShowAbout(false)}>
              <Ionicons
                name="close"
                size={24}
                color={isDark ? '#fff' : '#333'}
              />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            <Text style={[styles.aboutText, { color: isDark ? '#fff' : '#333' }]}>Giga Bhai is not just another chatbot — it’s your ultimate desi digital dost with giga-level swag. Built for the new-age Indian user, Giga Bhai blends intelligent conversation with personality-driven fun. Whether you need life advice, tech help, motivation, or just some casual banter to make your day better, Giga Bhai’s got your back — with style.{"\n\n"}Inspired by the vibe of Instagram DMs, Giga Bhai gives you a smooth, familiar chat experience but with a powerful AI twist. Each conversation happens inside a clean, intuitive interface where you feel like you're chatting with a real bro — not a boring bot.{"\n\n"}What makes Giga Bhai truly unique is its 5 hilarious and relatable AI personalities, each offering a different flavor of interaction:{"\n\n"}🧢 Swag Bhai – Your cool, confident dost who keeps it casual and stylish.{"\n\n"}💼 CEO Bhai – All about ambition, strategy, and giving gyaan like a boss.{"\n\n"}🔥 Roast Bhai – Savage, sarcastic, and ready to burn you (lovingly) with words.{"\n\n"}📚 Vidhyarthi Bhai – A fellow student and nerdy companion who understands the exam stress.{"\n\n"}🧠 Jugadu Bhai – The ultimate hack master who always has a shortcut or solution to every problem.{"\n\n"}You can switch between these personalities anytime with just a tap, and your conversations are saved — so you can pick up right where you left off. All your chats are securely stored using Firebase, and you can log in easily via your email to keep your data and vibe in sync across sessions.{"\n\n"}Whether you’re coding, chilling, ranting, or just vibing — Giga Bhai is there to listen, respond, and entertain. No complicated menus, no distractions — just real-time, smart, and very desi conversations that make your everyday digital life 10x more fun.{"\n"}</Text>
            <Text style={[styles.aboutText, { color: isDark ? '#fff' : '#333', marginTop: 10 }]}>
              {APP_TAGLINE}
            </Text>
            <Text style={styles.versionText}>Version {APP_VERSION}</Text>
          </ScrollView>
        </View>
      </Modal>
    </LinearGradient>
  </View>
);}
