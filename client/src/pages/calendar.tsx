import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek, addMonths, subMonths } from "date-fns";
import type { Job } from "@shared/schema";
import { Link } from "wouter";

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

  const { data: jobs, isLoading } = useQuery<JobWithAvailability[]>({
    queryKey: ["/api/jobs"],
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getJobsForDay = (day: Date) => {
    return jobs?.filter((job) => {
      const jobDate = new Date(job.startTime);
      return isSameDay(jobDate, day);
    }) || [];
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
                  className={`bg-card min-h-24 p-2 ${!isCurrentMonth ? "opacity-50" : ""}`}
                  data-testid={`calendar-day-${format(day, "yyyy-MM-dd")}`}
                >
                  <div className={`text-sm mb-2 ${isToday ? "font-semibold text-primary" : ""}`}>
                    {format(day, "d")}
                  </div>
                  <div className="space-y-1">
                    {dayJobs.slice(0, 2).map((job) => (
                      <Link key={job.id} href={`/jobs/${job.id}/schedule`}>
                        <a data-testid={`job-link-${job.id}`}>
                          <div className="bg-primary/10 border-l-2 border-primary px-2 py-1 rounded-sm hover-elevate cursor-pointer">
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
