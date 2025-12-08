import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AppHeader } from "@/components/app-header";
import { MobileHeader } from "@/components/mobile-header";
import { MobileTabBar } from "@/components/mobile-tab-bar";
import { PageBreadcrumbs } from "@/components/page-breadcrumbs";
import Dashboard from "@/pages/dashboard";
import JobForm from "@/pages/job-form";
import RosterBoard from "@/pages/roster-board";
import SendMessage from "@/pages/send-message";
import Contacts from "@/pages/contacts";
import Templates from "@/pages/templates";
import Calendar from "@/pages/calendar";
import Billing from "@/pages/billing";
import AdminDashboard from "@/pages/admin-dashboard";
import TeamPage from "@/pages/team";
import AuthPage from "@/pages/auth";
import ResetPasswordPage from "@/pages/reset-password";
import PricingPage from "@/pages/pricing";
import RosterView from "@/pages/roster-view";
import MessageHistory from "@/pages/message-history";
import ProfilePage from "@/pages/profile";
import NotFound from "@/pages/not-found";
import AdminLogin from "@/pages/admin-login";
import AdminChangePassword from "@/pages/admin-change-password";
import { AdminHeader } from "@/components/admin-header";
import { ContactHeader } from "@/components/contact-header";
import { ContactMobileHeader } from "@/components/contact-mobile-header";
import { ContactTabBar } from "@/components/contact-tab-bar";
import Winner from "@/pages/winner";
import ContactDashboard from "@/pages/contact-dashboard";
import ContactJobs from "@/pages/contact-jobs";
import ContactInvitations from "@/pages/contact-invitations";
import ContactMessages from "@/pages/contact-messages";
import ContactSchedule from "@/pages/contact-schedule";
import ContactSettings from "@/pages/contact-settings";
import { getContactId, removeContactId } from "@/lib/contactApiClient";
import { getUserQueryFn, getUserId, removeUserId } from "@/lib/userIdStorage";
import { Capacitor } from "@capacitor/core";
import { cn } from "@/lib/utils";
import { initializePushNotifications } from "@/lib/push-notifications";
import { useEffect } from "react";
import { useLocation } from "wouter";

