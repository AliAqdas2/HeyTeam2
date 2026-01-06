import React, { useEffect, useState, useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View, ActivityIndicator, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { apiFetch } from '@/lib/api';
import { format } from 'date-fns';
import ScreenHeader from '@/components/ScreenHeader';
import InviteToJobModal from '@/components/InviteToJobModal';
import BroadcastMessageModal from '@/components/BroadcastMessageModal';
import ManualAddContactModal from '@/components/ManualAddContactModal';
import { useTheme } from '@/lib/theme';

type AvailabilityWithContact = {
  id: string;
  status: string;
  contact: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email?: string;
  };
};

type Job = {
  id: string;
  name: string;
  location: string;
  startTime: string;
  endTime: string;
  notes?: string;
  availability: AvailabilityWithContact[];
};

const statusColumns = [
  { id: 'confirmed', label: 'Confirmed', color: '#0db2b5' },
  { id: 'maybe', label: 'Maybe', color: '#f59e0b' },
  { id: 'declined', label: 'Declined', color: '#d92d20' },
  { id: 'no_reply', label: 'No Reply', color: '#6b7280' },
];

export default function RosterBoard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { colors } = useTheme();

  // Modal states
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [showManualAddModal, setShowManualAddModal] = useState(false);

  const loadJob = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const data = await apiFetch<Job>(`/api/jobs/${id}/roster`);
      setJob(data);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load job roster');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadJob();
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadJob(false);
    }, [id])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadJob(false);
  }, []);

  const handleStatusChange = async (availabilityId: string, newStatus: string) => {
    try {
      await apiFetch(`/api/jobs/${id}/availability/${availabilityId}`, {
        method: 'PATCH',
        body: { status: newStatus },
      });
      loadJob(false);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update status');
    }
  };

  const getAvailabilityByStatus = (status: string) => {
    return job?.availability.filter((avail) => avail.status === status) || [];
  };

  const confirmedContacts = getAvailabilityByStatus('confirmed');

  const profileInitial = (contact: { firstName: string; lastName: string }) =>
    (contact.firstName?.[0] || 'A').toUpperCase();

  if (loading) {
    return (
      <View style={[styles.safe, { backgroundColor: colors.background }]}>
        <ScreenHeader title="Roster" />
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!job) {
    return (
      <View style={[styles.safe, { backgroundColor: colors.background }]}>
        <ScreenHeader title="Roster" />
        <View style={styles.loader}>
          <Text style={[styles.error, { color: colors.error }]}>Job not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScreenHeader title={job.name} />
      
      {/* Action Buttons */}
      <View style={[styles.actionBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.primary }]}
          onPress={() => setShowInviteModal(true)}
        >
          <Ionicons name="person-add-outline" size={18} color="#fff" />
          <Text style={styles.actionButtonText}>Invite to Job</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonSecondary, { backgroundColor: colors.primaryLight }]}
          onPress={() => setShowManualAddModal(true)}
        >
          <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
          <Text style={[styles.actionButtonTextSecondary, { color: colors.primary }]}>Add Contact</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Job Info */}
        <View style={[styles.jobCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.jobName, { color: colors.text }]}>{job.name}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={16} color={colors.icon} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>{job.location}</Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="time-outline" size={16} color={colors.icon} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
              {format(new Date(job.startTime), 'MMM d, h:mm a')} - {format(new Date(job.endTime), 'h:mm a')}
            </Text>
          </View>
          {job.notes && (
            <View style={styles.metaRow}>
              <Ionicons name="document-text-outline" size={16} color={colors.icon} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>{job.notes}</Text>
            </View>
          )}
        </View>

        {/* Status Columns */}
        {statusColumns.map((column) => {
          const availabilities = getAvailabilityByStatus(column.id);
          const isConfirmedColumn = column.id === 'confirmed';
          
          return (
            <View key={column.id} style={[styles.columnCard, { backgroundColor: colors.card }]}>
              <View style={[styles.columnHeader, { borderBottomColor: colors.border }]}>
                <View style={styles.columnHeaderLeft}>
                  <Text style={[styles.columnTitle, { color: colors.text }]}>{column.label}</Text>
                  <View style={[styles.badge, { backgroundColor: column.color }]}>
                    <Text style={styles.badgeText}>{availabilities.length}</Text>
                  </View>
                </View>
                {isConfirmedColumn && availabilities.length > 0 && (
                  <TouchableOpacity
                    style={[styles.broadcastButton, { backgroundColor: colors.primary }]}
                    onPress={() => setShowBroadcastModal(true)}
                  >
                    <Ionicons name="megaphone-outline" size={16} color="#fff" />
                    <Text style={styles.broadcastButtonText}>Message</Text>
                  </TouchableOpacity>
                )}
              </View>
              {availabilities.length === 0 ? (
                <View style={styles.emptyColumn}>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No contacts</Text>
                </View>
              ) : (
                availabilities.map((avail) => (
                  <View key={avail.id} style={[styles.contactCard, { backgroundColor: colors.backgroundSecondary }]}>
                    <View style={styles.contactHeader}>
                      <View style={[styles.avatar, { backgroundColor: colors.primaryLight }]}>
                        <Text style={[styles.avatarText, { color: colors.primary }]}>{profileInitial(avail.contact)}</Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.contactName, { color: colors.text }]}>
                          {avail.contact.firstName} {avail.contact.lastName}
                        </Text>
                        {avail.contact.email && (
                          <View style={styles.metaRow}>
                            <Ionicons name="mail-outline" size={12} color={colors.icon} />
                            <Text style={[styles.contactMeta, { color: colors.textSecondary }]}>{avail.contact.email}</Text>
                          </View>
                        )}
                        <View style={styles.metaRow}>
                          <Ionicons name="call-outline" size={12} color={colors.icon} />
                          <Text style={[styles.contactMeta, { color: colors.textSecondary }]}>{avail.contact.phone}</Text>
                        </View>
                      </View>
                    </View>
                    <View style={[styles.statusActions, { borderTopColor: colors.border }]}>
                      {statusColumns
                        .filter((s) => s.id !== avail.status)
                        .map((status) => (
                          <TouchableOpacity
                            key={status.id}
                            style={[styles.statusButton, { borderColor: colors.border }]}
                            onPress={() => handleStatusChange(avail.id, status.id)}
                          >
                            <Text style={[styles.statusButtonText, { color: status.color }]}>
                              {status.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                    </View>
                  </View>
                ))
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Modals */}
      <InviteToJobModal
        visible={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        onSuccess={() => loadJob(false)}
        jobId={id as string}
        jobName={job.name}
        existingAvailability={job.availability}
      />

      <BroadcastMessageModal
        visible={showBroadcastModal}
        onClose={() => setShowBroadcastModal(false)}
        onSuccess={() => loadJob(false)}
        jobId={id as string}
        jobName={job.name}
        confirmedContacts={confirmedContacts}
      />

      <ManualAddContactModal
        visible={showManualAddModal}
        onClose={() => setShowManualAddModal(false)}
        onSuccess={() => loadJob(false)}
        jobId={id as string}
        jobName={job.name}
        existingAvailability={job.availability}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  actionButtonSecondary: {},
  actionButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  actionButtonTextSecondary: {
    fontWeight: '700',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', flex: 1, marginHorizontal: 12 },
  container: { padding: 16, gap: 12 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  error: { fontSize: 16 },
  jobCard: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    gap: 8,
  },
  jobName: { fontSize: 20, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  metaText: { fontSize: 14 },
  columnCard: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    marginBottom: 12,
  },
  columnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  columnHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  columnTitle: { fontSize: 18, fontWeight: '700' },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  broadcastButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  broadcastButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyColumn: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: { fontSize: 14 },
  contactCard: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontWeight: '700', fontSize: 16 },
  contactName: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  contactMeta: { fontSize: 12 },
  statusActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  statusButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusButtonText: { fontSize: 12, fontWeight: '600' },
});
