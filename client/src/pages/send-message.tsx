import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Send, Users } from "lucide-react";
import type { Template, Contact, Job } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function SendMessage() {
  const [, params] = useRoute("/jobs/:id/send");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [messageContent, setMessageContent] = useState("");

  const { data: job } = useQuery<Job>({
    queryKey: ["/api/jobs", params?.id],
  });

  const { data: templates } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
  });

  const { data: contacts } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  const sendMutation = useMutation({
    mutationFn: (data: { jobId: string; templateId: string; contactIds: string[] }) =>
      apiRequest("POST", "/api/send-message", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      toast({
        title: "Messages Sent",
        description: `Successfully sent messages to ${selectedContacts.length} contact(s)`,
      });
      setLocation(`/jobs/${params?.id}/roster`);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send messages",
        variant: "destructive",
      });
    },
  });

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates?.find((t) => t.id === templateId);
    if (template) {
      setMessageContent(template.content);
    }
  };

  const toggleContact = (contactId: string) => {
    setSelectedContacts((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId]
    );
  };

  const selectAll = () => {
    if (contacts) {
      const activeContacts = contacts.filter((c) => !c.isOptedOut);
      setSelectedContacts(activeContacts.map((c) => c.id));
    }
  };

  const deselectAll = () => {
    setSelectedContacts([]);
  };

  const handleSend = () => {
    if (!params?.id || !selectedTemplate || selectedContacts.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select a template and at least one contact",
        variant: "destructive",
      });
      return;
    }

    sendMutation.mutate({
      jobId: params.id,
      templateId: selectedTemplate,
      contactIds: selectedContacts,
    });
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link href={`/jobs/${params?.id}/roster`}>
          <a data-testid="link-back-roster">
            <Button variant="ghost" size="sm" className="gap-2 mb-4">
              <ArrowLeft className="h-4 w-4" />
              Back to Roster
            </Button>
          </a>
        </Link>
        <h1 className="text-3xl font-semibold" data-testid="text-page-title">Send Message</h1>
        <p className="text-muted-foreground mt-1">
          {job?.name} - Broadcast to your crew
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">1. Select Template</h2>
            </CardHeader>
            <CardContent>
              <Select value={selectedTemplate} onValueChange={handleTemplateChange}>
                <SelectTrigger data-testid="select-template">
                  <SelectValue placeholder="Choose a message template" />
                </SelectTrigger>
                <SelectContent>
                  {templates?.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">2. Select Recipients</h2>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAll}
                    data-testid="button-select-all"
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={deselectAll}
                    data-testid="button-deselect-all"
                  >
                    Deselect All
                  </Button>
                </div>
              </div>
              <Badge variant="secondary" className="w-fit mt-2">
                {selectedContacts.length} selected
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {contacts?.filter((c) => !c.isOptedOut).map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center gap-3 p-3 rounded-lg border hover-elevate cursor-pointer"
                    onClick={() => toggleContact(contact.id)}
                    data-testid={`contact-item-${contact.id}`}
                  >
                    <Checkbox
                      checked={selectedContacts.includes(contact.id)}
                      onCheckedChange={() => toggleContact(contact.id)}
                    />
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>
                        {contact.firstName[0]}{contact.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">
                        {contact.firstName} {contact.lastName}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{contact.phone}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">3. Preview & Send</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Message Preview</label>
                <div className="bg-muted/50 p-4 rounded-lg min-h-32">
                  <p className="text-sm whitespace-pre-wrap">
                    {messageContent || "Select a template to preview the message"}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Recipients:</span>
                  <span className="font-medium">{selectedContacts.length}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Estimated Credits:</span>
                  <span className="font-medium">{selectedContacts.length}</span>
                </div>
              </div>

              <Button
                className="w-full gap-2"
                onClick={handleSend}
                disabled={!selectedTemplate || selectedContacts.length === 0 || sendMutation.isPending}
                data-testid="button-send-messages"
              >
                {sendMutation.isPending ? (
                  <div className="animate-spin w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send to {selectedContacts.length} Contact{selectedContacts.length !== 1 ? 's' : ''}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
