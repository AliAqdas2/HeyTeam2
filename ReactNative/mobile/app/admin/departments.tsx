import React, { useEffect, useState, useCallback } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { apiFetch } from '@/lib/api';
import { useWindowDimensions } from 'react-native';
import { Toast, useToast } from '@/components/Toast';
import ScreenHeader from '@/components/ScreenHeader';
import { useTheme } from '@/lib/theme';

type Department = {
  id: string;
  name: string;
  description?: string | null;
  address?: string | null;
};

type DepartmentStats = {
  contactCount: number;
  jobCount: number;
};

export default function AdminDepartments() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentStats, setDepartmentStats] = useState<Record<string, DepartmentStats>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const { height: screenHeight } = useWindowDimensions();
  const toast = useToast();
  const { colors } = useTheme();

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete confirmation state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [departmentToDelete, setDepartmentToDelete] = useState<Department | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const loadDepartments = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const data = await apiFetch<Department[]>('/api/departments');
      setDepartments(data || []);
      setError(null);

      // Load stats for each department
      const stats: Record<string, DepartmentStats> = {};
      await Promise.all(
        (data || []).map(async (dept) => {
          try {
            const [contacts, jobs] = await Promise.all([
              apiFetch<any[]>(`/api/departments/${dept.id}/contacts`),
              apiFetch<any[]>(`/api/departments/${dept.id}/jobs`),
            ]);
            stats[dept.id] = {
              contactCount: contacts?.length || 0,
              jobCount: jobs?.length || 0,
            };
          } catch {
            stats[dept.id] = { contactCount: 0, jobCount: 0 };
          }
        })
      );
      setDepartmentStats(stats);
    } catch (e: any) {
      setError(e?.message || 'Failed to load departments');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDepartments(false);
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDepartments(false);
  }, []);

  const resetForm = () => {
    setName('');
    setDescription('');
    setAddress('');
    setEditingDepartment(null);
  };

  const openAddModal = () => {
    resetForm();
    setShowFormModal(true);
  };

  const openEditModal = (department: Department) => {
    setEditingDepartment(department);
    setName(department.name);
    setDescription(department.description || '');
    setAddress(department.address || '');
    setShowFormModal(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Department name is required');
      return;
    }

    try {
      setSaving(true);
      const body = {
        name: name.trim(),
        description: description.trim() || null,
        address: address.trim() || null,
      };

      if (editingDepartment) {
        await apiFetch(`/api/departments/${editingDepartment.id}`, {
          method: 'PATCH',
          body,
        });
        toast.success('Department updated successfully');
      } else {
        await apiFetch('/api/departments', {
          method: 'POST',
          body,
        });
        toast.success('Department created successfully');
      }
      setShowFormModal(false);
      resetForm();
      loadDepartments();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save department');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePress = (department: Department) => {
    setDepartmentToDelete(department);
    setDeleteConfirmText('');
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!departmentToDelete || deleteConfirmText.toLowerCase() !== 'heyteam') return;

    try {
      setDeleting(true);
      await apiFetch(`/api/departments/${departmentToDelete.id}`, { method: 'DELETE' });
      setShowDeleteModal(false);
      setDepartmentToDelete(null);
      setDeleteConfirmText('');
      toast.success('Department deleted successfully');
      loadDepartments();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete department');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.safe, { backgroundColor: colors.background }]}>
        <ScreenHeader title="Departments" backTo="/admin/more" />
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title="Departments"
        backTo="/admin/more"
        rightAction={{
          icon: 'add',
          onPress: openAddModal,
        }}
      />
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {error && (
          <View style={[styles.errorContainer, { backgroundColor: colors.errorLight }]}>
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          </View>
        )}

        {departments.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: colors.card }]}>
            <Ionicons name="business-outline" size={64} color={colors.icon} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No departments yet</Text>
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
              Create departments to organize your jobs and contacts (e.g., ICU, Emergency, IT Support)
            </Text>
            <TouchableOpacity style={[styles.createFirstButton, { backgroundColor: colors.primary }]} onPress={openAddModal}>
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.createFirstButtonText}>Create Your First Department</Text>
            </TouchableOpacity>
          </View>
        ) : (
          departments.map((department) => {
            const stats = departmentStats[department.id] || { contactCount: 0, jobCount: 0 };
            return (
              <View key={department.id} style={[styles.card, { backgroundColor: colors.card }]}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleRow}>
                    <View style={[styles.iconContainer, { backgroundColor: colors.primaryLight }]}>
                      <Ionicons name="business" size={20} color={colors.primaryText} />
                    </View>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>{department.name}</Text>
                  </View>
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => openEditModal(department)}
                    >
                      <Ionicons name="pencil-outline" size={18} color={colors.icon} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleDeletePress(department)}
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
                {(department.description || department.address) && (
                  <View style={styles.cardBody}>
                    {department.description && (
                      <Text style={[styles.description, { color: colors.textSecondary }]}>{department.description}</Text>
                    )}
                    {department.address && (
                      <View style={styles.addressRow}>
                        <Text style={[styles.addressLabel, { color: colors.textTertiary }]}>Address: </Text>
                        <Text style={[styles.addressValue, { color: colors.textSecondary }]}>{department.address}</Text>
                      </View>
                    )}
                  </View>
                )}
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Ionicons name="people-outline" size={16} color={colors.icon} />
                    <Text style={[styles.statText, { color: colors.textTertiary }]}>{stats.contactCount} contacts</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Ionicons name="briefcase-outline" size={16} color={colors.icon} />
                    <Text style={[styles.statText, { color: colors.textTertiary }]}>{stats.jobCount} jobs</Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal
        visible={showFormModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowFormModal(false);
          resetForm();
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.modalOverlay, { backgroundColor: colors.modalBackdrop }]}
        >
          <View style={[styles.modalContent, { maxHeight: screenHeight * 0.8, backgroundColor: colors.modalBackground }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingDepartment ? 'Edit Department' : 'Create Department'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowFormModal(false);
                  resetForm();
                }}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Department Name *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }]}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g., ICU, Emergency, IT Support"
                  placeholderTextColor={colors.placeholder}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Description (Optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Add a description for this department..."
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  placeholderTextColor={colors.placeholder}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Address (Optional)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }]}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="123 Main St, City, State"
                  placeholderTextColor={colors.placeholder}
                />
                <Text style={[styles.inputHint, { color: colors.textTertiary }]}>
                  Default address used to prefill job locations for this department.
                </Text>
              </View>
            </ScrollView>
            <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: colors.backgroundTertiary }]}
                onPress={() => {
                  setShowFormModal(false);
                  resetForm();
                }}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton, { backgroundColor: colors.primary }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {editingDepartment ? 'Update' : 'Create'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => {
          setShowDeleteModal(false);
          setDepartmentToDelete(null);
          setDeleteConfirmText('');
        }}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalContent}>
            <View style={styles.deleteModalHeader}>
              <Ionicons name="warning" size={48} color="#d92d20" />
              <Text style={styles.deleteModalTitle}>Delete Department</Text>
            </View>
            <Text style={styles.deleteModalText}>
              Are you sure you want to delete{' '}
              <Text style={styles.deleteModalName}>{departmentToDelete?.name}</Text>? This will
              remove the department assignment from all jobs.{'\n\n'}
              Type <Text style={styles.deleteModalKeyword}>heyteam</Text> to confirm.
            </Text>
            <TextInput
              style={styles.deleteModalInput}
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder='Type "heyteam" to confirm'
              placeholderTextColor="#98a2b3"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={styles.deleteModalCancelButton}
                onPress={() => {
                  setShowDeleteModal(false);
                  setDepartmentToDelete(null);
                  setDeleteConfirmText('');
                }}
                disabled={deleting}
              >
                <Text style={styles.deleteModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.deleteModalDeleteButton,
                  deleteConfirmText.toLowerCase() !== 'heyteam' &&
                    styles.deleteModalDeleteButtonDisabled,
                ]}
                onPress={confirmDelete}
                disabled={deleteConfirmText.toLowerCase() !== 'heyteam' || deleting}
              >
                {deleting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.deleteModalDeleteText}>Delete</Text>
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
  safe: { flex: 1, backgroundColor: '#f5f7fb' },
  container: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, flexGrow: 1, gap: 12 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorContainer: {
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  errorText: { color: '#d92d20', fontSize: 14 },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#101828',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  createFirstButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'hsl(178, 60%, 50%)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  createFirstButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(13, 178, 181, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#101828',
    flex: 1,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  cardBody: {
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  addressRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  addressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#101828',
  },
  addressValue: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e4e7ec',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 14,
    color: '#6b7280',
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
  modalScroll: { flex: 1 },
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
    backgroundColor: '#fff',
  },
  textArea: {
    minHeight: 80,
    paddingTop: 12,
  },
  inputHint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 6,
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
});

