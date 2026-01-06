import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronUp, Smartphone, MessageSquare, Globe, CheckCircle2, XCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";

type MessageLogEvent = {
  id: string;
  eventType: string;
  channel: string;
  status: string;
  createdAt: string;
  responseStatus?: string | null;
};

type ContactSummary = {
  contactId: string;
  contactName: string;
  channel: "push" | "sms" | "portal";
  notificationSent: boolean;
  notificationDelivered: boolean;
  responseStatus: "accepted" | "declined" | "no_response" | null;
  lastEventAt: string | null;
  events: MessageLogEvent[];
};

type MessageLogsResponse = {
  jobId: string;
  contacts: ContactSummary[];
  summary: {
    total: number;
    contacted: number;
    delivered: number;
    responded: number;
    accepted: number;
    declined: number;
    noResponse: number;
  };
};

export function MessageLogsTable({ jobId }: { jobId: string }) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery<MessageLogsResponse>({
    queryKey: ["/api/jobs", jobId, "message-logs"],
    enabled: !!jobId,
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  const toggleRow = (contactId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(contactId)) {
      newExpanded.delete(contactId);
    } else {
      newExpanded.add(contactId);
    }
    setExpandedRows(newExpanded);
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case "push":
        return <Smartphone className="h-4 w-4" />;
      case "sms":
        return <MessageSquare className="h-4 w-4" />;
      case "portal":
        return <Globe className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getChannelLabel = (channel: string) => {
    switch (channel) {
      case "push":
        return "Mobile App";
      case "sms":
        return "SMS";
      case "portal":
        return "Portal";
      default:
        return channel;
    }
  };

  const getResponseStatusBadge = (status: string | null) => {
    if (!status) return null;

    switch (status) {
      case "accepted":
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Accepted
          </Badge>
        );
      case "declined":
        return (
          <Badge variant="secondary" className="bg-red-100 text-red-800">
            <XCircle className="h-3 w-3 mr-1" />
            Declined
          </Badge>
        );
      case "no_response":
        return (
          <Badge variant="secondary" className="bg-gray-100 text-gray-800">
            <Clock className="h-3 w-3 mr-1" />
            No Response
          </Badge>
        );
      default:
        return null;
    }
  };

  const getEventTypeLabel = (eventType: string) => {
    const labels: Record<string, string> = {
      push_sent: "Push Sent",
      push_delivered: "Push Delivered",
      push_failed: "Push Failed",
      sms_sent: "SMS Sent",
      sms_failed: "SMS Failed",
      sms_fallback: "SMS Fallback",
      response_received: "Response Received",
      no_response: "No Response",
    };
    return labels[eventType] || eventType;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Message Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">Loading message logs...</div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.contacts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Message Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No message logs available for this job.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Message Logs</CardTitle>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>Total: {data.summary.total}</span>
            <span>Contacted: {data.summary.contacted}</span>
            <span>Delivered: {data.summary.delivered}</span>
            <span>Responded: {data.summary.responded}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Notification</TableHead>
              <TableHead>Response</TableHead>
              <TableHead>Last Event</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.contacts.map((contact) => (
              <>
                <TableRow key={contact.contactId} className="cursor-pointer" onClick={() => toggleRow(contact.contactId)}>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleRow(contact.contactId);
                      }}
                    >
                      {expandedRows.has(contact.contactId) ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                  <TableCell className="font-medium">{contact.contactName}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getChannelIcon(contact.channel)}
                      <span>{getChannelLabel(contact.channel)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {contact.notificationSent ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="text-sm">
                        {contact.notificationSent
                          ? contact.notificationDelivered
                            ? "Delivered"
                            : "Sent"
                          : "Not Sent"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{getResponseStatusBadge(contact.responseStatus)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {contact.lastEventAt
                      ? format(new Date(contact.lastEventAt), "MMM d, yyyy 'at' h:mm a")
                      : "—"}
                  </TableCell>
                </TableRow>
                {expandedRows.has(contact.contactId) && (
                  <TableRow>
                    <TableCell colSpan={6} className="bg-muted/50">
                      <div className="py-4">
                        <h4 className="font-semibold mb-3">Event History</h4>
                        <div className="space-y-2">
                          {contact.events.map((event) => (
                            <div
                              key={event.id}
                              className="flex items-center justify-between p-2 bg-background rounded border"
                            >
                              <div className="flex items-center gap-3">
                                <Badge variant="outline">{getEventTypeLabel(event.eventType)}</Badge>
                                <span className="text-sm text-muted-foreground">
                                  {format(new Date(event.createdAt), "MMM d, yyyy 'at' h:mm a")}
                                </span>
                                {event.responseStatus && (
                                  <Badge variant="secondary">
                                    {event.responseStatus === "accepted" ? "Accepted" : "Declined"}
                                  </Badge>
                                )}
                              </div>
                              <Badge
                                variant={
                                  event.status === "success" || event.status === "delivered"
                                    ? "default"
                                    : event.status === "failed"
                                    ? "destructive"
                                    : "secondary"
                                }
                              >
                                {event.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
