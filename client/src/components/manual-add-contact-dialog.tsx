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
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, UserPlus, Loader2, CheckCircle, HelpCircle, XCircle, Clock } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Contact, Availability } from "@shared/schema";

type AvailabilityWithContact = Availability & { contact: Contact };

const STATUS_OPTIONS = [
  { id: "confirmed", label: "Confirmed", icon: CheckCircle, color: "text-emerald-600" },
  { id: "maybe", label: "Maybe", icon: HelpCircle, color: "text-amber-500" },
  { id: "declined", label: "Declined", icon: XCircle, color: "text-destructive" },
  { id: "no_reply", label: "No Reply", icon: Clock, color: "text-muted-foreground" },
];

interface ManualAddContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobName: string;
  existingAvailability: AvailabilityWithContact[];
}

export function ManualAddContactDialog({
  open,
  onOpenChange,
  jobId,
  jobName,
  existingAvailability,
}: ManualAddContactDialogProps) {
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [selectedStatus, setSelectedStatus] = useState<string>("confirmed");
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  // Fetch all contacts
  const { data: contacts = [], isLoading: loadingContacts } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
    enabled: open,
  });

  // Get contact IDs who are confirmed (only these should be excluded from invitation list)
  // Contacts who declined, maybe, or no_reply can be invited again
  const confirmedContactIds = useMemo(() => {
    return new Set(
      existingAvailability
        .filter((a) => a.status === "confirmed")
        .map((a) => a.contact.id)
    );
  }, [existingAvailability]);

  // Filter contacts to exclude only those who are confirmed
  const availableContacts = useMemo(() => {
    return contacts.filter((c) => !confirmedContactIds.has(c.id));
  }, [contacts, confirmedContactIds]);

  // Filter by search query
  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return availableContacts;
    const query = searchQuery.toLowerCase();
    return availableContacts.filter(
      (contact) =>
        `${contact.firstName} ${contact.lastName}`.toLowerCase().includes(query) ||
        contact.phone.includes(query) ||
        contact.email?.toLowerCase().includes(query)
    );
  }, [availableContacts, searchQuery]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedContactIds(new Set());
      setSelectedStatus("confirmed");
      setSearchQuery("");
    }
  }, [open]);

  const addContactsMutation = useMutation({
    mutationFn: async () => {
      const contactIdsArray = Array.from(selectedContactIds);
      let successCount = 0;
      let errorCount = 0;

      for (const contactId of contactIdsArray) {
        try {
          await apiRequest("POST", "/api/availability", {
            jobId,
            contactId,
            status: selectedStatus,
          });
          successCount++;
        } catch (e) {
          errorCount++;
        }
      }

      return { successCount, errorCount };
    },
    onSuccess: ({ successCount, errorCount }) => {
      const statusLabel = STATUS_OPTIONS.find((s) => s.id === selectedStatus)?.label || selectedStatus;
      toast({
        title: "Contacts Added",
        description: `Added ${successCount} contact${successCount > 1 ? "s" : ""} as "${statusLabel}"${
          errorCount > 0 ? ` (${errorCount} failed)` : ""
        }`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "roster"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to add contacts",
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

  const selectedCount = selectedContactIds.size;
  const totalCount = filteredContacts.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Add to Roster
          </DialogTitle>
          <DialogDescription>
            Manually add contacts to: {jobName}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden space-y-4">
          {/* Status Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((status) => {
                const Icon = status.icon;
                const isSelected = selectedStatus === status.id;
                return (
                  <Button
                    key={status.id}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedStatus(status.id)}
                    className="gap-2"
                  >
                    <Icon className={`h-4 w-4 ${isSelected ? "" : status.color}`} />
                    {status.label}
                  </Button>
                );
              })}
            </div>
          </div>

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
          {loadingContacts ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
              {availableContacts.length === 0
                ? "All contacts are already on the roster"
                : "No contacts match your search"}
            </div>
          ) : (
            <ScrollArea className="h-[300px] border rounded-lg">
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
                          {contact.phone} {contact.email && `• ${contact.email}`}
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
            onClick={() => addContactsMutation.mutate()}
            disabled={addContactsMutation.isPending || selectedCount === 0}
            className="gap-2"
          >
            {addContactsMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            Add ({selectedCount})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

