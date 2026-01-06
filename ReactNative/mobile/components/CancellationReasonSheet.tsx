import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/lib/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const CANCELLATION_REASONS = [
  { value: 'schedule_conflict', label: 'Schedule conflict' },
  { value: 'personal_emergency', label: 'Personal emergency' },
  { value: 'health_issue', label: 'Health issue' },
  { value: 'transportation_issue', label: 'Transportation issue' },
  { value: 'other', label: 'Other' },
];

type CancellationReasonSheetProps = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (reason: string, comments?: string) => void;
  loading?: boolean;
};

export default function CancellationReasonSheet({
  visible,
  onClose,
  onConfirm,
  loading = false,
}: CancellationReasonSheetProps) {
  const { colors } = useTheme();
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');
  const [comments, setComments] = useState<string>('');
  const insets = useSafeAreaInsets();

  const handleConfirm = () => {
    if (!selectedReason) return;
    
    let reasonText = CANCELLATION_REASONS.find((r) => r.value === selectedReason)?.label || selectedReason;
    if (selectedReason === 'other' && customReason.trim()) {
      reasonText = customReason.trim();
    }
    
    onConfirm(reasonText, comments.trim() || undefined);
    
    // Reset form
    setSelectedReason('');
    setCustomReason('');
    setComments('');
  };

  const handleClose = () => {
    setSelectedReason('');
    setCustomReason('');
    setComments('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <TouchableOpacity
          style={[styles.backdrop, { backgroundColor: colors.modalBackdrop }]}
          activeOpacity={1}
          onPress={handleClose}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.modalBackground,
              paddingBottom: Math.max(insets.bottom, 16),
              maxHeight: SCREEN_HEIGHT * 0.9,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.text }]}>Cancel Job Assignment</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.icon} />
            </TouchableOpacity>
          </View>

          <View style={styles.scrollContainer}>
            <ScrollView 
              style={styles.content} 
              contentContainerStyle={styles.contentContainer}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
              <Text style={[styles.subtitle, { color: colors.text }]}>Why are you canceling? *</Text>

              <View style={styles.reasonsList}>
                {CANCELLATION_REASONS.map((reason) => (
                  <TouchableOpacity
                    key={reason.value}
                    style={[
                      styles.reasonItem,
                      { borderColor: colors.border, backgroundColor: colors.card },
                      selectedReason === reason.value && {
                        borderColor: colors.primaryText,
                        backgroundColor: colors.primaryLight,
                      },
                    ]}
                    onPress={() => setSelectedReason(reason.value)}
                  >
                    <View style={styles.radioContainer}>
                      <View
                        style={[
                          styles.radio,
                          { borderColor: colors.borderLight },
                          selectedReason === reason.value && {
                            borderColor: colors.primaryText,
                          },
                        ]}
                      >
                        {selectedReason === reason.value && (
                          <View style={[styles.radioInner, { backgroundColor: colors.primaryText }]} />
                        )}
                      </View>
                      <Text
                        style={[
                          styles.reasonLabel,
                          { color: colors.textSecondary },
                          selectedReason === reason.value && {
                            color: colors.text,
                            fontWeight: '600',
                          },
                        ]}
                      >
                        {reason.label}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              {selectedReason === 'other' && (
                <View style={styles.customReasonContainer}>
                  <Text style={[styles.label, { color: colors.text }]}>Please specify *</Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        borderColor: colors.inputBorder,
                        backgroundColor: colors.inputBackground,
                        color: colors.inputText,
                      },
                    ]}
                    placeholder="Enter your reason"
                    value={customReason}
                    onChangeText={setCustomReason}
                    multiline
                    placeholderTextColor={colors.placeholder}
                  />
                </View>
              )}

              <View style={styles.commentsContainer}>
                <Text style={[styles.label, { color: colors.text }]}>Additional comments (optional)</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    styles.textArea,
                    {
                      borderColor: colors.inputBorder,
                      backgroundColor: colors.inputBackground,
                      color: colors.inputText,
                    },
                  ]}
                  placeholder="Tell us more about your situation..."
                  value={comments}
                  onChangeText={setComments}
                  multiline
                  numberOfLines={3}
                  placeholderTextColor={colors.placeholder}
                />
              </View>
            </ScrollView>
          </View>

          <View 
            style={[
              styles.actions, 
              { 
                borderTopColor: colors.border,
                paddingBottom: Math.max(insets.bottom, 0),
              }
            ]}
          >
            <TouchableOpacity
              style={[styles.button, styles.cancelButton, { backgroundColor: colors.backgroundTertiary }]}
              onPress={handleClose}
              disabled={loading}
            >
              <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.confirmButton,
                { backgroundColor: colors.error },
                (!selectedReason || (selectedReason === 'other' && !customReason.trim())) &&
                  { backgroundColor: colors.border, opacity: 0.6 },
              ]}
              onPress={handleConfirm}
              disabled={
                loading ||
                !selectedReason ||
                (selectedReason === 'other' && !customReason.trim())
              }
            >
              <Text style={styles.confirmButtonText}>
                {loading ? 'Canceling...' : 'Confirm Cancellation'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    minHeight: SCREEN_HEIGHT * 0.65,
    flexDirection: 'column',
  },
  scrollContainer: {
    flex: 1,
    minHeight: 300,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingVertical: 16,
    paddingBottom: 24,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  reasonsList: {
    gap: 8,
    marginBottom: 16,
  },
  reasonItem: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  radioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  reasonLabel: {
    fontSize: 16,
    flex: 1,
  },
  customReasonContainer: {
    marginTop: 8,
    marginBottom: 16,
  },
  commentsContainer: {
    marginTop: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 16,
    paddingBottom: 0, // Will be set dynamically based on safe area insets
    borderTopWidth: 1,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    // backgroundColor applied inline
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    // backgroundColor applied inline
  },
  confirmButtonDisabled: {
    // backgroundColor and opacity applied inline
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

