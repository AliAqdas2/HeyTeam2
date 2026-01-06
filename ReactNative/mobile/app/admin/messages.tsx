import React, { useEffect, useState, useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View, ActivityIndicator, TouchableOpacity, RefreshControl, TextInput, Linking, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { apiFetch } from '@/lib/api';
import { format } from 'date-fns';
import ScreenHeader from '@/components/ScreenHeader';
import { useTheme } from '@/lib/theme';

type Message = {
  id: string;
  contactId: string;
  contactName: string;
  jobId: string | null;
  jobName: string | null;
  direction: string;
  content: string;
  status: string;
  createdAt: string;
};

export default function AdminMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [searchContent, setSearchContent] = useState('');
  const { colors } = useTheme();

  const loadMessages = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const data = await apiFetch<Message[]>('/api/messages/history');
      setMessages(data || []);
    } catch (e: any) {
      // Handle errors
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMessages(false);
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadMessages(false);
  }, []);

  const filteredMessages = messages.filter((msg) => {
    const nameMatch = msg.contactName.toLowerCase().includes(searchName.toLowerCase());
    const contentMatch = msg.content.toLowerCase().includes(searchContent.toLowerCase());
    return nameMatch && contentMatch;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return colors.primaryText;
      case 'delivered':
        return colors.success;
      case 'failed':
        return colors.error;
      default:
        return colors.textTertiary;
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
      return (
        <View style={[styles.messageContentContainer, { backgroundColor: colors.backgroundTertiary }]}>
          <Text style={[styles.messageContent, { color: colors.text }]}>{content}</Text>
        </View>
      );
    }

    return (
      <View style={[styles.messageContentContainer, { backgroundColor: colors.backgroundTertiary }]}>
        <Text style={[styles.messageContent, { color: colors.text }]}>
          {parts.map((part, index) => {
            if (part.isLink) {
              return (
                <Text
                  key={index}
                  style={[styles.link, { color: colors.primary }]}
                  onPress={() => handleLinkPress(part.url!)}
                >
                  {part.text}
              </Text>
            );
            }
            return <Text key={index}>{part.text}</Text>;
          })}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Message History" backTo="/admin/more" />
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Search Filters */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Filter Messages</Text>
          <TextInput
            style={[styles.searchInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }]}
            placeholder="Search by contact name..."
            value={searchName}
            onChangeText={setSearchName}
            placeholderTextColor={colors.placeholder}
          />
          <TextInput
            style={[styles.searchInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }]}
            placeholder="Search message content..."
            value={searchContent}
            onChangeText={setSearchContent}
            placeholderTextColor={colors.placeholder}
          />
          {(searchName || searchContent) && (
            <TouchableOpacity
              style={[styles.clearButton, { backgroundColor: colors.backgroundTertiary }]}
              onPress={() => {
                setSearchName('');
                setSearchContent('');
              }}
            >
              <Text style={[styles.clearButtonText, { color: colors.primaryText }]}>Clear Filters</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading && (
          <View style={styles.loader}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}

        {/* Messages List */}
        {filteredMessages.length === 0 && !loading ? (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Ionicons name="chatbubbles-outline" size={48} color={colors.icon} style={styles.emptyIcon} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No messages found</Text>
            <Text style={[styles.metaText, { color: colors.textTertiary }]}>
              {searchName || searchContent ? 'Try different search terms' : 'No messages yet'}
            </Text>
          </View>
        ) : (
          filteredMessages.map((message) => (
            <View key={message.id} style={[styles.messageCard, { backgroundColor: colors.card }]}>
              <View style={styles.messageHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.contactName, { color: colors.text }]}>{message.contactName}</Text>
                  {message.jobName && (
                    <View style={styles.metaRow}>
                      <Ionicons name="briefcase-outline" size={14} color={colors.icon} />
                      <Text style={[styles.metaText, { color: colors.textTertiary }]}>{message.jobName}</Text>
                    </View>
                  )}
                  <View style={styles.metaRow}>
                    <Ionicons
                      name={message.direction === 'inbound' ? 'arrow-down' : 'arrow-up'}
                      size={14}
                      color={message.direction === 'inbound' ? colors.success : colors.primaryText}
                    />
                    <Text style={[styles.metaText, { color: colors.textTertiary }]}>
                      {format(new Date(message.createdAt), 'MMM d, yyyy h:mm a')}
                    </Text>
                  </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(message.status) + '20' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(message.status) }]}>{message.status}</Text>
                </View>
              </View>
              {renderMessageWithLinks(message.content)}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f7fb' },
  container: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, flexGrow: 1, gap: 12 },
  title: { fontSize: 24, fontWeight: '700', color: '#101828' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f5f7fb',
  },
  profileButton: { padding: 4, marginLeft: 12 },
  profileCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(13, 178, 181, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitial: { color: '#0db2b5', fontWeight: '700', fontSize: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    gap: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#101828', marginBottom: 8 },
  searchInput: {
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0f1729',
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  clearButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  clearButtonText: { color: '#0db2b5', fontWeight: '700', fontSize: 14 },
  loader: { paddingVertical: 12 },
  emptyIcon: { alignSelf: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#101828', textAlign: 'center', marginBottom: 8 },
  metaText: { color: '#6b7280', fontSize: 14, textAlign: 'center' },
  messageCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    marginBottom: 12,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  contactName: { fontSize: 18, fontWeight: '700', color: '#101828', marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  messageContentContainer: {
    borderRadius: 10,
    padding: 12,
  },
  messageContent: {
    fontSize: 14,
    lineHeight: 20,
  },
  link: {
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
});

