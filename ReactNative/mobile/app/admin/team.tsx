import React, { useEffect, useState, useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View, ActivityIndicator, TouchableOpacity, RefreshControl, Alert, Modal, KeyboardAvoidingView, Platform, TextInput } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { apiFetch } from '@/lib/api';
import { useWindowDimensions } from 'react-native';
import ScreenHeader from '@/components/ScreenHeader';
import { useTheme } from '@/lib/theme';

type TeamMember = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  teamRole: string;
  isAdmin: boolean;
};

export default function AdminTeam() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const { height: screenHeight } = useWindowDimensions();
  const { colors } = useTheme();

  // Invite form
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [teamRole, setTeamRole] = useState('member');
  const [inviting, setInviting] = useState(false);

  const loadMembers = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const data = await apiFetch<TeamMember[]>('/api/organization/members');
      setMembers(data || []);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to load team members');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMembers(false);
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadMembers(false);
  }, []);

  const handleInvite = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      setInviting(true);
      await apiFetch('/api/organization/invite', {
        method: 'POST',
        body: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          teamRole,
        },
      });
      Alert.alert('Success', 'Team member invited successfully');
      setShowInviteModal(false);
      setFirstName('');
      setLastName('');
      setEmail('');
      setTeamRole('member');
      loadMembers();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to invite team member');
    } finally {
      setInviting(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      await apiFetch(`/api/organization/members/${userId}/role`, {
        method: 'PATCH',
        body: { teamRole: newRole },
      });
      Alert.alert('Success', 'Role updated successfully');
      loadMembers();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update role');
    }
  };

  const handleRemoveMember = (member: TeamMember) => {
    Alert.alert(
      'Remove Team Member',
      `Are you sure you want to remove ${member.firstName} ${member.lastName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiFetch(`/api/organization/members/${member.id}`, { method: 'DELETE' });
              Alert.alert('Success', 'Team member removed successfully');
              loadMembers();
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to remove team member');
            }
          },
        },
      ]
    );
  };

  const profileInitial = (member: TeamMember) => (member.firstName?.[0] || 'A').toUpperCase();

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Team" backTo="/admin/more" />
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <TouchableOpacity style={[styles.inviteButton, { backgroundColor: colors.primary }]} onPress={() => setShowInviteModal(true)}>
          <Ionicons name="person-add-outline" size={20} color="#fff" />
          <Text style={styles.inviteButtonText}>Invite Team Member</Text>
        </TouchableOpacity>

        {loading && (
          <View style={styles.loader}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}

        {members.map((member) => (
          <View key={member.id} style={[styles.memberCard, { backgroundColor: colors.card }]}>
            <View style={styles.memberHeader}>
              <View style={[styles.avatar, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.avatarText, { color: colors.primaryText }]}>{profileInitial(member)}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.memberName, { color: colors.text }]}>
                  {member.firstName} {member.lastName}
                </Text>
                <Text style={[styles.memberEmail, { color: colors.textTertiary }]}>{member.email}</Text>
                <View style={styles.roleRow}>
                  {member.isAdmin && (
                    <View style={[styles.adminBadge, { backgroundColor: colors.primaryLight }]}>
                      <Ionicons name="shield-checkmark" size={14} color={colors.primaryText} />
                      <Text style={[styles.adminText, { color: colors.primaryText }]}>Admin</Text>
                    </View>
                  )}
                  <View style={[styles.roleBadge, { backgroundColor: colors.backgroundTertiary }]}>
                    <Text style={[styles.roleText, { color: colors.textSecondary }]}>{member.teamRole}</Text>
                  </View>
                </View>
              </View>
            </View>
            <View style={styles.memberActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  const newRole = member.teamRole === 'admin' ? 'member' : 'admin';
                  handleUpdateRole(member.id, newRole);
                }}
              >
                <Ionicons name="person-outline" size={18} color={colors.primaryText} />
                <Text style={[styles.actionText, { color: colors.primaryText }]}>
                  {member.teamRole === 'admin' ? 'Make Member' : 'Make Admin'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.deleteButton]}
                onPress={() => handleRemoveMember(member)}
              >
                <Ionicons name="trash-outline" size={18} color={colors.error} />
                <Text style={[styles.actionText, { color: colors.error }]}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Invite Modal */}
      <Modal
        visible={showInviteModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowInviteModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[styles.modalOverlay, { backgroundColor: colors.modalBackdrop }]}
        >
          <View style={[styles.modalContent, { maxHeight: screenHeight * 0.9, minHeight: screenHeight * 0.7, backgroundColor: colors.modalBackground }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Invite Team Member</Text>
              <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>First Name *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }]}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="First Name"
                  placeholderTextColor={colors.placeholder}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Last Name *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }]}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Last Name"
                  placeholderTextColor={colors.placeholder}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Email *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.inputText }]}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholderTextColor={colors.placeholder}
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Role</Text>
                <View style={styles.roleOptions}>
                  <TouchableOpacity
                    style={[
                      styles.roleOption,
                      { backgroundColor: colors.backgroundTertiary },
                      teamRole === 'member' && { backgroundColor: colors.primary },
                    ]}
                    onPress={() => setTeamRole('member')}
                  >
                    <Text style={[
                      styles.roleOptionText,
                      { color: colors.text },
                      teamRole === 'member' && { color: '#fff' },
                    ]}>
                      Member
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.roleOption,
                      { backgroundColor: colors.backgroundTertiary },
                      teamRole === 'admin' && { backgroundColor: colors.primary },
                    ]}
                    onPress={() => setTeamRole('admin')}
                  >
                    <Text style={[
                      styles.roleOptionText,
                      { color: colors.text },
                      teamRole === 'admin' && { color: '#fff' },
                    ]}>
                      Admin
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
            <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { backgroundColor: colors.backgroundTertiary }]}
                onPress={() => setShowInviteModal(false)}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton, { backgroundColor: colors.primary }]}
                onPress={handleInvite}
                disabled={inviting}
              >
                {inviting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Invite</Text>
                )}
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
  inviteButton: {
    backgroundColor: 'hsl(178, 60%, 50%)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  inviteButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  loader: { paddingVertical: 12 },
  memberCard: {
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
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(13, 178, 181, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#0db2b5', fontWeight: '700', fontSize: 18 },
  memberName: { fontSize: 18, fontWeight: '700', color: '#101828', marginBottom: 4 },
  memberEmail: { fontSize: 14, color: '#6b7280', marginBottom: 8 },
  roleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(13, 178, 181, 0.12)',
  },
  adminText: { fontSize: 12, fontWeight: '600', color: '#0db2b5' },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#e4e7ec',
  },
  roleText: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  memberActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e4e7ec',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
  },
  actionText: { fontSize: 14, fontWeight: '600', color: '#0db2b5' },
  deleteButton: {},
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
  input: {
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f1729',
  },
  roleOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  roleOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d0d5dd',
    alignItems: 'center',
  },
  roleOptionActive: {
    backgroundColor: 'rgba(13, 178, 181, 0.12)',
    borderColor: '#0db2b5',
  },
  roleOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  roleOptionTextActive: {
    color: '#0db2b5',
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

