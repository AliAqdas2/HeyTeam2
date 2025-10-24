import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Redirect } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, CreditCard, MessageSquare, TrendingUp, Shield, Plus, Ban, CheckCircle, Trash2 } from "lucide-react";
import { format } from "date-fns";
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

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
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

  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/me"],
  });

  const { data: users, isLoading } = useQuery<AdminUserData[]>({
    queryKey: ["/api/admin/users"],
    enabled: !!currentUser?.isAdmin,
  });

  const { data: platformAdmins, isLoading: isLoadingAdmins } = useQuery<PlatformAdminUser[]>({
    queryKey: ["/api/admin/admin-users"],
    enabled: !!currentUser?.isAdmin,
  });

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

  // Redirect non-admin users
  if (currentUser && !currentUser.isAdmin) {
    return <Redirect to="/" />;
  }

  if (isLoading || isLoadingAdmins) {
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

  // Filter users based on toggle state
  const filteredUsers = useMemo(() => {
    if (showDisabledInstances) {
      return users;
    }
    return users?.filter(u => u.isActive === true);
  }, [users, showDisabledInstances]);

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
      </Tabs>
    </div>
  );
}