function UserRouter() {
  return (
    <Switch>
      <Route path="/winner" component={Winner} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/schedule/:token" component={RosterView} />
      <Route path="/jobs/new" component={JobForm} />
      <Route path="/jobs/:id/edit" component={JobForm} />
      <Route path="/jobs/:id/schedule" component={RosterBoard} />
      <Route path="/jobs/:id/send" component={SendMessage} />
      <Route path="/jobs" component={Dashboard} />
      <Route path="/contacts" component={Contacts} />
      <Route path="/templates" component={Templates} />
      <Route path="/calendar" component={Calendar} />
      <Route path="/billing" component={Billing} />
      <Route path="/messages" component={MessageHistory} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/team" component={TeamPage} />
      <Route path="/">
        {() => <Redirect to="/jobs" />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function UserApp() {
  const [location] = useLocation();
  const isMobileLayout = Capacitor.isNativePlatform();
  const userId = isMobileLayout ? getUserId() : null; // Check for userId on mobile
  
  console.log("[UserApp] Rendering - isMobileLayout:", isMobileLayout, "userId:", userId);
  
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: isMobileLayout ? getUserQueryFn : undefined, // Use mobile queryFn for native apps
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    enabled: isMobileLayout ? !!userId : true, // Only run query if we have userId on mobile, always on web
  });
  
  console.log("[UserApp] Query state - isLoading:", isLoading, "error:", error, "user:", user);

  const isPublicRoute =
    location === "/auth" ||
    location.startsWith("/reset-password") ||
    location === "/pricing" ||
    location.startsWith("/schedule/");

  // For mobile apps, if no userId and not on public route, redirect to auth
  if (isMobileLayout && !userId && !isPublicRoute) {
    return <Redirect to="/auth" />;
  }

  // If error or unauthorized, clear userId and redirect to auth (mobile only)
  // But only if we actually had a userId - don't clear if query failed because userId was missing
  if (isMobileLayout && error && userId) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage === "UNAUTHORIZED" || errorMessage.includes("401")) {
      console.log("[UserApp] 401 error with userId present, clearing and redirecting");
      removeUserId();
      queryClient.removeQueries({ queryKey: ["/api/auth/me"] });
      if (!isPublicRoute) {
        return <Redirect to="/auth" />;
      }
    }
  }

  if (isLoading && !isPublicRoute) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // If no user data after loading completes and not on public route, redirect to auth
  if (!user && !isLoading && !isPublicRoute) {
    if (isMobileLayout) {
      removeUserId(); // Clear invalid userId
    }
    return <Redirect to="/auth" />;
  }

  if (user && location === "/auth") {
    return <Redirect to="/jobs" />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Mobile Header (native only) - Fixed at top */}
      {!isPublicRoute && isMobileLayout && <MobileHeader />}
      
      {/* Desktop Header */}
      {!isPublicRoute && !isMobileLayout && <AppHeader />}
      
      <main 
        className={cn(
          "flex-1 w-full",
          isPublicRoute 
            ? "" 
            : isMobileLayout
            ? "overflow-y-auto overflow-x-hidden mobile-container"
            : "mx-auto max-w-screen-2xl px-6 py-8"
        )}
        style={isMobileLayout && !isPublicRoute ? {
          paddingTop: `calc(2rem + 2rem + env(safe-area-inset-top, 0px))`, // 2rem for header (h-8 = 32px) + 2rem for content spacing
          paddingBottom: `calc(2rem + env(safe-area-inset-bottom, 0px))`,
          paddingLeft: `calc(0.75rem + env(safe-area-inset-left, 0px))`,
          paddingRight: `calc(0.75rem + env(safe-area-inset-right, 0px))`,
        } : undefined}
      >
        <div className={cn(
          isMobileLayout && !isPublicRoute ? "w-full max-w-full overflow-x-hidden" : ""
        )}>
          {!isPublicRoute && !isMobileLayout && <PageBreadcrumbs />}
        <UserRouter />
        </div>
      </main>
      
      {/* Mobile Tab Bar (native only) - Fixed at bottom */}
      {!isPublicRoute && isMobileLayout && <MobileTabBar />}
    </div>
  );
}

