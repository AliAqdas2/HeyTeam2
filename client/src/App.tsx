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

function UserRouter() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/roster/:token" component={RosterView} />
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
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/me"],
  });

  const isPublicRoute = location === "/auth" || location.startsWith("/reset-password") || location === "/pricing" || location.startsWith("/roster/");

  if (isLoading && !isPublicRoute) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user && !isPublicRoute) {
    return <Redirect to="/auth" />;
  }

  if (user && location === "/auth") {
    return <Redirect to="/jobs" />;
  }

  return (
    <div className="min-h-screen bg-background">
      {!isPublicRoute && <AppHeader />}
      <main className={isPublicRoute ? "" : "mx-auto max-w-screen-2xl px-6 py-8"}>
        {!isPublicRoute && <PageBreadcrumbs />}
        <UserRouter />
      </main>
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

function AppContent() {
  const [location] = useLocation();
  if (location.startsWith("/admin")) {
    return <AdminApp />;
  }
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
