import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send } from "lucide-react";
import type { Template, Contact, Job, JobSkillRequirement } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type JobWithSkills = Job & {
  skillRequirements?: JobSkillRequirement[];
};

export default function SendMessage() {
  const [, params] = useRoute("/jobs/:id/send");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [messageContent, setMessageContent] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSkillFilters, setActiveSkillFilters] = useState<string[]>([]);
  const [activeStatusFilters, setActiveStatusFilters] = useState<string[]>([]);

  const { data: job } = useQuery<JobWithSkills>({
    queryKey: ["/api/jobs", params?.id],
  });

  const { data: templates } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
    // Always pick up newly-created templates when arriving from the Templates page
    refetchOnMount: "always",
  });

  const { data: contacts } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  const sendMutation = useMutation({
    mutationFn: async (data: { jobId: string; templateId: string; contactIds: string[] }) => {
      const res = await apiRequest("POST", "/api/send-message", data);
      return await res.json();
    },
    onSuccess: (data: any) => {
      // Invalidate queries to refresh schedule and contacts immediately
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", params?.id, "roster"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({
        title: "Messages queued",
        description:
          data?.totalQueued != null
            ? `Optimised batches of ${Math.min(5, data.totalQueued)} will begin sending immediately. Additional batches (up to ${data.totalQueued} contacts) follow every 2 minutes until the job is filled or credits run out.`
            : `Messages will be sent in smart batches of 5 every 2 minutes until the job is filled or credits run out.`,
      });
      setLocation(`/jobs/${params?.id}/schedule`);
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

  const normalizeSkill = (value: string | null | undefined) => value?.trim().toLowerCase() ?? "";

  const contactsById = useMemo(() => {
    const map = new Map<string, Contact>();
    contacts?.forEach((contact) => {
      map.set(contact.id, contact);
    });
    return map;
  }, [contacts]);

  const jobSkillRequirements = job?.skillRequirements?.filter((requirement) => {
    return Boolean(normalizeSkill(requirement.skill)) && (requirement.headcount ?? 0) > 0;
  }) ?? [];

  const statusFilterOptions = useMemo(() => {
    if (!contacts) return [];
    const statuses = new Set<string>();
    contacts.forEach((contact) => {
      if (!contact.isOptedOut && contact.status) {
        statuses.add(contact.status);
      }
    });
    return Array.from(statuses);
  }, [contacts]);

  const selectedSkillStats = useMemo(() => {
    if (!jobSkillRequirements.length) return [];

    return jobSkillRequirements.map((requirement) => {
      const key = normalizeSkill(requirement.skill);
      const required = requirement.headcount ?? 0;
      const selected = key
        ? selectedContacts.reduce((count, contactId) => {
            const contact = contactsById.get(contactId);
            if (!contact) return count;
            const contactSkills = (contact.skills ?? []).map(normalizeSkill);
            return contactSkills.includes(key) ? count + 1 : count;
          }, 0)
        : 0;

      return {
        key,
        label: requirement.skill?.trim() || "Skill",
        required,
        selected,
        remaining: Math.max(required - selected, 0),
        notes: requirement.notes ?? "",
      };
    });
  }, [jobSkillRequirements, selectedContacts, contactsById]);

  const outstandingSkillKeys = useMemo(() => {
    return new Set(
      selectedSkillStats
        .filter((stat) => stat.remaining > 0)
        .map((stat) => stat.key)
        .filter(Boolean),
    );
  }, [selectedSkillStats]);

  const filteredContacts = useMemo(() => {
    if (!contacts) return [];
    const term = searchTerm.trim().toLowerCase();

    return contacts
      .filter((contact) => !contact.isOptedOut)
      .filter((contact) => {
        if (activeSkillFilters.length) {
          const contactSkills = (contact.skills ?? []).map(normalizeSkill);
          const matchesAll = activeSkillFilters.every((skill) => contactSkills.includes(skill));
          if (!matchesAll) return false;
        }

        if (activeStatusFilters.length) {
          const statusKey = contact.status ?? "";
          if (!activeStatusFilters.includes(statusKey)) {
            return false;
          }
        }

        if (term) {
          const name = `${contact.firstName} ${contact.lastName}`.toLowerCase();
          const phone = contact.phone?.toLowerCase() ?? "";
          const skills = (contact.skills ?? []).join(" ").toLowerCase();
          if (![name, phone, skills].some((value) => value.includes(term))) {
            return false;
          }
        }

        return true;
      });
  }, [contacts, searchTerm, activeSkillFilters, activeStatusFilters]);

  const toggleStatusFilter = (status: string) => {
    setActiveStatusFilters((prev) =>
      prev.includes(status) ? prev.filter((current) => current !== status) : [...prev, status],
    );
  };

  const toggleSkillFilter = (skillKey: string) => {
    setActiveSkillFilters((prev) =>
      prev.includes(skillKey) ? prev.filter((current) => current !== skillKey) : [...prev, skillKey],
    );
  };

  const clearFilters = () => {
    setActiveStatusFilters([]);
    setActiveSkillFilters([]);
    setSearchTerm("");
  };

  const selectAll = () => {
    if (filteredContacts.length) {
      setSelectedContacts(filteredContacts.map((c) => c.id));
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
        <Link href={`/jobs/${params?.id}/schedule`}>
          <a data-testid="link-back-roster">
            <Button variant="ghost" size="sm" className="gap-2 mb-4">
              <ArrowLeft className="h-4 w-4" />
              Back to Schedule
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
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">1. Select Recipients</h2>
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
              {statusFilterOptions.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {statusFilterOptions.map((statusOption) => {
                    const isActive = activeStatusFilters.includes(statusOption);
                    const label = statusOption
                      .split("_")
                      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                      .join(" ");
                    return (
                      <Button
                        key={statusOption}
                        variant={isActive ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleStatusFilter(statusOption)}
                        className="h-7 px-3 text-xs"
                      >
                        {label}
                      </Button>
                    );
                  })}
                </div>
              )}
              {jobSkillRequirements.length > 0 && (
                <div className="mt-4 space-y-2" data-testid="skill-requirement-summary">
                  <div className="text-sm font-medium">Skill requirements</div>
                  <div className="grid gap-2">
                    {selectedSkillStats.map((stat, index) => (
                      <div
                        key={`${stat.key}-${index}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          if (!stat.key) return;
                          toggleSkillFilter(stat.key);
                        }}
                        onKeyDown={(event) => {
                          if ((event.key === "Enter" || event.key === " ") && stat.key) {
                            toggleSkillFilter(stat.key);
                          }
                        }}
                        className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm transition ${
                          stat.key && activeSkillFilters.includes(stat.key)
                            ? "border-primary bg-primary/10"
                            : "border-border bg-muted/40 hover:border-primary"
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{stat.label}</span>
                          {stat.notes && (
                            <span className="text-xs text-muted-foreground">{stat.notes}</span>
                          )}
                        </div>
                        <div className="text-right">
                          <span
                            className={
                              stat.remaining > 0
                                ? "font-semibold text-destructive"
                                : "font-semibold text-emerald-600"
                            }
                          >
                            {stat.selected}/{stat.required}
                          </span>
                          <div className="text-xs text-muted-foreground">
                            {stat.remaining > 0
                              ? `${stat.remaining} more needed`
                              : "Requirement met"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search by name, phone, or skill"
                    className="text-sm sm:max-w-xs"
                    data-testid="input-search-contacts"
                  />
                  {(activeStatusFilters.length > 0 ||
                    activeSkillFilters.length > 0 ||
                    searchTerm.trim().length > 0) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearFilters}
                      className="h-8 px-3 text-xs self-start sm:self-auto"
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {filteredContacts.map((contact) => (
                  <div
                    key={contact.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border hover-elevate cursor-pointer ${
                      contact.skills &&
                      contact.skills.length > 0 &&
                      contact.skills
                        .map(normalizeSkill)
                        .some((skill) => outstandingSkillKeys.has(skill))
                        ? "border-primary bg-primary/5"
                        : ""
                    }`}
                    onClick={() => toggleContact(contact.id)}
                    data-testid={`contact-item-${contact.id}`}
                  >
                    <Checkbox
                      checked={selectedContacts.includes(contact.id)}
                      onCheckedChange={() => toggleContact(contact.id)}
                    />
                    <Avatar className="h-10 w-10">
                      {contact.profilePicture && (
                        <AvatarImage
                          src={contact.profilePicture}
                          alt={`${contact.firstName} ${contact.lastName}`}
                        />
                      )}
                      <AvatarFallback>
                        {contact.firstName[0]}{contact.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">
                        {contact.firstName} {contact.lastName}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{contact.phone}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(contact.skills ?? []).length > 0 ? (
                          (contact.skills ?? []).map((skill) => (
                            <Badge
                              key={`${contact.id}-${skill}`}
                              variant="outline"
                              className="text-xs font-normal"
                            >
                              {skill}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground italic">No skills added</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                  {contacts && filteredContacts.length === 0 && (
                    <div className="text-sm text-muted-foreground py-4 text-center">
                      No contacts match the current filters.
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">2. Select Template</h2>
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
                <p className="text-xs text-muted-foreground">
                  Messages are dispatched in batches of 5 every 2 minutes, prioritising local and available contractors until the job is filled.
                </p>
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
