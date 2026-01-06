import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Building2 } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek, addMonths, subMonths } from "date-fns";
import type { Job } from "@shared/schema";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type JobWithAvailability = Job & {
  availabilityCounts: {
    confirmed: number;
    maybe: number;
    declined: number;
    noReply: number;
  };
};

export default function Calendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [departmentFilter, setDepartmentFilter] = useState<string>("");

  const { data: departments } = useQuery({
    queryKey: ["/api/departments"],
  });

  const { data: jobs, isLoading } = useQuery<JobWithAvailability[]>({
    queryKey: ["/api/jobs", departmentFilter || "all"],
    queryFn: async () => {
      const url = departmentFilter ? `/api/jobs?departmentId=${departmentFilter}` : "/api/jobs";
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch jobs");
      return response.json();
    },
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const { toast } = useToast();
  const [draggedJob, setDraggedJob] = useState<JobWithAvailability | null>(null);

  const rescheduleMutation = useMutation({
    mutationFn: async ({ jobId, startTime, endTime }: { jobId: string; startTime: Date; endTime: Date }) => {
      return await apiRequest("PATCH", `/api/jobs/${jobId}/reschedule`, {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({
        title: "Job Rescheduled",
        description: "Job has been moved to the new date and time",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to reschedule",
        description: error.message || "Could not reschedule job",
        variant: "destructive",
      });
    },
  });

  const getJobsForDay = (day: Date) => {
    return jobs?.filter((job) => {
      const jobDate = new Date(job.startTime);
      const dateMatch = isSameDay(jobDate, day);
      const departmentMatch = !departmentFilter || job.departmentId === departmentFilter;
      return dateMatch && departmentMatch;
    }) || [];
  };

  const handleDragStart = (e: React.DragEvent, job: JobWithAvailability) => {
    setDraggedJob(job);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("jobId", job.id);
  };

  const handleDragEnd = () => {
    setDraggedJob(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetDay: Date) => {
    e.preventDefault();
    if (!draggedJob) return;

    const jobStartTime = new Date(draggedJob.startTime);
    const jobEndTime = new Date(draggedJob.endTime);
    const duration = jobEndTime.getTime() - jobStartTime.getTime();

    // Calculate new times preserving the original time of day
    const newStartTime = new Date(targetDay);
    newStartTime.setHours(jobStartTime.getHours(), jobStartTime.getMinutes(), jobStartTime.getSeconds(), jobStartTime.getMilliseconds());

    const newEndTime = new Date(newStartTime.getTime() + duration);

    rescheduleMutation.mutate({
      jobId: draggedJob.id,
      startTime: newStartTime,
      endTime: newEndTime,
    });

    setDraggedJob(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold" data-testid="text-page-title">Calendar</h1>
          <p className="text-muted-foreground mt-1">View all jobs by date and track confirmations</p>
        </div>
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <Select
            value={departmentFilter || "all"}
            onValueChange={(value) => setDepartmentFilter(value === "all" ? "" : value)}
          >
            <SelectTrigger className="w-[200px]" data-testid="select-department-filter">
              <SelectValue placeholder="All departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {departments?.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold" data-testid="text-current-month">
              {format(currentMonth, "MMMM yyyy")}
            </h2>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                data-testid="button-prev-month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={() => setCurrentMonth(new Date())}
                data-testid="button-today"
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                data-testid="button-next-month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="bg-muted p-3 text-center text-sm font-medium">
                {day}
              </div>
            ))}
            {calendarDays.map((day, index) => {
              const dayJobs = getJobsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={index}
                  className={`bg-card min-h-24 p-2 ${!isCurrentMonth ? "opacity-50" : ""} ${draggedJob ? "ring-2 ring-primary ring-offset-2" : ""}`}
                  data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, day)}
                >
                  <div className={`text-sm mb-2 ${isToday ? "font-semibold text-primary" : ""}`}>
                    {format(day, "d")}
                  </div>
                  <div className="space-y-1">
                    {dayJobs.slice(0, 2).map((job) => (
                      <Link key={job.id} href={`/jobs/${job.id}/schedule`}>
                        <a data-testid={`job-link-${job.id}`}>
                          <div
                            className="bg-primary/10 border-l-2 border-primary px-2 py-1 rounded-sm hover-elevate cursor-pointer"
                            draggable
                            onDragStart={(e) => handleDragStart(e, job)}
                            onDragEnd={handleDragEnd}
                          >
                            <div className="text-xs font-medium truncate">{job.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(job.startTime), "h:mm a")}
                            </div>
                          </div>
                        </a>
                      </Link>
                    ))}
                    {dayJobs.length > 2 && (
                      <div className="text-xs text-muted-foreground px-2">
                        +{dayJobs.length - 2} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {jobs && jobs.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No jobs scheduled</h3>
            <p className="text-muted-foreground mb-6">Create jobs to see them on the calendar</p>
            <Link href="/jobs/new">
              <a data-testid="link-create-job">
                <Button>Create Job</Button>
              </a>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
