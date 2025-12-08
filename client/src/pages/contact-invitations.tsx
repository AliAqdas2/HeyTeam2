import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Clock, Check, X } from "lucide-react";
import { format } from "date-fns";
import { queryClient } from "@/lib/queryClient";
import { contactApiRequest, getContactQueryFn } from "@/lib/contactApiClient";
import { useToast } from "@/hooks/use-toast";
import { Capacitor } from "@capacitor/core";
import { cn } from "@/lib/utils";

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
  availabilityId?: string;
};

export default function ContactInvitations() {
  const { toast } = useToast();
  const isMobileLayout = Capacitor.isNativePlatform();
  
  const { data, isLoading, refetch } = useQuery<{ invitations: Invitation[] }>({
    queryKey: ["/api/contact/invitations"],
    queryFn: getContactQueryFn,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    staleTime: 1 * 60 * 1000, // 1 minute
  });

  const updateInvitationMutation = useMutation({
    mutationFn: async ({ availabilityId, status }: { availabilityId: string; status: string }) => {
      const response = await contactApiRequest("PATCH", `/api/contact/availability/${availabilityId}`, { status });
      return await response.json();
    },
    onSuccess: () => {
      toast({ title: "Response saved successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/contact/invitations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contact/schedule"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contact/jobs"] });
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update response",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const invitations = data?.invitations || [];

  const handleResponse = (invitation: Invitation, status: "confirmed" | "declined" | "maybe") => {
    if (!invitation.availabilityId) {
      toast({
        title: "Error",
        description: "Invalid invitation data",
        variant: "destructive",
      });
      return;
    }
    updateInvitationMutation.mutate({
      availabilityId: invitation.availabilityId,
      status,
    });
  };

  return (
    <div className={cn("space-y-6", isMobileLayout && "space-y-3")}>
      {!isMobileLayout && (
      <div>
        <h1 className="text-3xl font-semibold">Job Invitations</h1>
        <p className="text-muted-foreground mt-1">Respond to job invitations by accepting, declining, or marking as maybe</p>
      </div>
      )}
      
      {isMobileLayout && (
        <div>
          <h1 className="text-xl font-semibold">Job Invitations</h1>
          <p className="text-sm text-muted-foreground mt-1">Respond to job invitations</p>
        </div>
      )}

      {invitations.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Pending Invitations</h3>
            <p className="text-muted-foreground">
              You don't have any pending job invitations at the moment.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {invitations.map((invitation) => (
            <InvitationCard
              key={invitation.id}
              invitation={invitation}
              onResponse={handleResponse}
              isUpdating={updateInvitationMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function InvitationCard({
  invitation,
  onResponse,
  isUpdating,
}: {
  invitation: Invitation;
  onResponse: (invitation: Invitation, status: "confirmed" | "declined" | "maybe") => void;
  isUpdating: boolean;
}) {
  const startTime = new Date(invitation.startTime);
  const endTime = new Date(invitation.endTime);
  const formattedDate = format(startTime, "EEEE, MMMM d, yyyy");
  const formattedTime = `${format(startTime, "h:mm a")} - ${format(endTime, "h:mm a")}`;

  const getStatusBadge = () => {
    switch (invitation.availabilityStatus) {
      case "confirmed":
        return <Badge className="bg-green-600">Accepted</Badge>;
      case "declined":
        return <Badge variant="destructive">Declined</Badge>;
      case "maybe":
        return <Badge variant="secondary">Maybe</Badge>;
      default:
        return <Badge variant="outline">Pending Response</Badge>;
    }
  };

  const hasResponded = invitation.availabilityStatus !== "no_reply";

  return (
    <Card className="hover-elevate">
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">{invitation.name}</h3>
                {getStatusBadge()}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4 flex-shrink-0" />
                  <span>{formattedDate}</span>
                </div>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4 flex-shrink-0" />
                  <span>{formattedTime}</span>
                </div>

                {invitation.location && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4 flex-shrink-0" />
                    <span>{invitation.location}</span>
                  </div>
                )}
              </div>

              {invitation.notes && (
                <p className="text-sm text-muted-foreground pt-2 border-t">{invitation.notes}</p>
              )}
            </div>
          </div>

          {!hasResponded && (
            <div className="flex flex-col gap-2 pt-4 border-t">
              <Button
                onClick={() => onResponse(invitation, "confirmed")}
                disabled={isUpdating}
                className="flex-1"
                variant="default"
              >
                <Check className="h-4 w-4 mr-2" />
                Accept
              </Button>
              <Button
                onClick={() => onResponse(invitation, "maybe")}
                disabled={isUpdating}
                className="flex-1"
                variant="secondary"
              >
                Maybe
              </Button>
              <Button
                onClick={() => onResponse(invitation, "declined")}
                disabled={isUpdating}
                className="flex-1"
                variant="destructive"
              >
                <X className="h-4 w-4 mr-2" />
                Decline
              </Button>
            </div>
          )}

          {hasResponded && (
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                You have already responded to this invitation.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

