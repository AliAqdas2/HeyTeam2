import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import CancellationReasonSheet from './CancellationReasonSheet';
import { useTheme } from '@/lib/theme';

type Job = {
  id: string;
  name: string;
  location?: string;
  startTime: string;
  endTime: string;
  availabilityStatus: string;
  availabilityId?: string;
};

type JobActionSheetProps = {
  visible: boolean;
  job: Job | null;
  onClose: () => void;
  onAction: (action: 'accept' | 'decline' | 'maybe' | 'cancel', reason?: string, comments?: string) => Promise<void>;
  loading?: boolean;
};

export default function JobActionSheet({
  visible,
  job,
  onClose,
  onAction,
  loading = false,
}: JobActionSheetProps) {
  const { colors } = useTheme();
  const [showCancellationSheet, setShowCancellationSheet] = useState(false);
  const insets = useSafeAreaInsets();

  if (!job) return null;

  const isPending = job.availabilityStatus === 'no_reply' || job.availabilityStatus === 'maybe';
  const isConfirmed = job.availabilityStatus === 'confirmed';
  const isPastJob = new Date(job.startTime) < new Date();

  const handleAction = async (action: 'accept' | 'decline' | 'maybe') => {
    try {
      await onAction(action);
      onClose();
    } catch (error) {
      // Error handling is done in parent component
    }
  };

  const handleCancelPress = () => {
    setShowCancellationSheet(true);
  };

  const handleCancellationConfirm = async (reason: string, comments?: string) => {
    await onAction('cancel', reason, comments);
    setShowCancellationSheet(false);
    onClose();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      <Modal
        visible={visible && !showCancellationSheet}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <TouchableOpacity
          style={[styles.backdrop, { backgroundColor: colors.modalBackdrop }]}
          activeOpacity={1}
          onPress={onClose}
        >
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.modalBackground,
                paddingBottom: Math.max(insets.bottom, 16),
              },
            ]}
          >
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <Text style={[styles.title, { color: colors.text }]}>{job.name}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={colors.icon} />
              </TouchableOpacity>
            </View>

            <View style={styles.jobInfo}>
              <View style={styles.infoRow}>
                <Ionicons name="calendar-outline" size={18} color={colors.icon} />
                <Text style={[styles.infoText, { color: colors.textTertiary }]}>{formatDate(job.startTime)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={18} color={colors.icon} />
                <Text style={[styles.infoText, { color: colors.textTertiary }]}>
                  {formatTime(job.startTime)} - {formatTime(job.endTime)}
                </Text>
              </View>
              {job.location && (
                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={18} color={colors.icon} />
                  <Text style={[styles.infoText, { color: colors.textTertiary }]}>{job.location}</Text>
                </View>
              )}
            </View>

            {isPending && !isPastJob && (
              <View style={[styles.actions, { borderTopColor: colors.border }]}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.acceptButton]}
                  onPress={() => handleAction('accept')}
                  disabled={loading}
                >
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.acceptButtonText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.maybeButton, { backgroundColor: colors.primaryLight, borderColor: colors.primaryText }]}
                  onPress={() => handleAction('maybe')}
                  disabled={loading}
                >
                  <Ionicons name="help-circle" size={20} color={colors.primaryText} />
                  <Text style={[styles.maybeButtonText, { color: colors.primaryText }]}>Maybe</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.declineButton, { backgroundColor: colors.errorLight, borderColor: colors.error }]}
                  onPress={() => handleAction('decline')}
                  disabled={loading}
                >
                  <Ionicons name="close-circle" size={20} color={colors.error} />
                  <Text style={[styles.declineButtonText, { color: colors.error }]}>Decline</Text>
                </TouchableOpacity>
              </View>
            )}

            {isPending && isPastJob && (
              <View style={[styles.actions, { borderTopColor: colors.border }]}>
                <View style={[styles.infoMessage, { backgroundColor: colors.backgroundTertiary }]}>
                  <Ionicons name="information-circle" size={20} color={colors.icon} />
                  <Text style={[styles.infoMessageText, { color: colors.textTertiary }]}>This job has already passed</Text>
                </View>
              </View>
            )}

            {isConfirmed && !isPastJob && (
              <View style={[styles.actions, { borderTopColor: colors.border }]}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.cancelButton, { backgroundColor: colors.errorLight, borderColor: colors.error }]}
                  onPress={handleCancelPress}
                  disabled={loading}
                >
                  <Ionicons name="close-circle" size={20} color={colors.error} />
                  <Text style={[styles.cancelButtonText, { color: colors.error }]}>Cancel Assignment</Text>
                </TouchableOpacity>
              </View>
            )}

            {isConfirmed && isPastJob && (
              <View style={[styles.actions, { borderTopColor: colors.border }]}>
                <View style={[styles.infoMessage, { backgroundColor: colors.backgroundTertiary }]}>
                  <Ionicons name="information-circle" size={20} color={colors.icon} />
                  <Text style={[styles.infoMessageText, { color: colors.textTertiary }]}>This job has already been completed</Text>
                </View>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      <CancellationReasonSheet
        visible={showCancellationSheet}
        onClose={() => setShowCancellationSheet(false)}
        onConfirm={handleCancellationConfirm}
        loading={loading}
      />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
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
    flex: 1,
  },
  closeButton: {
    padding: 4,
    marginLeft: 12,
  },
  jobInfo: {
    paddingVertical: 16,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    flex: 1,
  },
  actions: {
    paddingVertical: 16,
    gap: 12,
    borderTopWidth: 1,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  acceptButton: {
    backgroundColor: '#10b981',
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  maybeButton: {
    borderWidth: 1,
  },
  maybeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  declineButton: {
    borderWidth: 1,
  },
  declineButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  infoMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  infoMessageText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

