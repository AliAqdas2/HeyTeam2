import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Users, Building2 } from "lucide-react";

type Currency = "GBP" | "USD" | "EUR";

interface SubscriptionPlan {
  id: string;
  name: string;
  priceGbp: number;
  priceUsd: number;
  priceEur: number;
  messagesPerMonth: number;
  calendarIntegrations: number;
  supportLevel: string;
  customTemplates: boolean;
  autoFollowUp: boolean;
  multiManager: boolean;
  aiFeatures: boolean;
  dedicatedNumber: boolean;
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

const PLAN_COLORS = {
  Starter: "bg-primary/10 text-primary border-primary/20",
  Team: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  Business: "bg-purple-500/10 text-purple-600 border-purple-500/20",
} as const;

export default function PricingPage() {
  const [currency, setCurrency] = useState<Currency>("GBP");

  const { data: user } = useQuery({
    queryKey: ["/api/auth/me"],
  });

  const { data: plans = [], isLoading } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/subscription-plans"],
  });

  const getPrice = (plan: SubscriptionPlan) => {
    switch (currency) {
      case "USD":
        return plan.priceUsd;
      case "EUR":
        return plan.priceEur;
      default:
        return plan.priceGbp;
    }
  };

  const getPlanFeatures = (plan: SubscriptionPlan) => {
    const features = [
      `${plan.messagesPerMonth.toLocaleString()} messages per month`,
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading pricing...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-semibold text-foreground mb-4" data-testid="text-pricing-title">
            Choose the right plan for your team
          </h1>
          <p className="text-lg text-muted-foreground mb-8" data-testid="text-pricing-subtitle">
            Streamline workforce coordination with SMS/Email messaging, availability tracking, and calendar sync
          </p>

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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan) => {
            const Icon = PLAN_ICONS[plan.name as keyof typeof PLAN_ICONS] || Zap;
            const isPopular = plan.name === "Team";

            return (
              <Card
                key={plan.id}
                className={`relative p-6 flex flex-col ${isPopular ? "border-primary shadow-lg" : ""}`}
                data-testid={`card-plan-${plan.name.toLowerCase()}`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground" data-testid="badge-popular">
                      Most Popular
                    </Badge>
                  </div>
                )}

                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2 rounded-lg ${PLAN_COLORS[plan.name as keyof typeof PLAN_COLORS] || PLAN_COLORS.Starter}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <h2 className="text-2xl font-semibold text-foreground" data-testid={`text-plan-name-${plan.name.toLowerCase()}`}>
                      {plan.name}
                    </h2>
                  </div>

                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-4xl font-semibold text-foreground" data-testid={`text-price-${plan.name.toLowerCase()}`}>
                      {CURRENCY_SYMBOLS[currency]}{getPrice(plan)}
                    </span>
                    <span className="text-muted-foreground">/month</span>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    Perfect for {plan.name === "Starter" ? "small teams getting started" : plan.name === "Team" ? "growing teams" : "large organizations"}
                  </p>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {getPlanFeatures(plan).map((feature, index) => (
                    <li key={index} className="flex items-start gap-2" data-testid={`text-feature-${plan.name.toLowerCase()}-${index}`}>
                      <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                {user ? (
                  <Link href="/billing">
                    <Button
                      variant={isPopular ? "default" : "outline"}
                      className="w-full"
                      data-testid={`button-select-${plan.name.toLowerCase()}`}
                    >
                      Select {plan.name}
                    </Button>
                  </Link>
                ) : (
                  <Link href="/auth">
                    <Button
                      variant={isPopular ? "default" : "outline"}
                      className="w-full"
                      data-testid={`button-get-started-${plan.name.toLowerCase()}`}
                    >
                      Get Started
                    </Button>
                  </Link>
                )}
              </Card>
            );
          })}
        </div>

        <div className="mt-16 text-center">
          <h3 className="text-xl font-semibold text-foreground mb-4">Need more messages?</h3>
          <p className="text-muted-foreground mb-6">
            Add SMS bundles to your subscription for additional messaging credits at discounted rates
          </p>
          {user ? (
            <Link href="/billing">
              <Button variant="outline" data-testid="button-view-bundles">
                View SMS Bundles
              </Button>
            </Link>
          ) : (
            <Link href="/auth">
              <Button variant="outline" data-testid="button-signup-bundles">
                Sign Up to View Bundles
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
