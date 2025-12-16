import { Link, useLocation } from "wouter";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Calendar, Briefcase, MessageSquare, LogOut, Menu, ChevronDown, User, Bell } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { contactApiRequest, getContactQueryFn, removeContactId } from "@/lib/contactApiClient";
import { removeUserId } from "@/lib/userIdStorage";
import { removeDeviceToken } from "@/lib/push-notifications";
import { useToast } from "@/hooks/use-toast";
import logoImage from "@assets/heyteam 1_1760877824955.png";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { cn } from "@/lib/utils";

const contactNavItems = [
  { path: "/contact/dashboard", label: "Dashboard", icon: Briefcase },
  { path: "/contact/jobs", label: "My Jobs", icon: Briefcase },
  { path: "/contact/invitations", label: "Invitations", icon: Bell },
  { path: "/contact/messages", label: "Messages", icon: MessageSquare },
  { path: "/contact/schedule", label: "Schedule", icon: Calendar },
];

export function ContactHeader() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobileLayout = Capacitor.isNativePlatform();
  
  // On mobile, return null - ContactMobileHeader will be used instead
  if (isMobileLayout) {
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

  const logoutMutation = useMutation({
    mutationFn: async () => {
      // For mobile apps, just clear local storage - no API call needed
      removeContactId();
      removeUserId();
      await removeDeviceToken();
      return Promise.resolve();
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/mobile/auth/me"], null);
      queryClient.clear();
      toast({ title: "Logged out successfully" });
      setTimeout(() => {
        setLocation("/auth");
      }, 100);
    },
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

  const getContactDisplayName = () => {
    if (contact?.firstName && contact?.lastName) {
      return `${contact.firstName} ${contact.lastName}`;
    }
    return contact?.email || "Contact";
  };

  return (
    <header className="sticky top-0 z-50 border-b bg-card">
      <div className="mx-auto max-w-screen-2xl px-3 sm:px-6 py-2 sm:py-3">
        <div className="flex items-center justify-between gap-2 sm:gap-6">
          <div className="flex items-center gap-3 sm:gap-8">
            <Link href="/contact/dashboard">
              <div className="flex items-center gap-2 sm:gap-3 hover-elevate px-1 sm:px-2 py-1 rounded-md cursor-pointer">
                <img src={logoImage} alt="HeyTeam" className="w-20 sm:w-28" />
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {contactNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.path;
                return (
                  <Link key={item.path} href={item.path}>
                    <Button
                      variant="ghost"
                      className={`gap-2 ${isActive ? "bg-accent" : ""}`}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Button>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {/* Mobile menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px]">
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-2 mt-6">
                  {contactNavItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location === item.path;
                    return (
                      <Link key={item.path} href={item.path}>
                        <Button
                          variant={isActive ? "secondary" : "ghost"}
                          className="w-full justify-start gap-3"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </Button>
                      </Link>
                    );
                  })}
                  
                  <div className="border-t my-2" />
                  
                  {/* User Menu */}
                  <div className="text-xs font-medium text-muted-foreground px-2 py-1">Account</div>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      logoutMutation.mutate();
                    }}
                    disabled={logoutMutation.isPending}
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
            
            {/* Desktop navigation */}
            <div className="hidden md:flex items-center gap-2">
              {/* User Profile Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">{getContactInitials()}</AvatarFallback>
                    </Avatar>
                    <span className="hidden lg:inline">{getContactDisplayName()}</span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{getContactDisplayName()}</p>
                      <p className="text-xs leading-none text-muted-foreground">{contact?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => logoutMutation.mutate()} 
                    disabled={logoutMutation.isPending}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}

