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

type AvailabilityWithContact = {
  id: string;
  status: string;
  contact: Contact;
};

type ManualAddContactModalProps = {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  jobId: string;
  jobName: string;
  existingAvailability: AvailabilityWithContact[];
};

const STATUS_OPTIONS = [
  { id: 'confirmed', label: 'Confirmed', color: '#0db2b5', icon: 'checkmark-circle' as const },
  { id: 'maybe', label: 'Maybe', color: '#f59e0b', icon: 'help-circle' as const },
  { id: 'declined', label: 'Declined', color: '#d92d20', icon: 'close-circle' as const },
  { id: 'no_reply', label: 'No Reply', color: '#6b7280', icon: 'time' as const },
];

export default function ManualAddContactModal({
  visible,
  onClose,
  onSuccess,
  jobId,
  jobName,
  existingAvailability,
}: ManualAddContactModalProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [selectedStatus, setSelectedStatus] = useState<string>('confirmed');
  const [searchQuery, setSearchQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const toast = useToast();
  const { colors } = useTheme();

  // Get contact IDs who are confirmed (only these should be excluded)
  // Contacts who declined, maybe, or no_reply can be added again
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
      setSelectedStatus('confirmed');
      setSearchQuery('');
      toast.hide();
    }
  }, [visible]);

  // Load data when modal opens
  useEffect(() => {
    if (visible) {
      loadContacts();
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

  const handleAddContacts = async () => {
    if (selectedContactIds.size === 0) {
      toast.error('Please select at least one contact');
      return;
    }

    try {
      setAdding(true);

      // Add each contact to the roster with the selected status
      const contactIdsArray = Array.from(selectedContactIds);
      let successCount = 0;
      let errorCount = 0;

      for (const contactId of contactIdsArray) {
        try {
          await apiFetch('/api/availability', {
            method: 'POST',
            body: {
              jobId,
              contactId,
              status: selectedStatus,
            },
          });
          successCount++;
        } catch (e) {
          errorCount++;
        }
      }

      if (successCount > 0) {
        const statusLabel = STATUS_OPTIONS.find((s) => s.id === selectedStatus)?.label || selectedStatus;
        toast.success(
          `Added ${successCount} contact${successCount > 1 ? 's' : ''} as "${statusLabel}"${
            errorCount > 0 ? ` (${errorCount} failed)` : ''
          }`
        );

        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      } else {
        toast.error('Failed to add contacts');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to add contacts');
    } finally {
      setAdding(false);
    }
  };

  const selectedCount = selectedContactIds.size;
  const totalCount = filteredContacts.length;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { paddingTop: insets.top, backgroundColor: colors.modalBackdrop }]}>
        <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 20), height: screenHeight * 0.9, backgroundColor: colors.modalBackground }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Add to Roster</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
            Manually add contacts to: {jobName}
          </Text>

          {/* Status Selection */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Status</Text>
            <View style={styles.statusGrid}>
              {STATUS_OPTIONS.map((status) => {
                const isSelected = selectedStatus === status.id;
                return (
                  <TouchableOpacity
                    key={status.id}
                    style={[
                      styles.statusOption,
                      { borderColor: colors.border, backgroundColor: colors.backgroundTertiary },
                      isSelected && { backgroundColor: colors.card, borderColor: status.color },
                    ]}
                    onPress={() => setSelectedStatus(status.id)}
                  >
                    <Ionicons
                      name={status.icon}
                      size={20}
                      color={isSelected ? status.color : colors.icon}
                    />
                    <Text
                      style={[
                        styles.statusOptionText,
                        { color: colors.textSecondary },
                        isSelected && { color: status.color, fontWeight: '700' },
                      ]}
                    >
                      {status.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Search */}
          <View style={[styles.searchContainer, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }]}>
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
              <Text style={[styles.selectAllText, { color: colors.primaryText }]}>
                {selectedCount === totalCount && totalCount > 0 ? 'Deselect All' : 'Select All'}
              </Text>
            </TouchableOpacity>
            <Text style={[styles.countText, { color: colors.textTertiary }]}>
              {selectedCount} of {totalCount} selected
            </Text>
          </View>

          {/* Contacts List */}
          {loadingContacts ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loaderText, { color: colors.textTertiary }]}>Loading contacts...</Text>
            </View>
          ) : filteredContacts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color={colors.icon} />
              <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
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
                      { backgroundColor: colors.backgroundTertiary },
                      isSelected && { backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: colors.primary },
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
                        <Text style={[styles.contactMetaText, { color: colors.textTertiary }]}>{contact.phone}</Text>
                      </View>
                      {contact.email && (
                        <View style={styles.contactMeta}>
                          <Ionicons name="mail-outline" size={14} color={colors.icon} />
                          <Text style={[styles.contactMetaText, { color: colors.textTertiary }]}>{contact.email}</Text>
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
              style={[styles.button, styles.cancelButton, { backgroundColor: colors.backgroundTertiary }]} 
              onPress={onClose} 
              disabled={adding}
            >
              <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.addButton,
                { backgroundColor: colors.primary },
                selectedCount === 0 && { backgroundColor: colors.border },
              ]}
              onPress={handleAddContacts}
              disabled={adding || selectedCount === 0}
            >
              {adding ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="add-circle" size={18} color="#fff" />
                  <Text style={styles.addButtonText}>Add ({selectedCount})</Text>
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
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 2,
    gap: 6,
  },
  statusOptionText: {
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
  addButton: {},
  addButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});

