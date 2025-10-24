import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pencil } from "lucide-react";

type SubscriptionPlan = {
  id: string;
  name: string;
  description: string | null;
  monthlyCredits: number;
  priceGBP: number;
  priceUSD: number;
  priceEUR: number;
  calendarIntegrations: number;
  supportLevel: string;
  customTemplates: boolean;
  autoFollowUp: boolean;
  multiManager: boolean;
  aiFeatures: boolean;
  dedicatedNumber: boolean;
  isActive: boolean;
};

type SmsBundle = {
  id: string;
  name: string;
  description: string | null;
  credits: number;
  priceGBP: number;
  priceUSD: number;
  priceEUR: number;
  planId: string | null;
  isActive: boolean;
};

export function PricingManagement() {
  const { toast } = useToast();
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [editingBundle, setEditingBundle] = useState<SmsBundle | null>(null);
  const [priceGBP, setPriceGBP] = useState("");
  const [priceUSD, setPriceUSD] = useState("");
  const [priceEUR, setPriceEUR] = useState("");

  const { data: plans = [], isLoading: plansLoading } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/admin/subscription-plans"],
  });

  const { data: bundles = [], isLoading: bundlesLoading } = useQuery<SmsBundle[]>({
    queryKey: ["/api/admin/sms-bundles"],
  });

  const updatePlanPricingMutation = useMutation({
    mutationFn: async ({ planId, prices }: { planId: string; prices: { priceGBP: number; priceUSD: number; priceEUR: number } }) => {
      return await apiRequest("PATCH", `/api/admin/subscription-plans/${planId}/pricing`, prices);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscription-plans"] });
      toast({ title: "Plan pricing updated successfully" });
      closeDialog();
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update plan pricing", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const updateBundlePricingMutation = useMutation({
    mutationFn: async ({ bundleId, prices }: { bundleId: string; prices: { priceGBP: number; priceUSD: number; priceEUR: number } }) => {
      return await apiRequest("PATCH", `/api/admin/sms-bundles/${bundleId}/pricing`, prices);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sms-bundles"] });
      toast({ title: "Bundle pricing updated successfully" });
      closeDialog();
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update bundle pricing", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const openPlanDialog = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setPriceGBP((plan.priceGBP / 100).toFixed(2));
    setPriceUSD((plan.priceUSD / 100).toFixed(2));
    setPriceEUR((plan.priceEUR / 100).toFixed(2));
  };

  const openBundleDialog = (bundle: SmsBundle) => {
    setEditingBundle(bundle);
    setPriceGBP((bundle.priceGBP / 100).toFixed(2));
    setPriceUSD((bundle.priceUSD / 100).toFixed(2));
    setPriceEUR((bundle.priceEUR / 100).toFixed(2));
  };

  const closeDialog = () => {
    setEditingPlan(null);
    setEditingBundle(null);
    setPriceGBP("");
    setPriceUSD("");
    setPriceEUR("");
  };

  const handleUpdatePlanPricing = () => {
    if (!editingPlan) return;
    
    const gbp = Math.round(parseFloat(priceGBP) * 100);
    const usd = Math.round(parseFloat(priceUSD) * 100);
    const eur = Math.round(parseFloat(priceEUR) * 100);

    if (isNaN(gbp) || isNaN(usd) || isNaN(eur) || gbp <= 0 || usd <= 0 || eur <= 0) {
      toast({ 
        title: "Invalid prices", 
        description: "Please enter valid positive prices for all currencies",
        variant: "destructive" 
      });
      return;
    }

    updatePlanPricingMutation.mutate({ 
      planId: editingPlan.id, 
      prices: { priceGBP: gbp, priceUSD: usd, priceEUR: eur }
    });
  };

  const handleUpdateBundlePricing = () => {
    if (!editingBundle) return;
    
    const gbp = Math.round(parseFloat(priceGBP) * 100);
    const usd = Math.round(parseFloat(priceUSD) * 100);
    const eur = Math.round(parseFloat(priceEUR) * 100);

    if (isNaN(gbp) || isNaN(usd) || isNaN(eur) || gbp <= 0 || usd <= 0 || eur <= 0) {
      toast({ 
        title: "Invalid prices", 
        description: "Please enter valid positive prices for all currencies",
        variant: "destructive" 
      });
      return;
    }

    updateBundlePricingMutation.mutate({ 
      bundleId: editingBundle.id, 
      prices: { priceGBP: gbp, priceUSD: usd, priceEUR: eur }
    });
  };

  const formatPrice = (amount: number, currency: string) => {
    const symbol = currency === "GBP" ? "£" : currency === "USD" ? "$" : "€";
    return `${symbol}${(amount / 100).toFixed(2)}`;
  };

  if (plansLoading || bundlesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p data-testid="text-loading">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" data-testid="text-pricing-title">Pricing Management</h2>
        <p className="text-muted-foreground">Manage subscription plan and SMS bundle pricing across all currencies</p>
      </div>

      <Tabs defaultValue="plans" className="w-full">
        <TabsList>
          <TabsTrigger value="plans" data-testid="tab-plans">Subscription Plans</TabsTrigger>
          <TabsTrigger value="bundles" data-testid="tab-bundles">SMS Bundles</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="space-y-4">
          {plans.map((plan) => (
            <Card key={plan.id} data-testid={`card-plan-${plan.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                    <div className="mt-2 flex gap-2">
                      <Badge variant="outline" data-testid={`badge-credits-${plan.id}`}>
                        {plan.monthlyCredits} messages/month
                      </Badge>
                      {!plan.isActive && (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openPlanDialog(plan)}
                    data-testid={`button-edit-plan-${plan.id}`}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit Pricing
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">GBP</Label>
                    <p className="text-2xl font-bold" data-testid={`price-gbp-${plan.id}`}>
                      {formatPrice(plan.priceGBP, "GBP")}/mo
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">USD</Label>
                    <p className="text-2xl font-bold" data-testid={`price-usd-${plan.id}`}>
                      {formatPrice(plan.priceUSD, "USD")}/mo
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">EUR</Label>
                    <p className="text-2xl font-bold" data-testid={`price-eur-${plan.id}`}>
                      {formatPrice(plan.priceEUR, "EUR")}/mo
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="bundles" className="space-y-4">
          {bundles.map((bundle) => (
            <Card key={bundle.id} data-testid={`card-bundle-${bundle.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{bundle.name}</CardTitle>
                    <CardDescription>{bundle.description}</CardDescription>
                    <div className="mt-2 flex gap-2">
                      <Badge variant="outline" data-testid={`badge-credits-${bundle.id}`}>
                        {bundle.credits} messages
                      </Badge>
                      {!bundle.isActive && (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openBundleDialog(bundle)}
                    data-testid={`button-edit-bundle-${bundle.id}`}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit Pricing
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">GBP</Label>
                    <p className="text-2xl font-bold" data-testid={`price-gbp-${bundle.id}`}>
                      {formatPrice(bundle.priceGBP, "GBP")}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">USD</Label>
                    <p className="text-2xl font-bold" data-testid={`price-usd-${bundle.id}`}>
                      {formatPrice(bundle.priceUSD, "USD")}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">EUR</Label>
                    <p className="text-2xl font-bold" data-testid={`price-eur-${bundle.id}`}>
                      {formatPrice(bundle.priceEUR, "EUR")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Edit Plan Pricing Dialog */}
      <Dialog open={!!editingPlan} onOpenChange={closeDialog}>
        <DialogContent data-testid="dialog-edit-plan-pricing">
          <DialogHeader>
            <DialogTitle>Edit Plan Pricing</DialogTitle>
            <DialogDescription>
              Update pricing for {editingPlan?.name} across all currencies
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="gbp">Price (GBP) - £</Label>
              <Input
                id="gbp"
                type="number"
                step="0.01"
                min="0"
                value={priceGBP}
                onChange={(e) => setPriceGBP(e.target.value)}
                placeholder="29.00"
                data-testid="input-price-gbp"
              />
            </div>
            <div>
              <Label htmlFor="usd">Price (USD) - $</Label>
              <Input
                id="usd"
                type="number"
                step="0.01"
                min="0"
                value={priceUSD}
                onChange={(e) => setPriceUSD(e.target.value)}
                placeholder="37.00"
                data-testid="input-price-usd"
              />
            </div>
            <div>
              <Label htmlFor="eur">Price (EUR) - €</Label>
              <Input
                id="eur"
                type="number"
                step="0.01"
                min="0"
                value={priceEUR}
                onChange={(e) => setPriceEUR(e.target.value)}
                placeholder="34.00"
                data-testid="input-price-eur"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} data-testid="button-cancel">
              Cancel
            </Button>
            <Button 
              onClick={handleUpdatePlanPricing} 
              disabled={updatePlanPricingMutation.isPending}
              data-testid="button-save-plan"
            >
              {updatePlanPricingMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Bundle Pricing Dialog */}
      <Dialog open={!!editingBundle} onOpenChange={closeDialog}>
        <DialogContent data-testid="dialog-edit-bundle-pricing">
          <DialogHeader>
            <DialogTitle>Edit Bundle Pricing</DialogTitle>
            <DialogDescription>
              Update pricing for {editingBundle?.name} across all currencies
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="bundle-gbp">Price (GBP) - £</Label>
              <Input
                id="bundle-gbp"
                type="number"
                step="0.01"
                min="0"
                value={priceGBP}
                onChange={(e) => setPriceGBP(e.target.value)}
                placeholder="15.00"
                data-testid="input-bundle-price-gbp"
              />
            </div>
            <div>
              <Label htmlFor="bundle-usd">Price (USD) - $</Label>
              <Input
                id="bundle-usd"
                type="number"
                step="0.01"
                min="0"
                value={priceUSD}
                onChange={(e) => setPriceUSD(e.target.value)}
                placeholder="19.00"
                data-testid="input-bundle-price-usd"
              />
            </div>
            <div>
              <Label htmlFor="bundle-eur">Price (EUR) - €</Label>
              <Input
                id="bundle-eur"
                type="number"
                step="0.01"
                min="0"
                value={priceEUR}
                onChange={(e) => setPriceEUR(e.target.value)}
                placeholder="17.00"
                data-testid="input-bundle-price-eur"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} data-testid="button-cancel">
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateBundlePricing} 
              disabled={updateBundlePricingMutation.isPending}
              data-testid="button-save-bundle"
            >
              {updateBundlePricingMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
