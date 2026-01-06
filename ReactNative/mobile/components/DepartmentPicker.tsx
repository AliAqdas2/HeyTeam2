import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { apiFetch } from '@/lib/api';
import { useTheme } from '@/lib/theme';

type Department = {
  id: string;
  name: string;
  description?: string | null;
  address?: string | null;
};

type Props = {
  value: string | null;
  onChange: (departmentId: string | null, department?: Department) => void;
  label?: string;
};

export default function DepartmentPicker({ value, onChange, label = 'Department (Optional)' }: Props) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { colors } = useTheme();

  // Create form state
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      setLoading(true);
      const data = await apiFetch<Department[]>('/api/departments');
      setDepartments(data || []);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  };

  const selectedDepartment = departments.find((d) => d.id === value);

  const handleSelect = (department: Department | null) => {
    onChange(department?.id || null, department || undefined);
    setShowPicker(false);
  };

  const resetCreateForm = () => {
    setNewName('');
    setNewDescription('');
    setNewAddress('');
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;

    try {
      setCreating(true);
      const newDept = await apiFetch<Department>('/api/departments', {
        method: 'POST',
        body: {
          name: newName.trim(),
          description: newDescription.trim() || null,
          address: newAddress.trim() || null,
        },
      });
      
      // Add to list and select
      setDepartments((prev) => [...prev, newDept]);
      onChange(newDept.id, newDept);
      setShowCreateModal(false);
      resetCreateForm();
    } catch {
      // Error handling done by caller
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: colors.text }]}>
          <Ionicons name="business-outline" size={14} color={colors.icon} /> {label}
        </Text>
        <TouchableOpacity
          style={styles.createNewButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add" size={14} color={colors.primary} />
          <Text style={[styles.createNewText, { color: colors.primary }]}>Create New</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.pickerButton, { 
          backgroundColor: colors.inputBackground || colors.card,
          borderColor: colors.border 
        }]}
        onPress={() => setShowPicker(!showPicker)}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color={colors.icon} />
        ) : (
          <>
            <Text
              style={[
                styles.pickerText,
                { color: selectedDepartment ? colors.inputText : colors.placeholder },
              ]}
            >
              {selectedDepartment?.name || 'No Department'}
            </Text>
            <Ionicons
              name={showPicker ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={colors.icon}
            />
          </>
        )}
      </TouchableOpacity>

      {showPicker && (
        <View style={[styles.dropdown, {
          backgroundColor: colors.card,
          borderColor: colors.border
        }]}>
          <ScrollView style={styles.dropdownList} nestedScrollEnabled>
            <TouchableOpacity
              style={[
                styles.dropdownOption,
                !value && { backgroundColor: colors.primaryLight },
              ]}
              onPress={() => handleSelect(null)}
            >
              <Text
                style={[
                  styles.dropdownOptionText,
                  { color: !value ? colors.primary : colors.text },
                  !value && { fontWeight: '600' },
                ]}
              >
                No Department
              </Text>
              {!value && (
                <Ionicons name="checkmark" size={18} color={colors.primary} />
              )}
            </TouchableOpacity>
            {departments.map((dept) => (
              <TouchableOpacity
                key={dept.id}
                style={[
                  styles.dropdownOption,
                  value === dept.id && { backgroundColor: colors.primaryLight },
                ]}
                onPress={() => handleSelect(dept)}
              >
                <View style={styles.dropdownOptionContent}>
                  <Text
                    style={[
                      styles.dropdownOptionText,
                      { color: value === dept.id ? colors.primary : colors.text },
                      value === dept.id && { fontWeight: '600' },
                    ]}
                  >
                    {dept.name}
                  </Text>
                  {dept.address && (
                    <Text style={[styles.dropdownOptionAddress, { color: colors.textSecondary }]} numberOfLines={1}>
                      {dept.address}
                    </Text>
                  )}
                </View>
                {value === dept.id && (
                  <Ionicons name="checkmark" size={18} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        Assign this job to a specific department. Some jobs may not belong to any department.
      </Text>

      {/* Create Department Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowCreateModal(false);
          resetCreateForm();
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Create Department</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowCreateModal(false);
                  resetCreateForm();
                }}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Department Name *</Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: colors.inputBackground || colors.backgroundSecondary,
                  borderColor: colors.border,
                  color: colors.inputText
                }]}
                value={newName}
                onChangeText={setNewName}
                placeholder="e.g., ICU, Emergency, IT Support"
                placeholderTextColor={colors.placeholder}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Description (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea, { 
                  backgroundColor: colors.inputBackground || colors.backgroundSecondary,
                  borderColor: colors.border,
                  color: colors.inputText
                }]}
                value={newDescription}
                onChangeText={setNewDescription}
                placeholder="Add a description..."
                multiline
                numberOfLines={2}
                textAlignVertical="top"
                placeholderTextColor={colors.placeholder}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Address (Optional)</Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: colors.inputBackground || colors.backgroundSecondary,
                  borderColor: colors.border,
                  color: colors.inputText
                }]}
                value={newAddress}
                onChangeText={setNewAddress}
                placeholder="123 Main St, City, State"
                placeholderTextColor={colors.placeholder}
              />
              <Text style={[styles.inputHint, { color: colors.textSecondary }]}>
                Default address used to prefill job locations for this department.
              </Text>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: colors.backgroundSecondary }]}
                onPress={() => {
                  setShowCreateModal(false);
                  resetCreateForm();
                }}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.saveButton,
                  { backgroundColor: (!newName.trim() || creating) ? colors.backgroundTertiary : colors.primary },
                ]}
                onPress={handleCreate}
                disabled={!newName.trim() || creating}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
  },
  createNewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  createNewText: {
    fontSize: 12,
    fontWeight: '600',
  },
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pickerText: {
    fontSize: 15,
  },
  pickerPlaceholder: {},
  dropdown: {
    borderWidth: 1,
    borderRadius: 10,
    marginTop: 4,
    maxHeight: 200,
  },
  dropdownList: {
    padding: 4,
  },
  dropdownOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
  },
  dropdownOptionSelected: {},
  dropdownOptionContent: {
    flex: 1,
    marginRight: 8,
  },
  dropdownOptionText: {
    fontSize: 15,
  },
  dropdownOptionTextSelected: {},
  dropdownOptionAddress: {
    fontSize: 12,
    marginTop: 2,
  },
  hint: {
    fontSize: 12,
    marginTop: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  textArea: {
    minHeight: 60,
    paddingTop: 12,
  },
  inputHint: {
    fontSize: 12,
    marginTop: 6,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {},
  cancelButtonText: {
    fontWeight: '700',
    fontSize: 16,
  },
  saveButton: {},
  saveButtonDisabled: {},
  saveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});

