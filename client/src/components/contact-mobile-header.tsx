import { Link, useLocation } from "wouter";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { useQuery } from "@tanstack/react-query";
import { getContactQueryFn } from "@/lib/contactApiClient";
import { Capacitor } from "@capacitor/core";

export function ContactMobileHeader() {
  const [location] = useLocation();
  const isMobileLayout = Capacitor.isNativePlatform();
  
  // Only show on mobile
  if (!isMobileLayout) {
    return null;
  }

  const { data: contact } = useQuery({
    queryKey: ["/api/mobile/auth/me"],
    queryFn: getContactQueryFn,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const getContactInitials = () => {
    if (contact?.firstName && contact?.lastName) {
      return `${contact.firstName[0]}${contact.lastName[0]}`.toUpperCase();
    }
    if (contact?.email) {
      return contact.email.substring(0, 2).toUpperCase();
    }
    return "C";
  };

  // Get page title based on current route
  const getPageTitle = () => {
    if (location === "/contact/dashboard") return "Dashboard";
    if (location === "/contact/jobs") return "My Jobs";
    if (location === "/contact/invitations") return "Invitations";
    if (location === "/contact/messages") return "Messages";
    if (location === "/contact/schedule") return "Schedule";
    if (location === "/contact/settings") return "Settings";
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
        <Link href="/contact/settings">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full p-0"
          >
            <Avatar className="h-10 w-10">
              <AvatarFallback className="text-sm bg-primary text-primary-foreground">
                {getContactInitials()}
              </AvatarFallback>
            </Avatar>
          </Button>
        </Link>
      </div>
    </header>
  );
}

