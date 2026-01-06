import React, { useEffect, useState, useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View, ActivityIndicator, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { apiFetch } from '@/lib/api';
import ScreenHeader from '@/components/ScreenHeader';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '@/lib/theme';

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

export default function AdminBilling() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [credits, setCredits] = useState<{ available: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const { colors } = useTheme();

  const loadData = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const [subscriptionRes, plansRes, creditsRes] = await Promise.all([
        apiFetch<Subscription | null>('/api/subscription').catch(() => null),
        apiFetch<SubscriptionPlan[]>('/api/subscription-plans').catch(() => []),
        apiFetch<{ available: number }>('/api/credits').catch(() => ({ available: 0 })),
      ]);
      setSubscription(subscriptionRes);
      setPlans(plansRes || []);
      setCredits(creditsRes || { available: 0 });
    } catch (e: any) {
      // Handle errors silently for optional data
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

  const handleSubscribe = async (planId: string) => {
    try {
      setSubscribing(planId);
      
      // Create checkout session
      const response = await apiFetch<{ url: string }>('/api/create-checkout-session', {
        method: 'POST',
        body: { planId, currency },
      });

      if (response?.url) {
        // Open Stripe checkout in browser
        const result = await WebBrowser.openBrowserAsync(response.url);
        
        // Refresh data after returning from browser
        if (result.type === 'dismiss' || result.type === 'cancel') {
          loadData(false);
        }
      } else {
        Alert.alert('Error', 'Failed to create checkout session');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to start subscription');
    } finally {
      setSubscribing(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      // Open Stripe billing portal in browser
      const response = await apiFetch<{ url: string }>('/api/stripe/create-portal-session', {
        method: 'POST',
      });

      if (response?.url) {
        await WebBrowser.openBrowserAsync(response.url);
        loadData(false);
      } else {
        // Fallback to web portal
        await WebBrowser.openBrowserAsync('https://portal.heyteam.ai/billing');
        loadData(false);
      }
    } catch (e: any) {
      // Fallback to web portal
      await WebBrowser.openBrowserAsync('https://portal.heyteam.ai/billing');
      loadData(false);
    }
  };

  const currentPlan = subscription ? plans.find((p) => p.id === subscription.planId) : null;
  const currency = subscription?.currency ?? 'GBP';
  const symbol = CURRENCY_SYMBOLS[currency] ?? '£';
  const availableCredits = credits?.available ?? 0;
  const monthlyCredits = currentPlan?.monthlyCredits ?? null;

  const price =
    currentPlan
      ? currency === 'USD'
        ? currentPlan.priceUSD
        : currency === 'EUR'
          ? currentPlan.priceEUR
          : currentPlan.priceGBP
      : null;

  const usagePercent =
    monthlyCredits && monthlyCredits > 0
      ? Math.min(100, Math.max(0, Math.round(((monthlyCredits - availableCredits) / monthlyCredits) * 100)))
      : null;

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Billing" backTo="/admin/more" />
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

        {/* Current Plan */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Current Plan</Text>
          <Text style={[styles.planName, { color: colors.text }]}>{currentPlan?.name ?? 'Free Trial'}</Text>
          <Text style={[styles.planStatus, { color: colors.textTertiary }]}>{subscription?.status ?? 'trial'}</Text>
          {price !== null && (
            <Text style={[styles.planPrice, { color: colors.text }]}>
              {symbol}
              {(price / 100).toFixed(0)}/month
            </Text>
          )}
          {subscription?.currentPeriodEnd && (
            <Text style={[styles.renewalText, { color: colors.textTertiary }]}>
              Renews: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
            </Text>
          )}
          {subscription && (
            <TouchableOpacity 
              style={[styles.manageButton, { backgroundColor: colors.primaryLight }]} 
              onPress={handleManageSubscription}
            >
              <Ionicons name="settings-outline" size={18} color={colors.primaryText} />
              <Text style={[styles.manageButtonText, { color: colors.primaryText }]}>Manage Subscription</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* SMS Credits */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>SMS Credits</Text>
          <Text style={[styles.creditsAmount, { color: colors.text }]}>
            {availableCredits.toLocaleString()}
            {monthlyCredits ? ` / ${monthlyCredits.toLocaleString()}` : ''}
          </Text>
          {usagePercent !== null && (
            <>
              <View style={[styles.progressContainer, { backgroundColor: colors.border }]}>
                <View style={[styles.progressBar, { width: `${100 - usagePercent}%`, backgroundColor: colors.primaryText }]} />
              </View>
              <Text style={[styles.usageText, { color: colors.textTertiary }]}>{usagePercent}% of monthly credits used</Text>
            </>
          )}
        </View>

        {/* Available Plans */}
        {plans.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {subscription ? 'Upgrade Plan' : 'Choose a Plan'}
            </Text>
            {plans.map((plan) => {
              const planPrice =
                currency === 'USD'
                  ? plan.priceUSD
                  : currency === 'EUR'
                    ? plan.priceEUR
                    : plan.priceGBP;
              const isCurrentPlan = currentPlan?.id === plan.id;
              const isSubscribing = subscribing === plan.id;
              
              return (
                <View key={plan.id} style={[
                  styles.planCard,
                  { backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
                  isCurrentPlan && { backgroundColor: colors.primaryLight, borderColor: colors.primaryText },
                ]}>
                  <View style={styles.planCardHeader}>
                    <View>
                      <Text style={[styles.planCardName, { color: colors.text }]}>{plan.name}</Text>
                      {isCurrentPlan && (
                        <View style={[styles.currentBadge, { backgroundColor: colors.primary }]}>
                          <Text style={styles.currentBadgeText}>Current Plan</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.planCardPrice, { color: colors.text }]}>
                      {symbol}
                      {(planPrice / 100).toFixed(0)}
                      <Text style={[styles.planCardPriceMonth, { color: colors.textTertiary }]}>/mo</Text>
                    </Text>
                  </View>
                  <Text style={[styles.planCardCredits, { color: colors.textSecondary }]}>
                    {plan.monthlyCredits.toLocaleString()} SMS credits/month
                  </Text>
                  {!isCurrentPlan && (
                    <TouchableOpacity
                      style={[styles.subscribeButton, { backgroundColor: colors.primary }, isSubscribing && { opacity: 0.6 }]}
                      onPress={() => handleSubscribe(plan.id)}
                      disabled={isSubscribing}
                    >
                      {isSubscribing ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.subscribeButtonText}>
                          {subscription ? 'Upgrade' : 'Subscribe'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}

        <Text style={[styles.note, { color: colors.textTertiary }]}>
          Payments are processed securely via Stripe. Cancel anytime.
        </Text>
      </ScrollView>
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
  loader: { paddingVertical: 12 },
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
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#101828', marginBottom: 8 },
  planName: { fontSize: 24, fontWeight: '700', color: '#101828' },
  planStatus: {
    fontSize: 14,
    color: '#6b7280',
    textTransform: 'capitalize',
    marginTop: 4,
  },
  planPrice: { fontSize: 18, fontWeight: '600', color: '#0db2b5', marginTop: 4 },
  renewalText: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  creditsAmount: { fontSize: 32, fontWeight: '700', color: '#101828' },
  progressContainer: {
    height: 8,
    backgroundColor: '#e4e7ec',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 12,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#0db2b5',
    borderRadius: 4,
  },
  usageText: { fontSize: 12, color: '#6b7280', marginTop: 8 },
  planCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f5f7fb',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  planCardCurrent: {
    borderColor: '#0db2b5',
    backgroundColor: 'rgba(13, 178, 181, 0.05)',
  },
  planCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  planCardName: { fontSize: 18, fontWeight: '700', color: '#101828' },
  planCardPrice: { fontSize: 24, fontWeight: '700', color: '#0db2b5' },
  planCardPriceMonth: { fontSize: 14, fontWeight: '500', color: '#6b7280' },
  planCardCredits: { fontSize: 14, color: '#6b7280', marginBottom: 12 },
  currentBadge: {
    backgroundColor: '#0db2b5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4,
  },
  currentBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    textTransform: 'uppercase',
  },
  subscribeButton: {
    backgroundColor: '#0db2b5',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscribeButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  subscribeButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#0db2b5',
    borderRadius: 8,
    gap: 8,
  },
  manageButtonText: {
    color: '#0db2b5',
    fontWeight: '600',
    fontSize: 14,
  },
  note: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
});

