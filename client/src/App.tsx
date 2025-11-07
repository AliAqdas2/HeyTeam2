import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AppHeader } from "@/components/app-header";
import { PageBreadcrumbs } from "@/components/page-breadcrumbs";
import Dashboard from "@/pages/dashboard";
import JobForm from "@/pages/job-form";
import RosterBoard from "@/pages/roster-board";
import SendMessage from "@/pages/send-message";
import Contacts from "@/pages/contacts";
import Templates from "@/pages/templates";
import Calendar from "@/pages/calendar";
import Billing from "@/pages/billing";
import AdminPage from "@/pages/admin";
import AdminDashboard from "@/pages/admin-dashboard";
import TeamPage from "@/pages/team";
import AuthPage from "@/pages/auth";
import ResetPasswordPage from "@/pages/reset-password";
import PricingPage from "@/pages/pricing";
import RosterView from "@/pages/roster-view";
import MessageHistory from "@/pages/message-history";
import ProfilePage from "@/pages/profile";
import NotFound from "@/pages/not-found";

function Router() {
  const [location] = useLocation();
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/me"],
  });

  // Public routes
  const isPublicRoute = location === "/auth" || location.startsWith("/reset-password") || location === "/pricing" || location.startsWith("/roster/");

  if (isLoading && !isPublicRoute) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Redirect to auth if not logged in and trying to access protected route
  if (!user && !isPublicRoute) {
    return <Redirect to="/auth" />;
  }

  // Redirect to jobs if logged in and trying to access auth page
  if (user && location === "/auth") {
    return <Redirect to="/jobs" />;
  }

  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/roster/:token" component={RosterView} />
      <Route path="/">
        {() => <Redirect to="/jobs" />}
      </Route>
      <Route path="/jobs/new" component={JobForm} />
      <Route path="/jobs/:id/edit" component={JobForm} />
      <Route path="/jobs/:id/roster" component={RosterBoard} />
      <Route path="/jobs/:id/send" component={SendMessage} />
      <Route path="/jobs" component={Dashboard} />
      <Route path="/contacts" component={Contacts} />
      <Route path="/templates" component={Templates} />
      <Route path="/calendar" component={Calendar} />
      <Route path="/billing" component={Billing} />
      <Route path="/messages" component={MessageHistory} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/admin.aspx" component={AdminDashboard} />
      <Route path="/team" component={TeamPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const [location] = useLocation();
  const isPublicRoute = location === "/auth" || location.startsWith("/reset-password") || location === "/pricing" || location.startsWith("/roster/");

  return (
    <div className="min-h-screen bg-background">
      {!isPublicRoute && <AppHeader />}
      <main className={isPublicRoute ? "" : "mx-auto max-w-screen-2xl px-6 py-8"}>
        {!isPublicRoute && <PageBreadcrumbs />}
        <Router />
      </main>
    </div>
  );
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
