import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
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
import type { Job, Availability } from "@shared/schema";

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

  const { data: jobs, isLoading } = useQuery<JobWithAvailability[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: subscription } = useQuery<any>({
    queryKey: ["/api/subscription"],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading" />
      </div>
    );
  }

  // Filter jobs based on search query
  const filterJobs = (jobList: JobWithAvailability[]) => {
    if (!searchQuery.trim()) return jobList;
    
    const query = searchQuery.toLowerCase();
    return jobList.filter(job => 
      job.name.toLowerCase().includes(query) ||
      job.location?.toLowerCase().includes(query)
    );
  };

  const allUpcomingJobs = jobs?.filter(job => new Date(job.startTime) > new Date()) || [];
  const allPastJobs = jobs?.filter(job => new Date(job.startTime) <= new Date()) || [];

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
            <Button size="default" className="gap-2">
              <Plus className="h-4 w-4" />
              Create Job
            </Button>
          </a>
        </Link>
      </div>

      {/* Search Bar */}
      {jobs && jobs.length > 0 && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search jobs by name, location, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-jobs"
          />
        </div>
      )}

<Card>
  <CardContent className="p-6">
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <Link href="/billing">
          <a
            data-testid="link-current-plan"
            className="flex flex-col hover-elevate active-elevate-2 rounded-md p-2 -m-2"
          >
            <span className="text-sm text-muted-foreground">Current Plan</span>
            <span
              className="text-lg font-semibold capitalize"
              data-testid="text-plan-name"
            >
              {subscription?.plan ?? "N/A"}
            </span>
          </a>
        </Link>

        <div className="h-8 w-px bg-border" />

        <Link href="/billing">
          <a
            data-testid="link-sms-credits"
            className="flex flex-col hover-elevate active-elevate-2 rounded-md p-2 -m-2"
          >
            <span className="text-sm text-muted-foreground">SMS Credits</span>
            <span
              className="text-lg font-semibold"
              data-testid="text-sms-credits"
            >
              {subscription?.messageCredits ?? 0}
            </span>
          </a>
        </Link>
      </div>

      <Link href="/billing">
        <a data-testid="link-view-billing">
          <Button variant="outline" size="sm">
            Manage Billing
          </Button>
        </a>
      </Link>
    </div>
  </CardContent>
</Card>


      {upcomingJobs.length === 0 && pastJobs.length === 0 ? (
        <Card>
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
        <>
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
        </>
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

  const isPast = new Date(job.startTime) <= new Date();

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
        <Link href={`/jobs/${job.id}/roster`}>
          <a className="flex-1" data-testid={`link-view-roster-${job.id}`}>
            <Button variant="default" size="sm" className="w-full">View Roster</Button>
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
