import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, FlatList, Alert, RefreshControl } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { apiFetch } from '@/lib/api';
import JobActionSheet from '@/components/JobActionSheet';
import { useTheme } from '@/lib/theme';
import ScreenHeader from '@/components/ScreenHeader';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  format,
  isToday as isTodayFn,
} from 'date-fns';

type Job = {
  id: string;
  name: string;
  location: string;
  startTime: string;
  endTime: string;
  notes?: string;
  availabilityStatus: string;
  shiftPreference?: string;
  updatedAt: string;
  departmentId?: string;
  availabilityId?: string;
};

type Department = {
  id: string;
  name: string;
  organizationId: string;
};

type ContactMe = {
  type: 'contact';
  firstName: string;
  lastName: string;
};

export default function ContactSchedule() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [jobs, setJobs] = useState<Job[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contact, setContact] = useState<ContactMe | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { colors } = useTheme();

  const profileInitial = useMemo(() => (contact?.firstName?.[0] || 'A').toUpperCase(), [contact]);

  const loadData = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const [scheduleRes, deptsRes, me] = await Promise.all([
        apiFetch<{ upcoming: Job[]; past: Job[] }>('/api/contact/schedule'),
        apiFetch<Department[]>('/api/contact/departments'),
        apiFetch<ContactMe>('/api/mobile/auth/me'),
      ]);
      // Combine upcoming and past jobs for calendar display
      const allJobs = [...(scheduleRes?.upcoming || []), ...(scheduleRes?.past || [])];
      setJobs(allJobs);
      setDepartments(deptsRes || []);
      if (me?.type === 'contact') {
        setContact(me);
      }
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load calendar');
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

  const handleJobPress = (job: Job) => {
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

  const filteredJobs = useMemo(() => {
    if (!selectedDepartmentId) return jobs;
    return jobs.filter((job) => job.departmentId === selectedDepartmentId);
  }, [jobs, selectedDepartmentId]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const daysWithJobs = useMemo(() => {
    return monthDays.map((day) => {
      const dayJobs = filteredJobs.filter((job) => {
        const jobDate = new Date(job.startTime);
        return isSameDay(jobDate, day);
      });
      return { day, jobs: dayJobs };
    }).filter(item => item.jobs.length > 0);
  }, [monthDays, filteredJobs]);

  if (loading) {
    return (
      <View style={[styles.safe, { backgroundColor: colors.background }]}>
        <ScreenHeader 
          title="Calendar" 
          showBack={false}
          showProfile={true}
          profileInitial={profileInitial}
          profileRoute="/contact/settings"
        />
        <View style={styles.loader}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScreenHeader 
        title="Calendar" 
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
        <Text style={[styles.subtitle, { color: colors.textTertiary }]}>View all jobs by date and track confirmations</Text>

        {error && <Text style={[styles.error, { color: colors.error }]}>{error}</Text>}

        {/* Department Filter */}
        {departments.length > 0 && (
          <View style={styles.filterContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  !selectedDepartmentId && { backgroundColor: colors.primaryLight, borderColor: colors.primaryText },
                ]}
                onPress={() => setSelectedDepartmentId(null)}>
                <Text style={[
                  styles.filterChipText,
                  { color: colors.textSecondary },
                  !selectedDepartmentId && { color: colors.primaryText, fontWeight: '700' },
                ]}>
                  All Departments
                </Text>
              </TouchableOpacity>
              {departments.map((dept) => (
                <TouchableOpacity
                  key={dept.id}
                  style={[
                    styles.filterChip,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    selectedDepartmentId === dept.id && { backgroundColor: colors.primaryLight, borderColor: colors.primaryText },
                  ]}
                  onPress={() => setSelectedDepartmentId(dept.id)}>
                  <Text style={[
                    styles.filterChipText,
                    { color: colors.textSecondary },
                    selectedDepartmentId === dept.id && { color: colors.primaryText, fontWeight: '700' },
                  ]}>
                    {dept.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Month Navigation */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.calendarHeader}>
            <Text style={[styles.monthTitle, { color: colors.text }]}>{format(currentMonth, 'MMMM yyyy')}</Text>
            <View style={styles.navButtons}>
              <TouchableOpacity style={[styles.navButton, { borderColor: colors.border, backgroundColor: colors.inputBackground }]} onPress={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                <Ionicons name="chevron-back" size={18} color={colors.icon} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.todayButton, { borderColor: colors.border, backgroundColor: colors.inputBackground }]} onPress={() => setCurrentMonth(new Date())}>
                <Text style={[styles.todayButtonText, { color: colors.textSecondary }]}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.navButton, { borderColor: colors.border, backgroundColor: colors.inputBackground }]} onPress={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                <Ionicons name="chevron-forward" size={18} color={colors.icon} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Jobs List by Day */}
        {daysWithJobs.length > 0 ? (
          daysWithJobs.map(({ day, jobs }) => (
            <View key={day.toISOString()} style={[styles.dayCard, { backgroundColor: colors.card }]}>
              <View style={[styles.dayCardHeader, { borderBottomColor: colors.border }]}>
                <View style={styles.dayDateContainer}>
                  <Text style={[
                    styles.dayDateNumber,
                    { color: colors.text },
                    isTodayFn(day) && { color: colors.primaryText },
                  ]}>
                    {format(day, 'd')}
                  </Text>
                  <View>
                    <Text style={[
                      styles.dayDateDay,
                      { color: colors.text },
                      isTodayFn(day) && { color: colors.primaryText },
                    ]}>
                      {format(day, 'EEE')}
                    </Text>
                    <Text style={[styles.dayDateMonth, { color: colors.textTertiary }]}>{format(day, 'MMM')}</Text>
                  </View>
                </View>
                <View style={[styles.jobCountBadge, { backgroundColor: colors.primaryLight }]}>
                  <Text style={[styles.jobCountText, { color: colors.primaryText }]}>{jobs.length} {jobs.length === 1 ? 'job' : 'jobs'}</Text>
                </View>
              </View>
              <View style={styles.jobsList}>
                {jobs.map((job) => (
                  <TouchableOpacity
                    key={job.id}
                    style={styles.jobCard}
                    onPress={() => handleJobPress(job)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.jobCardContent}>
                      <View style={[styles.jobIconContainer, { backgroundColor: colors.primaryLight }]}>
                        <Ionicons name="briefcase" size={18} color={colors.primaryText} />
                      </View>
                      <View style={styles.jobDetails}>
                        <Text style={[styles.jobName, { color: colors.text }]}>{job.name}</Text>
                        <View style={styles.jobMeta}>
                          <Ionicons name="time-outline" size={14} color={colors.icon} />
                          <Text style={[styles.jobMetaText, { color: colors.textTertiary }]}>
                            {format(new Date(job.startTime), 'h:mm a')} - {format(new Date(job.endTime), 'h:mm a')}
                          </Text>
                        </View>
                        {job.location && (
                          <View style={styles.jobMeta}>
                            <Ionicons name="location-outline" size={14} color={colors.icon} />
                            <Text style={[styles.jobMetaText, { color: colors.textTertiary }]}>{job.location}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={[styles.statusBadge, getStatusStyle(job.availabilityStatus, colors)]}>
                      <Text style={[styles.statusBadgeText, { color: colors.primaryText }]}>{getStatusLabel(job.availabilityStatus)}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))
        ) : null}

        {/* Empty State */}
        {filteredJobs.length === 0 && (
          <View style={[styles.emptyCard, { backgroundColor: colors.card }]}>
            <Ionicons name="calendar-outline" size={48} color={colors.icon} style={styles.emptyIcon} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No jobs scheduled</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
              {selectedDepartmentId ? 'No jobs in this department' : 'You have no scheduled jobs'}
            </Text>
          </View>
        )}
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

function getStatusLabel(status: string) {
  if (status === 'confirmed') return 'Confirmed';
  if (status === 'declined') return 'Declined';
  if (status === 'maybe') return 'Maybe';
  if (status === 'cancelled') return 'Cancelled';
  return 'Pending';
}

function getStatusStyle(status: string, colors: ReturnType<typeof useTheme>['colors']) {
  if (status === 'confirmed') return { backgroundColor: colors.successLight };
  if (status === 'declined') return { backgroundColor: colors.errorLight };
  if (status === 'maybe') return { backgroundColor: colors.warningLight };
  if (status === 'cancelled') return { backgroundColor: colors.backgroundTertiary };
  return { backgroundColor: colors.primaryLight };
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, flexGrow: 1, gap: 12 },
  subtitle: { fontSize: 16, marginBottom: 8 },
  error: { marginBottom: 12, fontWeight: '600' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filterContainer: { marginBottom: 8 },
  filterScroll: { gap: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: { fontSize: 14, fontWeight: '600' },
  card: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  monthTitle: { fontSize: 20, fontWeight: '700' },
  navButtons: { flexDirection: 'row', gap: 8 },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  todayButton: {
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  todayButtonText: { fontSize: 14, fontWeight: '600' },
  dayCard: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  dayCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  dayDateContainer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dayDateNumber: {
    fontSize: 32,
    fontWeight: '700',
    width: 48,
    textAlign: 'center',
  },
  dayDateDay: { fontSize: 16, fontWeight: '700' },
  dayDateMonth: { fontSize: 12, marginTop: 2 },
  jobCountBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  jobCountText: { fontSize: 12, fontWeight: '700' },
  jobsList: { gap: 12 },
  jobCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  jobCardContent: { flexDirection: 'row', gap: 12, flex: 1 },
  jobIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  jobDetails: { flex: 1, gap: 4 },
  jobName: { fontSize: 16, fontWeight: '700' },
  jobMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  jobMetaText: { fontSize: 13 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },
  emptyCard: {
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  emptyIcon: { marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  emptySubtitle: { fontSize: 14, textAlign: 'center' },
});
