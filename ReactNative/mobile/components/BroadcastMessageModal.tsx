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

type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
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

type BroadcastMessageModalProps = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  jobId: string;
  jobName: string;
  confirmedContacts: AvailabilityWithContact[];
};

export default function BroadcastMessageModal({
  visible,
  onClose,
  onSuccess,
  jobId,
  jobName,
  confirmedContacts,
}: BroadcastMessageModalProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [customMessage, setCustomMessage] = useState('');
  const [useCustomMessage, setUseCustomMessage] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const toast = useToast();

  // Pre-select all confirmed contacts
  useEffect(() => {
    if (visible) {
      setSelectedContactIds(new Set(confirmedContacts.map((a) => a.contact.id)));
    }
  }, [visible, confirmedContacts]);

  // Filter by search query
  const filteredContacts = useMemo(() => {
    const contacts = confirmedContacts.map((a) => a.contact);
    if (!searchQuery.trim()) return contacts;
    const query = searchQuery.toLowerCase();
    return contacts.filter(
      (contact) =>
        `${contact.firstName} ${contact.lastName}`.toLowerCase().includes(query) ||
        contact.phone.includes(query) ||
        contact.email?.toLowerCase().includes(query)
    );
  }, [confirmedContacts, searchQuery]);

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setSelectedTemplateId('');
      setCustomMessage('');
      setUseCustomMessage(false);
      setSearchQuery('');
      setShowTemplateDropdown(false);
      toast.hide();
    }
  }, [visible]);

  // Load templates when modal opens
  useEffect(() => {
    if (visible) {
      loadTemplates();
    }
  }, [visible]);

  const loadTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const data = await apiFetch<Template[]>('/api/templates');
      setTemplates(data || []);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load templates');
    } finally {
      setLoadingTemplates(false);
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

  const handleSendBroadcast = async () => {
    if (selectedContactIds.size === 0) {
      toast.error('Please select at least one contact');
      return;
    }

    if (!useCustomMessage && !selectedTemplateId) {
      toast.error('Please select a template or write a custom message');
      return;
    }

    if (useCustomMessage && !customMessage.trim()) {
      toast.error('Please enter a message');
      return;
    }

    try {
      setSending(true);

      const body: any = {
        jobId,
        contactIds: Array.from(selectedContactIds),
      };

      if (useCustomMessage) {
        body.customMessage = customMessage.trim();
      } else {
        body.templateId = selectedTemplateId;
      }

      await apiFetch('/api/send-message', {
        method: 'POST',
        body,
      });

      toast.success(`Message sent to ${selectedContactIds.size} contact${selectedContactIds.size > 1 ? 's' : ''}`);

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
  const selectedCount = selectedContactIds.size;
  const totalCount = filteredContacts.length;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { paddingTop: insets.top }]}>
        <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 20), height: screenHeight * 0.9 }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Message Broadcast</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#101828" />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>Send message to confirmed contacts for: {jobName}</Text>

          {/* Message Type Toggle */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleButton, !useCustomMessage && styles.toggleButtonActive]}
              onPress={() => setUseCustomMessage(false)}
            >
              <Ionicons
                name="document-text-outline"
                size={18}
                color={!useCustomMessage ? '#fff' : '#6b7280'}
              />
              <Text style={[styles.toggleText, !useCustomMessage && styles.toggleTextActive]}>
                Template
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, useCustomMessage && styles.toggleButtonActive]}
              onPress={() => setUseCustomMessage(true)}
            >
              <Ionicons
                name="create-outline"
                size={18}
                color={useCustomMessage ? '#fff' : '#6b7280'}
              />
              <Text style={[styles.toggleText, useCustomMessage && styles.toggleTextActive]}>
                Custom
              </Text>
            </TouchableOpacity>
          </View>

          {/* Template Selection or Custom Message */}
          <View style={styles.section}>
            {useCustomMessage ? (
              <>
                <Text style={styles.sectionTitle}>Custom Message</Text>
                <TextInput
                  style={styles.textArea}
                  placeholder="Type your message here..."
                  value={customMessage}
                  onChangeText={setCustomMessage}
                  multiline
                  numberOfLines={4}
                  placeholderTextColor="#98a2b3"
                  textAlignVertical="top"
                />
              </>
            ) : (
              <>
                <Text style={styles.sectionTitle}>Message Template</Text>
                <TouchableOpacity
                  style={styles.dropdown}
                  onPress={() => setShowTemplateDropdown(!showTemplateDropdown)}
                >
                  <Text style={selectedTemplate ? styles.dropdownText : styles.dropdownPlaceholder}>
                    {selectedTemplate?.name || 'Select a template...'}
                  </Text>
                  <Ionicons
                    name={showTemplateDropdown ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#6b7280"
                  />
                </TouchableOpacity>

                {showTemplateDropdown && (
                  <View style={styles.dropdownList}>
                    {loadingTemplates ? (
                      <ActivityIndicator color="hsl(178, 60%, 50%)" style={{ padding: 12 }} />
                    ) : templates.length === 0 ? (
                      <Text style={styles.emptyDropdownText}>No templates available</Text>
                    ) : (
                      <ScrollView style={{ maxHeight: 150 }}>
                        {templates.map((template) => (
                          <TouchableOpacity
                            key={template.id}
                            style={[
                              styles.dropdownItem,
                              selectedTemplateId === template.id && styles.dropdownItemSelected,
                            ]}
                            onPress={() => {
                              setSelectedTemplateId(template.id);
                              setShowTemplateDropdown(false);
                            }}
                          >
                            <Text
                              style={[
                                styles.dropdownItemText,
                                selectedTemplateId === template.id && styles.dropdownItemTextSelected,
                              ]}
                            >
                              {template.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    )}
                  </View>
                )}

                {selectedTemplate && (
                  <View style={styles.previewBox}>
                    <Text style={styles.previewLabel}>Preview:</Text>
                    <Text style={styles.previewText}>{selectedTemplate.content}</Text>
                  </View>
                )}
              </>
            )}
          </View>

          {/* Search */}
          <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={18} color="#6b7280" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search contacts..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#98a2b3"
            />
          </View>

          {/* Selection Info */}
          <View style={styles.selectionInfo}>
            <TouchableOpacity onPress={toggleAll} style={styles.selectAllButton}>
              <Text style={styles.selectAllText}>
                {selectedCount === totalCount && totalCount > 0 ? 'Deselect All' : 'Select All'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.countText}>
              {selectedCount} of {totalCount} selected
            </Text>
          </View>

          {/* Contacts List */}
          {confirmedContacts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color="#6b7280" />
              <Text style={styles.emptyText}>No confirmed contacts to message</Text>
            </View>
          ) : (
            <ScrollView style={styles.contactsList} showsVerticalScrollIndicator={false}>
              {filteredContacts.map((contact) => {
                const isSelected = selectedContactIds.has(contact.id);
                return (
                  <TouchableOpacity
                    key={contact.id}
                    style={[styles.contactItem, isSelected && styles.contactItemSelected]}
                    onPress={() => toggleContact(contact.id)}
                  >
                    <View style={styles.contactCheckbox}>
                      <Ionicons
                        name={isSelected ? 'checkbox' : 'square-outline'}
                        size={24}
                        color={isSelected ? 'hsl(178, 60%, 50%)' : '#d0d5dd'}
                      />
                    </View>
                    <View style={styles.contactInfo}>
                      <Text style={styles.contactName}>
                        {contact.firstName} {contact.lastName}
                      </Text>
                      <View style={styles.contactMeta}>
                        <Ionicons name="call-outline" size={14} color="#6b7280" />
                        <Text style={styles.contactMetaText}>{contact.phone}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={[styles.button, styles.cancelButton]} onPress={onClose} disabled={sending}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.sendButton,
                (selectedCount === 0 || (!useCustomMessage && !selectedTemplateId) || (useCustomMessage && !customMessage.trim())) &&
                  styles.sendButtonDisabled,
              ]}
              onPress={handleSendBroadcast}
              disabled={
                sending ||
                selectedCount === 0 ||
                (!useCustomMessage && !selectedTemplateId) ||
                (useCustomMessage && !customMessage.trim())
              }
            >
              {sending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="megaphone" size={18} color="#fff" />
                  <Text style={styles.sendButtonText}>Broadcast ({selectedCount})</Text>
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
    backgroundColor: '#fff',
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
    color: '#101828',
  },
  closeButton: {
    padding: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#f5f7fb',
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  toggleButtonActive: {
    backgroundColor: 'hsl(178, 60%, 50%)',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  toggleTextActive: {
    color: '#fff',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#344054',
    marginBottom: 8,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#101828',
    minHeight: 100,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  dropdownText: {
    fontSize: 15,
    color: '#101828',
  },
  dropdownPlaceholder: {
    fontSize: 15,
    color: '#98a2b3',
  },
  dropdownList: {
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 10,
    marginTop: 4,
    backgroundColor: '#fff',
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e4e7ec',
  },
  dropdownItemSelected: {
    backgroundColor: 'rgba(13, 178, 181, 0.1)',
  },
  dropdownItemText: {
    fontSize: 15,
    color: '#101828',
  },
  dropdownItemTextSelected: {
    color: 'hsl(178, 60%, 50%)',
    fontWeight: '600',
  },
  emptyDropdownText: {
    padding: 12,
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  previewBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f5f7fb',
    borderRadius: 8,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
  },
  previewText: {
    fontSize: 14,
    color: '#344054',
    lineHeight: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    color: '#0f1729',
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
    color: 'hsl(178, 60%, 50%)',
  },
  countText: {
    fontSize: 14,
    color: '#6b7280',
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
    color: '#6b7280',
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
    backgroundColor: '#f5f7fb',
  },
  contactItemSelected: {
    backgroundColor: 'rgba(13, 178, 181, 0.1)',
    borderWidth: 1,
    borderColor: 'hsl(178, 60%, 50%)',
  },
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
    color: '#101828',
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
    color: '#6b7280',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e4e7ec',
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
  cancelButton: {
    backgroundColor: '#f5f7fb',
  },
  cancelButtonText: {
    color: '#101828',
    fontWeight: '700',
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: 'hsl(178, 60%, 50%)',
  },
  sendButtonDisabled: {
    backgroundColor: '#d0d5dd',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});

