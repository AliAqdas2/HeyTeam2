import { Link, useLocation } from "wouter";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { useQuery } from "@tanstack/react-query";
import { getContactQueryFn } from "@/lib/contactApiClient";
import { Capacitor } from "@capacitor/core";
import logoImage from "@assets/heyteam 1_1760877824955.png";

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
    <header 
      className="fixed left-0 right-0 z-50 border-b bg-card flex items-center px-2"
      style={{
        top: 0,
        height: "calc(2rem + env(safe-area-inset-top, 0px))",
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}
    >
      <div className="flex items-center justify-between w-full h-8">
        {/* Logo/Title */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Link href="/contact/dashboard">
            <img 
              src={logoImage} 
              alt="HeyTeam" 
              className="h-5 w-auto"
            />
          </Link>
          <h1 className="text-base font-semibold truncate ml-2">
            {getPageTitle()}
          </h1>
        </div>

        {/* Profile Avatar - Links to Settings */}
        <Link href="/contact/settings">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full p-0"
          >
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                {getContactInitials()}
              </AvatarFallback>
            </Avatar>
          </Button>
        </Link>
      </div>
    </header>
  );
}

