import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
  RefreshControl,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { apiFetch } from '@/lib/api';
import { format } from 'date-fns';
import { useTheme } from '@/lib/theme';
import ScreenHeader from '@/components/ScreenHeader';

type ContactMe = {
  type: 'contact';
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  organizationId: string;
  phone?: string;
  countryCode?: string;
};

type Message = {
  id: string;
  content: string;
  direction: 'inbound' | 'outbound';
  status: string;
  createdAt: string;
  jobId?: string;
  jobName?: string;
};

export default function ContactMessages() {
  const { colors } = useTheme();
  const [contact, setContact] = useState<ContactMe | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const profileInitial = useMemo(() => (contact?.firstName?.[0] || 'A').toUpperCase(), [contact]);

  const loadData = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const [me, messagesRes] = await Promise.all([
        apiFetch<ContactMe>('/api/mobile/auth/me'),
        apiFetch<Message[]>('/api/contact/messages'),
      ]);

      if (me?.type !== 'contact') {
        setError('Not a contact account');
      } else {
        setContact(me);
      }

      setMessages(messagesRes || []);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load messages');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Refresh data when page comes into focus
  useFocusEffect(
    useCallback(() => {
      loadData(false);
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData(false);
  }, []);

  const formatMessageDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return format(date, 'h:mm a');
    } else if (diffInHours < 168) {
      return format(date, 'EEE h:mm a');
    } else {
      return format(date, 'MMM d, yyyy h:mm a');
    }
  };

  const handleLinkPress = async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', 'Cannot open this link');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to open link');
    }
  };

  const renderMessageWithLinks = (content: string) => {
    // URL regex pattern - matches http, https, and www URLs
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
    const parts: Array<{ text: string; isLink: boolean; url?: string }> = [];
    let lastIndex = 0;
    let match;

    while ((match = urlRegex.exec(content)) !== null) {
      // Add text before the link
      if (match.index > lastIndex) {
        parts.push({
          text: content.substring(lastIndex, match.index),
          isLink: false,
        });
      }

      // Add the link
      let url = match[0];
      // Add https:// if it's a www link
      if (url.startsWith('www.')) {
        url = 'https://' + url;
      }
      parts.push({
        text: match[0],
        isLink: true,
        url: url,
      });

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push({
        text: content.substring(lastIndex),
        isLink: false,
      });
    }

    // If no links found, return the original content
    if (parts.length === 0) {
      return <Text style={[styles.messageContent, { color: colors.text }]}>{content}</Text>;
    }

    return (
      <Text style={[styles.messageContent, { color: colors.text }]}>
        {parts.map((part, index) => {
          if (part.isLink) {
            return (
              <Text
                key={index}
                style={[styles.link, { color: colors.primaryText }]}
                onPress={() => handleLinkPress(part.url!)}
              >
                {part.text}
              </Text>
            );
          }
          return <Text key={index}>{part.text}</Text>;
        })}
      </Text>
    );
  };

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScreenHeader 
        title="Messages" 
        showBack={false}
        showProfile={true}
        profileInitial={profileInitial}
        profileRoute="/contact/settings"
      />
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primaryText} />
        }
      >
        {contact && (
          <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
            View all messages from your organization
          </Text>
        )}
        {loading && (
          <View style={styles.loader}>
            <ActivityIndicator color={colors.primaryText} />
          </View>
        )}
        {error && <Text style={[styles.error, { color: colors.error }]}>{error}</Text>}

        {!loading && messages.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="mail-outline" size={64} color={colors.iconSecondary} />
            <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>No messages</Text>
            <Text style={[styles.emptyStateSubtext, { color: colors.textTertiary }]}>
              You don't have any messages yet. Messages from your organization will appear here.
            </Text>
          </View>
        )}

        {messages.map((message) => {
          return (
            <View key={message.id} style={[styles.messageCard, { backgroundColor: colors.card }]}>
              <View style={styles.messageHeader}>
                <View style={styles.messageHeaderLeft}>
                  <Ionicons
                    name="arrow-down-circle"
                    size={18}
                    color={colors.primaryText}
                  />
                  <Text style={[styles.directionText, { color: colors.textSecondary }]}>Received</Text>
                </View>
                <Text style={[styles.timestamp, { color: colors.textTertiary }]}>
                  {formatMessageDate(message.createdAt)}
                </Text>
              </View>

              {message.jobName && (
                <View style={[styles.jobInfo, { backgroundColor: colors.backgroundTertiary }]}>
                  <Ionicons name="briefcase-outline" size={14} color={colors.icon} />
                  <Text style={[styles.jobName, { color: colors.textSecondary }]}>{message.jobName}</Text>
                </View>
              )}

              {renderMessageWithLinks(message.content)}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    flexGrow: 1,
    gap: 12,
  },
  subtitle: { fontSize: 16, marginBottom: 8 },
  messageCard: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    gap: 12,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  messageHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  directionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  timestamp: {
    fontSize: 12,
  },
  jobInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  jobName: {
    fontSize: 13,
    fontWeight: '600',
  },
  messageContent: {
    fontSize: 15,
    lineHeight: 22,
  },
  link: {
    textDecorationLine: 'underline',
    fontWeight: '500',
  },
  error: { marginBottom: 12, fontWeight: '600' },
  loader: { paddingVertical: 12 },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptyStateSubtext: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
