import React, { useEffect, useState, useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { apiFetch } from '@/lib/api';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek, addMonths, subMonths } from 'date-fns';
import ScreenHeader from '@/components/ScreenHeader';
import { useTheme } from '@/lib/theme';

type JobWithAvailability = {
  id: string;
  name: string;
  location: string;
  startTime: string;
  endTime: string;
  availabilityCounts: {
    confirmed: number;
    maybe: number;
    declined: number;
    noReply: number;
  };
};

export default function AdminCalendar() {
  const [jobs, setJobs] = useState<JobWithAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { colors } = useTheme();

  const loadJobs = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const data = await apiFetch<JobWithAvailability[]>('/api/jobs');
      setJobs(data || []);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load jobs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadJobs(false);
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadJobs(false);
  }, []);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getJobsForDay = (day: Date) => {
    return jobs.filter((job) => {
      const jobDate = new Date(job.startTime);
      return isSameDay(jobDate, day);
    });
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Calendar" backTo="/admin/more" />
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* Month Navigation */}
        <View style={styles.monthHeader}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <Ionicons name="chevron-back" size={20} color={colors.primaryText} />
          </TouchableOpacity>
          <Text style={[styles.monthTitle, { color: colors.text }]}>{format(currentMonth, 'MMMM yyyy')}</Text>
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <Ionicons name="chevron-forward" size={20} color={colors.primaryText} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.todayButton, { backgroundColor: colors.backgroundTertiary }]}
            onPress={() => setCurrentMonth(new Date())}
          >
            <Text style={[styles.todayButtonText, { color: colors.primaryText }]}>Today</Text>
          </TouchableOpacity>
        </View>

        {loading && (
          <View style={styles.loader}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}

        {error && <Text style={[styles.error, { color: colors.error }]}>{error}</Text>}

        {/* Calendar Grid */}
        <View style={[styles.calendarCard, { backgroundColor: colors.card }]}>
          {/* Week Day Headers */}
          <View style={styles.weekHeader}>
            {weekDays.map((day) => (
              <View key={day} style={styles.weekDayHeader}>
                <Text style={[styles.weekDayText, { color: colors.textTertiary }]}>{day}</Text>
              </View>
            ))}
          </View>

          {/* Calendar Days */}
          <View style={styles.calendarGrid}>
            {calendarDays.map((day, index) => {
              const dayJobs = getJobsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isToday = isSameDay(day, new Date());

              return (
                <View
                  key={index}
                  style={[
                    styles.calendarDay,
                    { borderColor: colors.border },
                    !isCurrentMonth && styles.calendarDayOtherMonth,
                    isToday && { backgroundColor: colors.primaryLight },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNumber,
                      { color: colors.text },
                      isToday && { color: colors.primaryText, fontWeight: '700' },
                      !isCurrentMonth && { color: colors.textTertiary },
                    ]}
                  >
                    {format(day, 'd')}
                  </Text>
                  <View style={styles.dayJobs}>
                    {dayJobs.slice(0, 2).map((job) => (
                      <TouchableOpacity
                        key={job.id}
                        style={[styles.jobDot, { backgroundColor: colors.primaryLight }]}
                        onPress={() => router.push(`/admin/jobs/${job.id}/schedule`)}
                      >
                        <Text style={[styles.jobDotText, { color: colors.primaryText }]} numberOfLines={1}>
                          {job.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    {dayJobs.length > 2 && (
                      <Text style={[styles.moreJobsText, { color: colors.textTertiary }]}>+{dayJobs.length - 2} more</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Empty State */}
        {jobs.length === 0 && !loading && (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Ionicons name="calendar-outline" size={48} color={colors.icon} style={styles.emptyIcon} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No jobs scheduled</Text>
            <Text style={[styles.metaText, { color: colors.textTertiary }]}>Create jobs to see them on the calendar</Text>
            <TouchableOpacity
              style={[styles.createButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/admin/jobs/new')}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle" size={20} color="#fff" />
              <Text style={styles.createButtonText}>Create Job</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, flexGrow: 1, gap: 12 },
  title: { fontSize: 24, fontWeight: '700' },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navButton: {
    padding: 8,
  },
  monthTitle: { fontSize: 20, fontWeight: '700' },
  todayButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  todayButtonText: { fontSize: 14, fontWeight: '600' },
  loader: { paddingVertical: 12 },
  error: { marginBottom: 12, fontWeight: '600' },
  calendarCard: {
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  weekHeader: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDayHeader: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: '700',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: '14.28%',
    minHeight: 80,
    padding: 4,
    borderWidth: 1,
  },
  calendarDayOtherMonth: {
    opacity: 0.3,
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  dayJobs: {
    gap: 2,
  },
  jobDot: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 2,
  },
  jobDotText: {
    fontSize: 10,
    fontWeight: '600',
  },
  moreJobsText: {
    fontSize: 10,
    marginTop: 2,
  },
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
  metaText: { fontSize: 14, textAlign: 'center', marginBottom: 16 },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  createButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

