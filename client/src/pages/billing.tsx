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
import { CancellationReasonDialog } from "@/components/cancellation-reason-dialog";

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
  targetAudience: string;
  featureBullets: string;
  useCase: string;
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
  const [cancellationDialogOpen, setCancellationDialogOpen] = useState(false);

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
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
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

  const bundleCheckoutMutation = useMutation({
    mutationFn: async ({ bundleId, currency }: { bundleId: string; currency: Currency }) => {
      const response = await apiRequest("POST", "/api/create-bundle-checkout-session", { bundleId, currency });
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

  const manageStripeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/stripe/create-portal-session", {});
      return response.json();
    },
    onSuccess: (data: { url: string }) => {
      window.location.href = data.url;
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to open Stripe portal",
        variant: "destructive",
      });
    },
  });

  const handleCancellationComplete = () => {
    // This will be called after successful cancellation from the dialog
    setCancellationDialogOpen(false);
  };

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
    const normalized = plan.featureBullets
      ? plan.featureBullets
          .split("\n")
          .map((line) => line.trim())
          .map((line) => (line === "" ? "__SPACER__" : line))
      : [];

    if (normalized.length > 0) {
      return normalized;
    }

    const fallback = [
      `${plan.monthlyCredits.toLocaleString()} messages per month`,
      `${plan.supportLevel} support`,
    ];

    if (plan.customTemplates) fallback.push("Custom message templates");
    if (plan.autoFollowUp) fallback.push("Auto follow-up messages");
    if (plan.multiManager) fallback.push("Multi-manager access");
    if (plan.aiFeatures) fallback.push("AI-powered insights");
    if (plan.dedicatedNumber) fallback.push("Dedicated phone number");

    return fallback;
  };

  const renderFeatureItem = (feature: string, key: string | number) => {
    if (feature === "__SPACER__") {
      return <div key={key} className="h-2" aria-hidden />;
    }

    const isSectionHeading = feature.endsWith(":");

    if (isSectionHeading) {
      return (
        <div key={key} className="pt-2 text-sm font-semibold text-foreground">
          {feature}
        </div>
      );
    }

    return (
      <div key={key} className="flex items-start gap-2">
        <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
        <span className="text-sm">{feature}</span>
      </div>
    );
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

  // Handle Stripe checkout session return
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    
    if (sessionId) {
      // Process the checkout session on the backend
      const processCheckout = async () => {
        try {
          const response = await apiRequest("POST", "/api/stripe/process-session", { sessionId });
          const result = await response.json();
          
          // Show success message based on purchase type
          const isBundle = result.purchaseType === "bundle";
          toast({
            title: isBundle ? "SMS Bundle Purchased!" : "Subscription Activated!",
            description: `${result.creditsGranted || 0} credits have been added to your account.`,
          });
          
          // Invalidate queries to refetch subscription data
          queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
          queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
          queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        } catch (error: any) {
          console.error("Error processing checkout session:", error);
          toast({
            title: "Processing Payment",
            description: error.message || "Your payment was successful. Credits are being processed.",
            variant: "default",
          });
          
          // Still invalidate queries even if processing fails
          queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
          queryClient.invalidateQueries({ queryKey: ["/api/credits"] });
          queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        }
      };
      
      processCheckout();
      
      // Clean up URL by removing session_id
      window.history.replaceState({}, '', '/billing');
    }
  }, [toast]);

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
  const currentPlanFeatures = currentPlan ? getPlanFeatures(currentPlan) : [];

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
                  <Badge 
                    variant={subscription.cancelAtPeriodEnd ? "destructive" : subscription.status === "active" ? "default" : "secondary"} 
                    data-testid="badge-subscription-status"
                  >
                    {subscription.cancelAtPeriodEnd ? "Cancelling" : subscription.status}
                  </Badge>
                </div>
                <div className="text-lg text-muted-foreground mt-1">
                  {CURRENCY_SYMBOLS[subscription.currency as Currency || "GBP"]}
                  {((subscription.currency === "USD" ? currentPlan.priceUSD : subscription.currency === "EUR" ? currentPlan.priceEUR : currentPlan.priceGBP) / 100).toFixed(0)}
                  /month
                </div>
                {subscription.currentPeriodEnd && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {subscription.cancelAtPeriodEnd ? (
                      <span className="text-destructive">
                        Cancels on {format(new Date(subscription.currentPeriodEnd), "MMMM d, yyyy")}
                      </span>
                    ) : (
                      <>Renews on {format(new Date(subscription.currentPeriodEnd), "MMMM d, yyyy")}</>
                    )}
                  </p>
                )}
                {currentPlan.targetAudience && (
                  <div className="mt-4 space-y-1 text-sm">
                    <p className="text-xs uppercase font-semibold tracking-wide text-muted-foreground">
                      Target
                    </p>
                    <p>{currentPlan.targetAudience}</p>
                  </div>
                )}
                {currentPlan.useCase && (
                  <div className="mt-3 space-y-1 text-sm">
                    <p className="text-xs uppercase font-semibold tracking-wide text-muted-foreground">
                      Use Case
                    </p>
                    <p className="text-muted-foreground">{currentPlan.useCase}</p>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  data-testid="button-manage-stripe"
                  onClick={() => manageStripeMutation.mutate()}
                  disabled={manageStripeMutation.isPending}
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  {manageStripeMutation.isPending ? "Loading..." : "Manage in Stripe"}
                </Button>
                {subscription.status === "active" && !subscription.cancelAtPeriodEnd && (
                  <Button 
                    variant="destructive" 
                    onClick={() => setCancellationDialogOpen(true)}
                  >
                    Cancel Subscription
                  </Button>
                )}
              </div>
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
            {currentPlanFeatures.length > 0 && (
              <div className="space-y-2 pt-2">
                <p className="text-xs uppercase font-semibold tracking-wide text-muted-foreground">
                  Plan Features
                </p>
                <div className="space-y-2">
                  {currentPlanFeatures.map((feature, index) => renderFeatureItem(feature, `current-${index}`))}
                </div>
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
                    {plan.targetAudience && (
                      <div className="space-y-1 text-sm">
                        <p className="text-xs uppercase font-semibold tracking-wide text-muted-foreground">
                          Target
                        </p>
                        <p>{plan.targetAudience}</p>
                      </div>
                    )}
                    {plan.useCase && (
                      <div className="space-y-1 text-sm">
                        <p className="text-xs uppercase font-semibold tracking-wide text-muted-foreground">
                          Use Case
                        </p>
                        <p className="text-muted-foreground">{plan.useCase}</p>
                      </div>
                    )}
                    <div className="space-y-2" data-testid={`text-feature-${plan.name.toLowerCase()}-group`}>
                      {getPlanFeatures(plan).map((feature, index) => renderFeatureItem(feature, `${plan.id}-${index}`))}
                    </div>
                  </div>
                  <Button
                    className={`w-full ${
                      isCurrent ? "" : "bg-[#14b8a6] hover:bg-[#0d9488] text-white border-transparent"
                    } ${checkoutMutation.isPending ? "opacity-70" : ""}`}
                    variant="default"
                    disabled={isCurrent || checkoutMutation.isPending}
                    onClick={() => handleSelectPlan(plan.id)}
                    data-testid={`button-select-${plan.name.toLowerCase()}`}
                  >
                    {isCurrent ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Active
                      </>
                    ) : checkoutMutation.isPending ? (
                      "Loading..."
                    ) : (
                      "Select Plan"
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <Card data-testid="card-credits-panel">
        <CardHeader>
          <h3 className="text-lg font-semibold">SMS Credits</h3>
        </CardHeader>
        <CardContent className="space-y-6">
          {credits && (
            <div className="flex items-center justify-between p-6 bg-muted/50 rounded-lg border">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Available Credits</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold" data-testid="text-available-credits">
                    {credits.available.toLocaleString()}
                  </span>
                  <span className="text-lg text-muted-foreground">SMS</span>
                </div>
                {currentPlan && (
                  <p className="text-xs text-muted-foreground mt-1">
                    of {currentPlan.monthlyCredits.toLocaleString()} monthly credits
                  </p>
                )}
              </div>
              <div className="text-right">
                <Zap className="w-12 h-12 text-primary/20" />
              </div>
            </div>
          )}
          
          <div>
            <h4 className="font-semibold mb-2">Need More Credits?</h4>
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
          </div>
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
                        {CURRENCY_SYMBOLS[currency]}{((price / 100) / bundle.credits * 1000).toFixed(2)} per 1,000 messages
                      </div>
                      <Button 
                        className="w-full"
                        onClick={() => bundleCheckoutMutation.mutate({ bundleId: bundle.id, currency })}
                        disabled={bundleCheckoutMutation.isPending}
                        data-testid={`button-purchase-bundle-${bundle.id}`}
                      >
                        {bundleCheckoutMutation.isPending ? "Loading..." : "Purchase Bundle"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <CancellationReasonDialog
        open={cancellationDialogOpen}
        onOpenChange={setCancellationDialogOpen}
        onConfirm={handleCancellationComplete}
      />
    </div>
  );
}
