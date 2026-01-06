import React from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useTheme } from '@/lib/theme';
import ScreenHeader from '@/components/ScreenHeader';

const menuItems = [
  {
    id: 'departments',
    title: 'Departments',
    icon: 'business-outline',
    route: '/admin/departments',
    description: 'Organize jobs & contacts',
  },
  {
    id: 'templates',
    title: 'Templates',
    icon: 'document-text-outline',
    route: '/admin/templates',
    description: 'Manage message templates',
  },
  {
    id: 'calendar',
    title: 'Calendar',
    icon: 'calendar-outline',
    route: '/admin/calendar',
    description: 'View jobs by date',
  },
  {
    id: 'team',
    title: 'Team',
    icon: 'people-outline',
    route: '/admin/team',
    description: 'Manage team members',
  },
  {
    id: 'billing',
    title: 'Billing',
    icon: 'card-outline',
    route: '/admin/billing',
    description: 'Subscription & credits',
  },
  {
    id: 'messages',
    title: 'Message History',
    icon: 'chatbubbles-outline',
    route: '/admin/messages',
    description: 'View all messages',
  },
  {
    id: 'profile',
    title: 'Profile',
    icon: 'person-outline',
    route: '/admin/profile',
    description: 'Account settings',
  },
];

export default function AdminMore() {
  const { colors } = useTheme();
  
  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScreenHeader title="More" />
      <ScrollView contentContainerStyle={styles.container}>
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.menuItem, { backgroundColor: colors.card }]}
            onPress={() => router.push(item.route as any)}
            activeOpacity={0.7}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.iconContainer, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name={item.icon as any} size={24} color={colors.primaryText} />
              </View>
              <View style={styles.menuItemContent}>
                <Text style={[styles.menuItemTitle, { color: colors.text }]}>{item.title}</Text>
                <Text style={[styles.menuItemDescription, { color: colors.textTertiary }]}>{item.description}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.icon} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, flexGrow: 1, gap: 8 },
  title: { fontSize: 24, fontWeight: '700' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  profileButton: { padding: 4, marginLeft: 12 },
  profileCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitial: { fontWeight: '700', fontSize: 16 },
  menuItem: {
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    marginBottom: 8,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuItemContent: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  menuItemDescription: {
    fontSize: 14,
  },
});

