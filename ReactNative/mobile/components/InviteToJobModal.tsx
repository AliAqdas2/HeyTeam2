import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { apiFetch } from '@/lib/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Toast, useToast } from './Toast';
import { useTheme } from '@/lib/theme';

type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  status?: string;
};

type Template = {
  id: string;
  name: string;
  content: string;
};

type AvailabilityWithContact = {
  id: string;
  status: string;
  contact: Contact;
};

type InviteToJobModalProps = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  jobId: string;
  jobName: string;
  existingAvailability: AvailabilityWithContact[];
};

export default function InviteToJobModal({
  visible,
  onClose,
  onSuccess,
  jobId,
  jobName,
  existingAvailability,
}: InviteToJobModalProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [jobInvitationTemplate, setJobInvitationTemplate] = useState<Template | null>(null);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sending, setSending] = useState(false);
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const toast = useToast();
  const { colors } = useTheme();

  // Get contact IDs who are confirmed (only these should be excluded from invitation list)
  // Contacts who declined, maybe, or no_reply can be invited again
  const confirmedContactIds = useMemo(() => {
    return new Set(
      existingAvailability
        .filter((a) => a.status === "confirmed")
        .map((a) => a.contact.id)
    );
  }, [existingAvailability]);

  // Filter contacts to exclude only those who are confirmed
  const availableContacts = useMemo(() => {
    return contacts.filter((c) => !confirmedContactIds.has(c.id));
  }, [contacts, confirmedContactIds]);

  // Filter by search query
  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return availableContacts;
    const query = searchQuery.toLowerCase();
    return availableContacts.filter(
      (contact) =>
        `${contact.firstName} ${contact.lastName}`.toLowerCase().includes(query) ||
        contact.phone.includes(query) ||
        contact.email?.toLowerCase().includes(query)
    );
  }, [availableContacts, searchQuery]);

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setSelectedContactIds(new Set());
      setSearchQuery('');
      toast.hide();
    }
  }, [visible]);

  // Load data when modal opens
  useEffect(() => {
    if (visible) {
      loadContacts();
      loadJobInvitationTemplate();
    }
  }, [visible]);

  const loadContacts = async () => {
    try {
      setLoadingContacts(true);
      const data = await apiFetch<Contact[]>('/api/contacts');
      setContacts(data || []);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load contacts');
    } finally {
      setLoadingContacts(false);
    }
  };

  const loadJobInvitationTemplate = async () => {
    try {
      setLoadingTemplate(true);
      const data = await apiFetch<Template[]>('/api/templates');
      // Find the Job Invitation template
      const invitationTemplate = data?.find(
        (t) => t.name.toLowerCase() === 'job invitation'
      );
      setJobInvitationTemplate(invitationTemplate || null);
      if (!invitationTemplate) {
        toast.error('Job Invitation template not found. Please create one first.');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load template');
    } finally {
      setLoadingTemplate(false);
    }
  };

  const toggleContact = (contactId: string) => {
    const newSelected = new Set(selectedContactIds);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedContactIds(newSelected);
  };

  const toggleAll = () => {
    if (selectedContactIds.size === filteredContacts.length) {
      setSelectedContactIds(new Set());
    } else {
      setSelectedContactIds(new Set(filteredContacts.map((c) => c.id)));
    }
  };

  const handleSendInvitations = async () => {
    if (selectedContactIds.size === 0) {
      toast.error('Please select at least one contact');
      return;
    }

    if (!jobInvitationTemplate) {
      toast.error('Job Invitation template not found');
      return;
    }

    try {
      setSending(true);

      await apiFetch('/api/send-message', {
        method: 'POST',
        body: {
          jobId,
          templateId: jobInvitationTemplate.id,
          contactIds: Array.from(selectedContactIds),
        },
      });

      toast.success(`Invitations sent to ${selectedContactIds.size} contact${selectedContactIds.size > 1 ? 's' : ''}`);

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to send invitations');
    } finally {
      setSending(false);
    }
  };

  const selectedCount = selectedContactIds.size;
  const totalCount = filteredContacts.length;
  const isLoading = loadingContacts || loadingTemplate;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { paddingTop: insets.top }]}>
        <View style={[styles.modalContent, { 
          backgroundColor: colors.card,
          paddingBottom: Math.max(insets.bottom, 20), 
          height: screenHeight * 0.9 
        }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Invite to Job</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Send invitations for: {jobName}</Text>

          {/* Template Preview */}
          {jobInvitationTemplate && (
            <View style={[styles.templatePreview, {
              backgroundColor: colors.primaryLight,
              borderColor: colors.primary
            }]}>
              <View style={styles.templateHeader}>
                <Ionicons name="document-text" size={18} color={colors.primary} />
                <Text style={[styles.templateName, { color: colors.primary }]}>{jobInvitationTemplate.name}</Text>
              </View>
              <Text style={[styles.templateContent, { color: colors.text }]} numberOfLines={3}>
                {jobInvitationTemplate.content}
              </Text>
            </View>
          )}

          {!jobInvitationTemplate && !loadingTemplate && (
            <View style={[styles.errorBox, {
              backgroundColor: colors.errorLight
            }]}>
              <Ionicons name="alert-circle" size={20} color={colors.error} />
              <Text style={[styles.errorBoxText, { color: colors.error }]}>
                Job Invitation template not found. Please create one first.
              </Text>
            </View>
          )}

          {/* Search */}
          <View style={[styles.searchContainer, {
            backgroundColor: colors.inputBackground || colors.backgroundSecondary,
            borderColor: colors.border
          }]}>
            <Ionicons name="search-outline" size={18} color={colors.icon} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: colors.inputText }]}
              placeholder="Search contacts..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={colors.placeholder}
            />
          </View>

          {/* Selection Info */}
          <View style={styles.selectionInfo}>
            <TouchableOpacity onPress={toggleAll} style={styles.selectAllButton}>
              <Text style={[styles.selectAllText, { color: colors.primary }]}>
                {selectedCount === totalCount && totalCount > 0 ? 'Deselect All' : 'Select All'}
              </Text>
            </TouchableOpacity>
            <Text style={[styles.countText, { color: colors.textSecondary }]}>
              {selectedCount} of {totalCount} selected
            </Text>
          </View>

          {/* Contacts List */}
          {isLoading ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loaderText, { color: colors.textSecondary }]}>Loading contacts...</Text>
            </View>
          ) : filteredContacts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color={colors.icon} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {availableContacts.length === 0
                  ? 'All contacts are already on the roster'
                  : 'No contacts match your search'}
              </Text>
            </View>
          ) : (
            <ScrollView style={styles.contactsList} showsVerticalScrollIndicator={false}>
              {filteredContacts.map((contact) => {
                const isSelected = selectedContactIds.has(contact.id);
                return (
                  <TouchableOpacity
                    key={contact.id}
                    style={[
                      styles.contactItem,
                      { backgroundColor: colors.backgroundSecondary },
                      isSelected && {
                        backgroundColor: colors.primaryLight,
                        borderWidth: 1,
                        borderColor: colors.primary
                      }
                    ]}
                    onPress={() => toggleContact(contact.id)}
                  >
                    <View style={styles.contactCheckbox}>
                      <Ionicons
                        name={isSelected ? 'checkbox' : 'square-outline'}
                        size={24}
                        color={isSelected ? colors.primary : colors.border}
                      />
                    </View>
                    <View style={styles.contactInfo}>
                      <Text style={[styles.contactName, { color: colors.text }]}>
                        {contact.firstName} {contact.lastName}
                      </Text>
                      <View style={styles.contactMeta}>
                        <Ionicons name="call-outline" size={14} color={colors.icon} />
                        <Text style={[styles.contactMetaText, { color: colors.textSecondary }]}>{contact.phone}</Text>
                      </View>
                      {contact.email && (
                        <View style={styles.contactMeta}>
                          <Ionicons name="mail-outline" size={14} color={colors.icon} />
                          <Text style={[styles.contactMetaText, { color: colors.textSecondary }]}>{contact.email}</Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Footer */}
          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity 
              style={[styles.button, styles.cancelButton, { backgroundColor: colors.backgroundSecondary }]} 
              onPress={onClose} 
              disabled={sending}
            >
              <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.sendButton,
                { 
                  backgroundColor: (selectedCount === 0 || !jobInvitationTemplate) 
                    ? colors.backgroundTertiary 
                    : colors.primary 
                },
              ]}
              onPress={handleSendInvitations}
              disabled={sending || selectedCount === 0 || !jobInvitationTemplate}
            >
              {sending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="send" size={18} color="#fff" />
                  <Text style={styles.sendButtonText}>Send ({selectedCount})</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Toast */}
          <Toast visible={toast.visible} config={toast.config} onHide={toast.hide} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  templatePreview: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
  },
  templateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  templateName: {
    fontSize: 15,
    fontWeight: '600',
  },
  templateContent: {
    fontSize: 14,
    lineHeight: 20,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  errorBoxText: {
    flex: 1,
    fontSize: 14,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 15,
  },
  selectionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  selectAllButton: {
    paddingVertical: 4,
  },
  selectAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  countText: {
    fontSize: 14,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loaderText: {
    marginTop: 12,
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    textAlign: 'center',
  },
  contactsList: {
    flex: 1,
    marginBottom: 16,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  contactItemSelected: {},
  contactCheckbox: {
    marginRight: 12,
    marginTop: 2,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  contactMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  contactMetaText: {
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  cancelButton: {},
  cancelButtonText: {
    fontWeight: '700',
    fontSize: 16,
  },
  sendButton: {},
  sendButtonDisabled: {},
  sendButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});

