import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/theme';

type ScreenHeaderProps = {
  title: string;
  showBack?: boolean;
  rightAction?: {
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
  };
  // Profile avatar props
  showProfile?: boolean;
  profileInitial?: string;
  profileRoute?: string;
  onBackPress?: () => void;
  backTo?: string; // Explicit route to go back to
};

export default function ScreenHeader({ 
  title, 
  showBack = true, 
  rightAction,
  showProfile = false,
  profileInitial = 'A',
  profileRoute,
  onBackPress,
  backTo 
}: ScreenHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
    } else if (backTo) {
      // Use explicit back route if provided
      router.replace(backTo as any);
    } else if (router.canGoBack()) {
      router.back();
    } else {
      // Fallback to dashboard if can't go back
      router.replace('/admin/dashboard');
    }
  };

  const handleProfilePress = () => {
    if (profileRoute) {
      router.push(profileRoute as any);
    }
  };

  const renderRightElement = () => {
    if (showProfile) {
      return (
        <TouchableOpacity 
          style={styles.profileButton} 
          onPress={handleProfilePress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <View style={[styles.profileCircle, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.profileInitial, { color: colors.primaryText }]}>
              {profileInitial.toUpperCase()}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }

    if (rightAction) {
      return (
        <TouchableOpacity 
          style={styles.rightButton} 
          onPress={rightAction.onPress}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name={rightAction.icon} size={24} color={colors.text} />
        </TouchableOpacity>
      );
    }

    return <View style={styles.placeholder} />;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
      <View style={styles.content}>
        {showBack ? (
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={handleBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}
        
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{title}</Text>
        
        {renderRightElement()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 0,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
  },
  placeholder: {
    width: 40,
    height: 40,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  rightButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -8,
  },
  profileButton: {
    padding: 4,
  },
  profileCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitial: {
    fontWeight: '700',
    fontSize: 16,
  },
});
