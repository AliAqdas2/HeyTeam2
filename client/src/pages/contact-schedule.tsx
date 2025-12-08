import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek, addMonths, subMonths } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { getContactQueryFn } from "@/lib/contactApiClient";
import { Capacitor } from "@capacitor/core";
import { cn } from "@/lib/utils";

type JobWithStatus = {
  id: string;
  name: string;
  location: string;
  startTime: string;
  endTime: string;
  availabilityStatus: string;
};

export default function ContactSchedule() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const isMobileLayout = Capacitor.isNativePlatform();

  const { data: scheduleData, isLoading } = useQuery<{ upcoming: JobWithStatus[]; past: JobWithStatus[] }>({
    queryKey: ["/api/contact/schedule"],
    queryFn: getContactQueryFn,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    staleTime: 1 * 60 * 1000, // 1 minute
  });

  const allJobs = [...(scheduleData?.upcoming || []), ...(scheduleData?.past || [])];

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getJobsForDay = (day: Date) => {
    return allJobs.filter((job) => {
      const jobDate = new Date(job.startTime);
      return isSameDay(jobDate, day);
    }) || [];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", isMobileLayout && "space-y-3")}>
      {!isMobileLayout && (
      <div>
        <h1 className="text-3xl font-semibold">Schedule</h1>
        <p className="text-muted-foreground mt-1">View your jobs on a calendar</p>
      </div>
      )}
      
      {isMobileLayout && (
        <div>
          <h1 className="text-xl font-semibold">Schedule</h1>
          <p className="text-sm text-muted-foreground mt-1">View your jobs on a calendar</p>
        </div>
      )}

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold">
              {format(currentMonth, "MMMM yyyy")}
            </h2>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={() => setCurrentMonth(new Date())}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
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
                >
                  <div className={`text-sm mb-2 ${isToday ? "font-semibold text-primary" : ""}`}>
                    {format(day, "d")}
                  </div>
                  <div className="space-y-1">
                    {dayJobs.slice(0, 2).map((job) => (
                      <div
                        key={job.id}
                        className="bg-primary/10 border-l-2 border-primary px-2 py-1 rounded-sm"
                      >
                        <div className="text-xs font-medium truncate">{job.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(job.startTime), "h:mm a")}
                        </div>
                        <Badge 
                          variant={job.availabilityStatus === "confirmed" ? "default" : "secondary"}
                          className="text-xs mt-1"
                        >
                          {job.availabilityStatus === "confirmed" ? "Confirmed" : 
                           job.availabilityStatus === "declined" ? "Declined" : 
                           job.availabilityStatus === "maybe" ? "Maybe" : "Pending"}
                        </Badge>
                      </div>
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

      {allJobs.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <CalendarIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No jobs scheduled</h3>
            <p className="text-muted-foreground">You don't have any jobs scheduled for this month.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

