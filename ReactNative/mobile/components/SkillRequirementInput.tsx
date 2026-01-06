import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { apiFetch } from '@/lib/api';
import { useTheme } from '@/lib/theme';

export type SkillRequirement = {
  skill: string;
  headcount: number;
  notes?: string;
};

type SkillAvailabilitySummary = {
  skill: string;
  totalCount: number;
  availableCount: number;
};

type Props = {
  value: SkillRequirement[];
  onChange: (skills: SkillRequirement[]) => void;
};

export default function SkillRequirementInput({ value, onChange }: Props) {
  const [availableSkills, setAvailableSkills] = useState<SkillAvailabilitySummary[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const { colors } = useTheme();

  // Form state for add/edit modal
  const [skill, setSkill] = useState('');
  const [headcount, setHeadcount] = useState('1');
  const [notes, setNotes] = useState('');
  const [showSkillPicker, setShowSkillPicker] = useState(false);

  useEffect(() => {
    loadAvailableSkills();
  }, []);

  const loadAvailableSkills = async () => {
    try {
      const data = await apiFetch<{ skills: SkillAvailabilitySummary[] }>('/api/skills/availability');
      setAvailableSkills(data?.skills || []);
    } catch {
      // Silently fail - skills suggestions won't be available
    }
  };

  const resetForm = () => {
    setSkill('');
    setHeadcount('1');
    setNotes('');
    setEditingIndex(null);
  };

  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const openEditModal = (index: number) => {
    const req = value[index];
    setSkill(req.skill);
    setHeadcount(req.headcount.toString());
    setNotes(req.notes || '');
    setEditingIndex(index);
    setShowAddModal(true);
  };

  const handleSave = () => {
    if (!skill.trim()) return;

    const newReq: SkillRequirement = {
      skill: skill.trim(),
      headcount: parseInt(headcount, 10) || 1,
      notes: notes.trim() || undefined,
    };

    if (editingIndex !== null) {
      const updated = [...value];
      updated[editingIndex] = newReq;
      onChange(updated);
    } else {
      onChange([...value, newReq]);
    }

    setShowAddModal(false);
    resetForm();
  };

  const handleRemove = (index: number) => {
    const updated = value.filter((_, i) => i !== index);
    onChange(updated);
  };

  const selectSkill = (skillName: string) => {
    setSkill(skillName);
    setShowSkillPicker(false);
  };

  const getSkillStats = (skillName: string): SkillAvailabilitySummary | undefined => {
    return availableSkills.find(
      (s) => s.skill.toLowerCase() === skillName.toLowerCase()
    );
  };

  // Calculate total headcount
  const totalHeadcount = value.reduce((sum, req) => sum + req.headcount, 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.label, { color: colors.text }]}>Skill Requirements</Text>
          <Text style={[styles.sublabel, { color: colors.textSecondary }]}>
            Add skills and headcount needed for this job
          </Text>
        </View>
        <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.primaryLight }]} onPress={openAddModal}>
          <Ionicons name="add" size={18} color={colors.primary} />
          <Text style={[styles.addButtonText, { color: colors.primary }]}>Add Skill</Text>
        </TouchableOpacity>
      </View>

      {value.length === 0 ? (
        <View style={[styles.emptyState, { 
          backgroundColor: colors.backgroundSecondary,
          borderColor: colors.border 
        }]}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No skill requirements yet. Click "Add Skill" to create one.
          </Text>
        </View>
      ) : (
        <View style={styles.skillsList}>
          {value.map((req, index) => {
            const stats = getSkillStats(req.skill);
            const showWarning = stats && req.headcount > stats.availableCount;

            return (
              <View key={index} style={[styles.skillCard, { 
                backgroundColor: colors.backgroundSecondary,
                borderColor: colors.border 
              }]}>
                <View style={styles.skillCardHeader}>
                  <View style={styles.skillInfo}>
                    <Text style={[styles.skillName, { color: colors.text }]}>{req.skill}</Text>
                    <View style={[styles.headcountBadge, { backgroundColor: colors.primary }]}>
                      <Text style={styles.headcountText}>×{req.headcount}</Text>
                    </View>
                  </View>
                  <View style={styles.skillActions}>
                    <TouchableOpacity
                      style={styles.skillActionButton}
                      onPress={() => openEditModal(index)}
                    >
                      <Ionicons name="pencil-outline" size={16} color={colors.icon} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.skillActionButton}
                      onPress={() => handleRemove(index)}
                    >
                      <Ionicons name="close" size={16} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
                {req.notes && (
                  <Text style={[styles.skillNotes, { color: colors.textSecondary }]}>{req.notes}</Text>
                )}
                {stats && (
                  <Text
                    style={[
                      styles.availabilityText,
                      { color: colors.textSecondary },
                      showWarning && { color: colors.error },
                    ]}
                  >
                    {stats.availableCount}/{stats.totalCount} available
                    {showWarning && ' ⚠️'}
                  </Text>
                )}
              </View>
            );
          })}
          {totalHeadcount > 0 && (
            <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Total headcount:</Text>
              <Text style={[styles.totalValue, { color: colors.text }]}>{totalHeadcount} people</Text>
            </View>
          )}
        </View>
      )}

      {/* Add/Edit Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowAddModal(false);
          resetForm();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingIndex !== null ? 'Edit Skill' : 'Add Skill'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Skill *</Text>
              <TouchableOpacity
                style={[styles.skillPickerButton, { 
                  backgroundColor: colors.inputBackground || colors.card,
                  borderColor: colors.border 
                }]}
                onPress={() => setShowSkillPicker(!showSkillPicker)}
              >
                <Text
                  style={[
                    styles.skillPickerText,
                    { color: skill ? colors.inputText : colors.placeholder },
                  ]}
                >
                  {skill || 'Select or type a skill'}
                </Text>
                <Ionicons
                  name={showSkillPicker ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={colors.icon}
                />
              </TouchableOpacity>

              {showSkillPicker && (
                <View style={[styles.skillPickerDropdown, {
                  backgroundColor: colors.card,
                  borderColor: colors.border
                }]}>
                  <ScrollView style={styles.skillPickerList} nestedScrollEnabled>
                    {availableSkills.map((s, i) => (
                      <TouchableOpacity
                        key={i}
                        style={styles.skillOption}
                        onPress={() => selectSkill(s.skill)}
                      >
                        <Text style={[styles.skillOptionText, { color: colors.text }]}>{s.skill}</Text>
                        <Text style={[styles.skillOptionCount, { color: colors.textSecondary }]}>
                          {s.availableCount}/{s.totalCount}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      style={styles.skillOption}
                      onPress={() => setShowSkillPicker(false)}
                    >
                      <Text style={[styles.skillOptionText, { color: colors.primary }]}>
                        Type custom skill...
                      </Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              )}

              {!showSkillPicker && (
                <TextInput
                  style={[styles.input, { 
                    marginTop: 8,
                    backgroundColor: colors.inputBackground || colors.card,
                    borderColor: colors.border,
                    color: colors.inputText
                  }]}
                  value={skill}
                  onChangeText={setSkill}
                  placeholder="Or type a custom skill"
                  placeholderTextColor={colors.placeholder}
                />
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Headcount *</Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: colors.inputBackground || colors.card,
                  borderColor: colors.border,
                  color: colors.inputText
                }]}
                value={headcount}
                onChangeText={setHeadcount}
                placeholder="1"
                keyboardType="number-pad"
                placeholderTextColor={colors.placeholder}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.text }]}>Notes (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea, { 
                  backgroundColor: colors.inputBackground || colors.card,
                  borderColor: colors.border,
                  color: colors.inputText
                }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Any specific requirements for this skill..."
                multiline
                numberOfLines={2}
                textAlignVertical="top"
                placeholderTextColor={colors.placeholder}
              />
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: colors.backgroundSecondary }]}
                onPress={() => {
                  setShowAddModal(false);
                  resetForm();
                }}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.saveButton,
                  { backgroundColor: skill.trim() ? colors.primary : colors.backgroundTertiary },
                ]}
                onPress={handleSave}
                disabled={!skill.trim()}
              >
                <Text style={styles.saveButtonText}>
                  {editingIndex !== null ? 'Update' : 'Add'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
  },
  sublabel: {
    fontSize: 12,
    marginTop: 2,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  skillsList: {
    gap: 8,
  },
  skillCard: {
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
  },
  skillCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skillInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  skillName: {
    fontSize: 15,
    fontWeight: '600',
  },
  headcountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  headcountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  skillActions: {
    flexDirection: 'row',
    gap: 8,
  },
  skillActionButton: {
    padding: 4,
  },
  skillNotes: {
    fontSize: 13,
    marginTop: 8,
  },
  availabilityText: {
    fontSize: 12,
    marginTop: 6,
  },
  availabilityWarning: {},
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    marginTop: 4,
    borderTopWidth: 1,
  },
  totalLabel: {
    fontSize: 14,
  },
  totalValue: {
    fontSize: 14,
    fontWeight: '700',
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
    maxHeight: '80%',
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
  skillPickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  skillPickerText: {
    fontSize: 15,
  },
  skillPickerPlaceholder: {},
  skillPickerDropdown: {
    borderWidth: 1,
    borderRadius: 10,
    marginTop: 4,
    maxHeight: 200,
  },
  skillPickerList: {
    padding: 4,
  },
  skillOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
  },
  skillOptionText: {
    fontSize: 15,
  },
  skillOptionCount: {
    fontSize: 13,
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

