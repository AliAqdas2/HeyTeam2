import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, MapPin, Clock, Building2 } from "lucide-react";
import { format } from "date-fns";

type JobWithStatus = {
  id: string;
  name: string;
  location: string;
  startTime: string;
  endTime: string;
  notes?: string;
  departmentId?: string | null;
  availabilityStatus: string;
  shiftPreference?: string;
  updatedAt: string;
};

export default function ContactJobs() {
  const [departmentFilter, setDepartmentFilter] = useState<string | null>(null);

  const { data: scheduleData, isLoading } = useQuery<{ upcoming: JobWithStatus[]; past: JobWithStatus[] }>({
    queryKey: ["/api/contact/schedule"],
  });

  const { data: departments } = useQuery({
    queryKey: ["/api/contact/departments"],
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Filter jobs by department if filter is selected
  const filterJobs = (jobs: JobWithStatus[]) => {
    if (!departmentFilter) return jobs;
    return jobs.filter((job) => job.departmentId === departmentFilter);
  };

  const upcomingJobs = filterJobs(scheduleData?.upcoming || []);
  const pastJobs = filterJobs(scheduleData?.past || []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return <Badge className="bg-green-600">Confirmed</Badge>;
      case "declined":
        return <Badge variant="destructive">Declined</Badge>;
      case "maybe":
        return <Badge variant="secondary">Maybe</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">My Jobs</h1>
          <p className="text-muted-foreground mt-1">View all your upcoming and past job assignments</p>
        </div>
        {departments && departments.length > 0 && (
          <Select
            value={departmentFilter || "all"}
            onValueChange={(value) => setDepartmentFilter(value === "all" ? null : value)}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departments.map((dept: any) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Upcoming Jobs */}
      {upcomingJobs.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-3">Upcoming Jobs</h2>
          <div className="space-y-3">
            {upcomingJobs.map((job) => (
              <JobCard key={job.id} job={job} departments={departments} />
            ))}
          </div>
        </div>
      )}

      {/* Past Jobs */}
      {pastJobs.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-3">Past Jobs</h2>
          <div className="space-y-3">
            {pastJobs.map((job) => (
              <JobCard key={job.id} job={job} isPast />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {upcomingJobs.length === 0 && pastJobs.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Jobs Yet</h3>
            <p className="text-muted-foreground">
              You don't have any job assignments at the moment. Check back later!
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function JobCard({ job, isPast = false, departments }: { job: JobWithStatus; isPast?: boolean; departments?: Array<{ id: string; name: string }> }) {
  const startTime = new Date(job.startTime);
  const endTime = new Date(job.endTime);
  const formattedDate = format(startTime, "EEEE, MMMM d, yyyy");
  const formattedTime = `${format(startTime, "h:mm a")} - ${format(endTime, "h:mm a")}`;

  const department = departments?.find((d) => d.id === job.departmentId);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return <Badge className="bg-green-600">Confirmed</Badge>;
      case "declined":
        return <Badge variant="destructive">Declined</Badge>;
      case "maybe":
        return <Badge variant="secondary">Maybe</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  return (
    <Card className={isPast ? "opacity-60" : "hover-elevate"}>
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-3 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h3 className="text-lg font-semibold">{job.name}</h3>
                {department && (
                  <Badge variant="outline" className="text-xs mt-1">
                    <Building2 className="h-3 w-3 mr-1" />
                    {department.name}
                  </Badge>
                )}
              </div>
              {getStatusBadge(job.availabilityStatus)}
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4 flex-shrink-0" />
                <span>{formattedDate}</span>
              </div>

              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4 flex-shrink-0" />
                <span>{formattedTime}</span>
              </div>

              {job.location && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4 flex-shrink-0" />
                  <span>{job.location}</span>
                </div>
              )}
            </div>

            {job.notes && (
              <p className="text-sm text-muted-foreground pt-2 border-t">{job.notes}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

