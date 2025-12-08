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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Calendar, CreditCard, Key, Settings } from "lucide-react";
import { PricingManagement } from "@/components/pricing-management";

type UserWithDetails = {
  id: string;
  username: string;
  email: string | null;
  isAdmin: boolean;
  currency: string;
  credits: number;
  smsVolume: number;
  subscription: {
    planId: string | null;
    planName: string;
    status: string;
    currency: string;
    currentPeriodEnd: string | null;
    trialEndsAt: string | null;
  };
};

type SubscriptionPlan = {
  id: string;
  name: string;
  description: string | null;
  monthlyCredits: number;
  priceMonthly: number;
};

export default function AdminPage() {
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<UserWithDetails | null>(null);
  const [dialogType, setDialogType] = useState<"subscription" | "credits" | "password" | null>(null);

  // Form state
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const { data: users = [], isLoading: usersLoading } = useQuery<UserWithDetails[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: plans = [] } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/subscription-plans"],
  });

  const updateSubscriptionMutation = useMutation({
    mutationFn: async ({ userId, planId }: { userId: string; planId: string }) => {
      return await apiRequest("POST", `/api/admin/users/${userId}/subscription`, { planId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Subscription updated successfully" });
      closeDialog();
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to update subscription", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const grantCreditsMutation = useMutation({
    mutationFn: async ({ userId, amount, reason }: { userId: string; amount: number; reason: string }) => {
      return await apiRequest("POST", `/api/admin/users/${userId}/credits`, { amount, reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "Credits granted successfully" });
      closeDialog();
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to grant credits", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: string; newPassword: string }) => {
      return await apiRequest("POST", `/api/admin/users/${userId}/reset-password`, { newPassword });
    },
    onSuccess: () => {
      toast({ title: "Password reset successfully" });
      closeDialog();
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to reset password", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const closeDialog = () => {
    setDialogType(null);
    setSelectedUser(null);
    setSelectedPlanId("");
    setCreditAmount("");
    setCreditReason("");
    setNewPassword("");
  };

  const handleUpdateSubscription = () => {
    if (!selectedUser || !selectedPlanId) return;
    updateSubscriptionMutation.mutate({ userId: selectedUser.id, planId: selectedPlanId });
  };

  const handleGrantCredits = () => {
    if (!selectedUser || !creditAmount || parseInt(creditAmount) <= 0) return;
    grantCreditsMutation.mutate({ 
      userId: selectedUser.id, 
      amount: parseInt(creditAmount),
      reason: creditReason || "Admin grant"
    });
  };

  const handleResetPassword = () => {
    if (!selectedUser || !newPassword || newPassword.length < 6) return;
    resetPasswordMutation.mutate({ userId: selectedUser.id, newPassword });
  };

  if (usersLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p data-testid="text-loading">Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Admin Panel</h1>
        <p className="text-muted-foreground">Manage users, subscriptions, pricing, and credits</p>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList>
          <TabsTrigger value="users" data-testid="tab-users">User Management</TabsTrigger>
          <TabsTrigger value="pricing" data-testid="tab-pricing">Pricing Management</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <div className="flex items-center justify-end mb-4">
            <Badge variant="default" data-testid="badge-user-count">
              {users.length} {users.length === 1 ? "User" : "Users"}
            </Badge>
          </div>

          <div className="grid gap-4">
            {users.map((user) => (
              <Card key={user.id} data-testid={`card-user-${user.id}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {user.username}
                        {user.isAdmin && (
                          <Badge variant="secondary" data-testid={`badge-admin-${user.id}`}>Admin</Badge>
                        )}
                      </CardTitle>
                      <CardDescription data-testid={`text-email-${user.id}`}>
                        {user.email || "No email"}
                      </CardDescription>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline" data-testid={`badge-currency-${user.id}`}>
                          {user.currency}
                        </Badge>
                        <Badge variant="outline" data-testid={`badge-sms-volume-${user.id}`}>
                          {user.smsVolume} SMS sent
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium" data-testid={`text-credits-${user.id}`}>
                        {user.credits} Credits
                      </p>
                      <Badge 
                        variant={user.subscription.status === "active" ? "default" : "secondary"}
                        data-testid={`badge-status-${user.id}`}
                      >
                        {user.subscription.planName}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedUser(user);
                        setDialogType("subscription");
                      }}
                      data-testid={`button-manage-subscription-${user.id}`}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Manage Subscription
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedUser(user);
                        setDialogType("credits");
                      }}
                      data-testid={`button-grant-credits-${user.id}`}
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      Grant Credits
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedUser(user);
                        setDialogType("password");
                      }}
                      data-testid={`button-reset-password-${user.id}`}
                    >
                      <Key className="h-4 w-4 mr-2" />
                      Reset Password
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="pricing">
          <PricingManagement />
        </TabsContent>
      </Tabs>

      {/* Subscription Dialog */}
      <Dialog open={dialogType === "subscription"} onOpenChange={closeDialog}>
        <DialogContent data-testid="dialog-manage-subscription">
          <DialogHeader>
            <DialogTitle>Manage Subscription</DialogTitle>
            <DialogDescription>
              Update subscription plan for {selectedUser?.username}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="plan">Subscription Plan</Label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger data-testid="select-plan">
                  <SelectValue placeholder="Select a plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id} data-testid={`option-plan-${plan.id}`}>
                      {plan.name} - ${plan.priceMonthly}/mo ({plan.monthlyCredits} credits)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} data-testid="button-cancel">
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateSubscription} 
              disabled={!selectedPlanId || updateSubscriptionMutation.isPending}
              data-testid="button-update-subscription"
            >
              {updateSubscriptionMutation.isPending ? "Updating..." : "Update Subscription"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credits Dialog */}
      <Dialog open={dialogType === "credits"} onOpenChange={closeDialog}>
        <DialogContent data-testid="dialog-grant-credits">
          <DialogHeader>
            <DialogTitle>Grant Credits</DialogTitle>
            <DialogDescription>
              Add credits to {selectedUser?.username}'s account
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="amount">Credit Amount</Label>
              <Input
                id="amount"
                type="number"
                min="1"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                placeholder="Enter number of credits"
                data-testid="input-credit-amount"
              />
            </div>
            <div>
              <Label htmlFor="reason">Reason (Optional)</Label>
              <Input
                id="reason"
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
                placeholder="e.g., Bonus credits, Promotion"
                data-testid="input-credit-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} data-testid="button-cancel">
              Cancel
            </Button>
            <Button 
              onClick={handleGrantCredits} 
              disabled={!creditAmount || parseInt(creditAmount) <= 0 || grantCreditsMutation.isPending}
              data-testid="button-grant"
            >
              {grantCreditsMutation.isPending ? "Granting..." : "Grant Credits"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Reset Dialog */}
      <Dialog open={dialogType === "password"} onOpenChange={closeDialog}>
        <DialogContent data-testid="dialog-reset-password">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {selectedUser?.username}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 6 characters)"
                data-testid="input-new-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} data-testid="button-cancel">
              Cancel
            </Button>
            <Button 
              onClick={handleResetPassword} 
              disabled={!newPassword || newPassword.length < 6 || resetPasswordMutation.isPending}
              data-testid="button-reset"
            >
              {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
