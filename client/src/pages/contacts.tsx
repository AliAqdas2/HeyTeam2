import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Phone, Mail, UserX, Upload, FileText, Pencil, X, Calendar, Award, Send, Filter, MapPin, MessageSquare, Crown, Shield, User as UserIcon, Trash2, CheckCircle, Briefcase, Clock, Download, Key, Copy, Smartphone, AlertCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertContactSchema, type InsertContact, type Contact } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { COUNTRIES } from "@/lib/constants";
import { format } from "date-fns";
import { JobLocationPicker } from "@/components/job-location-picker";

export default function Contacts() {
  const [searchQuery, setSearchQuery] = useState("");
  const [skillFilter, setSkillFilter] = useState<string>("");
  const [qualificationFilter, setQualificationFilter] = useState<string>("");
  const [locationFilter, setLocationFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isPhoneImportOpen, setIsPhoneImportOpen] = useState(false);
  const [isBulkSMSOpen, setIsBulkSMSOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [messageContent, setMessageContent] = useState("");
  const [contactMessageDialogOpen, setContactMessageDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [contactMessageContent, setContactMessageContent] = useState("");
  const [isDownloadingReport, setIsDownloadingReport] = useState(false);
  const [passwordReminderDialogOpen, setPasswordReminderDialogOpen] = useState(false);
  const [tempPassword, setTempPassword] = useState("");
  const [passwordReminderUsername, setPasswordReminderUsername] = useState("");
  const { toast } = useToast();

  const handleDownloadReport = async () => {
    try {
      setIsDownloadingReport(true);
      const response = await fetch('/api/reports/resource-allocation');
      if (!response.ok) {
        throw new Error('Failed to generate report');
      }
      
      // Get the PDF blob
      const blob = await response.blob();
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `resource-allocation-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Report downloaded",
        description: "Resource allocation report has been downloaded successfully.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to download report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDownloadingReport(false);
    }
  };

  const { data: contacts, isLoading } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  const { data: teamMembers, isLoading: membersLoading } = useQuery({
    queryKey: ["/api/organization/members"],
  });

  const { data: currentUser } = useQuery({
    queryKey: ["/api/auth/me"],
  });

  // Get unique skills and qualifications for filter dropdowns
  const allSkills = Array.from(new Set(contacts?.flatMap(c => c.skills || []) || []));
  const allQualifications = Array.from(new Set(contacts?.flatMap(c => c.qualifications || []) || []));

  const filteredContacts = contacts?.filter((contact) => {
    const fullName = `${contact.firstName} ${contact.lastName}`.toLowerCase();
    const query = searchQuery.toLowerCase();
    const nameMatch = fullName.includes(query) || contact.phone.includes(query) || contact.email?.includes(query);
    
    // Apply skill filter
    const skillMatch = !skillFilter || (contact.skills && contact.skills.includes(skillFilter));
    
    // Apply qualification filter
    const qualificationMatch = !qualificationFilter || (contact.qualifications && contact.qualifications.includes(qualificationFilter));
    
    // Apply location filter
    const locationMatch = !locationFilter || (contact.address && contact.address.toLowerCase().includes(locationFilter.toLowerCase()));
    
    // Apply status filter
    const statusMatch = !statusFilter || contact.status === statusFilter;
    
    return nameMatch && skillMatch && qualificationMatch && locationMatch && statusMatch;
  });

  // Password reminder mutation
  const passwordReminderMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("POST", `/api/organization/members/${userId}/password-reminder`, {});
      return res.json();
    },
    onSuccess: (data) => {
      setTempPassword(data.tempPassword);
      setPasswordReminderUsername(data.username);
      setPasswordReminderDialogOpen(true);
      toast({
        title: "Password reminder sent",
        description: `Temporary password generated for ${data.username}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send password reminder",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold" data-testid="text-page-title">Contacts</h1>
          <p className="text-muted-foreground mt-1">Manage your crew members and their details</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button 
            variant="outline" 
            className="gap-2" 
            onClick={handleDownloadReport}
            disabled={isDownloadingReport}
            data-testid="button-download-report"
          >
            <Download className="h-4 w-4" />
            {isDownloadingReport ? "Generating..." : "Download Report"}
          </Button>
          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2" data-testid="button-import-csv">
                <Upload className="h-4 w-4" />
                Import CSV
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <ImportCSV onSuccess={() => setIsImportDialogOpen(false)} />
            </DialogContent>
          </Dialog>
          <Dialog open={isPhoneImportOpen} onOpenChange={setIsPhoneImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2" data-testid="button-import-phone">
                <Smartphone className="h-4 w-4" />
                Import from Phone
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <ImportFromPhone onSuccess={() => setIsPhoneImportOpen(false)} />
            </DialogContent>
          </Dialog>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) setEditingContact(null);
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-add-contact">
                <Plus className="h-4 w-4" />
                Add Contact
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <ContactForm 
                contact={editingContact} 
                onSuccess={() => {
                  setIsDialogOpen(false);
                  setEditingContact(null);
                }} 
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Dialog open={isBulkSMSOpen} onOpenChange={setIsBulkSMSOpen}>
        <DialogContent className="max-w-lg">
          <BulkSMSForm 
            contacts={filteredContacts || []} 
            onSuccess={() => setIsBulkSMSOpen(false)} 
          />
        </DialogContent>
      </Dialog>

      <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Message {selectedMember?.username}</DialogTitle>
            <DialogDescription>
              Send a direct message to this team member
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                placeholder="Type your message here..."
                value={messageContent}
                onChange={(e) => setMessageContent(e.target.value)}
                rows={5}
                data-testid="input-message-content"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={async () => {
                try {
                  await apiRequest("POST", "/api/messages/team", {
                    recipientId: selectedMember?.id,
                    content: messageContent,
                  });
                  toast({ title: "Message sent successfully" });
                  setMessageDialogOpen(false);
                  setMessageContent("");
                } catch (error: any) {
                  toast({
                    title: "Failed to send message",
                    description: error.message,
                    variant: "destructive",
                  });
                }
              }}
              disabled={!messageContent.trim()}
              data-testid="button-send-message"
            >
              <Send className="h-4 w-4 mr-2" />
              Send Message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={contactMessageDialogOpen} onOpenChange={setContactMessageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Message {selectedContact?.firstName} {selectedContact?.lastName}</DialogTitle>
            <DialogDescription>
              Send an SMS message to this contact
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="contact-message">Message</Label>
              <Textarea
                id="contact-message"
                placeholder="Type your SMS message here..."
                value={contactMessageContent}
                onChange={(e) => setContactMessageContent(e.target.value)}
                rows={5}
                data-testid="input-contact-message-content"
              />
              <p className="text-xs text-muted-foreground">
                Message will be sent via SMS to {selectedContact?.phone}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setContactMessageDialogOpen(false);
                setContactMessageContent("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!selectedContact) return;
                
                try {
                  await apiRequest("POST", "/api/messages/bulk-sms", {
                    contactIds: [selectedContact.id],
                    message: contactMessageContent,
                  });
                  
                  // Close dialog and clear content first
                  setContactMessageDialogOpen(false);
                  setContactMessageContent("");
                  
                  // Show success toast after dialog closes
                  setTimeout(() => {
                    toast({ 
                      title: "Message sent successfully",
                      description: `SMS sent to ${selectedContact.firstName} ${selectedContact.lastName}` 
                    });
                  }, 150);
                } catch (error: any) {
                  // Parse error message from response
                  let errorMessage = error.message || "An error occurred";
                  try {
                    // Error format from apiRequest is "status: json"
                    const parts = errorMessage.split(": ");
                    if (parts.length > 1) {
                      const jsonPart = parts.slice(1).join(": ");
                      const parsed = JSON.parse(jsonPart);
                      errorMessage = parsed.message || errorMessage;
                    }
                  } catch {
                    // If parsing fails, use the original error message
                  }
                  
                  toast({
                    title: "Failed to send message",
                    description: errorMessage,
                    variant: "destructive",
                  });
                }
              }}
              disabled={!contactMessageContent.trim()}
              data-testid="button-send-contact-message"
            >
              <Send className="h-4 w-4 mr-2" />
              Send SMS
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={passwordReminderDialogOpen} onOpenChange={setPasswordReminderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Password Reminder Generated</DialogTitle>
            <DialogDescription>
              A temporary password has been generated for {passwordReminderUsername}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Temporary Password</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={tempPassword}
                  readOnly
                  className="font-mono text-lg"
                  data-testid="input-temp-password"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(tempPassword);
                    toast({ title: "Copied to clipboard" });
                  }}
                  data-testid="button-copy-password"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Share this password with the team member. They should change it after logging in.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setPasswordReminderDialogOpen(false);
                setTempPassword("");
                setPasswordReminderUsername("");
              }}
              data-testid="button-close-password-dialog"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="crew" className="space-y-4">
        <TabsList data-testid="tabs-contacts">
          <TabsTrigger value="crew" data-testid="tab-crew">Crew Contacts</TabsTrigger>
          <TabsTrigger value="team" data-testid="tab-team">Team Members</TabsTrigger>
        </TabsList>

        <TabsContent value="crew" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search contacts by name, phone, or email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                      data-testid="input-search-contacts"
                    />
                  </div>
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => setShowFilters(!showFilters)}
                    data-testid="button-toggle-filters"
                  >
                    <Filter className="h-4 w-4" />
                  </Button>
                  {filteredContacts && filteredContacts.length > 0 && (
                    <Button 
                      className="gap-2"
                      onClick={() => setIsBulkSMSOpen(true)}
                      data-testid="button-bulk-sms"
                    >
                      <Send className="h-4 w-4" />
                      Bulk SMS ({filteredContacts.length})
                    </Button>
                  )}
                </div>

            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Filter by Status</label>
                  <Select value={statusFilter || "all"} onValueChange={(value) => setStatusFilter(value === "all" ? "" : value)}>
                    <SelectTrigger data-testid="select-status-filter">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="on_job">On Job</SelectItem>
                      <SelectItem value="off_shift">Off Shift</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Filter by Skill</label>
                  <Select value={skillFilter || "all"} onValueChange={(value) => setSkillFilter(value === "all" ? "" : value)}>
                    <SelectTrigger data-testid="select-skill-filter">
                      <SelectValue placeholder="All skills" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All skills</SelectItem>
                      {allSkills.map((skill) => (
                        <SelectItem key={skill} value={skill}>{skill}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Filter by Qualification</label>
                  <Select value={qualificationFilter || "all"} onValueChange={(value) => setQualificationFilter(value === "all" ? "" : value)}>
                    <SelectTrigger data-testid="select-qualification-filter">
                      <SelectValue placeholder="All qualifications" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All qualifications</SelectItem>
                      {allQualifications.map((qual) => (
                        <SelectItem key={qual} value={qual}>{qual}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Filter by Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="City, State, etc..."
                      value={locationFilter}
                      onChange={(e) => setLocationFilter(e.target.value)}
                      className="pl-9"
                      data-testid="input-location-filter"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filteredContacts && filteredContacts.length > 0 ? (
            <div className="space-y-3">
              {filteredContacts.map((contact) => (
                <ContactCard 
                  key={contact.id} 
                  contact={contact} 
                  onEdit={() => {
                    setEditingContact(contact);
                    setIsDialogOpen(true);
                  }}
                  onMessage={() => {
                    setSelectedContact(contact);
                    setContactMessageDialogOpen(true);
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              {contacts && contacts.length === 0 ? (
                <>
                  <UserX className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No contacts yet</h3>
                  <p className="text-muted-foreground mb-6">Add your first crew member to get started</p>
                </>
              ) : (
                <p className="text-muted-foreground">No contacts match your search</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>

    <TabsContent value="team" className="space-y-4">
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Team Members</h2>
          <p className="text-sm text-muted-foreground">Message your team members directly</p>
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : teamMembers && teamMembers.length > 0 ? (
            <div className="space-y-3">
              {teamMembers.map((member: any) => (
                <Card key={member.id} className="hover-elevate" data-testid={`card-team-member-${member.id}`}>
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Avatar className="h-10 w-10 flex-shrink-0">
                          <AvatarFallback>
                            {member.username.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold truncate" data-testid={`text-member-name-${member.id}`}>
                              {member.username}
                            </span>
                            {member.id === currentUser?.id && (
                              <Badge variant="outline" className="text-xs flex-shrink-0">You</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm text-muted-foreground truncate" data-testid={`text-member-email-${member.id}`}>
                              {member.email}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
                        <Badge 
                          variant={member.teamRole === "owner" ? "default" : member.teamRole === "admin" ? "secondary" : "outline"}
                          className="gap-1"
                          data-testid={`badge-member-role-${member.id}`}
                        >
                          {member.teamRole === "owner" && <Crown className="h-3 w-3" />}
                          {member.teamRole === "admin" && <Shield className="h-3 w-3" />}
                          {member.teamRole === "member" && <UserIcon className="h-3 w-3" />}
                          {member.teamRole.charAt(0).toUpperCase() + member.teamRole.slice(1)}
                        </Badge>
                        {member.id !== currentUser?.id && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2"
                              onClick={() => {
                                setSelectedMember(member);
                                setMessageDialogOpen(true);
                              }}
                              data-testid={`button-message-${member.id}`}
                              aria-label="Send message"
                            >
                              <MessageSquare className="h-4 w-4" />
                              <span className="hidden sm:inline">Message</span>
                              <span className="sr-only sm:hidden">Message</span>
                            </Button>
                            {(currentUser?.teamRole === "owner" || currentUser?.teamRole === "admin") && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-2"
                                onClick={() => passwordReminderMutation.mutate(member.id)}
                                disabled={passwordReminderMutation.isPending}
                                data-testid={`button-password-reminder-${member.id}`}
                                aria-label="Send password reminder"
                              >
                                <Key className="h-4 w-4" />
                                <span className="hidden sm:inline">Password Reminder</span>
                                <span className="sr-only sm:hidden">Password Reminder</span>
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <UserX className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No team members</h3>
              <p className="text-muted-foreground">Your team will appear here</p>
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  </Tabs>
    </div>
  );
}

function ContactCard({ contact, onEdit, onMessage }: { contact: Contact; onEdit: () => void; onMessage: () => void }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Get status badge configuration
  const getStatusConfig = (status: string) => {
    switch (status) {
      case "free":
        return { 
          label: "Free", 
          variant: "default" as const, 
          icon: CheckCircle,
          className: "bg-green-600 hover:bg-green-700 text-white border-green-600"
        };
      case "on_job":
        return { 
          label: "On Job", 
          variant: "default" as const, 
          icon: Briefcase,
          className: "bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
        };
      case "off_shift":
        return { 
          label: "Off Shift", 
          variant: "secondary" as const, 
          icon: Clock,
          className: "bg-gray-600 dark:bg-gray-700 hover:bg-gray-700 dark:hover:bg-gray-800 text-white border-gray-600"
        };
      default:
        return { 
          label: "Free", 
          variant: "default" as const, 
          icon: CheckCircle,
          className: "bg-green-600 hover:bg-green-700 text-white border-green-600"
        };
    }
  };

  const statusConfig = getStatusConfig(contact.status || "free");
  const StatusIcon = statusConfig.icon;

  const navigateToJobMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/contacts/${contact.id}/current-job`);
      if (!response.ok) {
        throw new Error("No current job found");
      }
      return response.json();
    },
    onSuccess: (job) => {
      setLocation(`/jobs/${job.id}/schedule`);
    },
    onError: () => {
      toast({
        title: "No Job Found",
        description: "This contact is not currently assigned to any job",
        variant: "destructive",
      });
    },
  });

  const handleStatusClick = () => {
    if (contact.status === "on_job") {
      navigateToJobMutation.mutate();
    }
  };

  const toggleOptOutMutation = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", `/api/contacts/${contact.id}`, {
        isOptedOut: !contact.isOptedOut,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({
        title: contact.isOptedOut ? "Contact Opted In" : "Contact Opted Out",
        description: contact.isOptedOut
          ? "Contact will receive messages again"
          : "Contact will not receive future messages",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/contacts/${contact.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({
        title: "Contact Deleted",
        description: `${contact.firstName} ${contact.lastName} has been removed from your contacts`,
      });
      setDeleteDialogOpen(false);
      setDeleteConfirmText("");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete contact",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const country = COUNTRIES.find(c => c.code === contact.countryCode) || COUNTRIES[0];
  // Don't prepend dial code if phone already starts with + (legacy data)
  const fullPhone = contact.phone.startsWith('+') 
    ? contact.phone 
    : `${country.dialCode} ${contact.phone}`;

  return (
    <Card className="hover-elevate" data-testid={`card-contact-${contact.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <Avatar className="h-12 w-12">
              {contact.profilePicture && (
                <AvatarImage src={contact.profilePicture} alt={`${contact.firstName} ${contact.lastName}`} />
              )}
              <AvatarFallback>
                {contact.firstName[0]}{contact.lastName[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold" data-testid={`text-contact-name-${contact.id}`}>
                  {contact.firstName} {contact.lastName}
                </h3>
                <Badge 
                  variant={statusConfig.variant} 
                  className={`gap-1 font-medium ${statusConfig.className} ${contact.status === "on_job" ? "cursor-pointer" : ""}`}
                  onClick={handleStatusClick}
                  data-testid={`badge-contact-status-${contact.id}`}
                >
                  <StatusIcon className="h-3 w-3" />
                  {statusConfig.label}
                </Badge>
                {contact.isOptedOut && (
                  <Badge variant="secondary" className="text-xs">Opted Out</Badge>
                )}
                {contact.hasLogin && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <Key className="h-3 w-3" />
                    Can Login
                  </Badge>
                )}
              </div>
              <div className="space-y-1 mt-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  <span data-testid={`text-contact-phone-${contact.id}`}>{fullPhone}</span>
                </div>
                {contact.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    <span data-testid={`text-contact-email-${contact.id}`}>{contact.email}</span>
                  </div>
                )}
                {contact.address && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    <span data-testid={`text-contact-address-${contact.id}`}>{contact.address}</span>
                  </div>
                )}
              </div>
              {contact.skills && contact.skills.length > 0 && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  {contact.skills.map((skill) => (
                    <Badge key={skill} variant="outline" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                </div>
              )}
              {contact.qualifications && contact.qualifications.length > 0 && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {contact.qualifications.map((qual) => (
                    <Badge key={qual} variant="secondary" className="text-xs gap-1">
                      <Award className="h-3 w-3" />
                      {qual}
                    </Badge>
                  ))}
                </div>
              )}
              {contact.tags && contact.tags.length > 0 && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {contact.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
              {contact.blackoutPeriods && contact.blackoutPeriods.length > 0 && (
                <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{contact.blackoutPeriods.length} blackout period(s)</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 items-end sm:items-start">
            <Button
              variant="ghost"
              size="icon"
              onClick={onMessage}
              disabled={contact.isOptedOut}
              title={contact.isOptedOut ? "Contact has opted out of messages" : "Send message"}
              data-testid={`button-message-contact-${contact.id}`}
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onEdit}
              data-testid={`button-edit-contact-${contact.id}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDeleteDialogOpen(true)}
              title="Delete contact"
              data-testid={`button-delete-contact-${contact.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              variant={contact.isOptedOut ? "outline" : "ghost"}
              size="sm"
              onClick={() => toggleOptOutMutation.mutate()}
              data-testid={`button-toggle-opt-out-${contact.id}`}
            >
              {contact.isOptedOut ? "Opt In" : "Opt Out"}
            </Button>
          </div>
        </div>
      </CardContent>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Contact</DialogTitle>
            <DialogDescription>
              This action cannot be undone. To confirm deletion of {contact.firstName} {contact.lastName}, please type <strong>heyteam</strong> below.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="delete-confirm">Type "heyteam" to confirm</Label>
            <Input
              id="delete-confirm"
              placeholder="heyteam"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              data-testid={`input-delete-confirm-${contact.id}`}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeleteConfirmText("");
              }}
              data-testid={`button-cancel-delete-${contact.id}`}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteConfirmText !== "heyteam" || deleteMutation.isPending}
              aria-disabled={deleteConfirmText !== "heyteam" || deleteMutation.isPending}
              data-testid={`button-confirm-delete-${contact.id}`}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ContactForm({ contact, onSuccess }: { contact?: Contact | null; onSuccess: () => void }) {
  const { toast } = useToast();
  const isEdit = !!contact;

  const [skillInput, setSkillInput] = useState("");
  const [qualificationInput, setQualificationInput] = useState("");
  const [blackoutStart, setBlackoutStart] = useState("");
  const [blackoutEnd, setBlackoutEnd] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [hasLogin, setHasLogin] = useState(contact?.hasLogin || false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Sync hasLogin with form value when contact changes
  useEffect(() => {
    if (contact) {
      setHasLogin(contact.hasLogin || false);
    }
  }, [contact]);

  const form = useForm<InsertContact>({
    resolver: zodResolver(insertContactSchema),
    defaultValues: contact ? {
      firstName: contact.firstName,
      lastName: contact.lastName,
      countryCode: contact.countryCode || "GB",
      phone: contact.phone,
      email: contact.email || "",
      address: contact.address || "",
      profilePicture: contact.profilePicture || "",
      notes: contact.notes || "",
      skills: contact.skills || [],
      qualifications: contact.qualifications || [],
      blackoutPeriods: contact.blackoutPeriods || [],
      isOptedOut: contact.isOptedOut,
      quietHoursStart: contact.quietHoursStart || "22:00",
      quietHoursEnd: contact.quietHoursEnd || "07:00",
      tags: contact.tags || [],
      status: contact.status || "free",
      hasLogin: contact.hasLogin || false,
    } : {
      firstName: "",
      lastName: "",
      countryCode: "GB",
      phone: "",
      email: "",
      address: "",
      profilePicture: "",
      notes: "",
      skills: [],
      qualifications: [],
      blackoutPeriods: [],
      isOptedOut: false,
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
      tags: [],
      status: "free",
      hasLogin: false,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertContact) => {
      const res = await apiRequest("POST", "/api/contacts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({
        title: "Contact Added",
        description: "New contact has been added successfully",
      });
      form.reset();
      setHasLogin(false);
      setPassword("");
      setConfirmPassword("");
      onSuccess();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add contact",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InsertContact) => {
      const res = await apiRequest("PATCH", `/api/contacts/${contact?.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({
        title: "Contact Updated",
        description: "Contact has been updated successfully",
      });
      setPassword("");
      setConfirmPassword("");
      onSuccess();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update contact",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertContact) => {
    // Check if login is being newly enabled (wasn't enabled before)
    const wasLoginEnabled = contact?.hasLogin || false;
    const isEnablingLogin = hasLogin && !wasLoginEnabled;
    
    // Password is required only when:
    // 1. Creating new contact with login enabled
    // 2. Enabling login on existing contact (wasn't enabled before)
    // NOT required when updating existing contact that already has login (can leave blank)
    if (hasLogin && (isEnablingLogin || !isEdit)) {
      if (!password) {
        toast({
          title: "Password Required",
          description: "Please enter a password when enabling login",
          variant: "destructive",
        });
        return;
      }
    }

    // If password is provided, validate it
    if (password) {
      if (password !== confirmPassword) {
        toast({
          title: "Passwords Don't Match",
          description: "Please make sure both password fields match",
          variant: "destructive",
        });
        return;
      }
      if (password.length < 6) {
        toast({
          title: "Password Too Short",
          description: "Password must be at least 6 characters",
          variant: "destructive",
        });
        return;
      }
    }

    // Prepare form data with login fields
    const formData: any = {
      ...data,
      hasLogin: hasLogin,
    };

    // Only include password if provided
    // If hasLogin is true but no password provided when editing, don't include password field
    // (backend will keep the existing password)
    if (hasLogin && password) {
      formData.password = password;
    } else if (!hasLogin) {
      formData.password = null; // Remove password if login is disabled
    }

    if (isEdit) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please upload an image file",
        variant: "destructive",
      });
      return;
    }

    setUploadingImage(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/contacts/upload-image', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Upload failed');

      const data = await response.json();
      form.setValue('profilePicture', data.url);
      toast({
        title: "Image Uploaded",
        description: "Profile picture has been uploaded successfully",
      });
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "Failed to upload profile picture",
        variant: "destructive",
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const addSkill = () => {
    if (skillInput.trim()) {
      const currentSkills = form.getValues("skills") || [];
      if (!currentSkills.includes(skillInput.trim())) {
        form.setValue("skills", [...currentSkills, skillInput.trim()]);
      }
      setSkillInput("");
    }
  };

  const removeSkill = (skill: string) => {
    const currentSkills = form.getValues("skills") || [];
    form.setValue("skills", currentSkills.filter(s => s !== skill));
  };

  const addQualification = () => {
    if (qualificationInput.trim()) {
      const currentQuals = form.getValues("qualifications") || [];
      if (!currentQuals.includes(qualificationInput.trim())) {
        form.setValue("qualifications", [...currentQuals, qualificationInput.trim()]);
      }
      setQualificationInput("");
    }
  };

  const removeQualification = (qual: string) => {
    const currentQuals = form.getValues("qualifications") || [];
    form.setValue("qualifications", currentQuals.filter(q => q !== qual));
  };

  const addBlackoutPeriod = () => {
    if (blackoutStart && blackoutEnd) {
      const currentPeriods = form.getValues("blackoutPeriods") || [];
      // Format dates in UK format (DD/MM/YYYY)
      const startFormatted = format(new Date(blackoutStart), "dd/MM/yyyy");
      const endFormatted = format(new Date(blackoutEnd), "dd/MM/yyyy");
      const periodStr = `${startFormatted} to ${endFormatted}`;
      form.setValue("blackoutPeriods", [...currentPeriods, periodStr]);
      setBlackoutStart("");
      setBlackoutEnd("");
    }
  };

  const removeBlackoutPeriod = (period: string) => {
    const currentPeriods = form.getValues("blackoutPeriods") || [];
    form.setValue("blackoutPeriods", currentPeriods.filter(p => p !== period));
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit Contact" : "Add New Contact"}</DialogTitle>
        <DialogDescription>
          Fill out the contact’s details. You can search for the address, add skills, qualifications, and blackout periods.
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="profilePicture"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Profile Picture</FormLabel>
                <FormControl>
                  <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20">
                      {field.value && (
                        <AvatarImage src={field.value} alt="Profile" />
                      )}
                      <AvatarFallback>
                        <Upload className="h-8 w-8 text-muted-foreground" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={uploadingImage}
                        data-testid="input-profile-picture"
                      />
                      {uploadingImage && (
                        <p className="text-sm text-muted-foreground mt-1">Uploading...</p>
                      )}
                    </div>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John" {...field} data-testid="input-first-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Doe" {...field} data-testid="input-last-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="countryCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-country">
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {COUNTRIES.map((country) => (
                        <SelectItem key={country.code} value={country.code}>
                          {country.name} ({country.dialCode})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Mobile Number</FormLabel>
                  <FormControl>
                    <Input placeholder="555-123-4567" {...field} data-testid="input-phone" />
                  </FormControl>
                  <FormDescription>
                    {COUNTRIES.find(c => c.code === form.watch("countryCode"))?.dialCode} will be prefixed
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email {hasLogin ? "(Required)" : "(Optional)"}</FormLabel>
                <FormControl>
                  <Input 
                    type="email" 
                    placeholder="john@example.com" 
                    {...field} 
                    required={hasLogin}
                    data-testid="input-email" 
                  />
                </FormControl>
                <FormMessage />
                {hasLogin && (
                  <FormDescription>Email is required for login access</FormDescription>
                )}
              </FormItem>
            )}
          />

          {/* Enable Login Section */}
          <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="hasLogin"
                checked={hasLogin}
                onCheckedChange={(checked) => {
                  setHasLogin(checked as boolean);
                  form.setValue("hasLogin", checked as boolean);
                  if (!checked) {
                    setPassword("");
                    setConfirmPassword("");
                  }
                }}
                data-testid="checkbox-enable-login"
              />
              <Label
                htmlFor="hasLogin"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Enable Login for Contact
              </Label>
            </div>
            <FormDescription>
              Allow this contact to log in to view their jobs and schedule
            </FormDescription>

            {hasLogin && (
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="password">
                    {isEdit ? "New Password (leave blank to keep current)" : "Password"}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder={isEdit ? "Enter new password or leave blank" : "Enter password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required={!isEdit}
                    data-testid="input-password"
                  />
                  <FormDescription>
                    Password must be at least 6 characters
                  </FormDescription>
                </div>
                {(!isEdit || password) && (
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Confirm password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required={!isEdit || !!password}
                      data-testid="input-confirm-password"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address (Optional)</FormLabel>
                <FormControl>
                  <JobLocationPicker
                    value={field.value || ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    id="contact-address"
                    placeholder="Search or choose on map"
                    inputProps={{ "data-testid": "input-address" }}
                  />
                </FormControl>
                <FormDescription>Search for an address or pick a location on the map.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="on_job">On Job</SelectItem>
                    <SelectItem value="off_shift">Off Shift</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>Current work status of this contact</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="skills"
            render={() => (
              <FormItem>
                <FormLabel>Skills</FormLabel>
                <FormControl>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add a skill..."
                        value={skillInput}
                        onChange={(e) => setSkillInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addSkill();
                          }
                        }}
                        data-testid="input-skill"
                      />
                      <Button type="button" onClick={addSkill} variant="outline" data-testid="button-add-skill">
                        Add
                      </Button>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {form.watch("skills")?.map((skill) => (
                        <Badge key={skill} variant="outline" className="gap-1" data-testid={`badge-skill-${skill}`}>
                          {skill}
                          <X 
                            className="h-3 w-3 cursor-pointer hover-elevate" 
                            onClick={() => removeSkill(skill)}
                          />
                        </Badge>
                      ))}
                    </div>
                  </div>
                </FormControl>
                <FormDescription>Add skills like "Carpenter", "Electrician", etc.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="qualifications"
            render={() => (
              <FormItem>
                <FormLabel>Qualifications</FormLabel>
                <FormControl>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add a qualification..."
                        value={qualificationInput}
                        onChange={(e) => setQualificationInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addQualification();
                          }
                        }}
                        data-testid="input-qualification"
                      />
                      <Button type="button" onClick={addQualification} variant="outline" data-testid="button-add-qualification">
                        Add
                      </Button>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {form.watch("qualifications")?.map((qual) => (
                        <Badge key={qual} variant="secondary" className="gap-1" data-testid={`badge-qualification-${qual}`}>
                          <Award className="h-3 w-3" />
                          {qual}
                          <X 
                            className="h-3 w-3 cursor-pointer hover-elevate" 
                            onClick={() => removeQualification(qual)}
                          />
                        </Badge>
                      ))}
                    </div>
                  </div>
                </FormControl>
                <FormDescription>Add certifications like "First Aid", "Forklift License", etc.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="blackoutPeriods"
            render={() => (
              <FormItem>
                <FormLabel>Blackout Periods</FormLabel>
                <FormControl>
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input
                        type="date"
                        value={blackoutStart}
                        onChange={(e) => setBlackoutStart(e.target.value)}
                        data-testid="input-blackout-start"
                      />
                      <Input
                        type="date"
                        value={blackoutEnd}
                        onChange={(e) => setBlackoutEnd(e.target.value)}
                        data-testid="input-blackout-end"
                      />
                    </div>
                    <Button 
                      type="button" 
                      onClick={addBlackoutPeriod} 
                      variant="outline" 
                      size="sm"
                      disabled={!blackoutStart || !blackoutEnd}
                      data-testid="button-add-blackout"
                    >
                      Add Blackout Period
                    </Button>
                    <div className="space-y-1">
                      {form.watch("blackoutPeriods")?.map((period, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-md text-sm" data-testid={`blackout-period-${index}`}>
                          <span className="flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5" />
                            {period}
                          </span>
                          <X 
                            className="h-3.5 w-3.5 cursor-pointer hover-elevate" 
                            onClick={() => removeBlackoutPeriod(period)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </FormControl>
                <FormDescription>Contact won't receive notifications during these dates</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes (Optional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Any additional information..."
                    className="resize-none h-20"
                    {...field}
                    data-testid="input-notes"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <DialogFooter>
            <Button 
              type="submit" 
              disabled={createMutation.isPending || updateMutation.isPending} 
              data-testid="button-submit-contact"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <div className="animate-spin w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full mr-2" />
              )}
              {isEdit ? "Update Contact" : "Add Contact"}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );
}

function ImportCSV({ onSuccess }: { onSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [results, setResults] = useState<any>(null);
  const { toast } = useToast();

  const importMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/contacts/import", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to import contacts");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setResults(data);
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({
        title: "Import Complete",
        description: `Imported ${data.imported} contacts, skipped ${data.skipped}`,
      });
      if (data.imported > 0 && data.errors.length === 0) {
        setTimeout(onSuccess, 2000);
      }
    },
    onError: () => {
      toast({
        title: "Import Failed",
        description: "Failed to import contacts",
        variant: "destructive",
      });
    },
  });

  const handleImport = () => {
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    importMutation.mutate(formData);
  };

  const downloadTemplate = () => {
    // Create CSV template with headers and sample data
    const csvContent = `firstName,lastName,phone,email
John,Smith,447700900123,john.smith@example.com
Jane,Doe,447700900456,jane.doe@example.com
Mike,Johnson,447700900789,`;

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'contacts_import_template.csv');
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Template Downloaded",
      description: "CSV template has been downloaded. You can open it in Excel.",
    });
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Import Contacts from CSV</DialogTitle>
        <DialogDescription>
          Upload a CSV file that includes first name, last name, phone, and optional email columns to add multiple contacts at once.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              Upload a CSV file with columns: firstName, lastName, phone, email (optional)
            </p>
            <Button 
              variant="link" 
              size="sm" 
              onClick={downloadTemplate}
              className="gap-1"
              data-testid="button-download-template"
            >
              <Download className="h-4 w-4" />
              Download Template
            </Button>
          </div>
          <Input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            data-testid="input-csv-file"
          />
        </div>

        {results && (
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Imported:</span>
                <span className="text-sm text-green-600">{results.imported}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Skipped (duplicates):</span>
                <span className="text-sm text-yellow-600">{results.skipped}</span>
              </div>
              {results.errors.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-red-600 mb-2">Errors:</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {results.errors.map((error: any, index: number) => (
                      <p key={index} className="text-xs text-red-600">
                        Row {error.row}: {error.message}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
      <DialogFooter>
        <Button
          onClick={handleImport}
          disabled={!file || importMutation.isPending}
          data-testid="button-import-contacts"
        >
          {importMutation.isPending && (
            <div className="animate-spin w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full mr-2" />
          )}
          Import Contacts
        </Button>
      </DialogFooter>
    </>
  );
}

function ImportFromPhone({ onSuccess }: { onSuccess: () => void }) {
  const [results, setResults] = useState<any>(null);
  const [isImporting, setIsImporting] = useState(false);
  const { toast } = useToast();

  // Check if Contact Picker API is available
  const isSupported = 'contacts' in navigator && 'ContactsManager' in window;

  const parsePhoneNumber = (phoneNumber: string): string => {
    // Remove all non-digit characters except +
    let cleaned = phoneNumber.replace(/[^\d+]/g, '');
    
    // If it starts with 00, replace with +
    if (cleaned.startsWith('00')) {
      cleaned = '+' + cleaned.substring(2);
    }
    
    // If it doesn't start with +, assume UK and add +44
    if (!cleaned.startsWith('+')) {
      // Remove leading 0 if present for UK numbers
      if (cleaned.startsWith('0')) {
        cleaned = cleaned.substring(1);
      }
      cleaned = '+44' + cleaned;
    }
    
    // Fix common UK format: +44(0)... or +440... → +44...
    // This handles numbers like "+44 (0)20 1234 5678" which become "+44020..." after cleaning
    if (cleaned.startsWith('+440')) {
      cleaned = '+44' + cleaned.substring(4);
    }
    
    return cleaned;
  };

  const handleImport = async () => {
    if (!isSupported) {
      toast({
        title: "Not Supported",
        description: "Contact picker is not supported on this device",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsImporting(true);
      setResults(null);

      // Request contacts with name, email, and tel properties
      const props = ['name', 'email', 'tel'];
      const opts = { multiple: true };
      
      // @ts-ignore - Contact Picker API is not fully typed yet
      const selectedContacts = await navigator.contacts.select(props, opts);
      
      if (!selectedContacts || selectedContacts.length === 0) {
        toast({
          title: "No Contacts Selected",
          description: "Please select at least one contact to import",
        });
        setIsImporting(false);
        return;
      }

      // Parse contacts into the format expected by backend
      const parsedContacts = selectedContacts.flatMap((contact: any) => {
        const phones = contact.tel || [];
        const emails = contact.email || [];
        const names = contact.name || [];
        
        // Get the first name (or use a default)
        const fullName = names.length > 0 ? names[0] : 'Unknown';
        const nameParts = fullName.split(' ');
        const firstName = nameParts[0] || 'Unknown';
        const lastName = nameParts.slice(1).join(' ') || 'Unknown';
        
        // Create a contact for each phone number
        return phones.map((phone: string, index: number) => ({
          firstName: firstName,
          lastName: lastName + (phones.length > 1 ? ` (${index + 1})` : ''),
          phone: parsePhoneNumber(phone),
          email: emails.length > 0 ? emails[0] : undefined,
          countryCode: 'GB',
        }));
      });

      if (parsedContacts.length === 0) {
        toast({
          title: "No Valid Contacts",
          description: "Selected contacts don't have phone numbers",
          variant: "destructive",
        });
        setIsImporting(false);
        return;
      }

      // Send to backend
      const response = await apiRequest("POST", "/api/contacts/bulk", {
        contacts: parsedContacts,
      });

      const data = await response.json();
      setResults(data);
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      
      toast({
        title: "Import Complete",
        description: `Imported ${data.imported} contacts, skipped ${data.skipped}`,
      });

      if (data.imported > 0 && data.errors.length === 0) {
        setTimeout(onSuccess, 2000);
      }
    } catch (error: any) {
      console.error('Import error:', error);
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import contacts from phone",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Import Contacts from Phone</DialogTitle>
        <DialogDescription>
          Import contacts directly from your phone's contact list
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        {!isSupported ? (
          <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <div className="text-yellow-600 dark:text-yellow-400">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                    Not Supported
                  </h4>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    The Contact Picker API is not supported on this device or browser. This feature works best on:
                  </p>
                  <ul className="text-sm text-yellow-700 dark:text-yellow-300 list-disc list-inside mt-2 space-y-1">
                    <li>Chrome on Android (version 80+)</li>
                    <li>Edge on Android (version 80+)</li>
                  </ul>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-2">
                    Please use the "Import CSV" option on desktop browsers or unsupported devices.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <div className="text-primary">
                    <Smartphone className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium mb-1">How it works</h4>
                    <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                      <li>Click "Select Contacts" below</li>
                      <li>Choose contacts from your phone's contact list</li>
                      <li>Contacts will be imported with their phone numbers</li>
                      <li>Duplicate phone numbers will be skipped</li>
                    </ol>
                  </div>
                </div>
              </CardContent>
            </Card>

            {results && (
              <Card>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Imported:</span>
                    <span className="text-sm text-green-600">{results.imported}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Skipped (duplicates):</span>
                    <span className="text-sm text-yellow-600">{results.skipped}</span>
                  </div>
                  {results.errors.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-red-600 mb-2">Errors:</p>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {results.errors.map((error: string, index: number) => (
                          <p key={index} className="text-xs text-red-600">
                            {error}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
      <DialogFooter>
        <Button
          onClick={handleImport}
          disabled={!isSupported || isImporting}
          data-testid="button-select-phone-contacts"
        >
          {isImporting && (
            <div className="animate-spin w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full mr-2" />
          )}
          <Smartphone className="h-4 w-4 mr-2" />
          {isImporting ? "Importing..." : "Select Contacts"}
        </Button>
      </DialogFooter>
    </>
  );
}

function BulkSMSForm({ contacts, onSuccess }: { contacts: Contact[]; onSuccess: () => void }) {
  const [message, setMessage] = useState("");
  const { toast } = useToast();

  const sendMutation = useMutation({
    mutationFn: async () => {
      const contactIds = contacts.map(c => c.id);
      const res = await apiRequest("POST", "/api/messages/bulk-sms", {
        contactIds,
        message,
      });
      return res.json();
    },
    onSuccess: (data) => {
      // Close dialog first
      onSuccess();
      // Show success toast after dialog closes
      setTimeout(() => {
        toast({
          title: "Messages Sent Successfully",
          description: `Successfully sent SMS to ${data.sent} contact(s)`,
        });
      }, 150);
    },
    onError: (error: any) => {
      let errorMessage = "Failed to send bulk SMS";
      try {
        const parts = error.message?.split(": ");
        if (parts && parts.length > 1) {
          const jsonPart = parts.slice(1).join(": ");
          const parsed = JSON.parse(jsonPart);
          errorMessage = parsed.message || errorMessage;
        }
      } catch {
        // Use default error message
      }
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleSend = () => {
    if (!message.trim()) {
      toast({
        title: "Message Required",
        description: "Please enter a message to send",
        variant: "destructive",
      });
      return;
    }
    sendMutation.mutate();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Send Bulk SMS</DialogTitle>
        <DialogDescription>
          Send a message to {contacts.length} selected contact{contacts.length !== 1 ? 's' : ''}.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium block mb-2">Recipients</label>
          <div className="max-h-32 overflow-y-auto border rounded-md p-3 space-y-1">
            {contacts.map((contact) => (
              <div key={contact.id} className="text-sm">
                {contact.firstName} {contact.lastName}
              </div>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium block mb-2">Message</label>
          <Textarea
            placeholder="Type your message here..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="resize-none h-32"
            data-testid="input-bulk-message"
          />
          <p className="text-xs text-muted-foreground mt-1">
            {message.length} characters
          </p>
        </div>
      </div>
      <DialogFooter>
        <Button
          onClick={handleSend}
          disabled={!message.trim() || sendMutation.isPending}
          data-testid="button-send-bulk-sms"
        >
          {sendMutation.isPending && (
            <div className="animate-spin w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full mr-2" />
          )}
          <Send className="h-4 w-4 mr-2" />
          Send to {contacts.length} Contact{contacts.length !== 1 ? 's' : ''}
        </Button>
      </DialogFooter>
    </>
  );
}
