import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View, ActivityIndicator, TouchableOpacity, Alert, RefreshControl, TextInput } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { apiFetch } from '@/lib/api';
import { format } from 'date-fns';
import { useTheme } from '@/lib/theme';
import ScreenHeader from '@/components/ScreenHeader';

type UserMe = {
  type: 'user';
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
};

type JobWithAvailability = {
  id: string;
  name: string;
  location: string;
  startTime: string;
  endTime: string;
  notes?: string;
  requiredHeadcount?: number;
  availabilityCounts: {
    confirmed: number;
    maybe: number;
    declined: number;
    noReply: number;
  };
};

type Subscription = {
  id: string;
  planId: string;
  status: string;
  currency: string;
  currentPeriodEnd?: string;
};

type SubscriptionPlan = {
  id: string;
  name: string;
  priceGBP: number;
  priceUSD: number;
  priceEUR: number;
  monthlyCredits: number;
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: '£',
  USD: '$',
  EUR: '€',
};

export default function AdminDashboard() {
  const [user, setUser] = useState<UserMe | null>(null);
  const [jobs, setJobs] = useState<JobWithAvailability[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [credits, setCredits] = useState<{ available: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const profileInitial = useMemo(() => (user?.firstName?.[0] || 'A').toUpperCase(), [user]);
  const { colors } = useTheme();

  const loadData = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const [me, jobsRes, subscriptionRes, plansRes, creditsRes] = await Promise.all([
        apiFetch<UserMe>('/api/mobile/auth/me'),
        apiFetch<JobWithAvailability[]>('/api/jobs'),
        apiFetch<Subscription | null>('/api/subscription').catch(() => null),
        apiFetch<SubscriptionPlan[]>('/api/subscription-plans').catch(() => []),
        apiFetch<{ available: number }>('/api/credits').catch(() => ({ available: 0 })),
      ]);

      if (me?.type !== 'user') {
        setError('Not a user account');
      } else {
        setUser(me);
      }

      setJobs(jobsRes || []);
      setSubscription(subscriptionRes);
      setPlans(plansRes || []);
      setCredits(creditsRes || { available: 0 });
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData(false);
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData(false);
  }, []);

  const isWithinDateRange = (job: JobWithAvailability) => {
    if (!fromDate && !toDate) return true;

    const jobStart = new Date(job.startTime);
    const jobEnd = new Date(job.endTime);

    if (fromDate) {
      const from = new Date(fromDate);
      from.setHours(0, 0, 0, 0);
      if (jobEnd < from) return false;
    }

    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      if (jobStart > to) return false;
    }

    return true;
  };

  const filterJobs = (jobList: JobWithAvailability[]) => {
    const byDate = jobList.filter(isWithinDateRange);

    if (!searchQuery.trim()) return byDate;

    const query = searchQuery.toLowerCase();
    return byDate.filter((job) =>
      job.name.toLowerCase().includes(query) || job.location?.toLowerCase().includes(query)
    );
  };

  const now = new Date();
  const allUpcomingJobs = jobs.filter((job) => new Date(job.endTime) > now);
  const allPastJobs = jobs.filter((job) => new Date(job.endTime) <= now);

  const upcomingJobs = filterJobs(allUpcomingJobs);
  const pastJobs = filterJobs(allPastJobs);

  const billingSummary = useMemo(() => {
    const currency = subscription?.currency ?? 'GBP';
    const symbol = CURRENCY_SYMBOLS[currency] ?? '£';
    const availableCredits = credits?.available ?? 0;

    if (!subscription) {
      return {
        planName: 'Free Trial',
        planStatus: 'trial',
        currencySymbol: symbol,
        price: null,
        availableCredits,
        monthlyCredits: null,
        usagePercent: null,
        hasActiveSubscription: false,
      };
    }

    const currentPlan = plans.find((plan) => plan.id === subscription.planId) ?? null;
    const monthlyCredits = currentPlan?.monthlyCredits ?? null;

    const usagePercent =
      monthlyCredits && monthlyCredits > 0
        ? Math.min(100, Math.max(0, Math.round(((monthlyCredits - availableCredits) / monthlyCredits) * 100)))
        : null;

    const price =
      currentPlan
        ? currency === 'USD'
          ? currentPlan.priceUSD
          : currency === 'EUR'
            ? currentPlan.priceEUR
            : currentPlan.priceGBP
        : null;

    return {
      planName: currentPlan?.name ?? 'Free Trial',
      planStatus: subscription.status ?? 'trial',
      currencySymbol: symbol,
      price: price !== null ? (price / 100).toFixed(0) : null,
      availableCredits,
      monthlyCredits,
      usagePercent,
      hasActiveSubscription: true,
    };
  }, [credits?.available, plans, subscription, user]);

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScreenHeader 
        title="Dashboard" 
        showBack={false}
        showProfile={true}
        profileInitial={profileInitial}
        profileRoute="/admin/profile"
      />
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {loading && (
          <View style={styles.loader}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}
        {error && <Text style={[styles.error, { color: colors.error }]}>{error}</Text>}

        {/* Billing Summary */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Current Plan</Text>
          <Text style={[styles.name, { color: colors.text }]}>{billingSummary.planName}</Text>
          <View style={styles.metaRow}>
            <Text style={[styles.metaText, { color: colors.textTertiary }]}>
              {billingSummary.price !== null
                ? `${billingSummary.currencySymbol}${billingSummary.price}/month`
                : billingSummary.hasActiveSubscription
                  ? 'Custom billing'
                  : 'Free plan'}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Text style={[styles.metaText, { color: colors.textTertiary }]}>SMS Credits: </Text>
            <Text style={[styles.name, { color: colors.text }]}>
              {billingSummary.availableCredits.toLocaleString()}
              {billingSummary.monthlyCredits ? ` / ${billingSummary.monthlyCredits.toLocaleString()}` : ''}
            </Text>
          </View>
          {billingSummary.usagePercent !== null && (
            <View style={styles.progressContainer}>
              <View style={[styles.progressBarContainer, { backgroundColor: colors.border }]}>
                <View style={[styles.progressBar, { width: `${billingSummary.usagePercent}%`, backgroundColor: colors.primaryText }]} />
              </View>
              <Text style={[styles.metaText, { color: colors.textTertiary }]}>{billingSummary.usagePercent}% of monthly credits used</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => router.push('/admin/billing')}
          >
            <Text style={[styles.linkText, { color: colors.primaryText }]}>Manage Billing</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.primaryText} />
          </TouchableOpacity>
        </View>

        {/* Create Job Button */}
        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/admin/jobs/new')}
          activeOpacity={0.7}
        >
          <Ionicons name="add-circle" size={20} color="#fff" />
          <Text style={styles.createButtonText}>Create Job</Text>
        </TouchableOpacity>

        {/* Search and Filters */}
        {jobs.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={[styles.searchContainer, { borderColor: colors.inputBorder, backgroundColor: colors.inputBackground }]}>
              <Ionicons name="search-outline" size={18} color={colors.icon} style={styles.searchIcon} />
              <TextInput
                style={[styles.searchInput, { color: colors.inputText }]}
                placeholder="Search jobs by name or location..."
                placeholderTextColor={colors.placeholder}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor="#98a2b3"
              />
            </View>
            <View style={styles.filterRow}>
              <Text style={styles.filterLabel}>From:</Text>
              <TextInput
                style={styles.dateInput}
                placeholder="YYYY-MM-DD"
                value={fromDate}
                onChangeText={setFromDate}
                placeholderTextColor="#98a2b3"
              />
              <Text style={styles.filterLabel}>To:</Text>
              <TextInput
                style={styles.dateInput}
                placeholder="YYYY-MM-DD"
                value={toDate}
                onChangeText={setToDate}
                placeholderTextColor="#98a2b3"
              />
              {(fromDate || toDate) && (
                <TouchableOpacity onPress={() => { setFromDate(''); setToDate(''); }}>
                  <Text style={styles.clearText}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Upcoming Jobs */}
        {upcomingJobs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upcoming Jobs</Text>
            {upcomingJobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </View>
        )}

        {/* Past Jobs */}
        {pastJobs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Past Jobs</Text>
            {pastJobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </View>
        )}

        {/* Empty State */}
        {upcomingJobs.length === 0 && pastJobs.length === 0 && !loading && (
          <View style={styles.card}>
            <Ionicons name="calendar-outline" size={48} color="#6b7280" style={styles.emptyIcon} />
            {searchQuery.trim() ? (
              <>
                <Text style={styles.emptyTitle}>No jobs found</Text>
                <Text style={styles.metaText}>No jobs match your search "{searchQuery}"</Text>
                <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.linkButton}>
                  <Text style={styles.linkText}>Clear Search</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.emptyTitle}>No jobs yet</Text>
                <Text style={styles.metaText}>Create your first job to start coordinating your crew</Text>
                <TouchableOpacity
                  style={styles.createButton}
                  onPress={() => router.push('/admin/jobs/new')}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add-circle" size={20} color="#fff" />
                  <Text style={styles.createButtonText}>Create Your First Job</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function JobCard({ job }: { job: JobWithAvailability }) {
  const { colors } = useTheme();
  const fillPercentage = job.requiredHeadcount
    ? Math.round((job.availabilityCounts.confirmed / job.requiredHeadcount) * 100)
    : 0;

  const isPast = new Date(job.endTime) <= new Date();

  const handleDelete = () => {
    Alert.alert(
      'Delete Job',
      `Are you sure you want to delete "${job.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiFetch(`/api/jobs/${job.id}`, { method: 'DELETE' });
              Alert.alert('Success', 'Job deleted successfully');
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to delete job');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.jobCard, { backgroundColor: colors.card }]}>
      <View style={styles.jobHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.jobName, { color: colors.text }]}>{job.name}</Text>
          {isPast && (
            <View style={[styles.pastBadge, { backgroundColor: colors.backgroundTertiary }]}>
              <Text style={[styles.pastBadgeText, { color: colors.textTertiary }]}>Past</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.metaRow}>
        <Ionicons name="location-outline" size={16} color={colors.icon} />
        <Text style={[styles.metaText, { color: colors.textTertiary }]}>{job.location}</Text>
      </View>
      <View style={styles.metaRow}>
        <Ionicons name="time-outline" size={16} color={colors.icon} />
        <Text style={[styles.metaText, { color: colors.textTertiary }]}>{format(new Date(job.startTime), 'MMM d, h:mm a')}</Text>
      </View>
      {job.requiredHeadcount && (
        <View style={styles.fillContainer}>
          <View style={styles.fillRow}>
            <Text style={[styles.metaText, { color: colors.textTertiary }]}>
              {job.availabilityCounts.confirmed}/{job.requiredHeadcount} Confirmed
            </Text>
            <Text style={[styles.metaText, { color: colors.textTertiary }]}>{fillPercentage}%</Text>
          </View>
          <View style={[styles.progressBarContainer, { backgroundColor: colors.border }]}>
            <View style={[styles.progressBar, { width: `${fillPercentage}%`, backgroundColor: colors.primaryText }]} />
          </View>
        </View>
      )}
      <View style={styles.badgeRow}>
        <View style={[styles.badge, { backgroundColor: colors.successLight }]}>
          <Text style={[styles.badgeText, { color: colors.success }]}>{job.availabilityCounts.confirmed} Confirmed</Text>
        </View>
        {job.availabilityCounts.maybe > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.warningLight }]}>
            <Text style={[styles.badgeText, { color: colors.warning }]}>{job.availabilityCounts.maybe} Maybe</Text>
          </View>
        )}
        {job.availabilityCounts.declined > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.errorLight }]}>
            <Text style={[styles.badgeText, { color: colors.error }]}>{job.availabilityCounts.declined} Declined</Text>
          </View>
        )}
        {job.availabilityCounts.noReply > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.backgroundTertiary }]}>
            <Text style={[styles.badgeText, { color: colors.textTertiary }]}>{job.availabilityCounts.noReply} No Reply</Text>
          </View>
        )}
      </View>
      <View style={[styles.jobActions, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.primaryLight }]}
          onPress={() => router.push(`/admin/jobs/${job.id}/schedule`)}
        >
          <Text style={[styles.actionButtonText, { color: colors.primaryText }]}>View Schedule</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton, { backgroundColor: colors.backgroundTertiary, borderColor: colors.border }]}
          onPress={() => router.push(`/admin/jobs/${job.id}/edit`)}
        >
          <Text style={[styles.actionButtonText, styles.editButtonText, { color: colors.text }]}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton, { backgroundColor: colors.errorLight, borderColor: colors.border }]}
          onPress={handleDelete}
        >
          <Ionicons name="trash-outline" size={16} color={colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, flexGrow: 1, gap: 12 },
  title: { fontSize: 24, fontWeight: '700', color: '#101828' },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#101828', marginBottom: 8 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    gap: 8,
  },
  name: { fontSize: 16, fontWeight: '700', color: '#101828' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  metaText: { color: '#6b7280', fontSize: 14 },
  error: { color: '#d92d20', marginBottom: 12, fontWeight: '600' },
  loader: { paddingVertical: 12 },
  progressContainer: { marginTop: 8, gap: 4 },
  progressBarContainer: {
    height: 4,
    backgroundColor: '#e4e7ec',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#0db2b5',
    borderRadius: 2,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  linkText: { color: '#0db2b5', fontWeight: '700', fontSize: 14, marginRight: 4 },
  createButton: {
    backgroundColor: 'hsl(178, 60%, 50%)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  createButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    color: '#0f1729',
    fontSize: 15,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterLabel: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  dateInput: {
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0f1729',
    minWidth: 100,
  },
  clearText: { color: '#0db2b5', fontWeight: '700', fontSize: 14 },
  section: { gap: 12 },
  jobCard: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    gap: 8,
    marginBottom: 12,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  jobName: { fontSize: 18, fontWeight: '700', flex: 1 },
  pastBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  pastBadgeText: { fontSize: 12, fontWeight: '600' },
  fillContainer: { marginTop: 8 },
  fillRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: { fontSize: 12, fontWeight: '600' },
  jobActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  editButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  editButtonText: {},
  deleteButton: {
    flex: 0,
    paddingHorizontal: 12,
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  emptyIcon: { alignSelf: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#101828', textAlign: 'center', marginBottom: 8 },
});

