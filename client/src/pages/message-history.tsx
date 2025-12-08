import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, X } from "lucide-react";
import { format } from "date-fns";

interface EnrichedMessage {
  id: string;
  contactId: string;
  contactName: string;
  jobId: string | null;
  jobName: string | null;
  direction: string;
  content: string;
  status: string;
  createdAt: string;
}

export default function MessageHistory() {
  const [searchName, setSearchName] = useState("");
  const [searchContent, setSearchContent] = useState("");
  const [searchDate, setSearchDate] = useState("");

  const { data: messages = [], isLoading } = useQuery<EnrichedMessage[]>({
    queryKey: ["/api/messages/history"],
  });

  const filteredMessages = messages.filter((msg) => {
    const nameMatch = msg.contactName.toLowerCase().includes(searchName.toLowerCase());
    const contentMatch = msg.content.toLowerCase().includes(searchContent.toLowerCase());
    
    let dateMatch = true;
    if (searchDate) {
      const msgDate = format(new Date(msg.createdAt), "yyyy-MM-dd");
      dateMatch = msgDate === searchDate;
    }
    
    return nameMatch && contentMatch && dateMatch;
  });

  const clearFilters = () => {
    setSearchName("");
    setSearchContent("");
    setSearchDate("");
  };

  const hasActiveFilters = searchName || searchContent || searchDate;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading message history...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Message History</h1>
        <p className="text-muted-foreground mt-1">
          View all sent and received messages
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Filter Messages
          </CardTitle>
          <CardDescription>
            Search by contact name, message content, or date
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search-name">Contact Name</Label>
              <Input
                id="search-name"
                data-testid="input-search-name"
                placeholder="Search by name..."
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="search-content">Message Content</Label>
              <Input
                id="search-content"
                data-testid="input-search-content"
                placeholder="Search message text..."
                value={searchContent}
                onChange={(e) => setSearchContent(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="search-date">Date</Label>
              <Input
                id="search-date"
                data-testid="input-search-date"
                type="date"
                value={searchDate}
                onChange={(e) => setSearchDate(e.target.value)}
              />
            </div>
          </div>

          {hasActiveFilters && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Found {filteredMessages.length} of {messages.length} messages
              </p>
              <Button
                variant="ghost"
                size="sm"
                data-testid="button-clear-filters"
                onClick={clearFilters}
              >
                <X className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Messages ({filteredMessages.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredMessages.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {hasActiveFilters ? "No messages match your filters" : "No messages yet"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="table-messages">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">Date & Time</th>
                    <th className="text-left p-3 font-medium">Contact</th>
                    <th className="text-left p-3 font-medium">Direction</th>
                    <th className="text-left p-3 font-medium">Job</th>
                    <th className="text-left p-3 font-medium">Message</th>
                    <th className="text-left p-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMessages.map((msg) => (
                    <tr
                      key={msg.id}
                      className="border-b hover-elevate"
                      data-testid={`row-message-${msg.id}`}
                    >
                      <td className="p-3 text-sm" data-testid={`text-date-${msg.id}`}>
                        {format(new Date(msg.createdAt), "MMM dd, yyyy HH:mm")}
                      </td>
                      <td className="p-3" data-testid={`text-contact-${msg.id}`}>
                        {msg.contactName}
                      </td>
                      <td className="p-3">
                        <Badge
                          variant={msg.direction === "outbound" ? "default" : "secondary"}
                          data-testid={`badge-direction-${msg.id}`}
                        >
                          {msg.direction === "outbound" ? "Sent" : "Received"}
                        </Badge>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground" data-testid={`text-job-${msg.id}`}>
                        {msg.jobName || "-"}
                      </td>
                      <td className="p-3 max-w-md" data-testid={`text-content-${msg.id}`}>
                        <div className="truncate text-sm">{msg.content}</div>
                      </td>
                      <td className="p-3">
                        <Badge
                          variant={msg.status === "sent" ? "default" : msg.status === "failed" ? "destructive" : "secondary"}
                          data-testid={`badge-status-${msg.id}`}
                        >
                          {msg.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
