import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Tabs, Redirect } from 'expo-router';
import { ActivityIndicator, Text, View, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { apiFetch } from '@/lib/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/theme';

type ContactMe = { type: 'contact'; firstName: string };

export default function ContactLayout() {
  const [isContact, setIsContact] = useState<boolean | null>(null);
  const [invitationCount, setInvitationCount] = useState(0);
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const insets = useSafeAreaInsets();
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTabRef = useRef<string | null>(null);
  const { colors } = useTheme();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const me = await apiFetch<ContactMe>('/api/mobile/auth/me');
        if (!mounted) return;
        setIsContact(me?.type === 'contact');
      } catch {
        if (!mounted) return;
        setIsContact(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const refreshInvitationCount = useCallback(async () => {
    try {
      const data = await apiFetch<{ invitations: any[] }>('/api/contact/invitations');
      setInvitationCount(data?.invitations?.length || 0);
    } catch {
      setInvitationCount(0);
    }
  }, []);

  useEffect(() => {
    refreshInvitationCount();
  }, [refreshInvitationCount]);


  // Refresh count when invitations tab is focused
  useEffect(() => {
    if (currentTab === 'invitations') {
      // Clear any existing timeout
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      // Refresh after a short delay to avoid too frequent calls
      refreshTimeoutRef.current = setTimeout(() => {
        refreshInvitationCount();
      }, 300);
    }
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [currentTab, refreshInvitationCount]);

  // Handle tab changes outside of render to avoid "Cannot update during render" warning
  useEffect(() => {
    if (pendingTabRef.current && pendingTabRef.current !== currentTab) {
      setCurrentTab(pendingTabRef.current);
      pendingTabRef.current = null;
    }
  });

  const tabBar = useMemo(
    () =>
      (props: any) => {
        const { state, descriptors, navigation } = props;
        const activeColor = colors.tabIconSelected;
        const inactiveColor = colors.tabIconDefault;
        const iconMap: Record<string, any> = {
          dashboard: 'home',
          schedule: 'calendar-outline',
          messages: 'chatbubbles-outline',
          invitations: 'notifications-outline',
          settings: 'settings-outline',
        };
        
        // Schedule tab update for next effect cycle (avoid setState during render)
        const currentRoute = state.routes[state.index]?.name;
        if (currentRoute && currentRoute !== currentTab) {
          pendingTabRef.current = currentRoute;
        }
        
        return (
          <View
            style={{
              flexDirection: 'row',
              paddingVertical: 8,
              paddingBottom: Math.max(insets.bottom, 8),
              borderTopWidth: 1,
              borderTopColor: colors.border,
              backgroundColor: colors.tabBar,
            }}>
            {state.routes.map((route: any, index: number) => {
              const { options } = descriptors[route.key];
              const isFocused = state.index === index;
              const label = options.tabBarLabel ?? options.title ?? route.name;
              const iconName = iconMap[route.name] ?? 'ellipse-outline';
              const onPress = () => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              };
              return (
                <Pressable
                  key={route.key}
                  style={{ flex: 1, alignItems: 'center', paddingVertical: 6 }}
                  onPress={onPress}>
                  <Ionicons name={iconName} size={20} color={isFocused ? activeColor : inactiveColor} />
                  {route.name === 'invitations' && invitationCount > 0 && (
                    <View style={{ position: 'absolute', top: 2, right: 24, backgroundColor: colors.error, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{invitationCount > 9 ? '9+' : invitationCount}</Text>
                    </View>
                  )}
                  <Text style={{ fontSize: 12, color: isFocused ? activeColor : colors.textSecondary, marginTop: 2 }}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        );
      },
    [invitationCount, currentTab, insets.bottom, colors],
  );

  if (isContact === false) return <Redirect href="/auth" />;
  if (isContact === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <Tabs tabBar={tabBar} initialRouteName="dashboard" screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="dashboard" options={{ tabBarLabel: 'Dashboard', title: 'Dashboard' }} />
      <Tabs.Screen name="schedule" options={{ tabBarLabel: 'Calendar', title: 'Calendar' }} />
      <Tabs.Screen name="messages" options={{ tabBarLabel: 'Messages', title: 'Messages' }} />
      <Tabs.Screen name="invitations" options={{ tabBarLabel: 'Invitations', title: 'Invitations' }} />
      <Tabs.Screen name="settings" options={{ tabBarLabel: 'Settings', title: 'Settings' }} />
    </Tabs>
  );
}

