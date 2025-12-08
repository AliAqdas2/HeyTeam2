import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Redirect } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, CreditCard, MessageSquare, TrendingUp, Shield, Plus, Ban, CheckCircle, Trash2, Copy, Edit } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AdminUserData {
  id: string;
  username: string;
  email: string;
  isAdmin: boolean;
  isActive: boolean;
  currency: string;
  credits: number;
  smsVolume: number;
  referralCode: string | null;
  createdAt: string | null;
  subscription: {
    planId: string | null;
    planName: string;
    status: string;
    currency: string;
    currentPeriodEnd: string | null;
    trialEndsAt: string | null;
    monthlyPayment: number;
  };
}

interface PlatformAdminUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

interface Reseller {
  id: string;
  name: string;
  email: string;
  referralCode: string;
  commissionRate: number;
  status: string;
  referredUsersCount: number;
  totalRevenue: number;
  totalCommission: number;
  transactionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ResellerReport {
  reseller: {
    id: string;
    name: string;
    email: string;
    commissionRate: number;
  };
  period: {
    month: number;
    year: number;
  };
  revenue: {
    new: number;
    recurring: number;
    bundles: number;
    total: number;
  };
  commission: {
    amount: number;
    rate: number;
  };
  transactions: Array<{
    id: string;
    type: string;
    amount: number;
    currency: string;
    commissionAmount: number;
    occurredAt: Date;
  }>;
  payout: {
    status: string;
  } | null;
}

interface Feedback {
  id: string;
  userId: string;
  message: string;
  status: string;
  createdAt: string;
  user: {
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
}

interface PlatformSettingsData {
  id: string;
  feedbackEmail: string;
  supportEmail: string;
  updatedAt: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
};

// Helper to convert integer minor-units (e.g. pence/cents) to display string
const formatMoney = (amountMinor: number, currency: string = "GBP") => {
  const symbol = CURRENCY_SYMBOLS[currency] ?? "";
  const major = amountMinor / 100;
  return `${symbol}${major.toFixed(2)}`;
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
  trial: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  canceled: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
  past_due: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
};

export default function AdminDashboard() {
  const { toast } = useToast();
  const [isAddAdminDialogOpen, setIsAddAdminDialogOpen] = useState(false);
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [showDisabledInstances, setShowDisabledInstances] = useState(false);
  
  const [isAddResellerDialogOpen, setIsAddResellerDialogOpen] = useState(false);
  const [isEditResellerDialogOpen, setIsEditResellerDialogOpen] = useState(false);
  const [editingReseller, setEditingReseller] = useState<Reseller | null>(null);
  const [newResellerName, setNewResellerName] = useState("");
  const [newResellerEmail, setNewResellerEmail] = useState("");
  const [newResellerCommissionRate, setNewResellerCommissionRate] = useState(20);
  
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [selectedReseller, setSelectedReseller] = useState<Reseller | null>(null);
  const [reportMonth, setReportMonth] = useState(new Date().getMonth() + 1);
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [feedbackEmail, setFeedbackEmail] = useState("feedback@heyteam.ai");
  const [supportEmail, setSupportEmail] = useState("support@heyteam.ai");

  const { data: adminMe, isLoading: isLoadingAdminMe } = useQuery<{ admin: { id: string; name: string | null; email: string } }>({
    queryKey: ["/api/admin/auth/me"],
  });

  const isAdminReady = !!adminMe?.admin;

  const { data: users, isLoading } = useQuery<AdminUserData[]>({
    queryKey: ["/api/admin/users"],
    enabled: isAdminReady,
  });

  const { data: platformAdmins, isLoading: isLoadingAdmins } = useQuery<PlatformAdminUser[]>({
    queryKey: ["/api/admin/admin-users"],
    enabled: isAdminReady,
  });

  const { data: resellers, isLoading: isLoadingResellers } = useQuery<Reseller[]>({
    queryKey: ["/api/admin/resellers"],
    enabled: isAdminReady,
  });

  const { data: resellerReport, isLoading: isLoadingReport } = useQuery<ResellerReport>({
    // Use a logical key and build the URL with query params inside the queryFn
    queryKey: ["admin-reseller-report", selectedReseller?.id, reportMonth, reportYear],
    enabled: isAdminReady && !!selectedReseller && isReportDialogOpen,
    queryFn: async ({ queryKey }) => {
      const [, resellerId, month, year] = queryKey as [string, string, number, number];
      const res = await apiRequest(
        "GET",
        `/api/admin/resellers/${resellerId}/report?month=${month}&year=${year}`,
      );
      return res.json();
    },
  });

  const { data: feedback, isLoading: isLoadingFeedback } = useQuery<Feedback[]>({
    queryKey: ["/api/admin/feedback"],
    enabled: isAdminReady,
  });

  const { data: platformSettings, isLoading: isLoadingSettings } = useQuery<PlatformSettingsData>({
    queryKey: ["/api/admin/settings"],
    enabled: isAdminReady,
  });

  useEffect(() => {
    if (platformSettings) {
      setFeedbackEmail(platformSettings.feedbackEmail);
      setSupportEmail(platformSettings.supportEmail);
    }
  }, [platformSettings]);

  const disableUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest("POST", `/api/admin/users/${userId}/disable`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User disabled successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to disable user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const enableUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest("POST", `/api/admin/users/${userId}/enable`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User enabled successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to enable user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createAdminUserMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/admin/admin-users", {
        name: newAdminName,
        email: newAdminEmail,
        password: newAdminPassword,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/admin-users"] });
      setIsAddAdminDialogOpen(false);
      setNewAdminName("");
      setNewAdminEmail("");
      setNewAdminPassword("");
      toast({ title: "Admin user created successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create admin user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteAdminUserMutation = useMutation({
    mutationFn: async (adminId: string) => {
      return await apiRequest("DELETE", `/api/admin/admin-users/${adminId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/admin-users"] });
      toast({ title: "Admin user deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete admin user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createResellerMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/admin/resellers", {
        name: newResellerName,
        email: newResellerEmail,
        commissionRate: newResellerCommissionRate,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/resellers"] });
      setIsAddResellerDialogOpen(false);
      setNewResellerName("");
      setNewResellerEmail("");
      setNewResellerCommissionRate(20);
      toast({ title: "Reseller created successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create reseller",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateResellerMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiRequest("PATCH", `/api/admin/resellers/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/resellers"] });
      setIsEditResellerDialogOpen(false);
      setEditingReseller(null);
      toast({ title: "Reseller updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update reseller",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteResellerMutation = useMutation({
    mutationFn: async (resellerId: string) => {
      return await apiRequest("DELETE", `/api/admin/resellers/${resellerId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/resellers"] });
      toast({ title: "Reseller deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete reseller",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateFeedbackStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return await apiRequest("PATCH", `/api/admin/feedback/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/feedback"] });
      toast({ title: "Feedback status updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update feedback status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updatePlatformSettingsMutation = useMutation<PlatformSettingsData, any, { feedbackEmail: string; supportEmail: string }>({
    mutationFn: async (payload) => {
      const res = await apiRequest("PATCH", "/api/admin/settings", payload);
      return res.json();
    },
    onSuccess: (data) => {
      setFeedbackEmail(data.feedbackEmail);
      setSupportEmail(data.supportEmail);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: "Platform settings updated" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update settings",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Filter users based on toggle state - MUST be before conditional returns
  const filteredUsers = useMemo(() => {
    if (showDisabledInstances) {
      return users;
    }
    return users?.filter(u => u.isActive === true);
  }, [users, showDisabledInstances]);

  const isSettingsDirty = platformSettings
    ? feedbackEmail !== platformSettings.feedbackEmail || supportEmail !== platformSettings.supportEmail
    : false;

  const settingsLastUpdated = platformSettings?.updatedAt
    ? formatDistanceToNow(new Date(platformSettings.updatedAt), { addSuffix: true })
    : null;

  const copyToClipboard = (text: string, message: string) => {
    try {
      // Prefer modern async clipboard API when available
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === "function"
      ) {
        navigator.clipboard
          .writeText(text)
          .then(() => {
            toast({ title: message });
          })
          .catch(() => {
            toast({
              title: "Failed to copy to clipboard",
              variant: "destructive",
            });
          });
        return;
      }

      // Fallback for browsers/environments without navigator.clipboard
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();

      let copied = false;
      try {
        copied = document.execCommand("copy");
      } catch {
        copied = false;
      }

      document.body.removeChild(textarea);

      if (copied) {
        toast({ title: message });
      } else {
        toast({
          title: "Failed to copy to clipboard",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  // Redirect non-admin users
  if (adminMe && !adminMe.admin) {
    return <Redirect to="/" />;
  }

  if (isLoadingAdminMe || isLoading || isLoadingAdmins || isLoadingResellers || isLoadingFeedback || isLoadingSettings) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading" />
      </div>
    );
  }

  // Calculate summary statistics
  const totalUsers = users?.length || 0;
  const activeUsers = users?.filter(u => u.isActive).length || 0;
  const disabledUsers = users?.filter(u => !u.isActive).length || 0;
  const activeSubscriptions = users?.filter(u => u.subscription.status === "active" && u.isActive).length || 0;
  const totalRevenue = users?.reduce((sum, u) => {
    if (u.subscription.status === "active" && u.isActive) {
      return sum + u.subscription.monthlyPayment;
    }
    return sum;
  }, 0) || 0;
  const totalCredits = users?.reduce((sum, u) => sum + u.credits, 0) || 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-foreground" data-testid="text-page-title">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">Monitor instances, subscriptions, and platform administrators</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-total-users">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Instances</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold" data-testid="text-total-users">{totalUsers}</div>
            <p className="text-xs text-muted-foreground mt-1">{activeUsers} active</p>
          </CardContent>
        </Card>

        <Card data-testid="card-active-subscriptions">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Subscriptions</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold" data-testid="text-active-subscriptions">{activeSubscriptions}</div>
          </CardContent>
        </Card>

          <Card data-testid="card-monthly-revenue">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold" data-testid="text-monthly-revenue">
              £{totalRevenue.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Mixed currencies</p>
          </CardContent>
        </Card>

        <Card data-testid="card-total-credits">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total SMS Credits</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold" data-testid="text-total-credits">{totalCredits.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for User Instances and Admin Users */}
      <Tabs defaultValue="instances" className="w-full">
        <TabsList>
          <TabsTrigger value="instances" data-testid="tab-instances">User Instances</TabsTrigger>
          <TabsTrigger value="admins" data-testid="tab-admins">Platform Admins</TabsTrigger>
          <TabsTrigger value="resellers" data-testid="tab-resellers">Resellers</TabsTrigger>
          <TabsTrigger value="feedback" data-testid="tab-feedback">Feedback</TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">Platform Settings</TabsTrigger>
        </TabsList>

        {/* User Instances Tab */}
        <TabsContent value="instances" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>User Instances</CardTitle>
                  <p className="text-sm text-muted-foreground">Manage customer accounts and subscriptions</p>
                </div>
                <Button
                  variant={showDisabledInstances ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowDisabledInstances(!showDisabledInstances)}
                  className="gap-2 self-start sm:self-auto"
                  data-testid="button-toggle-disabled"
                >
                  <Ban className="h-4 w-4" />
                  {showDisabledInstances ? `Hide Disabled (${disabledUsers})` : `Show Disabled (${disabledUsers})`}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="table-users">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Company</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Email</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Plan</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">SMS Credits</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Monthly Payment</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Registered</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers?.map((user) => (
                      <tr key={`${user.id}-${showDisabledInstances ? 'all' : 'active'}`} className="border-b hover-elevate" data-testid={`row-user-${user.id}`}>
                        <td className="p-3">
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground" data-testid={`text-username-${user.id}`}>
                              {user.username}
                            </span>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="text-sm text-muted-foreground" data-testid={`text-email-${user.id}`}>
                            {user.email}
                          </span>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" data-testid={`badge-plan-${user.id}`}>
                            {user.subscription.planName}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col gap-1">
                            <Badge 
                              className={STATUS_COLORS[user.subscription.status] || STATUS_COLORS.trial}
                              data-testid={`badge-status-${user.id}`}
                            >
                              {user.subscription.status}
                            </Badge>
                            {!user.isActive && (
                              <Badge variant="destructive" className="w-fit" data-testid={`badge-disabled-${user.id}`}>
                                Disabled
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="text-sm text-foreground" data-testid={`text-credits-${user.id}`}>
                            {user.credits.toLocaleString()}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="text-sm font-medium text-foreground" data-testid={`text-payment-${user.id}`}>
                            {user.subscription.monthlyPayment > 0 
                              ? `${CURRENCY_SYMBOLS[user.subscription.currency]}${user.subscription.monthlyPayment.toFixed(2)}`
                              : "—"
                            }
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="text-sm text-muted-foreground" data-testid={`text-registered-${user.id}`}>
                            {user.createdAt ? format(new Date(user.createdAt), "MMM d, yyyy") : "—"}
                          </span>
                        </td>
                        <td className="p-3">
                          {user.isActive ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => disableUserMutation.mutate(user.id)}
                              disabled={disableUserMutation.isPending}
                              data-testid={`button-disable-${user.id}`}
                            >
                              <Ban className="h-3 w-3 mr-1" />
                              Disable
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => enableUserMutation.mutate(user.id)}
                              disabled={enableUserMutation.isPending}
                              data-testid={`button-enable-${user.id}`}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Enable
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {(!filteredUsers || filteredUsers.length === 0) && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">
                    {showDisabledInstances ? "No users found" : "No active users found"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Platform Admins Tab */}
        <TabsContent value="admins" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>Platform Administrators</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Manage users with admin access to this dashboard</p>
              </div>
              <Dialog open={isAddAdminDialogOpen} onOpenChange={setIsAddAdminDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-admin">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Admin
                  </Button>
                </DialogTrigger>
                <DialogContent data-testid="dialog-add-admin">
                  <DialogHeader>
                    <DialogTitle>Add Platform Administrator</DialogTitle>
                    <DialogDescription>
                      Create a new admin user with access to this dashboard
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label htmlFor="admin-name">Name</Label>
                      <Input
                        id="admin-name"
                        value={newAdminName}
                        onChange={(e) => setNewAdminName(e.target.value)}
                        placeholder="John Doe"
                        data-testid="input-admin-name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="admin-email">Email</Label>
                      <Input
                        id="admin-email"
                        type="email"
                        value={newAdminEmail}
                        onChange={(e) => setNewAdminEmail(e.target.value)}
                        placeholder="admin@example.com"
                        data-testid="input-admin-email"
                      />
                    </div>
                    <div>
                      <Label htmlFor="admin-password">Password</Label>
                      <Input
                        id="admin-password"
                        type="password"
                        value={newAdminPassword}
                        onChange={(e) => setNewAdminPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                        data-testid="input-admin-password"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsAddAdminDialogOpen(false)}
                      data-testid="button-cancel-add-admin"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => createAdminUserMutation.mutate()}
                      disabled={createAdminUserMutation.isPending || !newAdminName || !newAdminEmail || !newAdminPassword}
                      data-testid="button-submit-add-admin"
                    >
                      {createAdminUserMutation.isPending ? "Creating..." : "Create Admin"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="table-admin-users">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Name</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Email</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Created</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {platformAdmins?.map((admin) => (
                      <tr key={admin.id} className="border-b hover-elevate" data-testid={`row-admin-${admin.id}`}>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-primary" />
                            <span className="font-medium text-foreground" data-testid={`text-admin-name-${admin.id}`}>
                              {admin.name}
                            </span>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="text-sm text-muted-foreground" data-testid={`text-admin-email-${admin.id}`}>
                            {admin.email}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="text-sm text-muted-foreground" data-testid={`text-admin-created-${admin.id}`}>
                            {format(new Date(admin.createdAt), "MMM d, yyyy")}
                          </span>
                        </td>
                        <td className="p-3">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (confirm("Are you sure you want to delete this admin user?")) {
                                deleteAdminUserMutation.mutate(admin.id);
                              }
                            }}
                            disabled={deleteAdminUserMutation.isPending}
                            data-testid={`button-delete-admin-${admin.id}`}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!platformAdmins || platformAdmins.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No platform admins found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Resellers Tab */}
        <TabsContent value="resellers" className="mt-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>Resellers</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Manage reseller partners and their commission structure</p>
              </div>
              <Dialog open={isAddResellerDialogOpen} onOpenChange={setIsAddResellerDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-reseller">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Reseller
                  </Button>
                </DialogTrigger>
                <DialogContent data-testid="dialog-add-reseller">
                  <DialogHeader>
                    <DialogTitle>Add Reseller</DialogTitle>
                    <DialogDescription>
                      Create a new reseller partner with a unique referral code
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label htmlFor="reseller-name">Name</Label>
                      <Input
                        id="reseller-name"
                        value={newResellerName}
                        onChange={(e) => setNewResellerName(e.target.value)}
                        placeholder="Reseller Company Name"
                        data-testid="input-reseller-name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="reseller-email">Email</Label>
                      <Input
                        id="reseller-email"
                        type="email"
                        value={newResellerEmail}
                        onChange={(e) => setNewResellerEmail(e.target.value)}
                        placeholder="contact@reseller.com"
                        data-testid="input-reseller-email"
                      />
                    </div>
                    <div>
                      <Label htmlFor="reseller-commission">Commission Rate (%)</Label>
                      <Input
                        id="reseller-commission"
                        type="number"
                        min="0"
                        max="100"
                        value={newResellerCommissionRate}
                        onChange={(e) => setNewResellerCommissionRate(Number(e.target.value))}
                        placeholder="20"
                        data-testid="input-reseller-commission"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsAddResellerDialogOpen(false)}
                      data-testid="button-cancel-add-reseller"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => createResellerMutation.mutate()}
                      disabled={createResellerMutation.isPending || !newResellerName || !newResellerEmail}
                      data-testid="button-submit-add-reseller"
                    >
                      {createResellerMutation.isPending ? "Creating..." : "Create Reseller"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="table-resellers">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Name</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Email</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Referral Code</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Commission</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Referred Users</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Total Revenue</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Total Commission</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resellers?.map((reseller) => (
                      <tr key={reseller.id} className="border-b hover-elevate" data-testid={`row-reseller-${reseller.id}`}>
                        <td className="p-3">
                          <span className="font-medium text-foreground" data-testid={`text-reseller-name-${reseller.id}`}>
                            {reseller.name}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="text-sm text-muted-foreground" data-testid={`text-reseller-email-${reseller.id}`}>
                            {reseller.email}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <code className="text-sm bg-muted px-2 py-1 rounded" data-testid={`text-reseller-code-${reseller.id}`}>
                              {reseller.referralCode}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => copyToClipboard(reseller.referralCode, "Referral code copied to clipboard")}
                              data-testid={`button-copy-code-${reseller.id}`}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="text-sm text-foreground" data-testid={`text-reseller-commission-${reseller.id}`}>
                            {reseller.commissionRate}%
                          </span>
                        </td>
                        <td className="p-3">
                          <Badge 
                            className={reseller.status === "active" ? STATUS_COLORS.active : STATUS_COLORS.canceled}
                            data-testid={`badge-reseller-status-${reseller.id}`}
                          >
                            {reseller.status}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <span className="text-sm text-foreground" data-testid={`text-reseller-users-${reseller.id}`}>
                            {reseller.referredUsersCount}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="text-sm font-medium text-foreground" data-testid={`text-reseller-revenue-${reseller.id}`}>
                            {formatMoney(reseller.totalRevenue, "GBP")}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="text-sm font-medium text-foreground" data-testid={`text-reseller-total-commission-${reseller.id}`}>
                            {formatMoney(reseller.totalCommission, "GBP")}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedReseller(reseller);
                                setReportMonth(new Date().getMonth() + 1);
                                setReportYear(new Date().getFullYear());
                                setShowAllTransactions(false);
                                setIsReportDialogOpen(true);
                              }}
                              data-testid={`button-view-report-${reseller.id}`}
                            >
                              <TrendingUp className="h-3 w-3 mr-1" />
                              View Report
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={() => {
                                const registrationUrl = `${window.location.origin}/auth?ref=${reseller.referralCode}`;
                                copyToClipboard(registrationUrl, "Registration URL copied to clipboard");
                              }}
                              data-testid={`button-copy-url-${reseller.id}`}
                            >
                              <Copy className="h-3 w-3" />
                              Copy Link
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingReseller(reseller);
                                setIsEditResellerDialogOpen(true);
                              }}
                              data-testid={`button-edit-reseller-${reseller.id}`}
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (confirm("Are you sure you want to delete this reseller? This action is permanent.")) {
                                  deleteResellerMutation.mutate(reseller.id);
                                }
                              }}
                              disabled={deleteResellerMutation.isPending}
                              data-testid={`button-delete-reseller-${reseller.id}`}
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!resellers || resellers.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No resellers found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Feedback Tab */}
        <TabsContent value="feedback" className="mt-6">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>User Feedback</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">View and manage feedback submitted by users</p>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="table-feedback">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">User</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Message</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Status</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Date</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feedback?.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((item) => {
                      const userName = item.user.firstName && item.user.lastName 
                        ? `${item.user.firstName} ${item.user.lastName}`
                        : item.user.email;
                      const truncatedMessage = item.message.length > 100 
                        ? `${item.message.substring(0, 100)}...` 
                        : item.message;
                      
                      return (
                        <tr key={item.id} className="border-b hover-elevate" data-testid={`row-feedback-${item.id}`}>
                          <td className="p-3">
                            <span className="text-sm text-foreground" data-testid={`text-user-${item.id}`}>
                              {userName}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="text-sm text-muted-foreground" data-testid={`text-message-${item.id}`}>
                              {truncatedMessage}
                            </span>
                          </td>
                          <td className="p-3">
                            <Badge 
                              className={
                                item.status === "new" 
                                  ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20"
                                  : item.status === "reviewed"
                                  ? "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20"
                                  : "bg-green-600"
                              }
                              data-testid={`badge-status-${item.id}`}
                            >
                              {item.status}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <span className="text-sm text-muted-foreground" data-testid={`text-date-${item.id}`}>
                              {format(new Date(item.createdAt), "MMM d, yyyy")}
                            </span>
                          </td>
                          <td className="p-3">
                            <Select
                              value={item.status}
                              onValueChange={(value) => {
                                updateFeedbackStatusMutation.mutate({ id: item.id, status: value });
                              }}
                            >
                              <SelectTrigger className="w-[140px]" data-testid={`select-status-${item.id}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="new">New</SelectItem>
                                <SelectItem value="reviewed">Reviewed</SelectItem>
                                <SelectItem value="implemented">Implemented</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {(!feedback || feedback.length === 0) && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No feedback found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Platform Settings Tab */}
        <TabsContent value="settings" className="mt-6">
          <Card data-testid="card-platform-settings">
            <CardHeader>
              <div>
                <CardTitle>Platform Settings</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Configure the default email addresses used for platform communications.
                </p>
              </div>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-6 max-w-xl"
                onSubmit={(event) => {
                  event.preventDefault();
                  updatePlatformSettingsMutation.mutate({ feedbackEmail, supportEmail });
                }}
              >
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="platform-feedback-email">Feedback Email</Label>
                    <Input
                      id="platform-feedback-email"
                      type="email"
                      value={feedbackEmail}
                      onChange={(event) => setFeedbackEmail(event.target.value)}
                      placeholder="feedback@heyteam.ai"
                      data-testid="input-settings-feedback-email"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Feedback submissions will be sent to this address.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="platform-support-email">Support Email</Label>
                    <Input
                      id="platform-support-email"
                      type="email"
                      value={supportEmail}
                      onChange={(event) => setSupportEmail(event.target.value)}
                      placeholder="support@heyteam.ai"
                      data-testid="input-settings-support-email"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Displayed wherever users are asked to contact support.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="submit"
                    disabled={!isSettingsDirty || updatePlatformSettingsMutation.isPending}
                    data-testid="button-save-platform-settings"
                  >
                    {updatePlatformSettingsMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      if (platformSettings) {
                        setFeedbackEmail(platformSettings.feedbackEmail);
                        setSupportEmail(platformSettings.supportEmail);
                      } else {
                        setFeedbackEmail("feedback@heyteam.ai");
                        setSupportEmail("support@heyteam.ai");
                      }
                    }}
                    disabled={updatePlatformSettingsMutation.isPending || !isSettingsDirty}
                    data-testid="button-reset-platform-settings"
                  >
                    Reset
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Last updated: {settingsLastUpdated ? settingsLastUpdated : "—"}
                  </span>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Reseller Dialog */}
      <Dialog open={isEditResellerDialogOpen} onOpenChange={setIsEditResellerDialogOpen}>
        <DialogContent data-testid="dialog-edit-reseller">
          <DialogHeader>
            <DialogTitle>Edit Reseller</DialogTitle>
            <DialogDescription>
              Update reseller information and commission structure
            </DialogDescription>
          </DialogHeader>
          {editingReseller && (
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="edit-reseller-name">Name</Label>
                <Input
                  id="edit-reseller-name"
                  defaultValue={editingReseller.name}
                  onChange={(e) => setEditingReseller({ ...editingReseller, name: e.target.value })}
                  data-testid="input-edit-reseller-name"
                />
              </div>
              <div>
                <Label htmlFor="edit-reseller-email">Email</Label>
                <Input
                  id="edit-reseller-email"
                  type="email"
                  defaultValue={editingReseller.email}
                  onChange={(e) => setEditingReseller({ ...editingReseller, email: e.target.value })}
                  data-testid="input-edit-reseller-email"
                />
              </div>
              <div>
                <Label htmlFor="edit-reseller-commission">Commission Rate (%)</Label>
                <Input
                  id="edit-reseller-commission"
                  type="number"
                  min="0"
                  max="100"
                  defaultValue={editingReseller.commissionRate}
                  onChange={(e) => setEditingReseller({ ...editingReseller, commissionRate: Number(e.target.value) })}
                  data-testid="input-edit-reseller-commission"
                />
              </div>
              <div>
                <Label htmlFor="edit-reseller-status">Status</Label>
                <select
                  id="edit-reseller-status"
                  className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={editingReseller.status}
                  onChange={(e) => setEditingReseller({ ...editingReseller, status: e.target.value })}
                  data-testid="select-edit-reseller-status"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditResellerDialogOpen(false);
                setEditingReseller(null);
              }}
              data-testid="button-cancel-edit-reseller"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editingReseller) {
                  updateResellerMutation.mutate({
                    id: editingReseller.id,
                    data: {
                      name: editingReseller.name,
                      email: editingReseller.email,
                      commissionRate: editingReseller.commissionRate,
                      status: editingReseller.status,
                    },
                  });
                }
              }}
              disabled={updateResellerMutation.isPending}
              data-testid="button-submit-edit-reseller"
            >
              {updateResellerMutation.isPending ? "Updating..." : "Update Reseller"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revenue Report Dialog */}
      <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" data-testid="dialog-revenue-report">
          <DialogHeader>
            <DialogTitle>Revenue Report - {selectedReseller?.name}</DialogTitle>
            <DialogDescription>
              View detailed revenue and commission breakdown for {selectedReseller?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Month/Year Selector */}
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <Label htmlFor="report-month">Month</Label>
                <Select value={reportMonth.toString()} onValueChange={(value) => setReportMonth(Number(value))}>
                  <SelectTrigger id="report-month" data-testid="select-report-month">
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">January</SelectItem>
                    <SelectItem value="2">February</SelectItem>
                    <SelectItem value="3">March</SelectItem>
                    <SelectItem value="4">April</SelectItem>
                    <SelectItem value="5">May</SelectItem>
                    <SelectItem value="6">June</SelectItem>
                    <SelectItem value="7">July</SelectItem>
                    <SelectItem value="8">August</SelectItem>
                    <SelectItem value="9">September</SelectItem>
                    <SelectItem value="10">October</SelectItem>
                    <SelectItem value="11">November</SelectItem>
                    <SelectItem value="12">December</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex-1">
                <Label htmlFor="report-year">Year</Label>
                <Input
                  id="report-year"
                  type="number"
                  min="2020"
                  max="2099"
                  value={reportYear}
                  onChange={(e) => setReportYear(Number(e.target.value))}
                  data-testid="input-report-year"
                />
              </div>
            </div>

            {isLoadingReport ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading" />
              </div>
            ) : resellerReport ? (
              <>
                {/* Revenue Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card data-testid="card-new-revenue">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">New Subscriptions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-semibold" data-testid="text-new-revenue">
                        {formatMoney(
                          resellerReport.revenue.new,
                          resellerReport.transactions[0]?.currency || "GBP",
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {resellerReport.transactions.filter(t => t.type === "subscription_start").length} transactions
                      </p>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-recurring-revenue">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Recurring Subscriptions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-semibold" data-testid="text-recurring-revenue">
                        {formatMoney(
                          resellerReport.revenue.recurring,
                          resellerReport.transactions[0]?.currency || "GBP",
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {resellerReport.transactions.filter(t => t.type === "subscription_renewal").length} transactions
                      </p>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-bundles-revenue">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Bundle Purchases</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-semibold" data-testid="text-bundles-revenue">
                        {formatMoney(
                          resellerReport.revenue.bundles,
                          resellerReport.transactions[0]?.currency || "GBP",
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {resellerReport.transactions.filter(t => t.type === "bundle_purchase").length} transactions
                      </p>
                    </CardContent>
                  </Card>

                  <Card data-testid="card-total-revenue">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-semibold" data-testid="text-total-revenue">
                        {formatMoney(
                          resellerReport.revenue.total,
                          resellerReport.transactions[0]?.currency || "GBP",
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {resellerReport.transactions.length} total transactions
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Commission Summary */}
                <Card data-testid="card-commission-summary">
                  <CardHeader>
                    <CardTitle>Commission Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Commission Rate</p>
                        <p className="text-2xl font-semibold mt-1" data-testid="text-commission-rate">
                          {resellerReport.commission.rate}%
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Commission</p>
                        <p className="text-2xl font-semibold mt-1" data-testid="text-total-commission">
                          {formatMoney(
                            resellerReport.commission.amount,
                            resellerReport.transactions[0]?.currency || "GBP",
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Payout Status</p>
                        <Badge 
                          className={
                            resellerReport.payout?.status === "paid" 
                              ? STATUS_COLORS.active
                              : resellerReport.payout?.status === "cancelled"
                              ? STATUS_COLORS.canceled
                              : STATUS_COLORS.past_due
                          }
                          data-testid="badge-payout-status"
                        >
                          {resellerReport.payout?.status || "pending"}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Transactions Table */}
                <Card data-testid="card-transactions">
                  <CardHeader className="flex flex-row items-center justify-between gap-2">
                    <CardTitle>Transactions</CardTitle>
                    {resellerReport.transactions.length > 10 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAllTransactions(!showAllTransactions)}
                        data-testid="button-toggle-transactions"
                      >
                        {showAllTransactions ? "Show Less" : `Show All (${resellerReport.transactions.length})`}
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    {resellerReport.transactions.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full" data-testid="table-transactions">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Type</th>
                              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Amount</th>
                              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Commission</th>
                              <th className="text-left p-3 text-sm font-medium text-muted-foreground">Date/Time</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(showAllTransactions 
                              ? resellerReport.transactions 
                              : resellerReport.transactions.slice(0, 10)
                            ).map((transaction) => (
                              <tr key={transaction.id} className="border-b hover-elevate" data-testid={`row-transaction-${transaction.id}`}>
                                <td className="p-3">
                                  <Badge variant="outline" data-testid={`badge-transaction-type-${transaction.id}`}>
                                    {transaction.type.replace(/_/g, " ")}
                                  </Badge>
                                </td>
                                <td className="p-3">
                                  <span className="text-sm font-medium text-foreground" data-testid={`text-transaction-amount-${transaction.id}`}>
                                    {formatMoney(transaction.amount, transaction.currency)}
                                  </span>
                                </td>
                                <td className="p-3">
                                  <span className="text-sm font-medium text-foreground" data-testid={`text-transaction-commission-${transaction.id}`}>
                                    {formatMoney(transaction.commissionAmount, transaction.currency)}
                                  </span>
                                </td>
                                <td className="p-3">
                                  <span className="text-sm text-muted-foreground" data-testid={`text-transaction-date-${transaction.id}`}>
                                    {format(new Date(transaction.occurredAt), "PPp", { locale: undefined })}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">No transactions for this period</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">No data available for the selected period</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsReportDialogOpen(false)}
              data-testid="button-close-report"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
