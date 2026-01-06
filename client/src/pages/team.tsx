import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Crown, Shield, User as UserIcon, Trash2, Pencil } from "lucide-react";
import { useState } from "react";

export default function TeamPage() {
  const { toast } = useToast();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteData, setInviteData] = useState({ firstName: "", lastName: "", email: "", teamRole: "member" });
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<any>(null);
  const [editData, setEditData] = useState({ firstName: "", lastName: "", email: "" });

  const { data: user } = useQuery({
    queryKey: ["/api/auth/me"],
  });

  const { data: organization } = useQuery({
    queryKey: ["/api/organization"],
    enabled: !!user,
  });

  const { data: members, isLoading } = useQuery({
    queryKey: ["/api/organization/members"],
    enabled: !!user,
  });

  const inviteMutation = useMutation({
    mutationFn: async (data: { firstName: string; lastName: string; email: string; teamRole: string }) => {
      return await apiRequest("POST", "/api/organization/invite", data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/organization/members"] });
      setInviteDialogOpen(false);
      setInviteData({ firstName: "", lastName: "", email: "", teamRole: "member" });
      toast({
        title: "Team member invited",
        description: `An invitation email with login credentials has been sent to ${inviteData.email}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to invite member",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, teamRole }: { userId: string; teamRole: string }) => {
      return await apiRequest("PATCH", `/api/organization/members/${userId}/role`, { teamRole });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organization/members"] });
      toast({ title: "Team role updated" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update role",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest("DELETE", `/api/organization/members/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organization/members"] });
      toast({ title: "Team member removed" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to remove member",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMemberMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: { firstName: string; lastName: string; email: string } }) => {
      return await apiRequest("PATCH", `/api/organization/members/${userId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organization/members"] });
      setEditDialogOpen(false);
      setEditingMember(null);
      toast({ title: "Team member updated" });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update member",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "owner":
        return <Crown className="h-4 w-4 text-primary" />;
      case "admin":
        return <Shield className="h-4 w-4 text-primary" />;
      default:
        return <UserIcon className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getRoleBadge = (role: string) => {
    const variant = role === "owner" ? "default" : role === "admin" ? "secondary" : "outline";
    return (
      <Badge variant={variant} className="gap-1" data-testid={`badge-role-${role}`}>
        {getRoleIcon(role)}
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Team Management</h1>
          <p className="text-muted-foreground mt-1" data-testid="text-organization-name">
            {organization?.name}
          </p>
        </div>
        {(user?.teamRole === "admin" || user?.teamRole === "owner") && (
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-invite-member">
                <UserPlus className="h-4 w-4" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="dialog-invite-member">
              <DialogHeader>
                <DialogTitle>Invite Team Member</DialogTitle>
                <DialogDescription>
                  Add a new member to your team. They'll receive login credentials.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      data-testid="input-first-name"
                      value={inviteData.firstName}
                      onChange={(e) => setInviteData({ ...inviteData, firstName: e.target.value })}
                      placeholder="John"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      data-testid="input-last-name"
                      value={inviteData.lastName}
                      onChange={(e) => setInviteData({ ...inviteData, lastName: e.target.value })}
                      placeholder="Doe"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    data-testid="input-email"
                    value={inviteData.email}
                    onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                    placeholder="john@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={inviteData.teamRole}
                    onValueChange={(value) => setInviteData({ ...inviteData, teamRole: value })}
                  >
                    <SelectTrigger id="role" data-testid="select-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      {user?.teamRole === "owner" && <SelectItem value="owner">Owner</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => inviteMutation.mutate(inviteData)}
                  disabled={inviteMutation.isPending || !inviteData.firstName || !inviteData.lastName || !inviteData.email}
                  data-testid="button-send-invite"
                >
                  {inviteMutation.isPending ? "Inviting..." : "Send Invite"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            Manage your team members and their roles
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-loading">
              Loading team members...
            </div>
          ) : (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="inline-block min-w-full align-middle">
                <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members?.map((member: any) => (
                  <TableRow key={member.id} data-testid={`row-member-${member.id}`}>
                    <TableCell className="font-medium" data-testid={`text-name-${member.id}`}>
                      {member.firstName && member.lastName ? `${member.firstName} ${member.lastName}` : member.username}
                      {member.id === user?.id && (
                        <Badge variant="outline" className="ml-2">You</Badge>
                      )}
                    </TableCell>
                    <TableCell data-testid={`text-email-${member.id}`}>{member.email}</TableCell>
                    <TableCell>
                      {(user?.teamRole === "admin" || user?.teamRole === "owner") && member.id !== user?.id ? (
                        <Select
                          value={member.teamRole}
                          onValueChange={(value) => updateRoleMutation.mutate({ userId: member.id, teamRole: value })}
                          disabled={member.teamRole === "owner" && user?.teamRole !== "owner"}
                        >
                          <SelectTrigger className="w-36" data-testid={`select-role-${member.id}`}>
                            <div className="flex items-center gap-2">
                              {getRoleIcon(member.teamRole)}
                              <span>{member.teamRole.charAt(0).toUpperCase() + member.teamRole.slice(1)}</span>
                            </div>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">
                              <div className="flex items-center gap-2">
                                <UserIcon className="h-4 w-4" />
                                Member
                              </div>
                            </SelectItem>
                            <SelectItem value="admin">
                              <div className="flex items-center gap-2">
                                <Shield className="h-4 w-4" />
                                Admin
                              </div>
                            </SelectItem>
                            {user?.teamRole === "owner" && (
                              <SelectItem value="owner">
                                <div className="flex items-center gap-2">
                                  <Crown className="h-4 w-4" />
                                  Owner
                                </div>
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      ) : (
                        getRoleBadge(member.teamRole)
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {(user?.teamRole === "admin" || user?.teamRole === "owner") && member.id !== user?.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingMember(member);
                              setEditData({ 
                                firstName: member.firstName || "", 
                                lastName: member.lastName || "", 
                                email: member.email 
                              });
                              setEditDialogOpen(true);
                            }}
                            data-testid={`button-edit-${member.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {(user?.teamRole === "admin" || user?.teamRole === "owner") &&
                          member.id !== user?.id &&
                          member.teamRole !== "owner" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                if (confirm(`Remove ${member.username} from the team?`)) {
                                  removeMemberMutation.mutate(member.id);
                                }
                              }}
                              data-testid={`button-remove-${member.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent data-testid="dialog-edit-member">
          <DialogHeader>
            <DialogTitle>Edit Team Member</DialogTitle>
            <DialogDescription>
              Update the name or email for this team member
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-firstName">First Name</Label>
                <Input
                  id="edit-firstName"
                  data-testid="input-edit-first-name"
                  value={editData.firstName}
                  onChange={(e) => setEditData({ ...editData, firstName: e.target.value })}
                  placeholder="John"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-lastName">Last Name</Label>
                <Input
                  id="edit-lastName"
                  data-testid="input-edit-last-name"
                  value={editData.lastName}
                  onChange={(e) => setEditData({ ...editData, lastName: e.target.value })}
                  placeholder="Doe"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                data-testid="input-edit-email"
                value={editData.email}
                onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                placeholder="john@example.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setEditingMember(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => updateMemberMutation.mutate({ userId: editingMember?.id, data: editData })}
              disabled={updateMemberMutation.isPending || !editData.firstName || !editData.lastName || !editData.email}
              data-testid="button-save-member"
            >
              {updateMemberMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
