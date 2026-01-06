import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { apiFetch } from '@/lib/api';
import DateTimePicker from '@/components/DateTimePicker';
import LocationPicker from '@/components/LocationPicker';
import ScreenHeader from '@/components/ScreenHeader';
import SkillRequirementInput, { SkillRequirement } from '@/components/SkillRequirementInput';
import DepartmentPicker from '@/components/DepartmentPicker';
import RecurringJobConfig, { RecurrencePattern } from '@/components/RecurringJobConfig';
import { Toast, useToast } from '@/components/Toast';
import { useTheme } from '@/lib/theme';

type JobSkillRequirement = {
  skill: string;
  headcount: number;
  notes?: string | null;
};

type Job = {
  id: string;
  name: string;
  location: string;
  startTime: string;
  endTime: string;
  requiredHeadcount?: number;
  notes?: string;
  departmentId?: string | null;
  isRecurring?: boolean;
  recurrencePattern?: RecurrencePattern | string | null;
  skillRequirements?: JobSkillRequirement[];
};

type Department = {
  id: string;
  name: string;
  address?: string | null;
};

export default function EditJob() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [startDateTime, setStartDateTime] = useState<Date | null>(null);
  const [endDateTime, setEndDateTime] = useState<Date | null>(null);
  const [requiredHeadcount, setRequiredHeadcount] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  
  // New fields
  const [skillRequirements, setSkillRequirements] = useState<SkillRequirement[]>([]);
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState<RecurrencePattern | null>(null);
  
  const toast = useToast();
  const { colors } = useTheme();
  
  // Get Google API key from environment
  const googleApiKey = process.env.EXPO_PUBLIC_GOOGLE_API_KEY || '';

  useEffect(() => {
    loadJob();
  }, [id]);

  // Auto-calculate headcount from skill requirements
  useEffect(() => {
    const totalHeadcount = skillRequirements.reduce((sum, req) => sum + req.headcount, 0);
    if (totalHeadcount > 0) {
      setRequiredHeadcount(totalHeadcount.toString());
    }
  }, [skillRequirements]);

  const loadJob = async () => {
    try {
      setLoading(true);
      const data = await apiFetch<Job>(`/api/jobs/${id}`);
      setJob(data);
      setName(data.name);
      setLocation(data.location);
      
      const start = new Date(data.startTime);
      const end = new Date(data.endTime);
      setStartDateTime(start);
      setEndDateTime(end);
      setRequiredHeadcount(data.requiredHeadcount?.toString() || '');
      setNotes(data.notes || '');
      
      // Set new fields
      setDepartmentId(data.departmentId || null);
      setIsRecurring(data.isRecurring || false);
      
      // Parse recurrence pattern if it's a string
      if (data.recurrencePattern) {
        let parsedPattern: RecurrencePattern | null = null;
        if (typeof data.recurrencePattern === 'string') {
          try {
            parsedPattern = JSON.parse(data.recurrencePattern);
          } catch {
            parsedPattern = null;
          }
        } else {
          parsedPattern = data.recurrencePattern;
        }
        setRecurrencePattern(parsedPattern);
      }
      
      // Set skill requirements
      if (data.skillRequirements) {
        setSkillRequirements(
          data.skillRequirements.map((req) => ({
            skill: req.skill,
            headcount: req.headcount,
            notes: req.notes || undefined,
          }))
        );
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load job');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleDepartmentChange = (id: string | null, department?: Department) => {
    setDepartmentId(id);
    // Auto-fill location from department address if location is empty
    if (department?.address && !location.trim()) {
      setLocation(department.address);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !location.trim() || !startDateTime || !endDateTime) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (endDateTime <= startDateTime) {
      toast.error('End time must be after start time');
      return;
    }

    try {
      setSaving(true);

      // Format skill requirements for API
      const formattedSkillRequirements = skillRequirements.map((req) => ({
        skill: req.skill,
        headcount: req.headcount,
        notes: req.notes || null,
      }));

      await apiFetch(`/api/jobs/${id}`, {
        method: 'PATCH',
        body: {
          name: name.trim(),
          location: location.trim(),
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          requiredHeadcount: requiredHeadcount ? parseInt(requiredHeadcount, 10) : null,
          notes: notes.trim() || null,
          skillRequirements: formattedSkillRequirements,
          departmentId: departmentId || null,
          isRecurring,
          recurrencePattern: isRecurring && recurrencePattern ? recurrencePattern : null,
        },
      });

      toast.success('Job updated successfully');
      setTimeout(() => router.back(), 500);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update job');
    } finally {
      setSaving(false);
    }
  };

  const headcountFromSkills = skillRequirements.reduce((sum, req) => sum + req.headcount, 0);

  if (loading) {
    return (
      <View style={[styles.safe, { backgroundColor: colors.background }]}>
        <ScreenHeader title="Edit Job" />
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Edit Job" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Job Name *</Text>
            <TextInput
              style={[styles.input, { 
                backgroundColor: colors.inputBackground || colors.card,
                borderColor: colors.border,
                color: colors.inputText
              }]}
              value={name}
              onChangeText={setName}
              placeholder="e.g., Downtown Construction Site"
              placeholderTextColor={colors.placeholder}
            />
          </View>

          {/* Skill Requirements */}
          <SkillRequirementInput
            value={skillRequirements}
            onChange={setSkillRequirements}
          />

          {/* Department */}
          <DepartmentPicker
            value={departmentId}
            onChange={handleDepartmentChange}
          />

          <LocationPicker
            label="Location"
            value={location}
            onChange={setLocation}
            placeholder="Search for an address"
            required
            googleApiKey={googleApiKey}
          />

          <DateTimePicker
            label="Start Date & Time"
            value={startDateTime}
            onChange={setStartDateTime}
            mode="datetime"
            required
          />

          <DateTimePicker
            label="End Date & Time"
            value={endDateTime}
            onChange={setEndDateTime}
            mode="datetime"
            minimumDate={startDateTime || undefined}
            required
          />

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Required Headcount</Text>
            <TextInput
              style={[styles.input, headcountFromSkills > 0 && styles.inputDisabled, { 
                backgroundColor: headcountFromSkills > 0 ? colors.backgroundSecondary : (colors.inputBackground || colors.card),
                borderColor: colors.border,
                color: colors.inputText
              }]}
              value={requiredHeadcount}
              onChangeText={setRequiredHeadcount}
              placeholder="Number of people needed"
              keyboardType="numeric"
              placeholderTextColor={colors.placeholder}
              editable={headcountFromSkills === 0}
            />
            {headcountFromSkills > 0 && (
              <Text style={[styles.inputHint, { color: colors.textTertiary }]}>
                Auto-calculated from skill requirements: {headcountFromSkills} people
              </Text>
            )}
          </View>

          {/* Recurring Job */}
          <RecurringJobConfig
            isRecurring={isRecurring}
            onRecurringChange={setIsRecurring}
            pattern={recurrencePattern}
            onPatternChange={setRecurrencePattern}
          />

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.text }]}>Notes (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea, { 
                backgroundColor: colors.inputBackground || colors.card,
                borderColor: colors.border,
                color: colors.inputText
              }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Additional notes..."
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              placeholderTextColor={colors.placeholder}
            />
          </View>
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton, { backgroundColor: colors.backgroundSecondary }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.saveButton, { backgroundColor: colors.primary }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Toast */}
      <Toast visible={toast.visible} config={toast.config} onHide={toast.hide} />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1 },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 32 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  inputDisabled: {},
  inputHint: {
    fontSize: 12,
    marginTop: 6,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {},
  cancelButtonText: { fontWeight: '700', fontSize: 16 },
  saveButton: {},
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
