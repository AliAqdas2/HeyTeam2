import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Megaphone, Send, Loader2, FileText, Edit } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Contact, Template, Availability } from "@shared/schema";

type AvailabilityWithContact = Availability & { contact: Contact };

interface BroadcastMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobName: string;
  confirmedContacts: AvailabilityWithContact[];
}

export function BroadcastMessageDialog({
  open,
  onOpenChange,
  jobId,
  jobName,
  confirmedContacts,
}: BroadcastMessageDialogProps) {
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [customMessage, setCustomMessage] = useState("");
  const [messageType, setMessageType] = useState<"template" | "custom">("template");
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  // Fetch templates
  const { data: templates = [], isLoading: loadingTemplates } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
    enabled: open,
  });

  // Pre-select all confirmed contacts
  useEffect(() => {
    if (open) {
      setSelectedContactIds(new Set(confirmedContacts.map((a) => a.contact.id)));
    }
  }, [open, confirmedContacts]);

  // Filter by search query
  const filteredContacts = useMemo(() => {
    const contacts = confirmedContacts.map((a) => a.contact);
    if (!searchQuery.trim()) return contacts;
    const query = searchQuery.toLowerCase();
    return contacts.filter(
      (contact) =>
        `${contact.firstName} ${contact.lastName}`.toLowerCase().includes(query) ||
        contact.phone.includes(query) ||
        contact.email?.toLowerCase().includes(query)
    );
  }, [confirmedContacts, searchQuery]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedTemplateId("");
      setCustomMessage("");
      setMessageType("template");
      setSearchQuery("");
    }
  }, [open]);

  const sendBroadcastMutation = useMutation({
    mutationFn: async () => {
      const body: any = {
        jobId,
        contactIds: Array.from(selectedContactIds),
      };

      if (messageType === "custom") {
        body.customMessage = customMessage.trim();
      } else {
        body.templateId = selectedTemplateId;
      }

      const response = await apiRequest("POST", "/api/send-message", body);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Message Broadcast Sent",
        description: `Sent message to ${selectedContactIds.size} contact${selectedContactIds.size > 1 ? "s" : ""}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "roster"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to send broadcast",
        variant: "destructive",
      });
    },
  });

  const toggleContact = (contactId: string) => {
    const newSelected = new Set(selectedContactIds);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedContactIds(newSelected);
  };

  const toggleAll = () => {
    if (selectedContactIds.size === filteredContacts.length) {
      setSelectedContactIds(new Set());
    } else {
      setSelectedContactIds(new Set(filteredContacts.map((c) => c.id)));
    }
  };

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);
  const selectedCount = selectedContactIds.size;
  const totalCount = filteredContacts.length;

  const isValid =
    selectedCount > 0 &&
    ((messageType === "template" && selectedTemplateId) ||
      (messageType === "custom" && customMessage.trim()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" />
            Message Broadcast
          </DialogTitle>
          <DialogDescription>
            Send message to confirmed contacts for: {jobName}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden space-y-4">
          {/* Message Type Tabs */}
          <Tabs value={messageType} onValueChange={(v) => setMessageType(v as "template" | "custom")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="template" className="gap-2">
                <FileText className="h-4 w-4" />
                Template
              </TabsTrigger>
              <TabsTrigger value="custom" className="gap-2">
                <Edit className="h-4 w-4" />
                Custom
              </TabsTrigger>
            </TabsList>

            <TabsContent value="template" className="space-y-2 mt-4">
              <label className="text-sm font-medium">Message Template</label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      No templates available
                    </div>
                  ) : (
                    templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>

              {selectedTemplate && (
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <div className="font-medium text-xs text-muted-foreground mb-1">Preview:</div>
                  <p className="whitespace-pre-wrap">{selectedTemplate.content}</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="custom" className="space-y-2 mt-4">
              <label className="text-sm font-medium">Custom Message</label>
              <Textarea
                placeholder="Type your message here..."
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                className="min-h-[120px]"
              />
            </TabsContent>
          </Tabs>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Selection Info */}
          <div className="flex justify-between items-center">
            <Button variant="ghost" size="sm" onClick={toggleAll}>
              {selectedCount === totalCount && totalCount > 0 ? "Deselect All" : "Select All"}
            </Button>
            <span className="text-sm text-muted-foreground">
              {selectedCount} of {totalCount} selected
            </span>
          </div>

          {/* Contacts List */}
          {confirmedContacts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
              No confirmed contacts to message
            </div>
          ) : (
            <ScrollArea className="h-[250px] border rounded-lg">
              <div className="p-2 space-y-2">
                {filteredContacts.map((contact) => {
                  const isSelected = selectedContactIds.has(contact.id);
                  return (
                    <div
                      key={contact.id}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-primary/10 border border-primary"
                          : "bg-muted/50 hover:bg-muted"
                      }`}
                      onClick={() => toggleContact(contact.id)}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleContact(contact.id)}
                      />
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="text-xs">
                          {contact.firstName[0]}{contact.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">
                          {contact.firstName} {contact.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {contact.phone}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => sendBroadcastMutation.mutate()}
            disabled={sendBroadcastMutation.isPending || !isValid}
            className="gap-2"
          >
            {sendBroadcastMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Broadcast ({selectedCount})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

