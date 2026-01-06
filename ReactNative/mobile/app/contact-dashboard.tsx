import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View, ActivityIndicator, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { apiFetch } from '@/lib/api';
import JobActionSheet from '@/components/JobActionSheet';
import { useTheme } from '@/lib/theme';
import ScreenHeader from '@/components/ScreenHeader';

type ContactMe = {
  type: 'contact';
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  organizationId: string;
  phone?: string;
  countryCode?: string;
};

type JobWithStatus = {
  id: string;
  name: string;
  location: string;
  startTime: string;
  endTime: string;
  notes?: string;
  availabilityStatus: string;
  shiftPreference?: string;
  updatedAt: string;
  availabilityId?: string;
};

type Invitation = {
  id: string;
  name: string;
  location: string;
  startTime: string;
  endTime: string;
  notes?: string;
  availabilityStatus: string;
  shiftPreference?: string;
  createdAt: string;
  availabilityId?: string;
};

export default function ContactDashboard() {
  const [contact, setContact] = useState<ContactMe | null>(null);
  const [schedule, setSchedule] = useState<{ upcoming: JobWithStatus[]; past: JobWithStatus[] }>({ upcoming: [], past: [] });
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobWithStatus | Invitation | null>(null);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const profileInitial = useMemo(() => (contact?.firstName?.[0] || 'A').toUpperCase(), [contact]);
  const { colors } = useTheme();

  const [refreshing, setRefreshing] = useState(false);

  const loadData = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const [me, scheduleRes, invitesRes] = await Promise.all([
        apiFetch<ContactMe>('/api/mobile/auth/me'),
        apiFetch<{ upcoming: JobWithStatus[]; past: JobWithStatus[] }>('/api/contact/schedule'),
        apiFetch<{ invitations: Invitation[] }>('/api/contact/invitations'),
      ]);

      if (me?.type !== 'contact') {
        setError('Not a contact account');
      } else {
        setContact(me);
      }

      setSchedule({
        upcoming: scheduleRes?.upcoming || [],
        past: scheduleRes?.past || [],
      });

      setInvitations(invitesRes?.invitations || []);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load contact info');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Refresh data when page comes into focus
  useFocusEffect(
    useCallback(() => {
      loadData(false);
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData(false);
  }, []);

  const handleJobPress = (job: JobWithStatus | Invitation) => {
    setSelectedJob(job);
    setActionSheetVisible(true);
  };

  const handleAction = async (action: 'accept' | 'decline' | 'maybe' | 'cancel', reason?: string, comments?: string) => {
    if (!selectedJob || !selectedJob.availabilityId) {
      Alert.alert('Error', 'Unable to perform action. Missing availability information.');
      return;
    }

    try {
      setActionLoading(true);

      if (action === 'cancel') {
        // For cancellation, update status to declined
        await apiFetch(`/api/contact/availability/${selectedJob.availabilityId}`, {
          method: 'PATCH',
          body: { status: 'declined' },
        });
        Alert.alert('Success', `Job assignment canceled${reason ? `: ${reason}` : ''}`);
      } else {
        // For accept/decline/maybe
        const statusMap: Record<string, string> = {
          accept: 'confirmed',
          decline: 'declined',
          maybe: 'maybe',
        };
        await apiFetch(`/api/contact/availability/${selectedJob.availabilityId}`, {
          method: 'PATCH',
          body: { status: statusMap[action] },
        });
        const actionText = action === 'accept' ? 'accepted' : action === 'decline' ? 'declined' : 'marked as maybe';
        Alert.alert('Success', `Job ${actionText} successfully`);
      }

      // Refresh data
      await loadData();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update job status');
    } finally {
      setActionLoading(false);
    }
  };

  const nextJob = useMemo(() => schedule.upcoming[0], [schedule.upcoming]);

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScreenHeader 
        title="Dashboard" 
        showBack={false}
        showProfile={true}
        profileInitial={profileInitial}
        profileRoute="/contact/settings"
      />
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {contact && <Text style={[styles.subtitle, { color: colors.textTertiary }]}>{`Welcome back, ${contact.firstName}! Here's an overview of your jobs and invitations.`}</Text>}
        {loading && (
          <View style={styles.loader}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}
        {error && <Text style={[styles.error, { color: colors.error }]}>{error}</Text>}

        {/* Stats */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <StatRow
            label="Upcoming Jobs"
            value={schedule.upcoming.length}
            icon="briefcase-outline"
            hint="Jobs scheduled ahead"
            colors={colors}
          />
        </View>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <StatRow
            label="Pending Invitations"
            value={invitations.length}
            icon="notifications-outline"
            hint="Require your response"
            colors={colors}
          />
        </View>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <StatRow
            label="Past Jobs"
            value={schedule.past.length}
            icon="time-outline"
            hint="Completed jobs"
            colors={colors}
          />
        </View>

        {/* Next Job */}
        {nextJob && (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.card }]}
            onPress={() => handleJobPress(nextJob)}
            activeOpacity={0.7}
          >
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Next Job</Text>
            <Text style={[styles.name, { color: colors.text }]}>{nextJob.name}</Text>
            <View style={styles.metaRow}>
              <Ionicons name="calendar-outline" size={18} color={colors.icon} />
              <Text style={[styles.metaText, { color: colors.textTertiary }]}>{formatDate(nextJob.startTime)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Ionicons name="time-outline" size={18} color={colors.icon} />
              <Text style={[styles.metaText, { color: colors.textTertiary }]}>{formatRange(nextJob.startTime, nextJob.endTime)}</Text>
            </View>
            {nextJob.location ? (
              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={18} color={colors.icon} />
                <Text style={[styles.metaText, { color: colors.textTertiary }]}>{nextJob.location}</Text>
              </View>
            ) : null}
            <View style={styles.badgeRow}>
              <Text style={[styles.badge, { backgroundColor: colors.primaryLight, color: colors.primaryText }]}>{statusLabel(nextJob.availabilityStatus)}</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Invitations */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Invitations</Text>
          {invitations.length === 0 ? (
            <Text style={[styles.metaText, { color: colors.textTertiary }]}>No pending invitations at the moment.</Text>
          ) : (
            invitations.slice(0, 3).map((inv) => (
              <TouchableOpacity
                key={inv.id}
                style={[styles.inviteRow, { borderBottomColor: colors.border }]}
                onPress={() => handleJobPress(inv)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: colors.text }]}>{inv.name}</Text>
                  <Text style={[styles.metaText, { color: colors.textTertiary }]}>{formatRange(inv.startTime, inv.endTime)}</Text>
                </View>
                <Text style={[styles.badge, { backgroundColor: colors.primaryLight, color: colors.primaryText }]}>Pending</Text>
              </TouchableOpacity>
            ))
          )}
          <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/contact/invitations')}>
            <Text style={[styles.linkText, { color: colors.primaryText }]}>View all invitations</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.primaryText} />
          </TouchableOpacity>
        </View>

        {/* View Schedule */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={20} color={colors.text} />
            <Text style={[styles.sectionTitle, { marginBottom: 0, marginLeft: 8, color: colors.text }]}>View Schedule</Text>
          </View>
          <Text style={[styles.metaText, { color: colors.textTertiary }]}>View your complete schedule with all upcoming and past jobs.</Text>
          <View style={{ marginTop: 8, gap: 8 }}>
            {schedule.upcoming.length === 0 ? (
              <Text style={[styles.metaText, { color: colors.textTertiary }]}>No upcoming jobs.</Text>
            ) : (
              schedule.upcoming.slice(0, 3).map((job) => (
                <TouchableOpacity
                  key={job.id}
                  style={[styles.scheduleRow, { borderBottomColor: colors.border }]}
                  onPress={() => handleJobPress(job)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.name, { color: colors.text }]}>{job.name}</Text>
                    <Text style={[styles.metaText, { color: colors.textTertiary }]}>{formatDate(job.startTime)}</Text>
                    <Text style={[styles.metaText, { color: colors.textTertiary }]}>{formatRange(job.startTime, job.endTime)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.primaryText} />
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      <JobActionSheet
        visible={actionSheetVisible}
        job={selectedJob as any}
        onClose={() => {
          setActionSheetVisible(false);
          setSelectedJob(null);
        }}
        onAction={handleAction}
        loading={actionLoading}
      />
    </View>
  );
}

function StatRow({ label, value, icon, hint, colors }: { label: string; value: number; icon: any; hint: string; colors: ReturnType<typeof useTheme>['colors'] }) {
  return (
    <View style={styles.statRow}>
      <View>
        <Text style={[styles.name, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.statNumber, { color: colors.text }]}>{value}</Text>
        <Text style={[styles.metaText, { color: colors.textTertiary }]}>{hint}</Text>
      </View>
      <Ionicons name={icon} size={22} color={colors.icon} />
    </View>
  );
}

function formatRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function formatDate(date: string) {
  const d = new Date(date);
  return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function statusLabel(status: string) {
  if (status === 'confirmed') return 'Confirmed';
  if (status === 'declined') return 'Declined';
  if (status === 'maybe') return 'Maybe';
  return 'Pending';
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, flexGrow: 1, gap: 12 },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 16, marginBottom: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  card: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    gap: 6,
  },
  name: { fontSize: 16, fontWeight: '700' },
  label: { marginTop: 6, fontWeight: '600' },
  value: { marginTop: 2 },
  error: { marginBottom: 12, fontWeight: '600' },
  loader: { paddingVertical: 12 },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  statNumber: { fontSize: 24, fontWeight: '700' },
  badge: {
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    fontWeight: '700',
  },
  badgeRow: { marginTop: 4 },
  inviteRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  metaText: { fontSize: 14 },
  statNumberContainer: {},
  linkRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  linkText: { fontWeight: '700', fontSize: 14, marginRight: 4 },
  scheduleRow: {
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});