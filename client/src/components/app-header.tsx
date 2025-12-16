import { Link, useLocation } from "wouter";
import { ThemeToggle } from "./theme-toggle";
import { FeedbackDialog } from "./feedback-dialog";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Users, Calendar, FileText, Briefcase, CreditCard, LogOut, Shield, Settings, Menu, MessageSquare, ChevronDown, User, MessageSquarePlus } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { removeUserId, getUserId, getUserQueryFn } from "@/lib/userIdStorage";
import { removeContactId } from "@/lib/contactApiClient";
import { Capacitor } from "@capacitor/core";
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

const navItems = [
  { path: "/jobs", label: "Jobs", icon: Briefcase },
  { path: "/calendar", label: "Calendar", icon: Calendar },
  { path: "/contacts", label: "Contacts", icon: Users },
  { path: "/templates", label: "Templates", icon: FileText },
];

export function AppHeader() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isMobileLayout = Capacitor.isNativePlatform();
  const { data: user } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: isMobileLayout ? getUserQueryFn : undefined, // Use mobile queryFn for native apps
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: organization } = useQuery({
    queryKey: ["/api/organization"],
    enabled: !!user,
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      // Just clear local storage - no API call needed
      if (Capacitor.isNativePlatform()) {
        removeUserId();
        removeContactId();
      }
      return Promise.resolve();
    },
    onSuccess: () => {
      // Clear the user query cache, which will trigger App.tsx to redirect to /auth
      queryClient.setQueryData(["/api/auth/me"], null);
      queryClient.clear();
      
      toast({ title: "Logged out successfully" });
      // Small delay to ensure state updates before redirect
      setTimeout(() => {
        setLocation("/auth");
      }, 100);
    },
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

  const getUserDisplayName = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user?.username || user?.email || "User";
  };

  return (
    <header className="sticky top-0 z-50 border-b bg-card">
      <div className="mx-auto max-w-screen-2xl px-3 sm:px-6 py-2 sm:py-3">
        <div className="flex items-center justify-between gap-2 sm:gap-6">
          <div className="flex items-center gap-3 sm:gap-8">
            <Link href="/">
              <div className="flex items-center gap-2 sm:gap-3 hover-elevate px-1 sm:px-2 py-1 rounded-md cursor-pointer" data-testid="link-home">
                <img src={logoImage} alt="HeyTeam" className="w-20 sm:w-28" />
                {organization && (
                  <span className="text-xs sm:text-sm font-medium text-muted-foreground hidden sm:inline" data-testid="text-organization-name">
                    {organization.name}
                  </span>
                )}
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.path;
                return (
                  <Link key={item.path} href={item.path}>
                    <Button
                      variant="ghost"
                      className={`gap-2 ${isActive ? "bg-accent" : ""}`}
                      id={`tour-nav-${item.label.toLowerCase()}`}
                      data-testid={`link-nav-${item.label.toLowerCase()}`}
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
            {/* Mobile menu - shows on small screens */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" data-testid="button-mobile-menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px]">
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-2 mt-6">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location === item.path;
                    return (
                      <Link key={item.path} href={item.path}>
                        <Button
                          variant={isActive ? "secondary" : "ghost"}
                          className="w-full justify-start gap-3"
                          onClick={() => setMobileMenuOpen(false)}
                          data-testid={`link-mobile-nav-${item.label.toLowerCase()}`}
                        >
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </Button>
                      </Link>
                    );
                  })}
                  
                  {(user?.isAdmin || user?.teamRole === "admin" || user?.teamRole === "owner") && (
                    <>
                      <div className="border-t my-2" />
                      
                      {/* Setup Menu */}
                      <div className="text-xs font-medium text-muted-foreground px-2 py-1">Setup</div>
                      <Link href="/team">
                        <Button 
                          variant="ghost" 
                          className="w-full justify-start gap-3"
                          onClick={() => setMobileMenuOpen(false)}
                          data-testid="link-mobile-team"
                        >
                          <Settings className="h-4 w-4" />
                          Team
                        </Button>
                      </Link>
                      <Link href="/messages">
                        <Button 
                          variant="ghost" 
                          className="w-full justify-start gap-3"
                          onClick={() => setMobileMenuOpen(false)}
                          data-testid="link-mobile-messages"
                        >
                          <MessageSquare className="h-4 w-4" />
                          Messages
                        </Button>
                      </Link>
                      <Link href="/billing">
                        <Button 
                          variant="ghost" 
                          className="w-full justify-start gap-3"
                          onClick={() => setMobileMenuOpen(false)}
                          data-testid="link-mobile-billing"
                        >
                          <CreditCard className="h-4 w-4" />
                          Billing
                        </Button>
                      </Link>
                      
                      <div className="border-t my-2" />
                    </>
                  )}
                  
                  {/* User Menu */}
                  <div className="text-xs font-medium text-muted-foreground px-2 py-1">Account</div>
                  <Link href="/profile">
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start gap-3"
                      onClick={() => setMobileMenuOpen(false)}
                      data-testid="link-mobile-profile"
                    >
                      <User className="h-4 w-4" />
                      Edit Profile
                    </Button>
                  </Link>
                  <FeedbackDialog trigger={
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-3"
                      data-testid="button-mobile-feedback"
                    >
                      <MessageSquarePlus className="h-4 w-4" />
                      Send Feedback
                    </Button>
                  } />
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      logoutMutation.mutate();
                    }}
                    disabled={logoutMutation.isPending}
                    data-testid="button-mobile-logout"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
            
            {/* Desktop navigation - hidden on mobile */}
            <div className="hidden md:flex items-center gap-2">
              {/* Setup Dropdown - Only for Admin and Owners */}
              {(user?.isAdmin || user?.teamRole === "admin" || user?.teamRole === "owner") && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2" data-testid="button-setup-menu">
                      <Settings className="h-4 w-4" />
                      <span className="hidden lg:inline">Setup</span>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel>Setup</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/team" className="cursor-pointer">
                        <Settings className="h-4 w-4 mr-2" />
                        Team
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/messages" className="cursor-pointer" data-testid="link-messages">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Messages
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/billing" className="cursor-pointer">
                        <CreditCard className="h-4 w-4 mr-2" />
                        Billing
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}

              {/* User Profile Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2" data-testid="button-profile-menu">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">{getUserInitials()}</AvatarFallback>
                    </Avatar>
                    <span className="hidden lg:inline">{getUserDisplayName()}</span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{getUserDisplayName()}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="cursor-pointer" data-testid="link-profile">
                      <User className="h-4 w-4 mr-2" />
                      Edit Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <FeedbackDialog trigger={
                      <button className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50">
                        <MessageSquarePlus className="h-4 w-4 mr-2" />
                        Send Feedback
                      </button>
                    } />
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={() => logoutMutation.mutate()} 
                    disabled={logoutMutation.isPending}
                    data-testid="button-logout"
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
