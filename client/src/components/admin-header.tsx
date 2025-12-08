import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type AdminHeaderProps = {
  admin: {
    id: string;
    name: string | null;
    email: string;
  };
};

export function AdminHeader({ admin }: AdminHeaderProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/auth/logout", {});
    },
    onSuccess: () => {
      queryClient.removeQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("/api/admin");
        },
      });
      toast({ title: "Logged out" });
      setLocation("/admin/login");
    },
  });

  const displayName = admin.name?.trim() || admin.email;

  return (
    <header className="border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-6 py-4">
        <div className="flex flex-col">
          <span className="text-lg font-semibold tracking-tight">HeyTeam Admin</span>
          <span className="text-xs text-muted-foreground">Signed in as {displayName}</span>
        </div>

        <nav className="flex items-center gap-4">
          <Link href="/admin/dashboard">
            <a className="text-sm font-medium text-muted-foreground transition hover:text-foreground" data-testid="admin-nav-dashboard">
              Dashboard
            </a>
          </Link>
          <Link href="/admin/change-password">
            <a className="text-sm font-medium text-muted-foreground transition hover:text-foreground" data-testid="admin-nav-change-password">
              Change Password
            </a>
          </Link>
          <Separator orientation="vertical" className="h-6" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            data-testid="admin-nav-logout"
          >
            {logoutMutation.isPending ? "Signing out..." : "Logout"}
          </Button>
        </nav>
      </div>
    </header>
  );
}
