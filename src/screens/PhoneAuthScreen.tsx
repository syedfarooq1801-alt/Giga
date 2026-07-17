import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  Alert,
  StyleSheet,
  SafeAreaView,
  Keyboard,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';

type PhoneAuthScreenProps = {
  onSuccess?: () => void;
};

const PhoneAuthScreen: React.FC<PhoneAuthScreenProps> = ({ onSuccess }) => {
  const scrollViewRef = useRef<any>(null);

  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'phone' | 'code'>('phone');

  useEffect(() => {
    Keyboard.dismiss();
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  }, [step]);

  useEffect(() => {
    Keyboard.dismiss();
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  }, [step]);
  const [confirmation, setConfirmation] = useState<FirebaseAuthTypes.ConfirmationResult | null>(null);
  
  const { isDark } = useTheme();

  const handleSendCode = async () => {
    if (!phoneNumber) {
      Alert.alert('Error', 'Please enter your phone number');
      return;
    }

    try {
      setIsLoading(true);
      
      // Format phone number to include country code if missing
      const formattedNumber = phoneNumber.startsWith('+') ? phoneNumber : `+1${phoneNumber}`;
      
      // Request a verification code
      const confirmation = await auth().signInWithPhoneNumber(formattedNumber, true);
      
      setConfirmation(confirmation);
      setStep('code');
    } catch (error: any) {
      console.error('Error sending code:', error);
      Alert.alert('Error', error.message || 'Failed to send verification code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode || !confirmation) {
      Alert.alert('Error', 'Please enter the verification code');
      return;
    }

    try {
      setIsLoading(true);
      await confirmation.confirm(verificationCode);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error verifying code:', error);
      Alert.alert('Error', error.message || 'Invalid verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const containerStyle: ViewStyle = {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: isDark ? '#000' : '#fff' } as ViewStyle]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
      >
        <View 
          style={[styles.container, containerStyle]} 
          onStartShouldSetResponder={() => true}
          onResponderGrant={Keyboard.dismiss}
        >
          <LinearGradient
            colors={isDark ? ['#000000', '#1a1a1a'] : ['#ffffff', '#f5f5f5']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        {step === 'code' && (
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => setStep('phone')}
          >
            <Ionicons 
              name="arrow-back" 
              size={24} 
              color={isDark ? '#fff' : '#000'} 
            />
          </TouchableOpacity>
        )}

        <Text style={[styles.title, { color: isDark ? '#fff' : '#000' }]}>
          {step === 'phone' ? 'Enter Your Phone Number' : 'Enter Verification Code'}
        </Text>

        {step === 'phone' ? (
          <>
            <TextInput
              style={[
                styles.input,
                { 
                  backgroundColor: isDark ? '#333' : '#f0f0f0',
                  color: isDark ? '#fff' : '#000',
                  borderColor: isDark ? '#444' : '#ddd'
                }
              ]}
              placeholder="+1 (555) 123-4567"
              placeholderTextColor={isDark ? '#888' : '#999'}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              autoFocus
            />
            <TouchableOpacity
              style={[styles.button, isLoading && { opacity: 0.7 }]}
              onPress={handleSendCode}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Send Verification Code</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={[styles.subtitle, { color: isDark ? '#888' : '#666' }]}>
              We've sent a verification code to {phoneNumber}
            </Text>
            <TextInput
              style={[
                styles.input,
                { 
                  backgroundColor: isDark ? '#333' : '#f0f0f0',
                  color: isDark ? '#fff' : '#000',
                  borderColor: isDark ? '#444' : '#ddd'
                }
              ]}
              placeholder="Enter 6-digit code"
              placeholderTextColor={isDark ? '#888' : '#999'}
              value={verificationCode}
              onChangeText={setVerificationCode}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.button, isLoading && { opacity: 0.7 }]}
              onPress={handleVerifyCode}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Verify Code</Text>
              )}
            </TouchableOpacity>
          </>
        )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  input: {
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    color: '#666',
  },
  backButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    zIndex: 1,
  },
});

export default PhoneAuthScreen;
