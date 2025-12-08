import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Briefcase, Bell, MessageSquare, Clock, MapPin } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { getContactQueryFn } from "@/lib/contactApiClient";
import { Capacitor } from "@capacitor/core";
import { cn } from "@/lib/utils";

type JobWithStatus = {
  id: string;
  name: string;
  location: string;
  startTime: string;
  endTime: string;
  notes?: string;
  availabilityStatus: string;
  shiftPreference?: string;
  updatedAt: string;
};

type Invitation = {
  id: string;
  name: string;
  location: string;
  startTime: string;
  endTime: string;
  notes?: string;
  availabilityStatus: string;
  shiftPreference?: string;
  createdAt: string;
};

export default function ContactDashboard() {
  const isMobileLayout = Capacitor.isNativePlatform();
  
  const { data: contact } = useQuery({
    queryKey: ["/api/mobile/auth/me"],
    queryFn: getContactQueryFn,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: scheduleData } = useQuery<{ upcoming: JobWithStatus[]; past: JobWithStatus[] }>({
    queryKey: ["/api/contact/schedule"],
    queryFn: getContactQueryFn,
    enabled: !!contact,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchInterval: 5000, // Refetch every 5 seconds
    staleTime: 0, // Always consider data stale to allow refetching
  });

  const { data: invitationsData } = useQuery<{ invitations: Invitation[] }>({
    queryKey: ["/api/contact/invitations"],
    queryFn: getContactQueryFn,
    enabled: !!contact,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchInterval: 5000, // Refetch every 5 seconds
    staleTime: 0, // Always consider data stale to allow refetching
  });

  const upcomingCount = scheduleData?.upcoming?.length || 0;
  const pastCount = scheduleData?.past?.length || 0;
  const invitationCount = invitationsData?.invitations?.length || 0;

  // Get next upcoming job
  const nextJob = scheduleData?.upcoming?.[0];

  return (
    <div className={cn("space-y-6", isMobileLayout && "space-y-3")}>
      {!isMobileLayout && (
      <div>
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back, {contact?.firstName}! Here's an overview of your jobs and invitations.
        </p>
      </div>
      )}
      
      {isMobileLayout && (
        <div>
          <h1 className="text-xl font-semibold">Welcome back, {contact?.firstName}!</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Here's an overview of your jobs and invitations.
          </p>
        </div>
      )}

      {/* Stats Cards */}
      <div className={cn("grid gap-4", isMobileLayout ? "grid-cols-3" : "grid-cols-1 md:grid-cols-3")}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Jobs</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingCount}</div>
            <p className="text-xs text-muted-foreground">Jobs scheduled ahead</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Invitations</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invitationCount}</div>
            <p className="text-xs text-muted-foreground">Require your response</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Past Jobs</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pastCount}</div>
            <p className="text-xs text-muted-foreground">Completed jobs</p>
          </CardContent>
        </Card>
      </div>

      {/* Next Upcoming Job */}
      {nextJob && (
        <Card>
          <CardHeader>
            <CardTitle>Next Job</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold mb-2">{nextJob.name}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>{format(new Date(nextJob.startTime), "EEEE, MMMM d, yyyy")}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>
                      {format(new Date(nextJob.startTime), "h:mm a")} - {format(new Date(nextJob.endTime), "h:mm a")}
                    </span>
                  </div>
                  {nextJob.location && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>{nextJob.location}</span>
                    </div>
                  )}
                </div>
                <div className="mt-4">
                  <Badge variant={nextJob.availabilityStatus === "confirmed" ? "default" : "secondary"}>
                    {nextJob.availabilityStatus === "confirmed" ? "Confirmed" : 
                     nextJob.availabilityStatus === "declined" ? "Declined" : 
                     nextJob.availabilityStatus === "maybe" ? "Maybe" : "Pending"}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="hover-elevate cursor-pointer">
          <Link href="/contact/invitations">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Invitations
              </CardTitle>
            </CardHeader>
            <CardContent>
              {invitationCount > 0 ? (
                <p className="text-muted-foreground">
                  You have {invitationCount} pending invitation{invitationCount !== 1 ? "s" : ""} waiting for your response.
                </p>
              ) : (
                <p className="text-muted-foreground">No pending invitations at the moment.</p>
              )}
            </CardContent>
          </Link>
        </Card>

        <Card className="hover-elevate cursor-pointer">
          <Link href="/contact/schedule">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                View Schedule
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                View your complete schedule with all upcoming and past jobs.
              </p>
            </CardContent>
          </Link>
        </Card>
      </div>

      {/* Recent Invitations */}
      {invitationsData && invitationsData.invitations.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Invitations</CardTitle>
            <Link href="/contact/invitations">
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {invitationsData.invitations.slice(0, 3).map((invitation) => (
                <div key={invitation.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h4 className="font-semibold">{invitation.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(invitation.startTime), "MMM d, yyyy h:mm a")}
                    </p>
                  </div>
                  <Badge variant="outline">Pending</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

