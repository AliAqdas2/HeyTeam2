import React, { useEffect, useState, useMemo } from 'react';
import { Tabs, Redirect } from 'expo-router';
import { ActivityIndicator, Text, View, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { apiFetch } from '@/lib/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/theme';

type UserMe = { type: 'user'; firstName: string };

export default function AdminLayout() {
  const [isUser, setIsUser] = useState<boolean | null>(null);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const me = await apiFetch<UserMe>('/api/mobile/auth/me');
        if (!mounted) return;
        setIsUser(me?.type === 'user');
      } catch {
        if (!mounted) return;
        setIsUser(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const tabBar = useMemo(
    () =>
      (props: any) => {
        const { state, descriptors, navigation } = props;
        const activeColor = colors.tabIconSelected;
        const inactiveColor = colors.tabIconDefault;
        const iconMap: Record<string, any> = {
          dashboard: 'briefcase-outline',
          contacts: 'people-outline',
          calendar: 'calendar-outline',
          more: 'menu-outline',
        };
        
        // Only show these tabs in the bottom navigation
        const visibleTabs = ['dashboard', 'contacts', 'calendar', 'more'];
        
        // Filter routes to only show visible tabs
        const visibleRoutes = state.routes.filter((route: any) => 
          visibleTabs.includes(route.name)
        );
        
        // Find the active index based on visible routes
        const activeRoute = state.routes[state.index];
        const activeIndex = visibleRoutes.findIndex((route: any) => route.key === activeRoute?.key);
        
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
            {visibleRoutes.map((route: any, index: number) => {
              const { options } = descriptors[route.key];
              const isFocused = activeIndex === index;
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
                  <Text style={{ fontSize: 12, color: isFocused ? activeColor : colors.textSecondary, marginTop: 2 }}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        );
      },
    [insets.bottom, colors],
  );

  if (isUser === false) return <Redirect href="/auth" />;
  if (isUser === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <Tabs tabBar={tabBar} initialRouteName="dashboard" screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="dashboard" options={{ tabBarLabel: 'Dashboard', title: 'Dashboard' }} />
      <Tabs.Screen name="contacts" options={{ tabBarLabel: 'Contacts', title: 'Contacts' }} />
      <Tabs.Screen name="calendar" options={{ tabBarLabel: 'Calendar', title: 'Calendar' }} />
      <Tabs.Screen name="more" options={{ tabBarLabel: 'More', title: 'More' }} />
      {/* Hide other screens from tab bar */}
      <Tabs.Screen 
        name="templates" 
        options={{ 
          tabBarButton: () => null,
        }} 
      />
      <Tabs.Screen 
        name="profile" 
        options={{ 
          tabBarButton: () => null,
        }} 
      />
      <Tabs.Screen 
        name="team" 
        options={{ 
          tabBarButton: () => null,
        }} 
      />
      <Tabs.Screen 
        name="billing" 
        options={{ 
          tabBarButton: () => null,
        }} 
      />
      <Tabs.Screen 
        name="messages" 
        options={{ 
          tabBarButton: () => null,
        }} 
      />
      <Tabs.Screen 
        name="jobs" 
        options={{ 
          tabBarButton: () => null,
        }} 
      />
    </Tabs>
  );
}

