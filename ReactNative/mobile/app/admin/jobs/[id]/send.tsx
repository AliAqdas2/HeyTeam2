import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity, TextInput, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { apiFetch } from '@/lib/api';
import ScreenHeader from '@/components/ScreenHeader';

type Template = {
  id: string;
  name: string;
  content: string;
};

type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
};

type Job = {
  id: string;
  name: string;
};

export default function SendMessage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [messageContent, setMessageContent] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [jobData, templatesData, contactsData] = await Promise.all([
        apiFetch<Job>(`/api/jobs/${id}`),
        apiFetch<Template[]>('/api/templates'),
        apiFetch<Contact[]>('/api/contacts'),
      ]);
      setJob(jobData);
      setTemplates(templatesData || []);
      setContacts(contactsData || []);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      setMessageContent(template.content);
    }
  };

  const toggleContact = (contactId: string) => {
    setSelectedContacts((prev) =>
      prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId]
    );
  };

  const handleSend = async () => {
    if (!selectedTemplate || selectedContacts.length === 0) {
      Alert.alert('Error', 'Please select a template and at least one contact');
      return;
    }

    try {
      setSending(true);
      await apiFetch('/api/send-message', {
        method: 'POST',
        body: {
          jobId: id,
          templateId: selectedTemplate,
          contactIds: selectedContacts,
        },
      });
      Alert.alert('Success', 'Messages queued successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to send messages');
    } finally {
      setSending(false);
    }
  };

  const filteredContacts = contacts.filter((contact) => {
    const fullName = `${contact.firstName} ${contact.lastName}`.toLowerCase();
    return fullName.includes(searchTerm.toLowerCase()) || contact.phone.includes(searchTerm);
  });

  if (loading) {
    return (
      <View style={styles.safe}>
        <ScreenHeader title="Send Message" />
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="hsl(178, 60%, 50%)" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      <ScreenHeader title="Send Message" />
      <ScrollView contentContainerStyle={styles.container}>
        {/* Template Selection */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Select Template</Text>
          {templates.map((template) => (
            <TouchableOpacity
              key={template.id}
              style={[
                styles.templateItem,
                selectedTemplate === template.id && styles.templateItemSelected,
              ]}
              onPress={() => handleTemplateSelect(template.id)}
            >
              <Text style={styles.templateName}>{template.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Message Preview */}
        {messageContent && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Message Preview</Text>
            <Text style={styles.messagePreview}>{messageContent}</Text>
          </View>
        )}

        {/* Contact Selection */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Select Contacts</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search contacts..."
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholderTextColor="#98a2b3"
          />
          <View style={styles.contactsList}>
            {filteredContacts.map((contact) => {
              const isSelected = selectedContacts.includes(contact.id);
              return (
                <TouchableOpacity
                  key={contact.id}
                  style={[styles.contactItem, isSelected && styles.contactItemSelected]}
                  onPress={() => toggleContact(contact.id)}
                >
                  <Ionicons
                    name={isSelected ? 'checkbox' : 'checkbox-outline'}
                    size={24}
                    color={isSelected ? '#0db2b5' : '#6b7280'}
                  />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.contactName}>
                      {contact.firstName} {contact.lastName}
                    </Text>
                    <Text style={styles.contactPhone}>{contact.phone}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Send Button */}
        <TouchableOpacity
          style={[styles.sendButton, sending && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={sending || selectedContacts.length === 0}
        >
          {sending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="send" size={20} color="#fff" />
              <Text style={styles.sendButtonText}>
                Send to {selectedContacts.length} contact{selectedContacts.length !== 1 ? 's' : ''}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f7fb' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f5f7fb',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#101828' },
  container: { padding: 16, gap: 12 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  templateItem: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d0d5dd',
    marginBottom: 8,
  },
  templateItemSelected: {
    backgroundColor: 'rgba(13, 178, 181, 0.12)',
    borderColor: '#0db2b5',
  },
  templateName: { fontSize: 16, fontWeight: '600', color: '#101828' },
  messagePreview: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    padding: 12,
    backgroundColor: '#f5f7fb',
    borderRadius: 10,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0f1729',
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  contactsList: { gap: 8 },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d0d5dd',
  },
  contactItemSelected: {
    backgroundColor: 'rgba(13, 178, 181, 0.12)',
    borderColor: '#0db2b5',
  },
  contactName: { fontSize: 16, fontWeight: '600', color: '#101828' },
  contactPhone: { fontSize: 14, color: '#6b7280', marginTop: 2 },
  sendButton: {
    backgroundColor: 'hsl(178, 60%, 50%)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

