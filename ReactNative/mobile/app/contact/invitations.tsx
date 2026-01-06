import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { apiFetch } from '@/lib/api';
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

export default function ContactInvitations() {
  const [contact, setContact] = useState<ContactMe | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const profileInitial = useMemo(() => (contact?.firstName?.[0] || 'A').toUpperCase(), [contact]);
  const { colors } = useTheme();

  const loadData = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const [me, invitesRes] = await Promise.all([
        apiFetch<ContactMe>('/api/mobile/auth/me'),
        apiFetch<{ invitations: Invitation[] }>('/api/contact/invitations'),
      ]);

      if (me?.type !== 'contact') {
        setError('Not a contact account');
      } else {
        setContact(me);
      }

      setInvitations(invitesRes?.invitations || []);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load invitations');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Refresh data when page comes into focus (to update badge count in parent)
  useFocusEffect(
    useCallback(() => {
      loadData(false);
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData(false);
  }, []);

  const handleAction = async (
    invitation: Invitation,
    action: 'accept' | 'decline' | 'maybe'
  ) => {
    if (!invitation.availabilityId) {
      Alert.alert('Error', 'Unable to perform action. Missing availability information.');
      return;
    }

    try {
      setActionLoading(invitation.id);

      const statusMap: Record<string, string> = {
        accept: 'confirmed',
        decline: 'declined',
        maybe: 'maybe',
      };
      await apiFetch(`/api/contact/availability/${invitation.availabilityId}`, {
        method: 'PATCH',
        body: { status: statusMap[action] },
      });

      const actionText =
        action === 'accept'
          ? 'accepted'
          : action === 'decline'
          ? 'declined'
          : 'marked as maybe';
      Alert.alert('Success', `Job ${actionText} successfully`);

      // Refresh data
      await loadData();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update invitation status');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatRange = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    return `${s.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })} - ${e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScreenHeader 
        title="Invitations" 
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
        {contact && (
          <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
            Respond to your pending job invitations
          </Text>
        )}
        {loading && (
          <View style={styles.loader}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}
        {error && <Text style={[styles.error, { color: colors.error }]}>{error}</Text>}

        {!loading && invitations.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="mail-outline" size={64} color={colors.icon} />
            <Text style={[styles.emptyStateText, { color: colors.text }]}>No pending invitations</Text>
            <Text style={[styles.emptyStateSubtext, { color: colors.textTertiary }]}>
              You're all caught up! New invitations will appear here.
            </Text>
          </View>
        )}

        {invitations.map((invitation) => {
          const isLoading = actionLoading === invitation.id;
          return (
            <View key={invitation.id} style={[styles.card, { backgroundColor: colors.card }]}>
              <Text style={[styles.jobName, { color: colors.text }]}>{invitation.name}</Text>

              <View style={styles.metaRow}>
                <Ionicons name="calendar-outline" size={18} color={colors.icon} />
                <Text style={[styles.metaText, { color: colors.textTertiary }]}>{formatDate(invitation.startTime)}</Text>
              </View>

              <View style={styles.metaRow}>
                <Ionicons name="time-outline" size={18} color={colors.icon} />
                <Text style={[styles.metaText, { color: colors.textTertiary }]}>
                  {formatRange(invitation.startTime, invitation.endTime)}
                </Text>
              </View>

              {invitation.location && (
                <View style={styles.metaRow}>
                  <Ionicons name="location-outline" size={18} color={colors.icon} />
                  <Text style={[styles.metaText, { color: colors.textTertiary }]}>{invitation.location}</Text>
                </View>
              )}

              {invitation.notes && (
                <View style={styles.notesContainer}>
                  <Text style={[styles.notesLabel, { color: colors.text }]}>Notes:</Text>
                  <Text style={[styles.notesText, { color: colors.textSecondary }]}>{invitation.notes}</Text>
                </View>
              )}

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.acceptButton, { backgroundColor: colors.success }]}
                  onPress={() => handleAction(invitation, 'accept')}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={18} color="#fff" />
                      <Text style={styles.acceptButtonText}>Accept</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.maybeButton, { backgroundColor: colors.warningLight, borderColor: colors.warning }]}
                  onPress={() => handleAction(invitation, 'maybe')}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color={colors.warning} />
                  ) : (
                    <>
                      <Ionicons name="help-circle" size={18} color={colors.warning} />
                      <Text style={[styles.maybeButtonText, { color: colors.warning }]}>Maybe</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.declineButton, { backgroundColor: colors.errorLight, borderColor: colors.error }]}
                  onPress={() => handleAction(invitation, 'decline')}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color={colors.error} />
                  ) : (
                    <>
                      <Ionicons name="close-circle" size={18} color={colors.error} />
                      <Text style={[styles.declineButtonText, { color: colors.error }]}>Decline</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    flexGrow: 1,
    gap: 12,
  },
  subtitle: { fontSize: 16, marginBottom: 8 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    gap: 12,
  },
  jobName: { fontSize: 18, fontWeight: '700', color: '#101828' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText: { color: '#6b7280', fontSize: 14 },
  notesContainer: {
    marginTop: 4,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: '#475467',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  acceptButton: {
    backgroundColor: '#10b981',
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  maybeButton: {
    backgroundColor: 'rgba(13, 178, 181, 0.12)',
    borderWidth: 1,
    borderColor: '#0db2b5',
  },
  maybeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0db2b5',
  },
  declineButton: {
    backgroundColor: 'rgba(217, 45, 32, 0.12)',
    borderWidth: 1,
    borderColor: '#d92d20',
  },
  declineButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#d92d20',
  },
  error: { color: '#d92d20', marginBottom: 12, fontWeight: '600' },
  loader: { paddingVertical: 12 },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#475467',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
