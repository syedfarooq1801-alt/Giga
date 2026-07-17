import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions,
  FlatList,
} from 'react-native';
import { ResizeMode, Video } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/FirebaseAuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../utils/api';

const { width, height } = Dimensions.get('window');

interface Gig {
  id: string;
  videoUrl: string;
  userAvatar: string;
  username: string;
  description: string;
  likes: number;
  comments: number;
}

export const GigsScreen: React.FC = () => {
  const { isDark } = useTheme();
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef(null);
  const { signOut } = useAuth();

  const theme = {
    light: {
      background: '#000000',
      text: '#ffffff',
      secondaryText: '#8e8e8e',
      accent: '#0095f6',
      overlay: 'rgba(0,0,0,0.5)',
    },
    dark: {
      background: '#000000',
      text: '#ffffff',
      secondaryText: '#8e8e8e',
      accent: '#0095f6',
      overlay: 'rgba(0,0,0,0.5)',
    },
  };

  const currentTheme = isDark ? theme.dark : theme.light;

  useEffect(() => {
    fetchGigs();
  }, []);

  const fetchGigs = async () => {
    try {
      const response = await api.get<Gig[]>('/gigs');
      if (response.success && response.user) {
        setGigs(response.user);
      } else {
        setGigs([]);
      }
    } catch (err) {
      console.error('Failed to fetch gigs', err);
      Alert.alert('Error', 'Failed to fetch gigs');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('Failed to sign out', err);
      Alert.alert('Error', 'Failed to sign out');
    }
  };

  const renderGig = ({ item, index }: { item: any; index: number }) => (
    <View style={styles.gigItem}>
      <Video
        source={{ uri: item.videoUrl }}
        style={styles.gigVideo}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay={index === currentIndex}
        isLooping
        isMuted={false}
      />
      <View style={styles.gigOverlay}>
        <View style={styles.gigInfo}>
          <Image source={{ uri: item.userAvatar }} style={styles.gigAvatar} />
          <Text style={styles.gigUsername}>{item.username}</Text>
          <TouchableOpacity style={styles.followButton}>
            <Text style={styles.followButtonText}>Follow</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.gigDescription}>{item.description}</Text>
        <View style={styles.gigActions}>
          <TouchableOpacity style={styles.gigActionButton}>
            <Ionicons name="heart-outline" size={24} color="#fff" />
            <Text style={styles.gigActionText}>{item.likes}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.gigActionButton}>
            <Ionicons name="chatbubble-outline" size={24} color="#fff" />
            <Text style={styles.gigActionText}>{item.comments}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.gigActionButton}>
            <Ionicons name="share-social-outline" size={24} color="#fff" />
            <Text style={styles.gigActionText}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: currentTheme.background }]}>
        <ActivityIndicator size="large" color={currentTheme.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
      <LinearGradient
        colors={['#1a365d', '#2d3748']}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Gigs</Text>
        <TouchableOpacity onPress={handleSignOut} style={styles.signOutButton}>
          <Ionicons name="log-out-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      <FlatList
        ref={flatListRef}
        data={gigs}
        renderItem={renderGig}
        keyExtractor={item => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={height}
        snapToAlignment="start"
        decelerationRate="fast"
        onMomentumScrollEnd={(event) => {
          const index = Math.round(event.nativeEvent.contentOffset.y / height);
          setCurrentIndex(index);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  signOutButton: {
    padding: 8,
  },
  gigItem: {
    width,
    height,
    backgroundColor: '#000',
  },
  gigVideo: {
    width: '100%',
    height: '100%',
  },
  gigOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  gigInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  gigAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#fff',
  },
  gigUsername: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  followButton: {
    backgroundColor: '#0095f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  followButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  gigDescription: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 12,
  },
  gigActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gigActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
  },
  gigActionText: {
    color: '#fff',
    marginLeft: 4,
    fontSize: 12,
  },
}); 