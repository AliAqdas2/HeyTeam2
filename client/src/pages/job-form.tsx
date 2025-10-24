import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { insertJobSchema, type InsertJob, type Job } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function JobForm() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/jobs/:id/edit");
  const { toast } = useToast();
  const isEdit = !!params?.id;

  const { data: job, isLoading } = useQuery<Job>({
    queryKey: ["/api/jobs", params?.id],
    enabled: isEdit,
  });

  const getDefaultStartTime = () => {
    const date = new Date();
    date.setHours(9, 0, 0, 0);
    return date;
  };

  const getDefaultEndTime = () => {
    const date = new Date();
    date.setHours(17, 0, 0, 0);
    return date;
  };

  const form = useForm<InsertJob>({
    resolver: zodResolver(insertJobSchema),
    defaultValues: {
      name: "",
      location: "",
      startTime: getDefaultStartTime(),
      endTime: getDefaultEndTime(),
      requiredHeadcount: undefined,
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertJob) => apiRequest("POST", "/api/jobs", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({
        title: "Job Created",
        description: "Your job has been created successfully",
      });
      setLocation("/");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create job",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: InsertJob) => apiRequest("PATCH", `/api/jobs/${params?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", params?.id] });
      toast({
        title: "Job Updated",
        description: "Your job has been updated successfully",
      });
      setLocation("/");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update job",
        variant: "destructive",
      });
    },
  });

  React.useEffect(() => {
    if (isEdit && job) {
      form.reset({
        name: job.name,
        location: job.location,
        startTime: new Date(job.startTime),
        endTime: new Date(job.endTime),
        requiredHeadcount: job.requiredHeadcount || undefined,
        notes: job.notes || "",
      });
    }
  }, [job, isEdit, form]);

  if (isEdit && isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" aria-label="Loading" />
      </div>
    );
  }

  const onSubmit = (data: InsertJob) => {
    if (isEdit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link href="/">
          <a data-testid="link-back-dashboard">
            <Button variant="ghost" size="sm" className="gap-2 mb-4">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </a>
        </Link>
        <h1 className="text-3xl font-semibold" data-testid="text-page-title">
          {isEdit ? "Edit Job" : "Create New Job"}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isEdit ? "Update job details and notify your crew of changes" : "Set up a new job and coordinate your crew"}
        </p>
      </div>

      <Card>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardHeader>
              <h2 className="text-lg font-semibold">Job Details</h2>
            </CardHeader>
            <CardContent className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Downtown Construction Site" {...field} data-testid="input-job-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 123 Main St, City" {...field} data-testid="input-job-location" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="startTime"
                  render={({ field }) => {
                    const formatDateForInput = (date: Date | string | undefined) => {
                      if (!date) return "";
                      const d = date instanceof Date ? date : new Date(date);
                      if (isNaN(d.getTime())) return "";
                      
                      const year = d.getFullYear();
                      const month = String(d.getMonth() + 1).padStart(2, '0');
                      const day = String(d.getDate()).padStart(2, '0');
                      const hours = String(d.getHours()).padStart(2, '0');
                      const minutes = String(d.getMinutes()).padStart(2, '0');
                      
                      return `${year}-${month}-${day}T${hours}:${minutes}`;
                    };

                    return (
                      <FormItem>
                        <FormLabel>Start Time</FormLabel>
                        <FormControl>
                          <Input
                            type="datetime-local"
                            value={formatDateForInput(field.value)}
                            onChange={(e) => {
                              const dateStr = e.target.value;
                              if (dateStr) {
                                const date = new Date(dateStr);
                                if (!isNaN(date.getTime())) {
                                  field.onChange(date);
                                }
                              } else {
                                field.onChange(undefined);
                              }
                            }}
                            data-testid="input-start-time"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />

                <FormField
                  control={form.control}
                  name="endTime"
                  render={({ field }) => {
                    const formatDateForInput = (date: Date | string | undefined) => {
                      if (!date) return "";
                      const d = date instanceof Date ? date : new Date(date);
                      if (isNaN(d.getTime())) return "";
                      
                      const year = d.getFullYear();
                      const month = String(d.getMonth() + 1).padStart(2, '0');
                      const day = String(d.getDate()).padStart(2, '0');
                      const hours = String(d.getHours()).padStart(2, '0');
                      const minutes = String(d.getMinutes()).padStart(2, '0');
                      
                      return `${year}-${month}-${day}T${hours}:${minutes}`;
                    };

                    return (
                      <FormItem>
                        <FormLabel>End Time</FormLabel>
                        <FormControl>
                          <Input
                            type="datetime-local"
                            value={formatDateForInput(field.value)}
                            onChange={(e) => {
                              const dateStr = e.target.value;
                              if (dateStr) {
                                const date = new Date(dateStr);
                                if (!isNaN(date.getTime())) {
                                  field.onChange(date);
                                }
                              } else {
                                field.onChange(undefined);
                              }
                            }}
                            data-testid="input-end-time"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>

              <FormField
                control={form.control}
                name="requiredHeadcount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Required Headcount (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="e.g., 6"
                        {...field}
                        value={field.value || ""}
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                        data-testid="input-required-headcount"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add any additional details about the job..."
                        className="resize-none h-24"
                        {...field}
                        data-testid="input-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex gap-3 justify-end border-t pt-6">
              <Link href="/">
                <a data-testid="link-cancel">
                  <Button type="button" variant="outline">Cancel</Button>
                </a>
              </Link>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-submit-job"
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <div className="animate-spin w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full mr-2" />
                )}
                {isEdit ? "Update Job" : "Create Job"}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
