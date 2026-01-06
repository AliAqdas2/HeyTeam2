import React, { useEffect, useState, useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View, ActivityIndicator, TouchableOpacity, TextInput, RefreshControl, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { apiFetch } from '@/lib/api';
import { useWindowDimensions } from 'react-native';
import ContactImportModal from '@/components/ContactImportModal';
import { Toast, useToast } from '@/components/Toast';
import { useTheme } from '@/lib/theme';
import ScreenHeader from '@/components/ScreenHeader';

type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  status?: string;
  skills?: string[];
  qualifications?: string[];
  address?: string;
};

type Department = {
  id: string;
  name: string;
};

export default function AdminContacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const { height: screenHeight } = useWindowDimensions();
  const toast = useToast();
  const { colors } = useTheme();

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState('active');
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkill, setNewSkill] = useState('');
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [contactDepartments, setContactDepartments] = useState<string[]>([]);

  // Delete confirmation state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const loadContacts = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const data = await apiFetch<Contact[]>('/api/contacts');
      setContacts(data || []);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load contacts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadContacts();
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      const data = await apiFetch<Department[]>('/api/departments');
      setDepartments(data || []);
    } catch {
      // Silently fail
    }
  };

  const loadContactDepartments = async (contactId: string) => {
    try {
      const data = await apiFetch<Department[]>(`/api/contacts/${contactId}/departments`);
      setContactDepartments(data?.map(d => d.id) || []);
      setSelectedDepartments(data?.map(d => d.id) || []);
    } catch {
      setContactDepartments([]);
      setSelectedDepartments([]);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadContacts(false);
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadContacts(false);
  }, []);

  const filteredContacts = contacts.filter((contact) => {
    const fullName = `${contact.firstName} ${contact.lastName}`.toLowerCase();
    const query = searchQuery.toLowerCase();
    return fullName.includes(query) || contact.phone.includes(query) || contact.email?.toLowerCase().includes(query);
  });

  const handleOpenAddModal = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setStatus('active');
    setSkills([]);
    setNewSkill('');
    setSelectedDepartments([]);
    setContactDepartments([]);
    setEditingContact(null);
    setShowAddModal(true);
  };

  const handleOpenEditModal = (contact: Contact) => {
    setFirstName(contact.firstName);
    setLastName(contact.lastName);
    setEmail(contact.email || '');
    setPhone(contact.phone);
    setStatus(contact.status || 'active');
    setSkills(contact.skills || []);
    setNewSkill('');
    setEditingContact(contact);
    setShowAddModal(true);
    loadContactDepartments(contact.id);
  };

  const handleAddSkill = () => {
    const skill = newSkill.trim();
    if (skill && !skills.includes(skill)) {
      setSkills([...skills, skill]);
      setNewSkill('');
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter(s => s !== skillToRemove));
  };

  const toggleDepartment = (deptId: string) => {
    if (selectedDepartments.includes(deptId)) {
      setSelectedDepartments(selectedDepartments.filter(id => id !== deptId));
    } else {
      setSelectedDepartments([...selectedDepartments, deptId]);
    }
  };

  const handleSaveContact = async () => {
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      toast.error('First name, last name, and phone are required');
      return;
    }

    try {
      const contactData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim() || null,
        phone: phone.trim(),
        status: status,
        skills: skills,
      };

      let contactId = editingContact?.id;

      if (editingContact) {
        await apiFetch(`/api/contacts/${editingContact.id}`, {
          method: 'PATCH',
          body: contactData,
        });
        
        // Update department assignments
        const previousDeptIds = contactDepartments;
        
        // Add new departments
        for (const deptId of selectedDepartments) {
          if (!previousDeptIds.includes(deptId)) {
            try {
              await apiFetch(`/api/departments/${deptId}/contacts/${editingContact.id}`, {
                method: 'POST',
                body: {},
              });
            } catch {
              // Silently fail - department might already be assigned
            }
          }
        }
        
        // Remove unselected departments
        for (const deptId of previousDeptIds) {
          if (!selectedDepartments.includes(deptId)) {
            try {
              await apiFetch(`/api/departments/${deptId}/contacts/${editingContact.id}`, {
                method: 'DELETE',
              });
            } catch {
              // Silently fail
            }
          }
        }
        
        toast.success('Contact updated successfully');
      } else {
        const result = await apiFetch<{ id: string }>('/api/contacts', {
          method: 'POST',
          body: contactData,
        });
        contactId = result?.id;
        
        // Assign departments to new contact
        if (contactId && selectedDepartments.length > 0) {
          for (const deptId of selectedDepartments) {
            try {
              await apiFetch(`/api/departments/${deptId}/contacts/${contactId}`, {
                method: 'POST',
                body: {},
              });
            } catch {
              // Silently fail
            }
          }
        }
        
        toast.success('Contact created successfully');
      }
      setShowAddModal(false);
      loadContacts();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save contact');
    }
  };

  const handleDeleteContact = (contact: Contact) => {
    setContactToDelete(contact);
    setDeleteConfirmText('');
    setShowDeleteModal(true);
  };

  const confirmDeleteContact = async () => {
    if (!contactToDelete || deleteConfirmText.toLowerCase() !== 'heyteam') return;
    
    try {
      setDeleting(true);
      await apiFetch(`/api/contacts/${contactToDelete.id}`, { method: 'DELETE' });
      setShowDeleteModal(false);
      setContactToDelete(null);
      setDeleteConfirmText('');
      toast.success('Contact deleted successfully');
      loadContacts();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete contact');
    } finally {
      setDeleting(false);
    }
  };

  const profileInitial = (contact: Contact) => (contact.firstName?.[0] || 'A').toUpperCase();

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Contacts" />
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
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

        {/* Add Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity style={[styles.addButton, styles.addButtonHalf, { backgroundColor: colors.primary }]} onPress={handleOpenAddModal} activeOpacity={0.7}>
            <Ionicons name="add-circle" size={20} color="#fff" />
            <Text style={styles.addButtonText}>Add Contact</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.importButton, styles.addButtonHalf, { backgroundColor: colors.primary }]}
            onPress={() => setShowImportModal(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="phone-portrait-outline" size={20} color="#fff" />
            <Text style={styles.addButtonText}>Import from Phone</Text>
          </TouchableOpacity>
        </View>

        {loading && (
          <View style={styles.loader}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}

        {error && <Text style={[styles.error, { color: colors.error }]}>{error}</Text>}

        {/* Contacts List */}
        {filteredContacts.length === 0 && !loading ? (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Ionicons name="people-outline" size={48} color={colors.icon} style={styles.emptyIcon} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No contacts found</Text>
            <Text style={[styles.metaText, { color: colors.textTertiary }]}>
              {searchQuery ? 'Try a different search term' : 'Add your first contact to get started'}
            </Text>
          </View>
        ) : (
          filteredContacts.map((contact) => (
            <View key={contact.id} style={[styles.contactCard, { backgroundColor: colors.card }]}>
              <View style={styles.contactHeader}>
                <View style={[styles.avatar, { backgroundColor: colors.primaryLight }]}>
                  <Text style={[styles.avatarText, { color: colors.primaryText }]}>{profileInitial(contact)}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.contactName, { color: colors.text }]}>
                    {contact.firstName} {contact.lastName}
                  </Text>
                  {contact.email && (
                    <View style={styles.metaRow}>
                      <Ionicons name="mail-outline" size={14} color={colors.icon} />
                      <Text style={[styles.metaText, { color: colors.textTertiary }]}>{contact.email}</Text>
                    </View>
                  )}
                  <View style={styles.metaRow}>
                    <Ionicons name="call-outline" size={14} color={colors.icon} />
                    <Text style={[styles.metaText, { color: colors.textTertiary }]}>{contact.phone}</Text>
                  </View>
                  {contact.status && (
                    <View style={[
                      styles.statusBadge,
                      { backgroundColor: colors.backgroundTertiary },
                      contact.status === 'active' && { backgroundColor: colors.successLight },
                    ]}>
                      <Text style={[
                        styles.statusText,
                        { color: colors.textSecondary },
                        contact.status === 'active' && { color: colors.success },
                      ]}>
                        {contact.status}
                      </Text>
                    </View>
                  )}
                  {contact.skills && contact.skills.length > 0 && (
                    <View style={styles.contactSkillsRow}>
                      {contact.skills.slice(0, 3).map((skill, idx) => (
                        <View key={idx} style={[styles.contactSkillBadge, { backgroundColor: colors.primaryLight }]}>
                          <Text style={[styles.contactSkillText, { color: colors.primaryText }]}>{skill}</Text>
                        </View>
                      ))}
                      {contact.skills.length > 3 && (
                        <View style={[styles.contactSkillBadgeMore, { backgroundColor: colors.backgroundTertiary }]}>
                          <Text style={[styles.contactSkillTextMore, { color: colors.textSecondary }]}>+{contact.skills.length - 3}</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.contactActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleOpenEditModal(contact)}
                >
                  <Ionicons name="pencil-outline" size={18} color={colors.primaryText} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleDeleteContact(contact)}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.modalOverlay, { backgroundColor: colors.modalBackdrop }]}
        >
          <View style={[styles.modalContent, { maxHeight: screenHeight * 0.9, minHeight: screenHeight * 0.7, backgroundColor: colors.modalBackground }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingContact ? 'Edit Contact' : 'Add Contact'}
              </Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>First Name *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }]}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="First Name"
                  placeholderTextColor={colors.placeholder}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Last Name *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }]}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Last Name"
                  placeholderTextColor={colors.placeholder}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Email</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }]}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholderTextColor={colors.placeholder}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Phone *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }]}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Phone"
                  keyboardType="phone-pad"
                  placeholderTextColor={colors.placeholder}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Status</Text>
                <View style={styles.statusRow}>
                  <TouchableOpacity
                    style={[
                      styles.statusOption,
                      { backgroundColor: colors.backgroundTertiary },
                      status === 'active' && { backgroundColor: colors.successLight },
                    ]}
                    onPress={() => setStatus('active')}
                  >
                    <Text style={[
                      styles.statusOptionText,
                      { color: colors.textSecondary },
                      status === 'active' && { color: colors.success },
                    ]}>
                      Active
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.statusOption,
                      { backgroundColor: colors.backgroundTertiary },
                      status === 'inactive' && { backgroundColor: colors.errorLight },
                    ]}
                    onPress={() => setStatus('inactive')}
                  >
                    <Text style={[
                      styles.statusOptionText,
                      { color: colors.textSecondary },
                      status === 'inactive' && { color: colors.error },
                    ]}>
                      Inactive
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Skills Input */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Skills</Text>
                <View style={styles.skillInputRow}>
                  <TextInput
                    style={[styles.input, { flex: 1, backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }]}
                    value={newSkill}
                    onChangeText={setNewSkill}
                    placeholder="Add a skill..."
                    placeholderTextColor={colors.placeholder}
                    onSubmitEditing={handleAddSkill}
                    returnKeyType="done"
                  />
                  <TouchableOpacity style={[styles.addSkillButton, { backgroundColor: colors.primary }]} onPress={handleAddSkill}>
                    <Ionicons name="add" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
                {skills.length > 0 && (
                  <View style={styles.skillsContainer}>
                    {skills.map((skill, index) => (
                      <View key={index} style={[styles.skillTag, { backgroundColor: colors.primaryLight }]}>
                        <Text style={[styles.skillTagText, { color: colors.primaryText }]}>{skill}</Text>
                        <TouchableOpacity onPress={() => handleRemoveSkill(skill)}>
                          <Ionicons name="close-circle" size={18} color={colors.icon} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Department Assignment */}
              {departments.length > 0 && (
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>Departments</Text>
                  <View style={styles.departmentsContainer}>
                    {departments.map((dept) => (
                      <TouchableOpacity
                        key={dept.id}
                        style={[
                          styles.departmentTag,
                          { backgroundColor: colors.backgroundTertiary },
                          selectedDepartments.includes(dept.id) && { backgroundColor: colors.primary },
                        ]}
                        onPress={() => toggleDepartment(dept.id)}
                      >
                        <Text
                          style={[
                            styles.departmentTagText,
                            { color: colors.text },
                            selectedDepartments.includes(dept.id) && { color: '#fff' },
                          ]}
                        >
                          {dept.name}
                        </Text>
                        {selectedDepartments.includes(dept.id) && (
                          <Ionicons name="checkmark-circle" size={16} color="#fff" />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </ScrollView>
            <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: colors.backgroundTertiary }]}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.saveButton, { backgroundColor: colors.primary }]} onPress={handleSaveContact}>
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Import Modal */}
      <ContactImportModal
        visible={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => {
          loadContacts();
        }}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => {
          setShowDeleteModal(false);
          setContactToDelete(null);
          setDeleteConfirmText('');
        }}
      >
        <View style={[styles.deleteModalOverlay, { backgroundColor: colors.modalBackdrop }]}>
          <View style={[styles.deleteModalContent, { backgroundColor: colors.modalBackground }]}>
            <View style={styles.deleteModalHeader}>
              <Ionicons name="warning" size={48} color={colors.error} />
              <Text style={[styles.deleteModalTitle, { color: colors.text }]}>Delete Contact</Text>
            </View>
            <Text style={[styles.deleteModalText, { color: colors.textSecondary }]}>
              This action cannot be undone. To confirm deletion of{' '}
              <Text style={[styles.deleteModalName, { color: colors.text }]}>
                {contactToDelete?.firstName} {contactToDelete?.lastName}
              </Text>
              , please type <Text style={[styles.deleteModalKeyword, { color: colors.primaryText }]}>heyteam</Text> below.
            </Text>
            <TextInput
              style={[styles.deleteModalInput, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }]}
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder='Type "heyteam" to confirm'
              placeholderTextColor={colors.placeholder}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={[styles.deleteModalCancelButton, { backgroundColor: colors.backgroundTertiary }]}
                onPress={() => {
                  setShowDeleteModal(false);
                  setContactToDelete(null);
                  setDeleteConfirmText('');
                }}
                disabled={deleting}
              >
                <Text style={[styles.deleteModalCancelText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.deleteModalDeleteButton,
                  { backgroundColor: colors.error },
                  deleteConfirmText.toLowerCase() !== 'heyteam' && { opacity: 0.5 },
                ]}
                onPress={confirmDeleteContact}
                disabled={deleteConfirmText.toLowerCase() !== 'heyteam' || deleting}
              >
                {deleting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.deleteModalDeleteText}>Delete Contact</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Toast */}
      <Toast visible={toast.visible} config={toast.config} onHide={toast.hide} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, flexGrow: 1, gap: 12 },
  title: { fontSize: 24, fontWeight: '700' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  profileButton: { padding: 4, marginLeft: 12 },
  profileCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitial: { fontWeight: '700', fontSize: 16 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 15,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  addButtonHalf: {
    flex: 1,
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  addButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  card: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  emptyIcon: { marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  metaText: { fontSize: 14, textAlign: 'center' },
  loader: { paddingVertical: 12 },
  error: { marginBottom: 12, fontWeight: '600' },
  contactCard: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    marginBottom: 12,
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(13, 178, 181, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#0db2b5', fontWeight: '700', fontSize: 18 },
  contactName: { fontSize: 16, fontWeight: '700', color: '#101828', marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#e4e7ec',
    marginTop: 8,
  },
  activeBadge: { backgroundColor: 'rgba(13, 178, 181, 0.12)' },
  statusText: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  activeText: { color: '#0db2b5' },
  contactActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e4e7ec',
  },
  actionButton: {
    padding: 8,
  },
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
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#101828' },
  modalScroll: { flex: 1, paddingVertical: 16 },
  modalScrollContent: { paddingBottom: 20 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 14, fontWeight: '700', color: '#344054', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f1729',
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d0d5dd',
    alignItems: 'center',
  },
  statusOptionActive: {
    backgroundColor: 'rgba(13, 178, 181, 0.12)',
    borderColor: '#0db2b5',
  },
  statusOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  statusOptionTextActive: {
    color: '#0db2b5',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e4e7ec',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f7fb',
  },
  cancelButtonText: { color: '#101828', fontWeight: '700', fontSize: 16 },
  saveButton: {
    backgroundColor: 'hsl(178, 60%, 50%)',
  },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  // Delete confirmation modal styles
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deleteModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  deleteModalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  deleteModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#101828',
    marginTop: 12,
  },
  deleteModalText: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  deleteModalName: {
    fontWeight: '700',
    color: '#101828',
  },
  deleteModalKeyword: {
    fontWeight: '700',
    color: '#d92d20',
  },
  deleteModalInput: {
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f1729',
    marginBottom: 20,
    textAlign: 'center',
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  deleteModalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#f5f7fb',
  },
  deleteModalCancelText: {
    color: '#101828',
    fontWeight: '700',
    fontSize: 16,
  },
  deleteModalDeleteButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: '#d92d20',
  },
  deleteModalDeleteButtonDisabled: {
    backgroundColor: '#e4e7ec',
  },
  deleteModalDeleteText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  // Skills input styles
  skillInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addSkillButton: {
    backgroundColor: '#0db2b5',
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  skillTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  skillTagText: {
    fontSize: 13,
    color: '#344054',
    fontWeight: '600',
  },
  // Department selection styles
  departmentsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  departmentTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f5f7fb',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d0d5dd',
  },
  departmentTagSelected: {
    backgroundColor: '#0db2b5',
    borderColor: '#0db2b5',
  },
  departmentTagText: {
    fontSize: 13,
    color: '#344054',
    fontWeight: '600',
  },
  departmentTagTextSelected: {
    color: '#fff',
  },
  // Contact skill badges
  contactSkillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 8,
  },
  contactSkillBadge: {
    backgroundColor: 'rgba(13, 178, 181, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  contactSkillText: {
    fontSize: 11,
    color: '#0db2b5',
    fontWeight: '600',
  },
  contactSkillBadgeMore: {
    backgroundColor: '#e4e7ec',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  contactSkillTextMore: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
  },
});

