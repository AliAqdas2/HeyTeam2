import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { LogOut, User, Mail, Phone, MapPin } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { getContactQueryFn, contactApiRequest, removeContactId } from "@/lib/contactApiClient";
import { removeUserId } from "@/lib/userIdStorage";
import { removeDeviceToken } from "@/lib/push-notifications";
import { useToast } from "@/hooks/use-toast";
import { Capacitor } from "@capacitor/core";

export default function ContactSettings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isMobileLayout = Capacitor.isNativePlatform();

  const { data: contact } = useQuery({
    queryKey: ["/api/mobile/auth/me"],
    queryFn: getContactQueryFn,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      return await contactApiRequest("POST", "/api/mobile/auth/logout", {});
    },
    onSuccess: async () => {
      removeContactId();
      removeUserId(); // Clear both IDs to be safe
      await removeDeviceToken(); // Remove push notification token
      queryClient.setQueryData(["/api/mobile/auth/me"], null);
      queryClient.clear();
      toast({ title: "Logged out successfully" });
      setTimeout(() => {
        setLocation("/auth");
      }, 100);
    },
    onError: () => {
      toast({
        title: "Logout failed",
        variant: "destructive",
      });
    },
  });

  const getContactInitials = () => {
    if (contact?.firstName && contact?.lastName) {
      return `${contact.firstName[0]}${contact.lastName[0]}`.toUpperCase();
    }
    if (contact?.email) {
      return contact.email.substring(0, 2).toUpperCase();
    }
    return "C";
  };

  const getContactDisplayName = () => {
    if (contact?.firstName && contact?.lastName) {
      return `${contact.firstName} ${contact.lastName}`;
    }
    return contact?.email || "Contact";
  };

  return (
    <div className={`min-h-screen bg-background ${isMobileLayout ? "p-4" : "container mx-auto p-6 max-w-2xl"} space-y-4`}>
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account and preferences
        </p>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your contact information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-lg bg-primary text-primary-foreground">
                {getContactInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="text-lg font-semibold">{getContactDisplayName()}</h3>
              {contact?.email && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <Mail className="h-4 w-4" />
                  <span>{contact.email}</span>
                </div>
              )}
              {contact?.phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <Phone className="h-4 w-4" />
                  <span>{contact.countryCode} {contact.phone}</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Information */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {contact?.firstName && contact?.lastName && (
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Name</p>
                <p className="text-sm text-muted-foreground">
                  {contact.firstName} {contact.lastName}
                </p>
              </div>
            </div>
          )}
          {contact?.email && (
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Email</p>
                <p className="text-sm text-muted-foreground">{contact.email}</p>
              </div>
            </div>
          )}
          {contact?.phone && (
            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Phone</p>
                <p className="text-sm text-muted-foreground">
                  {contact.countryCode} {contact.phone}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logout Section */}
      <Card>
        <CardContent className="pt-6">
          <Button
            variant="destructive"
            className="w-full"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            <LogOut className="h-4 w-4 mr-2" />
            {logoutMutation.isPending ? "Logging out..." : "Logout"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

