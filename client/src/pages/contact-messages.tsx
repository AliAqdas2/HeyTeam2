import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Clock, Briefcase } from "lucide-react";
import { format } from "date-fns";

type Message = {
  id: string;
  content: string;
  direction: "inbound" | "outbound";
  status: string;
  createdAt: string;
  jobId?: string;
  jobName?: string;
};

export default function ContactMessages() {
  const { data: messages, isLoading } = useQuery<Message[]>({
    queryKey: ["/api/contact/messages"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const sortedMessages = messages ? [...messages].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  }) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Messages</h1>
        <p className="text-muted-foreground mt-1">View all messages sent to you about your jobs</p>
      </div>

      {sortedMessages.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Messages</h3>
            <p className="text-muted-foreground">
              You don't have any messages at the moment.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedMessages.map((message) => (
            <MessageCard key={message.id} message={message} />
          ))}
        </div>
      )}
    </div>
  );
}

function MessageCard({ message }: { message: Message }) {
  const isOutbound = message.direction === "outbound";

  return (
    <Card className={isOutbound ? "ml-0" : "mr-0"}>
      <CardContent className="p-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <Badge variant={isOutbound ? "secondary" : "default"}>
                {isOutbound ? "You" : "From Manager"}
              </Badge>
              {message.jobName && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Briefcase className="h-3 w-3" />
                  {message.jobName}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{format(new Date(message.createdAt), "MMM d, yyyy h:mm a")}</span>
            </div>
          </div>
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
      </CardContent>
    </Card>
  );
}

