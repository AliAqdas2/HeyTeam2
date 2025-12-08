import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Clock, AlertCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import type { Job, Contact } from "@shared/schema";

interface RosterData {
  contact: Contact;
  jobs: Job[];
}

export default function RosterView() {
  const [, params] = useRoute("/schedule/:token");
  const token = params?.token;

  const { data, isLoading, error } = useQuery<RosterData>({
    queryKey: ["/api/roster", token],
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Invalid Schedule Link</h2>
            <p className="text-muted-foreground">
              This schedule link is invalid or has expired. Please contact your manager for a new link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { contact, jobs } = data;
  
  // Sort jobs by date (upcoming first)
  const sortedJobs = [...jobs].sort((a, b) => {
    const dateA = new Date(a.startTime).getTime();
    const dateB = new Date(b.startTime).getTime();
    return dateA - dateB;
  });

  // Separate upcoming and past jobs
  const now = new Date();
  const upcomingJobs = sortedJobs.filter(job => new Date(job.startTime) >= now);
  const pastJobs = sortedJobs.filter(job => new Date(job.startTime) < now);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card data-testid="card-roster-header">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-lg">
                {contact.firstName?.[0] || '?'}{contact.lastName?.[0] || ''}
              </div>
              <div>
                <h1 className="text-2xl font-semibold" data-testid="text-contact-name">
                  {contact.firstName} {contact.lastName}
                </h1>
                <p className="text-muted-foreground">Your Job Schedule</p>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Upcoming Jobs */}
        {upcomingJobs.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-3 px-1">Upcoming Jobs</h2>
            <div className="space-y-3">
              {upcomingJobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          </div>
        )}

        {/* Past Jobs */}
        {pastJobs.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-3 px-1">Past Jobs</h2>
            <div className="space-y-3">
              {pastJobs.map((job) => (
                <JobCard key={job.id} job={job} isPast />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {jobs.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Jobs Assigned</h3>
              <p className="text-muted-foreground">
                You don't have any jobs assigned at the moment. Check back later!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function JobCard({ job, isPast = false }: { job: Job; isPast?: boolean }) {
  const startTime = new Date(job.startTime);
  const endTime = new Date(job.endTime);
  const formattedDate = format(startTime, "EEEE, MMMM d, yyyy");
  const formattedTime = `${format(startTime, "h:mm a")} - ${format(endTime, "h:mm a")}`;

  return (
    <Card 
      className={isPast ? "opacity-60" : "hover-elevate"}
      data-testid={`card-job-${job.id}`}
    >
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-3 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-lg font-semibold" data-testid={`text-job-name-${job.id}`}>
                {job.name}
              </h3>
              {isPast && (
                <Badge variant="secondary" className="text-xs">Past</Badge>
              )}
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4 flex-shrink-0" />
                <span data-testid={`text-job-date-${job.id}`}>{formattedDate}</span>
              </div>

              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4 flex-shrink-0" />
                <span data-testid={`text-job-time-${job.id}`}>{formattedTime}</span>
              </div>

              {job.location && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4 flex-shrink-0" />
                  <span data-testid={`text-job-location-${job.id}`}>{job.location}</span>
                </div>
              )}
            </div>

            {job.notes && (
              <p className="text-sm text-muted-foreground pt-2 border-t" data-testid={`text-job-notes-${job.id}`}>
                {job.notes}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
