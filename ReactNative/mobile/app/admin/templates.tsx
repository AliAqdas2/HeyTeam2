import React, { useEffect, useState, useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View, ActivityIndicator, TouchableOpacity, TextInput, RefreshControl, Alert, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { apiFetch } from '@/lib/api';
import { useWindowDimensions } from 'react-native';
import ScreenHeader from '@/components/ScreenHeader';
import { useTheme } from '@/lib/theme';

type Template = {
  id: string;
  name: string;
  content: string;
  isActive?: boolean;
};

export default function AdminTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const { height: screenHeight } = useWindowDimensions();
  const { colors } = useTheme();

  // Form state
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [isActive, setIsActive] = useState(true);

  const loadTemplates = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const data = await apiFetch<Template[]>('/api/templates');
      setTemplates(data || []);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load templates');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTemplates(false);
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadTemplates(false);
  }, []);

  const handleOpenAddModal = () => {
    setName('');
    setContent('');
    setIsActive(true);
    setEditingTemplate(null);
    setShowAddModal(true);
  };

  const handleOpenEditModal = (template: Template) => {
    setName(template.name);
    setContent(template.content);
    setIsActive(template.isActive !== false);
    setEditingTemplate(template);
    setShowAddModal(true);
  };

  const handleSaveTemplate = async () => {
    if (!name.trim() || !content.trim()) {
      Alert.alert('Error', 'Name and content are required');
      return;
    }

    try {
      if (editingTemplate) {
        await apiFetch(`/api/templates/${editingTemplate.id}`, {
          method: 'PATCH',
          body: {
            name: name.trim(),
            content: content.trim(),
            isActive,
          },
        });
        Alert.alert('Success', 'Template updated successfully');
      } else {
        await apiFetch('/api/templates', {
          method: 'POST',
          body: {
            name: name.trim(),
            content: content.trim(),
            isActive,
          },
        });
        Alert.alert('Success', 'Template created successfully');
      }
      setShowAddModal(false);
      loadTemplates();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to save template');
    }
  };

  const handleDeleteTemplate = (template: Template) => {
    Alert.alert(
      'Delete Template',
      `Are you sure you want to delete "${template.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiFetch(`/api/templates/${template.id}`, { method: 'DELETE' });
              Alert.alert('Success', 'Template deleted successfully');
              loadTemplates();
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to delete template');
            }
          },
        },
      ]
    );
  };

  const availableTokens = [
    '{FirstName}',
    '{LastName}',
    '{JobName}',
    '{Date}',
    '{Time}',
    '{Location}',
    '{Notes}',
  ];

  // Check if template is a job invitation template
  const isProtectedTemplate = (template: Template) => {
    const normalized = template.name.toLowerCase().trim();
    return normalized === "job invitation" || 
           normalized === "job cancellation" || 
           normalized === "job update";
  };

  const isJobInvitationTemplate = (template: Template) => {
    return template.name && 
      (template.name.toLowerCase().includes("invitation") || 
       template.name.toLowerCase().includes("job invitation") ||
       template.name.toLowerCase() === "job invitation");
  };

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Templates" backTo="/admin/more" />
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Add Button */}
        <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.primary }]} onPress={handleOpenAddModal} activeOpacity={0.7}>
          <Ionicons name="add-circle" size={20} color="#fff" />
          <Text style={styles.addButtonText}>Create Template</Text>
        </TouchableOpacity>

        {loading && (
          <View style={styles.loader}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}

        {error && <Text style={[styles.error, { color: colors.error }]}>{error}</Text>}

        {/* Templates List */}
        {templates.length === 0 && !loading ? (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Ionicons name="document-text-outline" size={48} color={colors.icon} style={styles.emptyIcon} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No templates yet</Text>
            <Text style={[styles.metaText, { color: colors.textTertiary }]}>Create your first message template to speed up communication</Text>
          </View>
        ) : (
          templates.map((template) => (
            <View key={template.id} style={[styles.templateCard, { backgroundColor: colors.card }]}>
              <View style={styles.templateHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.templateName, { color: colors.text }]}>{template.name}</Text>
                  {template.isActive === false && (
                    <View style={[styles.inactiveBadge, { backgroundColor: colors.backgroundTertiary }]}>
                      <Text style={[styles.inactiveText, { color: colors.textSecondary }]}>Inactive</Text>
                    </View>
                  )}
                </View>
              </View>
              <Text style={[styles.templateContent, { color: colors.textSecondary }]} numberOfLines={3}>
                {template.content}
              </Text>
              <View style={styles.templateActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleOpenEditModal(template)}
                >
                  <Ionicons name="pencil-outline" size={18} color={colors.primaryText} />
                  <Text style={[styles.actionText, { color: colors.primaryText }]}>Edit</Text>
                </TouchableOpacity>
                {!isProtectedTemplate(template) && (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleDeleteTemplate(template)}
                  >
                    <Ionicons name="trash-outline" size={18} color={colors.error} />
                    <Text style={[styles.actionText, { color: colors.error }]}>Delete</Text>
                  </TouchableOpacity>
                )}
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
                {editingTemplate ? 'Edit Template' : 'Create Template'}
              </Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Template Name *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }, editingTemplate && isProtectedTemplate(editingTemplate) && { opacity: 0.6 }]}
                  value={name}
                  onChangeText={setName}
                  placeholder="Template Name"
                  placeholderTextColor={colors.placeholder}
                  editable={!editingTemplate || !isProtectedTemplate(editingTemplate)}
                />
                {editingTemplate && isProtectedTemplate(editingTemplate) && (
                  <Text style={[styles.helpText, { color: colors.textSecondary }]}>
                    The name of the {editingTemplate.name} template cannot be changed
                  </Text>
                )}
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Content *</Text>
                <TextInput
                  style={[styles.input, styles.textArea, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }]}
                  value={content}
                  onChangeText={setContent}
                  placeholder="Template content... Use tokens like {FirstName}, {JobName}, etc."
                  multiline
                  numberOfLines={8}
                  textAlignVertical="top"
                  placeholderTextColor={colors.placeholder}
                />
              </View>
              <View style={styles.tokenSection}>
                <Text style={[styles.tokenLabel, { color: colors.text }]}>Available Tokens:</Text>
                <View style={styles.tokenRow}>
                  {availableTokens.map((token) => (
                    <TouchableOpacity
                      key={token}
                      style={[styles.tokenBadge, { backgroundColor: colors.primaryLight }]}
                      onPress={() => {
                        setContent((prev) => prev + token);
                      }}
                    >
                      <Text style={[styles.tokenText, { color: colors.primaryText }]}>{token}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.inputGroup}>
                <TouchableOpacity
                  style={styles.switchRow}
                  onPress={() => setIsActive(!isActive)}
                >
                  <Text style={[styles.switchLabel, { color: colors.text }]}>Active</Text>
                  <View style={[styles.switch, { backgroundColor: colors.backgroundTertiary }, isActive && { backgroundColor: colors.primary }]}>
                    <View style={[styles.switchThumb, { backgroundColor: colors.card }, isActive && { backgroundColor: '#fff' }]} />
                  </View>
                </TouchableOpacity>
              </View>
            </ScrollView>
            <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: colors.backgroundTertiary }]}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.saveButton, { backgroundColor: colors.primary }]} onPress={handleSaveTemplate}>
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  addButton: {
    backgroundColor: 'hsl(178, 60%, 50%)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  addButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  card: {
    backgroundColor: '#fff',
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
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#101828', marginBottom: 8 },
  metaText: { color: '#6b7280', fontSize: 14, textAlign: 'center' },
  loader: { paddingVertical: 12 },
  error: { color: '#d92d20', marginBottom: 12, fontWeight: '600' },
  templateCard: {
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
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  templateName: { fontSize: 18, fontWeight: '700', color: '#101828' },
  inactiveBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#e4e7ec',
    marginTop: 4,
  },
  inactiveText: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  templateContent: { fontSize: 14, color: '#6b7280', lineHeight: 20, marginBottom: 12 },
  templateActions: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e4e7ec',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionText: { fontSize: 14, fontWeight: '600', color: '#0db2b5' },
  deleteText: { color: '#d92d20' },
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
  helpText: { fontSize: 12, marginTop: 4, fontStyle: 'italic' },
  input: {
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f1729',
  },
  textArea: {
    minHeight: 120,
    paddingTop: 12,
  },
  tokenSection: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f5f7fb',
    borderRadius: 10,
  },
  tokenLabel: { fontSize: 14, fontWeight: '700', color: '#344054', marginBottom: 8 },
  tokenRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tokenBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d0d5dd',
  },
  tokenText: { fontSize: 12, fontWeight: '600', color: '#0db2b5' },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: { fontSize: 14, fontWeight: '600', color: '#344054' },
  switch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#d0d5dd',
    padding: 2,
  },
  switchActive: {
    backgroundColor: '#0db2b5',
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  switchThumbActive: {
    transform: [{ translateX: 20 }],
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
});

