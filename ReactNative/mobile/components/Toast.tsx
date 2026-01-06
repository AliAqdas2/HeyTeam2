import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export type ToastConfig = {
  message: string;
  type: ToastType;
  duration?: number; // ms, default 3000
  action?: {
    label: string;
    onPress: () => void;
  };
};

type ToastProps = {
  visible: boolean;
  config: ToastConfig | null;
  onHide: () => void;
};

const ICON_MAP: Record<ToastType, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  info: 'information-circle',
  warning: 'warning',
};

const COLOR_MAP: Record<ToastType, { bg: string; border: string; icon: string; text: string }> = {
  success: {
    bg: '#ecfdf5',
    border: '#10b981',
    icon: '#059669',
    text: '#065f46',
  },
  error: {
    bg: '#fef2f2',
    border: '#ef4444',
    icon: '#dc2626',
    text: '#991b1b',
  },
  info: {
    bg: '#eff6ff',
    border: '#3b82f6',
    icon: '#2563eb',
    text: '#1e40af',
  },
  warning: {
    bg: '#fffbeb',
    border: '#f59e0b',
    icon: '#d97706',
    text: '#92400e',
  },
};

export function Toast({ visible, config, onHide }: ToastProps) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && config) {
      // Slide in
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-hide after duration
      const duration = config.duration || 3000;
      const timer = setTimeout(() => {
        hideToast();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible, config]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide();
    });
  };

  if (!visible || !config) return null;

  const colors = COLOR_MAP[config.type];
  const iconName = ICON_MAP[config.type];

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: insets.top + (Platform.OS === 'ios' ? 10 : 20),
          backgroundColor: colors.bg,
          borderColor: colors.border,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <View style={styles.content}>
        <Ionicons name={iconName} size={22} color={colors.icon} />
        <Text style={[styles.message, { color: colors.text }]} numberOfLines={2}>
          {config.message}
        </Text>
        {config.action && (
          <TouchableOpacity onPress={config.action.onPress} style={styles.actionButton}>
            <Text style={[styles.actionText, { color: colors.icon }]}>
              {config.action.label}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={hideToast} style={styles.closeButton}>
          <Ionicons name="close" size={18} color={colors.icon} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// Hook for easier toast usage
type ToastState = {
  visible: boolean;
  config: ToastConfig | null;
};

export function useToast() {
  const [state, setState] = React.useState<ToastState>({
    visible: false,
    config: null,
  });

  const show = (config: ToastConfig) => {
    setState({ visible: true, config });
  };

  const hide = () => {
    setState({ visible: false, config: null });
  };

  const success = (message: string, duration?: number) => {
    show({ message, type: 'success', duration });
  };

  const error = (message: string, duration?: number) => {
    show({ message, type: 'error', duration });
  };

  const info = (message: string, duration?: number) => {
    show({ message, type: 'info', duration });
  };

  const warning = (message: string, duration?: number) => {
    show({ message, type: 'warning', duration });
  };

  return {
    ...state,
    show,
    hide,
    success,
    error,
    info,
    warning,
  };
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 9999,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 10,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  actionButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
    marginLeft: 4,
  },
});

export default Toast;

