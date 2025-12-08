import { Link, useLocation } from "wouter";
import { Home, Briefcase, Bell, MessageSquare, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { getContactQueryFn } from "@/lib/contactApiClient";

const tabs = [
  { path: "/contact/dashboard", label: "Dashboard", icon: Home },
  { path: "/contact/jobs", label: "Jobs", icon: Briefcase },
  { path: "/contact/invitations", label: "Invitations", icon: Bell },
  { path: "/contact/messages", label: "Messages", icon: MessageSquare },
  { path: "/contact/schedule", label: "Schedule", icon: Calendar },
];

export function ContactTabBar() {
  const [location] = useLocation();
  
  // Get invitation count for badge
  const { data: invitationsData } = useQuery<{ invitations: any[] }>({
    queryKey: ["/api/contact/invitations"],
    queryFn: getContactQueryFn,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
  
  const invitationCount = invitationsData?.invitations?.length || 0;

  return (
    <nav
      className={cn("ios-tap")}
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        width: "100%",
        zIndex: 9999,
        paddingTop: "10px",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        backgroundColor: "hsl(var(--background) / 0.95)",
        borderTop: "1px solid hsl(var(--border))",
        boxShadow: "0 -2px 10px rgba(0, 0, 0, 0.05)",
      }}
    >
      <div className="flex items-center justify-around h-8">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = location === tab.path || location.startsWith(tab.path + "/");
          const showBadge = tab.path === "/contact/invitations" && invitationCount > 0;
          
          return (
            <Link
              key={tab.path}
              href={tab.path}
              className={cn(
                "flex flex-col items-center justify-center",
                "flex-1 h-full",
                "transition-colors duration-200",
                "active:bg-accent/50",
                "min-w-0",
                "ios-tap ios-no-select",
                "relative"
              )}
            >
              <div className="relative flex flex-col items-center justify-center">
                <Icon
                  className={cn(
                    "h-5 w-5 transition-colors duration-200",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground"
                  )}
                />
                {showBadge && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] text-destructive-foreground flex items-center justify-center font-bold">
                    {invitationCount > 9 ? "9+" : invitationCount}
                  </span>
                )}
                <span
                  className={cn(
                    "text-[10px] font-medium transition-colors duration-200",
                    "leading-tight mt-0.5",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  {tab.label}
                </span>
                {isActive && (
                  <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