function AdminRouter() {
  return (
    <Switch>
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin/dashboard" component={AdminDashboard} />
      <Route path="/admin/change-password" component={AdminChangePassword} />
      <Route path="/admin">
        {() => <Redirect to="/admin/dashboard" />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AdminApp() {
  const [location] = useLocation();
  const isPublicRoute = location === "/admin/login";
  const { data, isLoading } = useQuery<{ admin: { id: string; name: string | null; email: string } }>({
    queryKey: ["/api/admin/auth/me"],
    retry: false,
  });

  const admin = data?.admin ?? null;

  if (!isPublicRoute && isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Checking admin access...</div>
      </div>
    );
  }

  if (!isPublicRoute && !admin) {
    return <Redirect to="/admin/login" />;
  }

  if (admin && isPublicRoute) {
    return <Redirect to="/admin/dashboard" />;
  }

  const containerClass = isPublicRoute
    ? "px-4 py-12"
    : "mx-auto max-w-screen-2xl px-6 py-8";

  return (
    <div className="min-h-screen bg-background">
      {!isPublicRoute && admin && <AdminHeader admin={admin} />}
      <main className={containerClass}>
        <AdminRouter />
      </main>
    </div>
  );
}

function ContactRouter() {
  return (
    <Switch>
      <Route path="/contact/dashboard" component={ContactDashboard} />
      <Route path="/contact/jobs" component={ContactJobs} />
      <Route path="/contact/invitations" component={ContactInvitations} />
      <Route path="/contact/messages" component={ContactMessages} />
      <Route path="/contact/schedule" component={ContactSchedule} />
      <Route path="/contact/settings" component={ContactSettings} />
      <Route path="/contact">
        {() => <Redirect to="/contact/dashboard" />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function ContactApp() {
  const [location, setLocation] = useLocation();
  const contactId = getContactId();
  const isMobileLayout = Capacitor.isNativePlatform();
  const isPublicRoute = false; // Contact routes are always authenticated

  // Initialize push notifications on mount for contacts
  // SIMPLIFIED: Register immediately after login
  useEffect(() => {
    if (contactId && isMobileLayout) {
      console.log("[ContactApp] ===== INITIALIZING PUSH NOTIFICATIONS =====");
      console.log("[ContactApp] Contact ID:", contactId);
      console.log("[ContactApp] Is Mobile:", isMobileLayout);
      
      // Small delay to ensure everything is loaded
      const timer = setTimeout(() => {
        initializePushNotifications().catch((error) => {
          console.error("[ContactApp] Failed to initialize push notifications:", error);
          // Show error to user
          window.dispatchEvent(new CustomEvent("pushNotificationError", {
            detail: { 
              title: "Push Notification Error",
              message: `Failed to register: ${error instanceof Error ? error.message : String(error)}`
            }
          }));
        });
      }, 500); // 500ms delay to ensure contact is fully loaded
      
      return () => clearTimeout(timer);
    } else {
      console.log("[ContactApp] Skipping push notification init - contactId:", contactId, "isMobileLayout:", isMobileLayout);
    }
  }, [contactId, isMobileLayout]);
  
  // Listen for push notification errors and show toast
  useEffect(() => {
    const handleError = (event: CustomEvent) => {
      const { title, message } = event.detail;
      console.error("[ContactApp] Push notification error:", title, message);
      // Show alert for now (can be replaced with toast if available)
      alert(`${title}\n\n${message}\n\nCheck console for more details.`);
    };
    
    const handleSuccess = (event: CustomEvent) => {
      const { message } = event.detail;
      console.log("[ContactApp] Push notification success:", message);
      // Can show success toast here if needed
    };
    
    window.addEventListener("pushNotificationError", handleError as EventListener);
    window.addEventListener("pushNotificationSuccess", handleSuccess as EventListener);
    return () => {
      window.removeEventListener("pushNotificationError", handleError as EventListener);
      window.removeEventListener("pushNotificationSuccess", handleSuccess as EventListener);
    };
  }, []);

  // Handle notification taps
  useEffect(() => {
    const handleNotificationTap = (event: CustomEvent) => {
      const { type, action } = event.detail;
      if (type === "job_invitation" && action === "view_invitations") {
        setLocation("/contact/invitations");
      }
    };

    window.addEventListener("pushNotificationTap", handleNotificationTap as EventListener);
    return () => {
      window.removeEventListener("pushNotificationTap", handleNotificationTap as EventListener);
    };
  }, [setLocation]);
  
  const { data: contact, isLoading, error } = useQuery({
    queryKey: ["/api/mobile/auth/me"],
    queryFn: async () => {
      if (!contactId) {
        removeContactId();
        throw new Error("UNAUTHORIZED");
      }
      // Get API base URL for native apps
      const getApiBaseUrl = () => {
        if (Capacitor.isNativePlatform()) {
          return "https://portal.heyteam.ai";
        }
        return "";
      };
      
      const baseUrl = getApiBaseUrl();
      const meUrl = `${baseUrl}/api/mobile/auth/me`;
      
      const response = await fetch(meUrl, {
        headers: {
          "X-Contact-ID": contactId,
        },
        credentials: "include",
      });
      if (response.status === 401) {
        removeContactId();
        throw new Error("UNAUTHORIZED");
      }
      if (!response.ok) {
        throw new Error("Failed to fetch contact");
      }
      const data = await response.json();
      if (data.type !== "contact") {
        removeContactId();
        throw new Error("UNAUTHORIZED");
      }
      return data;
    },
    retry: false,
    enabled: !!contactId, // Only run if we have contactId
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Don't refetch on mount - use cached data
    refetchOnReconnect: false,
    staleTime: 5 * 60 * 1000, // 5 minutes - data is fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });

  // If no contact ID, redirect to auth
  if (!contactId) {
    return <Redirect to="/auth" />;
  }

  // If error or unauthorized, clear and redirect to auth
  if (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage === "UNAUTHORIZED" || errorMessage.includes("401")) {
      removeContactId();
      queryClient.removeQueries({ queryKey: ["/api/mobile/auth/me"] });
      return <Redirect to="/auth" />;
    }
  }

  // If loading, show loading screen (only show once, don't keep refetching)
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // If no contact data after loading completes, redirect to auth
  if (!contact && !isLoading) {
    removeContactId();
    queryClient.removeQueries({ queryKey: ["/api/mobile/auth/me"] });
    return <Redirect to="/auth" />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Mobile Header (native only) - Fixed at top */}
      {!isPublicRoute && isMobileLayout && <ContactMobileHeader />}
      
      {/* Desktop Header */}
      {!isPublicRoute && !isMobileLayout && <ContactHeader />}
      
      {/* Main Content */}
      <main 
        className={cn(
          "flex-1 w-full",
          isPublicRoute 
            ? "" 
            : isMobileLayout
            ? "overflow-y-auto overflow-x-hidden mobile-container"
            : "mx-auto max-w-screen-2xl px-6 py-8"
        )}
        style={isMobileLayout && !isPublicRoute ? {
          paddingTop: `calc(2rem + 2rem + env(safe-area-inset-top, 0px))`, // 2rem for header (h-8 = 32px) + 2rem for content spacing
          paddingBottom: `calc(2rem + env(safe-area-inset-bottom, 0px))`,
          paddingLeft: `calc(0.75rem + env(safe-area-inset-left, 0px))`,
          paddingRight: `calc(0.75rem + env(safe-area-inset-right, 0px))`,
        } : undefined}
      >
        <div className={cn(
          isMobileLayout && !isPublicRoute ? "w-full max-w-full overflow-x-hidden" : ""
        )}>
          <ContactRouter />
        </div>
      </main>
      
      {/* Mobile Tab Bar (native only) - Fixed at bottom */}
      {!isPublicRoute && isMobileLayout && <ContactTabBar />}
    </div>
  );
}

function AppContent() {
  const [location] = useLocation();
  const isMobileLayout = Capacitor.isNativePlatform();
 
  // Public routes (including /auth) should use UserRouter
  const isPublicRoute =
    location === "/auth" ||
    location.startsWith("/reset-password") ||
    location === "/pricing" ||
    location.startsWith("/schedule/");

  // Check if we're on a contact route (but not /auth)
  const isContactRoute = location.startsWith("/contact") && location !== "/auth";

  // On mobile, check for stored IDs to determine which app to show
  if (isMobileLayout && isPublicRoute) {
    // On public routes, check for stored IDs and redirect accordingly
    const contactId = getContactId();
    const userId = getUserId();
    
    if (contactId && !userId) {
      // Has contactId but no userId, redirect to contact dashboard
      return <Redirect to="/contact/dashboard" />;
    } else if (userId && !contactId) {
      // Has userId but no contactId, redirect to user dashboard
      return <Redirect to="/jobs" />;
    }
    // If both or neither, show the public route (auth page)
  }

  // Early decision: If on contact route, use ContactApp
  if (isContactRoute) {
    return <ContactApp />;
  }

  // For public routes (including /auth), use UserApp
  if (isPublicRoute) {
    return <UserApp />;
  }

  // For all other routes, use UserApp
  return <UserApp />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <AppContent />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
