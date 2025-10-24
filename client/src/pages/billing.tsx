import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Check, CreditCard, Zap, Users, Building2, Package } from "lucide-react";
import { format } from "date-fns";
import type { Subscription, User } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type Currency = "GBP" | "USD" | "EUR";

interface SubscriptionPlan {
  id: string;
  name: string;
  priceGBP: number;
  priceUSD: number;
  priceEUR: number;
  monthlyCredits: number;
  calendarIntegrations: number;
  supportLevel: string;
  customTemplates: boolean;
  autoFollowUp: boolean;
  multiManager: boolean;
  aiFeatures: boolean;
  dedicatedNumber: boolean;
}

interface SmsBundle {
  id: string;
  name: string;
  description: string | null;
  credits: number;
  priceGBP: number;
  priceUSD: number;
  priceEUR: number;
}

const CURRENCY_SYMBOLS = {
  GBP: "£",
  USD: "$",
  EUR: "€",
} as const;

const PLAN_ICONS = {
  Starter: Zap,
  Team: Users,
  Business: Building2,
} as const;

export default function Billing() {
  const { toast } = useToast();
  const [currency, setCurrency] = useState<Currency>("GBP");
  const [bundlesDialogOpen, setBundlesDialogOpen] = useState(false);

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  const { data: subscription, isLoading: isLoadingSubscription } = useQuery<Subscription>({
    queryKey: ["/api/subscription"],
  });

  const { data: plans = [], isLoading: isLoadingPlans } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/subscription-plans"],
  });

  const { data: credits } = useQuery<{ available: number; breakdown: any }>({
    queryKey: ["/api/credits"],
  });

  const { data: bundles = [], isLoading: isLoadingBundles } = useQuery<SmsBundle[]>({
    queryKey: ["/api/sms-bundles"],
    enabled: bundlesDialogOpen, // Only fetch when dialog is opened
  });

  const checkoutMutation = useMutation({
    mutationFn: async ({ planId, currency }: { planId: string; currency: Currency }) => {
      const response = await apiRequest("POST", "/api/create-checkout-session", { planId, currency });
      return response.json();
    },
    onSuccess: (data: { url: string }) => {
      window.location.href = data.url;
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create checkout session",
        variant: "destructive",
      });
    },
  });

  const getPrice = (plan: SubscriptionPlan) => {
    switch (currency) {
      case "USD":
        return plan.priceUSD;
      case "EUR":
        return plan.priceEUR;
      default:
        return plan.priceGBP;
    }
  };

  const getPlanFeatures = (plan: SubscriptionPlan) => {
    const features = [
      `${plan.monthlyCredits.toLocaleString()} messages per month`,
      `${plan.calendarIntegrations} calendar integration${plan.calendarIntegrations > 1 ? "s" : ""}`,
      `${plan.supportLevel} support`,
    ];

    if (plan.customTemplates) features.push("Custom message templates");
    if (plan.autoFollowUp) features.push("Auto follow-up messages");
    if (plan.multiManager) features.push("Multi-manager access");
    if (plan.aiFeatures) features.push("AI-powered insights");
    if (plan.dedicatedNumber) features.push("Dedicated phone number");

    return features;
  };

  const handleSelectPlan = (planId: string) => {
    checkoutMutation.mutate({ planId, currency });
  };

  // Set initial currency from user preference
  useEffect(() => {
    if (user?.currency) {
      setCurrency(user.currency as Currency);
    }
  }, [user?.currency]);

  if (isLoadingSubscription || isLoadingPlans) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading" />
      </div>
    );
  }

  const currentPlan = plans.find((p) => p.id === subscription?.planId);
  const creditUsagePercent = currentPlan && credits
    ? Math.round(((currentPlan.monthlyCredits - credits.available) / currentPlan.monthlyCredits) * 100)
    : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold" data-testid="text-page-title">Billing & Subscription</h1>
        <p className="text-muted-foreground mt-1">Manage your plan and SMS credits</p>
      </div>

      {subscription && currentPlan && (
        <Card data-testid="card-current-subscription">
          <CardHeader>
            <h2 className="text-lg font-semibold">Current Plan</h2>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-2xl font-semibold" data-testid="text-current-plan">
                    {currentPlan.name}
                  </h3>
                  <Badge variant={subscription.status === "active" ? "default" : "secondary"} data-testid="badge-subscription-status">
                    {subscription.status}
                  </Badge>
                </div>
                <div className="text-lg text-muted-foreground mt-1">
                  {CURRENCY_SYMBOLS[subscription.currency as Currency || "GBP"]}
                  {((subscription.currency === "USD" ? currentPlan.priceUSD : subscription.currency === "EUR" ? currentPlan.priceEUR : currentPlan.priceGBP) / 100).toFixed(0)}
                  /month
                </div>
                {subscription.currentPeriodEnd && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Renews on {format(new Date(subscription.currentPeriodEnd), "MMMM d, yyyy")}
                  </p>
                )}
              </div>
              <Button variant="outline" data-testid="button-manage-stripe">
                <CreditCard className="h-4 w-4 mr-2" />
                Manage in Stripe
              </Button>
            </div>

            {credits && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">SMS Credits</span>
                  <span className="text-sm text-muted-foreground" data-testid="text-credits-remaining">
                    {credits.available} / {currentPlan.monthlyCredits} remaining
                  </span>
                </div>
                <Progress value={100 - creditUsagePercent} className="h-3" data-testid="progress-credit-usage" />
                <p className="text-xs text-muted-foreground">
                  {creditUsagePercent}% used this month
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold">Available Plans</h2>
          <div className="inline-flex items-center gap-2 p-1 bg-muted rounded-lg" data-testid="group-currency-selector">
            {(["GBP", "USD", "EUR"] as Currency[]).map((curr) => (
              <Button
                key={curr}
                variant={currency === curr ? "default" : "ghost"}
                size="sm"
                onClick={() => setCurrency(curr)}
                className={`toggle-elevate ${currency === curr ? "toggle-elevated" : ""}`}
                data-testid={`button-currency-${curr.toLowerCase()}`}
              >
                {CURRENCY_SYMBOLS[curr]} {curr}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isCurrent = plan.id === subscription?.planId;
            const Icon = PLAN_ICONS[plan.name as keyof typeof PLAN_ICONS] || Zap;

            return (
              <Card 
                key={plan.id} 
                className={isCurrent ? "border-primary" : ""} 
                data-testid={`card-plan-${plan.name.toLowerCase()}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="w-5 h-5 text-primary" />
                        <h3 className="text-xl font-semibold" data-testid={`text-plan-name-${plan.name.toLowerCase()}`}>
                          {plan.name}
                        </h3>
                      </div>
                      <div className="text-3xl font-bold" data-testid={`text-price-${plan.name.toLowerCase()}`}>
                        {CURRENCY_SYMBOLS[currency]}{(getPrice(plan) / 100).toFixed(0)}
                      </div>
                      <p className="text-sm text-muted-foreground">per month</p>
                    </div>
                    {isCurrent && (
                      <Badge variant="default" data-testid="badge-current-plan">Current</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    {getPlanFeatures(plan).map((feature, index) => (
                      <div key={index} className="flex items-start gap-2" data-testid={`text-feature-${plan.name.toLowerCase()}-${index}`}>
                        <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>
                  <Button
                    className="w-full"
                    variant={isCurrent ? "outline" : "default"}
                    disabled={isCurrent || checkoutMutation.isPending}
                    onClick={() => handleSelectPlan(plan.id)}
                    data-testid={`button-select-${plan.name.toLowerCase()}`}
                  >
                    {checkoutMutation.isPending ? "Loading..." : isCurrent ? "Current Plan" : "Select Plan"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Need More Credits?</h3>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Running low on SMS credits? Purchase additional SMS bundles at discounted rates or upgrade your plan for more monthly credits.
          </p>
          <Button 
            variant="outline" 
            onClick={() => setBundlesDialogOpen(true)}
            data-testid="button-view-bundles"
          >
            <Package className="h-4 w-4 mr-2" />
            View SMS Bundles
          </Button>
        </CardContent>
      </Card>

      <Dialog open={bundlesDialogOpen} onOpenChange={setBundlesDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>SMS Bundles</DialogTitle>
            <DialogDescription>
              Purchase additional SMS credits at discounted rates
            </DialogDescription>
          </DialogHeader>

          {isLoadingBundles ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading" />
            </div>
          ) : bundles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No SMS bundles available at this time.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {bundles.map((bundle) => {
                const price = currency === "USD" ? bundle.priceUSD : currency === "EUR" ? bundle.priceEUR : bundle.priceGBP;
                
                return (
                  <Card key={bundle.id} data-testid={`card-bundle-${bundle.id}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-xl font-semibold">{bundle.name}</h3>
                          {bundle.description && (
                            <p className="text-sm text-muted-foreground mt-1">{bundle.description}</p>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold">
                          {CURRENCY_SYMBOLS[currency]}{(price / 100).toFixed(0)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          for {bundle.credits.toLocaleString()} credits
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        ${((price / 100) / bundle.credits * 1000).toFixed(2)} per 1,000 messages
                      </div>
                      <Button 
                        className="w-full"
                        data-testid={`button-purchase-bundle-${bundle.id}`}
                      >
                        Purchase Bundle
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
