import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Dimensions,
  FlatList,
} from 'react-native';
import { ResizeMode, Video } from 'expo-av';
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
  const { colors, radius, typography } = useTheme();
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef(null);
  const { signOut } = useAuth();

  useEffect(() => {
    fetchGigs();
  }, []);

  const fetchGigs = async () => {
    try {
      const response = await api.get<Gig[]>('/gigs');
      setGigs(response.success && response.data ? response.data : []);
    } catch (err) {
      console.error('Failed to fetch gigs', err);
      setGigs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('Failed to sign out', err);
    }
  };

  const renderGig = ({ item, index }: { item: Gig; index: number }) => (
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
          <TouchableOpacity style={[styles.followButton, { backgroundColor: colors.accent }]}>
            <Text style={[styles.followButtonText, { color: colors.accentContrast }]}>Follow</Text>
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

  // Immersive video-feed chrome is deliberately dark regardless of app theme
  // (standard for a Reels/TikTok-style feed), but tinted off real tokens.
  return (
    <View style={styles.container}>
      <View style={[styles.header, { backgroundColor: '#0d0c0a' }]}>
        <Text style={styles.headerTitle}>Gigs</Text>
        <TouchableOpacity onPress={handleSignOut} style={styles.signOutButton}>
          <Ionicons name="log-out-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : gigs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="film-outline" size={40} color="rgba(255,255,255,0.4)" />
          <Text style={[styles.emptyTitle, { fontFamily: typography.fontFamily }]}>No Gigs yet</Text>
          <Text style={styles.emptySubtitle}>Check back soon</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={gigs}
          renderItem={renderGig}
          keyExtractor={(item) => item.id}
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
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    marginTop: 10,
  },
  emptySubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
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
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  followButtonText: {
    fontWeight: '700',
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
