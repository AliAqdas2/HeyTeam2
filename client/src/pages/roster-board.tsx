import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Phone, Mail, MessageSquare, Download, Calendar } from "lucide-react";
import { format } from "date-fns";
import type { Job, Contact, Availability, Message, JobSkillRequirement } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AvailabilityWithContact = Availability & { contact: Contact };
type JobWithDetails = Job & {
  availability: AvailabilityWithContact[];
  skillRequirements?: JobSkillRequirement[];
};

const statusColumns = [
  { id: "confirmed", label: "Confirmed", variant: "default" as const },
  { id: "maybe", label: "Maybe", variant: "secondary" as const },
  { id: "declined", label: "Declined", variant: "secondary" as const },
  { id: "no_reply", label: "No Reply", variant: "secondary" as const },
];

function DropZone({
  columnId,
  label,
  variant,
  availability,
  onSelect,
  onDrop,
}: {
  columnId: string;
  label: string;
  variant: "default" | "secondary";
  availability: AvailabilityWithContact[];
  onSelect: (contact: Contact) => void;
  onDrop: (availabilityId: string, targetStatus: string) => void;
}) {
  const [isOver, setIsOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const currentStatus = e.dataTransfer.getData("currentStatus");
    if (currentStatus !== columnId) {
      setIsOver(true);
    }
  };

  const handleDragLeave = () => {
    setIsOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(false);
    const availabilityId = e.dataTransfer.getData("availabilityId");
    const currentStatus = e.dataTransfer.getData("currentStatus");
    if (availabilityId && currentStatus !== columnId) {
      onDrop(availabilityId, columnId);
    }
  };

  return (
    <Card
      className={`${isOver ? "ring-2 ring-primary" : ""}`}
      data-testid={`column-${columnId}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{label}</h3>
          <Badge variant={variant} data-testid={`badge-count-${columnId}`}>
            {availability.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {availability.length === 0 ? (
          <div className={`text-center py-8 text-sm text-muted-foreground border-2 border-dashed rounded-lg ${isOver ? "border-primary bg-primary/5" : ""}`}>
            {isOver ? "Drop here" : "No contacts"}
          </div>
        ) : (
          availability.map((avail) => (
            <ContactCard
              key={avail.id}
              availability={avail}
              onSelect={() => onSelect(avail.contact)}
              onStatusChange={(newStatus) => onDrop(avail.id, newStatus)}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

const normalizeSkill = (value: string | null | undefined) => value?.trim().toLowerCase() ?? "";

export default function RosterBoard() {
  const [, params] = useRoute("/jobs/:id/schedule");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const { toast } = useToast();

  const { data: job, isLoading } = useQuery<JobWithDetails>({
    queryKey: ["/api/jobs", params?.id, "roster"],
    // Auto-refresh the schedule view so changes and new replies appear without manual reloads
    refetchInterval: 5000,
  });

  const { data: messages } = useQuery<Message[]>({
    queryKey: ["/api/messages", selectedContact?.id],
    enabled: !!selectedContact,
  });

  const updateAvailabilityMutation = useMutation({
    mutationFn: ({ availabilityId, status }: { availabilityId: string; status: string }) =>
      apiRequest("PATCH", `/api/availability/${availabilityId}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", params?.id, "roster"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({
        title: "Status Updated",
        description: "Contact availability status has been updated",
      });
    },
  });

  const jobSkillRequirements: JobSkillRequirement[] = (job?.skillRequirements ?? []).filter(
    (requirement) => Boolean(normalizeSkill(requirement.skill)) && (requirement.headcount ?? 0) > 0,
  );

  const confirmedAvailability = useMemo<AvailabilityWithContact[]>(
    () => job?.availability.filter((record) => record.status === "confirmed") ?? [],
    [job?.availability],
  );

  type SkillRequirementStat = {
    key: string;
    label: string;
    required: number;
    confirmed: number;
    remaining: number;
    notes: string;
  };

  const skillRequirementStats = useMemo<SkillRequirementStat[]>(() => {
    if (!jobSkillRequirements.length) return [];

    return jobSkillRequirements.map((requirement) => {
      const key = normalizeSkill(requirement.skill);
      const required = requirement.headcount ?? 0;
      const confirmed = key
        ? confirmedAvailability.reduce((count, availabilityRecord) => {
            const contact = availabilityRecord.contact;
            if (!contact) return count;
            const contactSkills = (contact.skills ?? []).map(normalizeSkill);
            return contactSkills.includes(key) ? count + 1 : count;
          }, 0)
        : 0;

      return {
        key,
        label: requirement.skill?.trim() || "Skill",
        required,
        confirmed,
        remaining: Math.max(required - confirmed, 0),
        notes: requirement.notes ?? "",
      };
    });
  }, [jobSkillRequirements, confirmedAvailability]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading" />
      </div>
    );
  }

  if (!job) {
    return <div>Job not found</div>;
  }

  const groupedAvailability = statusColumns.reduce((acc, column) => {
    acc[column.id] = job.availability.filter(a => a.status === column.id);
    return acc;
  }, {} as Record<string, AvailabilityWithContact[]>);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/">
          <a data-testid="link-back-dashboard">
            <Button variant="ghost" size="sm" className="gap-2 mb-4">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </a>
        </Link>
        <h1 className="text-3xl font-semibold" data-testid="text-job-name">{job.name}</h1>
        <p className="text-muted-foreground mt-1">
          {format(new Date(job.startTime), "MMMM d, yyyy 'at' h:mm a")} - {job.location}
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Link href={`/jobs/${job.id}/send`}>
          <a data-testid="link-send-message">
            <Button className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Send Message
            </Button>
          </a>
        </Link>
        <Link href={`/jobs/${job.id}/edit`}>
          <a data-testid="link-edit-job">
            <Button variant="outline">Edit Job</Button>
          </a>
        </Link>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => exportToCSV(job, groupedAvailability.confirmed || [])}
          data-testid="button-export-csv"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => downloadCalendarInvite(job.id)}
          data-testid="button-download-calendar"
        >
          <Calendar className="h-4 w-4" />
          Calendar Invite
        </Button>
      </div>

      {skillRequirementStats.length > 0 && (
        <Card>
          <CardHeader>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Skill Requirements</h2>
              <p className="text-sm text-muted-foreground">
                Coverage based on confirmed crew members
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2" data-testid="skill-requirement-summary">
              {skillRequirementStats.map((stat, index) => (
                <div
                  key={`${stat.key}-${index}`}
                  className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-sm"
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
                      {stat.confirmed}/{stat.required}
                    </span>
                    <div className="text-xs text-muted-foreground">
                      {stat.remaining > 0 ? `${stat.remaining} more needed` : "Requirement met"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statusColumns.map((column) => (
          <DropZone
            key={column.id}
            columnId={column.id}
            label={column.label}
            variant={column.variant}
            availability={groupedAvailability[column.id] || []}
            onSelect={setSelectedContact}
            onDrop={(availabilityId: string, targetStatus: string) => {
              updateAvailabilityMutation.mutate({
                availabilityId,
                status: targetStatus,
              });
            }}
          />
        ))}
      </div>

      <Sheet open={!!selectedContact} onOpenChange={(open) => !open && setSelectedContact(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedContact && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>
                      {selectedContact.firstName[0]}{selectedContact.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div data-testid="text-contact-name">
                      {selectedContact.firstName} {selectedContact.lastName}
                    </div>
                    <div className="text-sm font-normal text-muted-foreground">Contact Details</div>
                  </div>
                </SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span data-testid="text-contact-phone">{selectedContact.phone}</span>
                  </div>
                  {selectedContact.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span data-testid="text-contact-email">{selectedContact.email}</span>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Message Thread</h3>
                  {messages && messages.length > 0 ? (
                    <div className="space-y-3">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={`p-3 rounded-lg ${
                            message.direction === "outbound"
                              ? "bg-primary/10 ml-8"
                              : "bg-card mr-8"
                          }`}
                          data-testid={`message-${message.id}`}
                        >
                          <p className="text-sm">{message.content}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(message.createdAt), "MMM d, h:mm a")}
                            </span>
                            {message.direction === "outbound" && (
                              <Badge variant="secondary" className="text-xs">{message.status}</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-sm text-muted-foreground border-2 border-dashed rounded-lg">
                      No messages yet
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function exportToCSV(job: JobWithDetails, confirmedAvailability: AvailabilityWithContact[]) {
  const escapeCSV = (str: string) => `"${str.replace(/"/g, '""')}"`;
  
  const headers = ["First Name", "Last Name", "Phone", "Email", "Shift Preference", "Status"];
  const rows = confirmedAvailability.map((avail) => [
    avail.contact.firstName,
    avail.contact.lastName,
    avail.contact.phone,
    avail.contact.email || "",
    avail.shiftPreference || "",
    avail.status,
  ]);

  const csvContent = [
    headers.map(escapeCSV).join(","),
    ...rows.map((row) => row.map(escapeCSV).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${job.name.replace(/\s+/g, "_")}_roster_${format(new Date(), "yyyy-MM-dd")}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

function downloadCalendarInvite(jobId: string) {
  const link = document.createElement("a");
  link.href = `/api/jobs/${jobId}/calendar-invite`;
  link.download = "";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function ContactCard({
  availability,
  onSelect,
  onStatusChange,
}: {
  availability: AvailabilityWithContact;
  onSelect: () => void;
  onStatusChange: (status: string) => void;
}) {
  const { contact } = availability;
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("availabilityId", availability.id);
    e.dataTransfer.setData("currentStatus", availability.status);
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  return (
    <Card
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`hover-elevate cursor-move ${isDragging ? "opacity-50" : ""}`}
      onClick={onSelect}
      data-testid={`card-contact-${contact.id}`}
    >
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="text-xs">
              {contact.firstName[0]}{contact.lastName[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate">
              {contact.firstName} {contact.lastName}
            </div>
            <div className="text-xs text-muted-foreground truncate">{contact.phone}</div>
          </div>
        </div>
        {availability.shiftPreference && (
          <Badge variant="secondary" className="mt-2 text-xs">
            {availability.shiftPreference}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
