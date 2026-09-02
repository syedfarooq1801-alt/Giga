import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
} from 'react-native';

import { getAuth } from 'firebase/auth';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/FirebaseAuthContext';
import { useGuest } from '../contexts/GuestContext';
import { collectGuestDataForMigration } from '../services/guestSession';
import { migrateGuestConversations } from '../services/guestChat';
import { Ionicons } from '@expo/vector-icons';

type AuthMode = 'login' | 'signup';

const EmailAuthScreen = () => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(true);

  const scrollViewRef = useRef<any>(null);

  const { signInWithEmail, signUpWithEmail, sendPasswordResetEmail } = useAuth();
  const { isGuest, enterGuestMode, exitGuestMode } = useGuest();
  const [guestLoading, setGuestLoading] = useState(false);
  const { colors, radius, typography } = useTheme();
  const styles = makeStyles(colors, radius, typography);

  const handleContinueAsGuest = async () => {
    setGuestLoading(true);
    try {
      await enterGuestMode();
      // No navigation call needed -- Navigation itself swaps to the Main
      // stack the moment isGuest flips true (same mechanism as signing in).
    } finally {
      setGuestLoading(false);
    }
  };

  useEffect(() => {
    Keyboard.dismiss(); // Dismiss keyboard on mode change
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: 0, animated: true });
    }
  }, [mode]);

  const handleForgotPassword = async () => {
    setForgotLoading(true);
    setForgotMessage('');
    setForgotSuccess(true);
    try {
      await sendPasswordResetEmail(forgotEmail.trim());
      setForgotMessage('If this email exists, a reset link has been sent.');
    } catch (err: any) {
      setForgotMessage('Failed to send reset link. Try again.');
      setForgotSuccess(false);
    } finally {
      setForgotLoading(false);
    }
  };

  // Runs after a successful login -- if this browser has guest chats
  // sitting in AsyncStorage (from before this sign-in, or from a signup
  // that then forced a re-login), upload them into the now-real account
  // and clear local guest state. Best-effort: a failed migration leaves
  // guest data in place rather than losing it, so it can be retried on
  // the next login instead of silently vanishing.
  const migrateGuestDataIfAny = async () => {
    if (!isGuest) return;
    try {
      const payload = await collectGuestDataForMigration();
      if (payload.conversations.length === 0) {
        await exitGuestMode();
        return;
      }
      const idToken = await getAuth().currentUser?.getIdToken();
      if (!idToken) return;
      const result = await migrateGuestConversations(idToken, payload);
      if (result) {
        await exitGuestMode();
      }
    } catch (e) {
      console.warn('[EmailAuthScreen] Guest migration failed, will retry next login:', e);
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError('');

      if (mode === 'login') {
        await signInWithEmail(email, password);
        // Navigation will be handled by parent on auth state change
        await migrateGuestDataIfAny();
      } else {
        // signup mode
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        if (!name.trim() || !username.trim()) {
          throw new Error('Name and username are required');
        }
        await signUpWithEmail(email, password, name, username);
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setName('');
        setUsername('');
        alert('Account created successfully! Please log in.');
        setMode('login');
        window.location.href = window.location.origin + '/login';
      }
    } catch (err: any) {
      let errorMessage = 'Authentication failed. Please try again.';
      if (err.code) {
        switch (err.code) {
          case 'auth/user-not-found':
            errorMessage = 'No account found with this email.';
            break;
          case 'auth/wrong-password':
            errorMessage = 'Incorrect password. Please try again.';
            break;
          case 'auth/invalid-email':
            errorMessage = 'Invalid email address.';
            break;
          case 'auth/email-already-in-use':
            errorMessage = 'This email is already in use.';
            break;
          case 'auth/weak-password':
            errorMessage = 'Password should be at least 6 characters.';
            break;
          case 'auth/too-many-requests':
            errorMessage = 'Too many failed attempts. Please wait and try again.';
            break;
          default:
            errorMessage = err.message || errorMessage;
        }
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = () => {
    if (mode === 'login') {
      return email.includes('@') && password.length >= 6;
    } else {
      return (
        email.includes('@') &&
        password.length >= 6 &&
        password === confirmPassword &&
        name.trim().length > 0 &&
        username.trim().length > 0
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.formContainer}>
          <Text style={styles.title}>{mode === 'login' ? 'Welcome to Giga BhAI' : 'Create Account'}</Text>

          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor={colors.sub}
              value={email}
              onChangeText={(text: string) => {
                setEmail(text);
                setError('');
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
          </View>

          {mode === 'signup' && (
            <>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your full name"
                  placeholderTextColor={colors.sub}
                  value={name}
                  onChangeText={(text: string) => {
                    setName(text);
                    setError('');
                  }}
                  editable={!loading}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Username</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Choose a username"
                  placeholderTextColor={colors.sub}
                  value={username}
                  onChangeText={(text: string) => {
                    setUsername(text);
                    setError('');
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
              </View>
            </>
          )}

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Password</Text>
            <View style={{ position: 'relative' }}>
              <TextInput
                style={[styles.input, { paddingRight: 44 }]}
                placeholder="Enter your password"
                placeholderTextColor={colors.sub}
                value={password}
                onChangeText={(text: string) => {
                  setPassword(text);
                  setError('');
                }}
                secureTextEntry={!showPassword}
                editable={!loading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                style={styles.eyeButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={22} color={colors.sub} />
              </TouchableOpacity>
            </View>
          </View>

          {mode === 'signup' && (
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Confirm your password"
                placeholderTextColor={colors.sub}
                value={confirmPassword}
                onChangeText={(text: string) => {
                  setConfirmPassword(text);
                  setError('');
                }}
                secureTextEntry
                editable={!loading}
              />
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, { opacity: !isFormValid() || loading ? 0.6 : 1 }]}
            onPress={handleSubmit}
            disabled={!isFormValid() || loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.accentContrast} />
            ) : (
              <Text style={styles.buttonText}>{mode === 'login' ? 'Log In' : 'Sign Up'}</Text>
            )}
          </TouchableOpacity>

          {mode === 'login' && (
            <TouchableOpacity style={styles.linkButton} onPress={() => setShowForgotPassword(true)} disabled={loading}>
              <Text style={styles.linkText}>Forgot Password?</Text>
            </TouchableOpacity>
          )}

          {showForgotPassword && (
            <View style={styles.forgotCard}>
              <Text style={styles.forgotTitle}>Reset Password</Text>
              <Text style={styles.forgotBody}>Enter your email address and we'll send you a reset link.</Text>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={colors.sub}
                value={forgotEmail}
                onChangeText={setForgotEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!forgotLoading}
              />
              <TouchableOpacity
                style={[styles.button, { marginTop: 12 }]}
                onPress={handleForgotPassword}
                disabled={forgotLoading || !forgotEmail.includes('@')}
              >
                {forgotLoading ? (
                  <ActivityIndicator color={colors.accentContrast} />
                ) : (
                  <Text style={styles.buttonText}>Send Reset Link</Text>
                )}
              </TouchableOpacity>
              {forgotMessage ? (
                <Text style={[styles.forgotMessage, { color: forgotSuccess ? colors.success : colors.danger }]}>
                  {forgotMessage}
                </Text>
              ) : null}
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => {
                  setShowForgotPassword(false);
                  setForgotMessage('');
                  setForgotEmail('');
                }}
              >
                <Text style={styles.linkText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={styles.switchModeButton} onPress={() => setMode(mode === 'login' ? 'signup' : 'login')} disabled={loading}>
            <Text style={styles.switchModeText}>
              {mode === 'login' ? "Don't have an account? Sign Up" : 'Already have an account? Log In'}
            </Text>
          </TouchableOpacity>

          <View style={styles.guestDivider}>
            <View style={styles.guestDividerLine} />
            <Text style={styles.guestDividerText}>or</Text>
            <View style={styles.guestDividerLine} />
          </View>

          <TouchableOpacity
            style={[styles.guestButton, { opacity: guestLoading ? 0.6 : 1 }]}
            onPress={handleContinueAsGuest}
            disabled={guestLoading}
          >
            {guestLoading ? (
              <ActivityIndicator color={colors.ink} />
            ) : (
              <Text style={styles.guestButtonText}>Continue as guest</Text>
            )}
          </TouchableOpacity>
          <Text style={styles.guestHint}>
            Basic chat only, stored on this device. Sign in anytime to save it to your account.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const makeStyles = (colors: any, radius: any, typography: any) =>
  StyleSheet.create({
    container: { flex: 1 },
    scrollContainer: { flexGrow: 1, justifyContent: 'center', padding: 20 },
    formContainer: { width: '100%', maxWidth: 400, alignSelf: 'center' },
    title: {
      fontSize: typography.size.xl,
      fontWeight: typography.weight.black,
      letterSpacing: typography.letterSpacingTight,
      marginBottom: 28,
      textAlign: 'center',
      color: colors.ink,
      fontFamily: typography.fontFamily,
    },
    inputContainer: { marginBottom: 16 },
    label: { marginBottom: 8, fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.ink },
    input: {
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radius.md,
      padding: 13,
      fontSize: typography.size.base,
      backgroundColor: colors.surface,
      color: colors.ink,
    },
    eyeButton: {
      position: 'absolute',
      right: 6,
      top: 0,
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      width: 36,
    },
    button: {
      marginTop: 8,
      padding: 15,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
    },
    buttonText: { color: colors.accentContrast, fontSize: typography.size.base, fontWeight: typography.weight.bold },
    linkButton: { marginTop: 12, padding: 10, alignItems: 'center' },
    linkText: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.accent },
    switchModeButton: { marginTop: 16, padding: 12, alignItems: 'center' },
    switchModeText: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.accent },
    guestDivider: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 4 },
    guestDividerLine: { flex: 1, height: 1, backgroundColor: colors.line },
    guestDividerText: { marginHorizontal: 10, fontSize: typography.size.sm, color: colors.sub },
    guestButton: {
      marginTop: 8,
      padding: 15,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
    },
    guestButtonText: { color: colors.ink, fontSize: typography.size.base, fontWeight: typography.weight.bold },
    guestHint: { marginTop: 10, fontSize: 12, color: colors.sub, textAlign: 'center' },
    errorContainer: {
      backgroundColor: colors.dangerBg,
      padding: 12,
      borderRadius: radius.md,
      marginBottom: 16,
    },
    errorText: { color: colors.danger, textAlign: 'center', fontSize: typography.size.sm },
    forgotCard: {
      marginTop: 24,
      padding: 16,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.line,
    },
    forgotTitle: { color: colors.ink, fontWeight: typography.weight.bold, marginBottom: 8, fontSize: typography.size.base },
    forgotBody: { color: colors.sub, marginBottom: 8, fontSize: 13 },
    forgotMessage: { marginTop: 8, textAlign: 'center', fontSize: 13 },
  });

export default EmailAuthScreen;
