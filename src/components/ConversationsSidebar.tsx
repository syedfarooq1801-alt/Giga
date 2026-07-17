import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  Platform,
  ViewStyle,
  TextStyle,
  ModalProps,
  FlatListProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Conversation } from '../contexts/ConversationContext';

interface ConversationsSidebarProps {
  isVisible: boolean;
  onClose: () => void;
  conversations: Conversation[];
  onSelectConversation: (id: string) => void;
  onCreateNew: () => void;
  currentConversationId: string;
  isCurrentConversationEmpty: boolean;
}

interface Styles {
  modalContainer: ViewStyle;
  sidebar: ViewStyle;
  header: ViewStyle;
  headerTitle: TextStyle;
  closeButton: ViewStyle;
  newButton: ViewStyle;
  newButtonText: TextStyle;
  conversationsList: ViewStyle;
  conversationItem: ViewStyle;
  conversationContent: ViewStyle;
  conversationTitle: TextStyle;
  conversationDate: TextStyle;
  newButtonDisabled: ViewStyle;
  newButtonTextDisabled: TextStyle;
}

const ConversationsSidebar: React.FC<ConversationsSidebarProps> = ({
  isVisible,
  onClose,
  conversations,
  onSelectConversation,
  onCreateNew,
  currentConversationId,
  isCurrentConversationEmpty,
}) => {
  const renderConversation: FlatListProps<Conversation>['renderItem'] = ({ item }) => {
    const firstMessage = item.messages[0]?.text || 'New conversation';
    const title = item.title || firstMessage.substring(0, 30) + (firstMessage.length > 30 ? '...' : '');
    const date = new Date(item.timestamp).toLocaleDateString();

    return (
      <TouchableOpacity
        style={styles.conversationItem}
        onPress={() => onSelectConversation(item.id)}
      >
        <View style={styles.conversationContent}>
          <Text style={styles.conversationTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.conversationDate}>{date}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.sidebar}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Conversations</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.newButton,
              isCurrentConversationEmpty && styles.newButtonDisabled
            ]}
            onPress={onCreateNew}
            disabled={isCurrentConversationEmpty}
          >
            <Ionicons 
              name="add-circle-outline" 
              size={24} 
              color={isCurrentConversationEmpty ? "#999" : "#000"} 
            />
            <Text style={[
              styles.newButtonText,
              isCurrentConversationEmpty && styles.newButtonTextDisabled
            ]}>
              {isCurrentConversationEmpty ? "Start Current Conversation First" : "New Conversation"}
            </Text>
          </TouchableOpacity>

          <FlatList<Conversation>
            data={conversations}
            renderItem={renderConversation}
            keyExtractor={(item: Conversation) => item.id}
            contentContainerStyle={styles.conversationsList}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create<Styles>({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: '80%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 2, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  newButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
  },
  conversationsList: {
    flexGrow: 1,
  },
  conversationItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  conversationContent: {
    flex: 1,
  },
  conversationTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  conversationDate: {
    fontSize: 12,
    color: '#666',
  },
  newButtonDisabled: {
    opacity: 0.5,
    backgroundColor: '#f5f5f5',
  },
  newButtonTextDisabled: {
    color: '#999',
  },
});

export { ConversationsSidebar }; 