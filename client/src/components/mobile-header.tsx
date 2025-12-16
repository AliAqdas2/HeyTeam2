import { Link, useLocation } from "wouter";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { useQuery } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
import { getUserQueryFn } from "@/lib/userIdStorage";

export function MobileHeader() {
  const [location] = useLocation();
  const isMobileLayout = Capacitor.isNativePlatform();
  
  // Only show on mobile
  if (!isMobileLayout) {
    return null;
  }

  const { data: user } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: getUserQueryFn, // Use mobile queryFn
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const getUserInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    if (user?.username) {
      return user.username.substring(0, 2).toUpperCase();
    }
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return "U";
  };

  // Get page title based on current route
  const getPageTitle = () => {
    if (location === "/jobs") return "Jobs";
    if (location === "/calendar") return "Calendar";
    if (location === "/contacts") return "Contacts";
    if (location === "/templates") return "Templates";
    if (location === "/billing") return "Billing";
    if (location === "/messages") return "Messages";
    if (location === "/profile") return "Profile";
    if (location === "/team") return "Settings";
    if (location.startsWith("/jobs/")) return "Job";
    return "HeyTeam";
  };

  return (
    <header className="mobile-header-fixed">
      <div className="flex items-center justify-between px-4" style={{ height: "3.5rem" }}>
        {/* Page Title */}
        <div className="flex items-center flex-1 min-w-0">
          <h1 className="text-2xl font-semibold truncate">
            {getPageTitle()}
          </h1>
        </div>

        {/* Profile Avatar - Links to Settings */}
        <Link href="/team">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full p-0"
          >
            <Avatar className="h-10 w-10">
              <AvatarFallback className="text-sm bg-primary text-primary-foreground">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
          </Button>
        </Link>
      </div>
    </header>
  );
}

