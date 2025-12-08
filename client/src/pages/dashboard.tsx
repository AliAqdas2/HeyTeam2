import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, MapPin, Clock, Users, Calendar as CalendarIcon, Search, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Job, Availability, Subscription, User } from "@shared/schema";
// driver.js is a JS-only package, so we import it with a type-safe workaround.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useTheme } from "@/components/theme-provider";

type SubscriptionPlan = {
  id: string;
  name: string;
  priceGBP: number;
  priceUSD: number;
  priceEUR: number;
  monthlyCredits: number;
  supportLevel: string;
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
};

type JobWithAvailability = Job & {
  availabilityCounts: {
    confirmed: number;
    maybe: number;
    declined: number;
    noReply: number;
  };
};

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [location, setLocation] = useLocation();
  const { theme } = useTheme();
  const hasShownTourRef = useRef(false);
  const driverInstanceRef = useRef<ReturnType<typeof driver> | null>(null);

  const { data: jobs, isLoading } = useQuery<JobWithAvailability[]>({
    queryKey: ["/api/jobs"],
    // Keep the jobs list feeling live while you're on the dashboard
    refetchInterval: 5000,
  });

  const { data: user } = useQuery<User>({
    queryKey: ["/api/auth/me"],
  });

  const { data: subscription, isLoading: isLoadingSubscription } = useQuery<Subscription>({
    queryKey: ["/api/subscription"],
  });

  const { data: plans = [], isLoading: isLoadingPlans } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/subscription-plans"],
  });

  const { data: credits, isLoading: isLoadingCredits } = useQuery<{ available: number; breakdown: any }>({
    queryKey: ["/api/credits"],
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (hasShownTourRef.current) return;
    if (isLoading || isLoadingPlans || isLoadingSubscription) return;

    // Wouter's location does not include the query string, so we read it directly from window.location.
    const params = new URLSearchParams(window.location.search);
    if (params.get("tour") !== "signup") return;

    const timer = window.setTimeout(() => {
      const contactsButton = document.getElementById("tour-nav-contacts");
      const templatesButton = document.getElementById("tour-nav-templates");
      const createJobButton = document.getElementById("tour-create-job");
      const jobSection = document.getElementById("tour-job-section");

      const steps = [];

      if (contactsButton) {
        steps.push({
          element: contactsButton,
          popover: {
            title: "Add Your Crew",
            description: "Start by adding or importing contacts so HeyTeam knows who to reach out to.",
            side: "bottom" as const,
            align: "start" as const,
          },
        });
      }

      if (templatesButton) {
        steps.push({
          element: templatesButton,
          popover: {
            title: "Craft Your Templates",
            description: "Create or customise messaging templates so you can send polished updates in seconds.",
            side: "bottom" as const,
            align: "start" as const,
          },
        });
      }

      if (createJobButton) {
        steps.push({
          element: createJobButton,
          popover: {
            title: "Set Up Your Next Job",
            description: "Create a job, set the requirements, and get everything ready for outreach.",
            side: "bottom" as const,
            align: "center" as const,
          },
        });
      }

      if (jobSection) {
        steps.push({
          element: jobSection,
          popover: {
            title: "Send Invitations",
            description: "From each job, use 'Send Message' to invite the right crew and track responses in real time.",
            side: "top" as const,
            align: "center" as const,
          },
        });
      }

      if (!steps.length) {
        return;
      }

      hasShownTourRef.current = true;

      const overlayColor = theme === "dark" ? "rgba(15, 23, 42, 0.75)" : "rgba(15, 23, 42, 0.45)";
      const popoverClass = `driverjs-theme ${theme === "dark" ? "driverjs-theme-dark" : "driverjs-theme-light"}`;

      const driverInstance = driver({
        steps,
        showProgress: true,
        overlayColor,
        popoverClass,
        stageRadius: 12,
        stagePadding: 6,
        onDestroyed: () => {
          driverInstanceRef.current = null;
        },
      });

      driverInstanceRef.current = driverInstance;
      driverInstance.drive();
    }, 500);

    return () => {
      window.clearTimeout(timer);
      driverInstanceRef.current?.destroy();
    };
  }, [isLoading, isLoadingPlans, isLoadingSubscription, location, theme]);

  type BillingSummary = {
    planName: string;
    planStatus: string;
    renewalDate: Date | null;
    currencySymbol: string;
    price: string | null;
    availableCredits: number;
    monthlyCredits: number | null;
    usagePercent: number | null;
    hasActiveSubscription: boolean;
  };

  const billingSummary = useMemo<BillingSummary>(() => {
    const currency = subscription?.currency ?? user?.currency ?? "GBP";
    const symbol = CURRENCY_SYMBOLS[currency] ?? "";
    const availableCredits = credits?.available ?? 0;

    if (!subscription) {
      return {
        planName: "Free Trial",
        planStatus: "trial",
        renewalDate: null,
        currencySymbol: symbol,
        price: null,
        availableCredits,
        monthlyCredits: null,
        usagePercent: null,
        hasActiveSubscription: false,
      };
    }

    const currentPlan = plans.find((plan) => plan.id === subscription.planId) ?? null;
    const monthlyCredits = currentPlan?.monthlyCredits ?? null;

    const usagePercent =
      monthlyCredits && monthlyCredits > 0
        ? Math.min(100, Math.max(0, Math.round(((monthlyCredits - availableCredits) / monthlyCredits) * 100)))
        : null;

    const price =
      currentPlan
        ? currency === "USD"
          ? currentPlan.priceUSD
          : currency === "EUR"
            ? currentPlan.priceEUR
            : currentPlan.priceGBP
        : null;

    return {
      planName: currentPlan?.name ?? "Free Trial",
      planStatus: subscription.status ?? "trial",
      renewalDate: subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : null,
      currencySymbol: symbol,
      price: price !== null ? (price / 100).toFixed(0) : null,
      availableCredits,
      monthlyCredits,
      usagePercent,
      hasActiveSubscription: true,
    };
  }, [credits?.available, plans, subscription, user?.currency]);

  const formatStatusLabel = (status: string) =>
    status
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ") || "Status";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading" />
      </div>
    );
  }

  const isWithinDateRange = (job: JobWithAvailability) => {
    if (!fromDate && !toDate) return true;

    const jobStart = new Date(job.startTime);
    const jobEnd = new Date(job.endTime);

    if (fromDate) {
      const from = new Date(fromDate);
      from.setHours(0, 0, 0, 0);
      // Job counts in range if it hasn't fully finished before "from"
      if (jobEnd < from) return false;
    }

    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      // Job counts in range if it has started by "to"
      if (jobStart > to) return false;
    }

    return true;
  };

  // Filter jobs based on date range and search query
  const filterJobs = (jobList: JobWithAvailability[]) => {
    const byDate = jobList.filter(isWithinDateRange);

    if (!searchQuery.trim()) return byDate;

    const query = searchQuery.toLowerCase();
    return byDate.filter((job) =>
      job.name.toLowerCase().includes(query) || job.location?.toLowerCase().includes(query),
    );
  };

  const now = new Date();
  const allUpcomingJobs = jobs?.filter((job) => new Date(job.endTime) > now) || [];
  const allPastJobs = jobs?.filter((job) => new Date(job.endTime) <= now) || [];

  const upcomingJobs = filterJobs(allUpcomingJobs);
  const pastJobs = filterJobs(allPastJobs);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-foreground" data-testid="text-page-title">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage your jobs and crew coordination</p>
        </div>
        <Link href="/jobs/new">
          <a data-testid="link-create-job">
            <Button size="default" className="gap-2" id="tour-create-job">
              <Plus className="h-4 w-4" />
              Create Job
            </Button>
          </a>
        </Link>
      </div>

      {/* Filters */}
      {jobs && jobs.length > 0 && (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search jobs by name or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-jobs"
            />
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">From</span>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-9 w-[140px]"
                data-testid="input-date-from"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">To</span>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-9 w-[140px]"
                data-testid="input-date-to"
              />
            </div>
            {(fromDate || toDate) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFromDate("");
                  setToDate("");
                }}
                data-testid="button-clear-date-filters"
              >
                Clear dates
              </Button>
            )}
          </div>
        </div>
      )}

      <Card>
        <CardContent className="p-6 space-y-4">
          {isLoadingSubscription || isLoadingPlans ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" aria-label="Loading billing" />
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">Current Plan</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-semibold" data-testid="text-plan-name">
                      {billingSummary.planName}
                    </span>
                    <Badge variant={billingSummary.planStatus === "active" ? "default" : "secondary"}>
                      {formatStatusLabel(billingSummary.planStatus)}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {billingSummary.price !== null
                      ? `${billingSummary.currencySymbol}${billingSummary.price}/month`
                      : billingSummary.hasActiveSubscription
                        ? "Custom billing"
                        : "Free plan"}
                    {billingSummary.renewalDate && (
                      <span className="ml-2">
                        · Renews {format(billingSummary.renewalDate, "MMM d, yyyy")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex flex-col">
                    <span className="text-sm text-muted-foreground">SMS Credits</span>
                    <span className="text-lg font-semibold" data-testid="text-sms-credits">
                      {billingSummary.availableCredits.toLocaleString()}
                      {billingSummary.monthlyCredits
                        ? ` / ${billingSummary.monthlyCredits.toLocaleString()}`
                        : ""}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLocation("/billing")}
                    data-testid="link-view-billing"
                  >
                    {billingSummary.hasActiveSubscription ? "Manage Billing" : "Set Up Billing"}
                  </Button>
                </div>
              </div>
              {billingSummary.usagePercent !== null && (
                <div className="space-y-2">
                  <Progress value={100 - billingSummary.usagePercent} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {billingSummary.usagePercent}% of monthly credits used
                  </p>
                </div>
              )}
              {!billingSummary.hasActiveSubscription && (
                <p className="text-xs text-muted-foreground">
                  You&apos;re currently on the free trial. Set up billing to choose a plan.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {upcomingJobs.length === 0 && pastJobs.length === 0 ? (
        <Card id="tour-job-section">
          <CardContent className="p-12 text-center">
            <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            {searchQuery.trim() ? (
              <>
                <h3 className="text-lg font-medium mb-2">No jobs found</h3>
                <p className="text-muted-foreground mb-6">
                  No jobs match your search "{searchQuery}". Try different keywords.
                </p>
                <Button variant="outline" onClick={() => setSearchQuery("")} data-testid="button-clear-search">
                  Clear Search
                </Button>
              </>
            ) : (
              <>
                <h3 className="text-lg font-medium mb-2">No jobs yet</h3>
                <p className="text-muted-foreground mb-6">Create your first job to start coordinating your crew</p>
                <Link href="/jobs/new">
                  <a data-testid="link-create-first-job">
                    <Button className="gap-2">
                      <Plus className="h-4 w-4" />
                      Create Your First Job
                    </Button>
                  </a>
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div id="tour-job-section" className="space-y-6">
          {upcomingJobs.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Upcoming Jobs</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcomingJobs.map((job) => (
                  <JobCard key={job.id} job={job} />
                ))}
              </div>
            </div>
          )}

          {pastJobs.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Past Jobs</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pastJobs.map((job) => (
                  <JobCard key={job.id} job={job} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function JobCard({ job }: { job: JobWithAvailability }) {
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");

  const fillPercentage = job.requiredHeadcount
    ? Math.round((job.availabilityCounts.confirmed / job.requiredHeadcount) * 100)
    : 0;

  const isPast = new Date(job.endTime) <= new Date();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/jobs/${job.id}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({ title: "Job deleted successfully" });
      setDeleteDialogOpen(false);
      setConfirmationText("");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete job",
        description: error.message || "Could not delete job",
        variant: "destructive",
      });
    },
  });

  const handleDelete = () => {
    if (confirmationText.toLowerCase() === "heyteam") {
      deleteMutation.mutate();
    }
  };

  return (
    <Card className="hover-elevate" data-testid={`card-job-${job.id}`}>
      <CardHeader className="space-y-0 pb-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-lg line-clamp-2" data-testid={`text-job-name-${job.id}`}>{job.name}</h3>
          {isPast && <Badge variant="secondary">Past</Badge>}
        </div>
        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-2">
          <MapPin className="h-3.5 w-3.5" />
          <span className="line-clamp-1">{job.location}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span>{format(new Date(job.startTime), "MMM d, h:mm a")}</span>
        </div>

        {job.requiredHeadcount && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium" data-testid={`text-fill-${job.id}`}>
                  {job.availabilityCounts.confirmed}/{job.requiredHeadcount}
                </span>
              </div>
              <span className="text-muted-foreground">{fillPercentage}%</span>
            </div>
            <Progress value={fillPercentage} className="h-2" />
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-xs">
            <span className="text-chart-2">{job.availabilityCounts.confirmed}</span>
            <span>&nbsp;Confirmed</span>
          </Badge>
          {job.availabilityCounts.maybe > 0 && (
            <Badge variant="secondary" className="text-xs">
              <span className="text-chart-3">{job.availabilityCounts.maybe}</span>
              <span>&nbsp;Maybe</span>
            </Badge>
          )}
          {job.availabilityCounts.declined > 0 && (
            <Badge variant="secondary" className="text-xs">
              <span className="text-chart-4">{job.availabilityCounts.declined}</span>
              <span>&nbsp;Declined</span>
            </Badge>
          )}
          {job.availabilityCounts.noReply > 0 && (
            <Badge variant="secondary" className="text-xs">
              <span>{job.availabilityCounts.noReply}&nbsp;No Reply</span>
            </Badge>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex gap-2 flex-wrap pt-4 border-t">
        <Link href={`/jobs/${job.id}/schedule`}>
          <a className="flex-1" data-testid={`link-view-roster-${job.id}`}>
            <Button variant="default" size="sm" className="w-full">View Schedule</Button>
          </a>
        </Link>
        <Link href={`/jobs/${job.id}/edit`}>
          <a data-testid={`link-edit-job-${job.id}`}>
            <Button variant="outline" size="sm">Edit</Button>
          </a>
        </Link>
        
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-1"
              data-testid={`button-delete-job-${job.id}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Job</AlertDialogTitle>
              <AlertDialogDescription className="space-y-4">
                <p>
                  This will permanently delete the job <strong>{job.name}</strong> and all associated data including availability responses and assignments.
                </p>
                <p>
                  To confirm deletion, please type <strong>heyteam</strong> below:
                </p>
                <Input
                  value={confirmationText}
                  onChange={(e) => setConfirmationText(e.target.value)}
                  placeholder="Type heyteam to confirm"
                  data-testid={`input-delete-confirmation-${job.id}`}
                />
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel 
                onClick={() => setConfirmationText("")}
                data-testid={`button-cancel-delete-${job.id}`}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={confirmationText.toLowerCase() !== "heyteam" || deleteMutation.isPending}
                className="bg-destructive hover:bg-destructive/90"
                data-testid={`button-confirm-delete-${job.id}`}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete Job"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}
