import React from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { insertJobSchema, type Job, type JobSkillRequirement } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Plus, X } from "lucide-react";
import { JobLocationPicker } from "@/components/job-location-picker";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const skillRequirementFormSchema = z.object({
  skill: z
    .string({ required_error: "Skill is required" })
    .trim()
    .min(1, "Skill is required"),
  headcount: z
    .coerce
    .number({ invalid_type_error: "Headcount must be a number" })
    .int("Headcount must be a whole number")
    .min(1, "Headcount must be at least 1"),
  notes: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value === null || value === undefined) {
        return "";
      }
      return value;
    }),
});

type JobSkillRequirementFormValue = z.infer<typeof skillRequirementFormSchema>;

const jobFormSchema = insertJobSchema.extend({
  skillRequirements: z.array(skillRequirementFormSchema).default([]),
});

type JobFormValues = z.infer<typeof jobFormSchema>;

type JobWithSkills = Job & {
  skillRequirements?: JobSkillRequirement[];
};

type SkillAvailabilityContact = {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
  available: boolean;
  isOptedOut: boolean;
  skills: string[];
};

type SkillAvailabilitySummary = {
  skill: string;
  totalCount: number;
  availableCount: number;
};

type SkillAvailabilityResponse = {
  contacts: SkillAvailabilityContact[];
  skills: SkillAvailabilitySummary[];
};

type JobSubmissionPayload = Omit<JobFormValues, "skillRequirements"> & {
  skillRequirements: Array<{
    skill: string;
    headcount: number;
    notes: string | null;
  }>;
};

export default function JobForm() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/jobs/:id/edit");
  const { toast } = useToast();
  const isEdit = !!params?.id;
  const [isCancelDialogOpen, setIsCancelDialogOpen] = React.useState(false);
  const [isCancellingJob, setIsCancellingJob] = React.useState(false);

  const { data: job, isLoading } = useQuery<JobWithSkills>({
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

  const form = useForm<JobFormValues>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      name: "",
      location: "",
      startTime: getDefaultStartTime(),
      endTime: getDefaultEndTime(),
      requiredHeadcount: undefined,
      notes: "",
      skillRequirements: [],
    },
  });

  const { data: skillAvailability } = useQuery<SkillAvailabilityResponse>({
    queryKey: ["/api/skills/availability"],
  });

  const {
    fields: skillRequirementFields,
    append: appendSkillRequirement,
    remove: removeSkillRequirement,
  } = useFieldArray({
    control: form.control,
    name: "skillRequirements",
  });

  const skillRequirementValues = form.watch("skillRequirements") ?? [];

  // Auto-calculate required headcount based on skill requirements
  React.useEffect(() => {
    const totalHeadcount = skillRequirementValues.reduce((sum, req) => {
      const count = Number(req?.headcount ?? 0);
      return sum + (isNaN(count) ? 0 : count);
    }, 0);

    if (totalHeadcount > 0) {
      form.setValue("requiredHeadcount", totalHeadcount);
    }
  }, [skillRequirementValues, form]);

  const skillSummaryMap = React.useMemo(() => {
    const map = new Map<string, SkillAvailabilitySummary>();
    skillAvailability?.skills.forEach((entry) => {
      map.set(entry.skill.toLowerCase(), entry);
    });
    return map;
  }, [skillAvailability]);

  const availableSkillOptions = React.useMemo(() => {
    const options = new Set<string>();
    skillAvailability?.skills.forEach((entry) => {
      const skill = entry.skill?.trim();
      if (skill) {
        options.add(skill);
      }
    });

    skillRequirementValues.forEach((requirement) => {
      const skill = requirement?.skill?.trim();
      if (skill) {
        options.add(skill);
      }
    });

    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [skillAvailability, skillRequirementValues]);

  const [customSkillModes, setCustomSkillModes] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    setCustomSkillModes((prev) => {
      const next: Record<string, boolean> = {};

      skillRequirementFields.forEach((field, idx) => {
        const value = form.getValues(`skillRequirements.${idx}.skill`) ?? "";
        const normalized = value.trim().toLowerCase();
        const matchedOption = availableSkillOptions.find(
          (option) => option.toLowerCase() === normalized,
        );
        next[field.id] = Object.prototype.hasOwnProperty.call(prev, field.id)
          ? prev[field.id]
          : value.trim().length > 0 && !matchedOption;
      });

      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      if (prevKeys.length === nextKeys.length) {
        const allSame = nextKeys.every((key) => prev[key] === next[key]);
        if (allSame) {
          return prev;
        }
      }

      return next;
    });
  }, [skillRequirementFields, availableSkillOptions, form]);

  const createMutation = useMutation({
    mutationFn: (data: JobSubmissionPayload) => apiRequest("POST", "/api/jobs", data),
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
    mutationFn: async (data: JobSubmissionPayload) => {
      const response = await apiRequest("PATCH", `/api/jobs/${params?.id}`, data);
      try {
        return await response.json();
      } catch {
        return null;
      }
    },
    onSuccess: async (payload) => {
      await queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/jobs", params?.id] });

      toast({
        title: "Job Updated",
        description: "Your job has been updated successfully",
      });

      const rescheduleTriggered = payload?.reschedule?.triggered;
      const notifiedCount = payload?.reschedule?.notifiedCount ?? 0;
      const removedContactsCount = payload?.reschedule?.removedContactsCount ?? 0;
      const replacementInvitesSent = payload?.reschedule?.replacementInvitesSent ?? 0;

      if (rescheduleTriggered) {
        let description = "";
        
        if (removedContactsCount > 0) {
          description = `${removedContactsCount} contact${removedContactsCount === 1 ? " was" : "s were"} unavailable on the new date and removed from this job.`;
          
          if (replacementInvitesSent > 0) {
            description += ` Invited ${replacementInvitesSent} replacement contact${replacementInvitesSent === 1 ? "" : "s"}.`;
          }
          
          if (notifiedCount > 0) {
            description += ` Notified ${notifiedCount} available contact${notifiedCount === 1 ? "" : "s"} about the reschedule.`;
          }
          
          toast({
            title: "Job Rescheduled",
            description,
            variant: "default",
          });
        } else if (notifiedCount > 0) {
          description = `Notified ${notifiedCount} contact${notifiedCount === 1 ? "" : "s"} about the new schedule.`;
          toast({
            title: "Reschedule notices sent",
            description,
          });
        } else {
          toast({
            title: "Job Updated",
            description: "No SMS notifications were sent (Twilio not configured or no confirmed contacts).",
          });
        }
      }

      if (payload?.conflicts?.length) {
        const conflictSummary = payload.conflicts
          .map((entry: any) => {
            const contactName = `${entry.contact.firstName} ${entry.contact.lastName}`.trim();
            const jobNames = entry.jobs.map((job: any) => job.name).join(", ");
            return `${contactName}: ${jobNames}`;
          })
          .join(" • ");

        toast({
          title: "Heads up – scheduling conflicts detected",
          description: conflictSummary,
          variant: "destructive",
        });
      }

      setLocation("/");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update job",
        variant: "destructive",
      });
    },
  });

  const handleCancelJob = React.useCallback(async () => {
    if (!params?.id) {
      return;
    }
    try {
      setIsCancellingJob(true);
      const response = await apiRequest("DELETE", `/api/jobs/${params.id}`);
      let payload: any = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      const notifiedCount = payload?.notifiedCount ?? 0;

      await queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/jobs", params.id] });
      await queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });

      toast({
        title: "Job cancelled",
        description:
          notifiedCount > 0
            ? `Notified ${notifiedCount} contact${notifiedCount === 1 ? "" : "s"} about the cancellation.`
            : "The job was removed and no confirmed contacts required notification.",
      });

      setLocation("/");
    } catch (error: any) {
      toast({
        title: "Failed to cancel job",
        description: error?.message || "Unable to cancel this job right now",
        variant: "destructive",
      });
    } finally {
      setIsCancellingJob(false);
      setIsCancelDialogOpen(false);
    }
  }, [params?.id, setLocation, toast]);

  React.useEffect(() => {
    if (isEdit && job) {
      form.reset({
        name: job.name,
        location: job.location,
        startTime: new Date(job.startTime),
        endTime: new Date(job.endTime),
        requiredHeadcount: job.requiredHeadcount || undefined,
        notes: job.notes || "",
        skillRequirements:
          job.skillRequirements?.map((requirement) => ({
            skill: requirement.skill ?? "",
            headcount: requirement.headcount ?? 1,
            notes: requirement.notes ?? "",
          })) ?? [],
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

  const onSubmit = (values: JobFormValues) => {
    const sanitizedSkillRequirements = values.skillRequirements
      .map((requirement) => {
        const skill = requirement.skill.trim();
        const notes = requirement.notes.trim();
        return {
          skill,
          headcount: Number(requirement.headcount),
          notes: notes.length ? notes : null,
        };
      })
      .filter((requirement) => requirement.skill.length > 0);

    const jobNotesRaw = typeof values.notes === "string" ? values.notes.trim() : "";
    const jobNotes = jobNotesRaw.length ? jobNotesRaw : null;

    const payload: JobSubmissionPayload = {
      ...values,
      notes: jobNotes,
      skillRequirements: sanitizedSkillRequirements,
    };

    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 mb-4"
          onClick={() => setLocation("/")}
          data-testid="link-back-dashboard"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
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

          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-medium">Skill Requirements</h3>
                <p className="text-sm text-muted-foreground">
                  Add the skills and headcount you need for this job. Availability is based on your contacts.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  appendSkillRequirement({
                    skill: "",
                    headcount: 1,
                    notes: "",
                  })
                }
                data-testid="button-add-skill-requirement"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Skill
              </Button>
            </div>

            <div className="space-y-4">
              {skillRequirementFields.length === 0 ? (
                <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
                  No skill requirements yet. Click &ldquo;Add Skill&rdquo; to create one.
                </div>
              ) : (
                skillRequirementFields.map((field, index) => {
                  const currentValue = skillRequirementValues?.[index];
                  const skillValue = currentValue?.skill?.trim() ?? "";
                  const normalizedSkillKey = skillValue.toLowerCase();
                  const skillStats = normalizedSkillKey ? skillSummaryMap.get(normalizedSkillKey) : undefined;
                  const headcountValue = Number(currentValue?.headcount ?? 0);
                  const hasSkillSelection = skillValue.length > 0;
                  const availableCount = skillStats?.availableCount ?? 0;
                  const canEvaluateAvailability = Boolean(skillAvailability);
                  const showWarning =
                    hasSkillSelection &&
                    canEvaluateAvailability &&
                    headcountValue > availableCount &&
                    headcountValue > 0;
                  const warningMessage = !hasSkillSelection
                    ? ""
                    : skillStats
                      ? availableCount === 0
                        ? `No available contacts with ${skillStats.skill}.`
                        : `Only ${skillStats.availableCount} ${skillStats.availableCount === 1 ? "person is" : "people are"} currently available for ${skillStats.skill}.`
                      : `No availability data for ${skillValue}.`;

                  const availabilityLabel = !hasSkillSelection
                    ? "Select a skill to view availability"
                    : !skillAvailability
                      ? "Loading availability..."
                      : skillStats
                        ? `${skillStats.availableCount}/${skillStats.totalCount} available`
                        : "No availability data found";

                  return (
                    <div
                      key={field.id}
                      className="space-y-4 rounded-lg border p-4"
                      data-testid={`skill-requirement-${index}`}
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                        <FormField
                          control={form.control}
                          name={`skillRequirements.${index}.skill`}
                          render={({ field: skillField }) => {
                            const rawValue = skillField.value ?? "";
                            const normalizedValue = rawValue.trim().toLowerCase();
                            const matchedOption = availableSkillOptions.find(
                              (option) => option.toLowerCase() === normalizedValue,
                            );
                            const isCustom =
                              customSkillModes[field.id] ??
                              (rawValue.trim().length > 0 && !matchedOption);
                            const selectDisplayValue = isCustom
                              ? "__other__"
                              : matchedOption ?? "";

                            return (
                              <FormItem className="flex-1">
                                <FormLabel>Skill</FormLabel>
                                <FormControl>
                                  <Select
                                    value={selectDisplayValue}
                                    onValueChange={(value) => {
                                      if (value === "__other__") {
                                        setCustomSkillModes((prev) => ({
                                          ...prev,
                                          [field.id]: true,
                                        }));
                                        if (matchedOption) {
                                          skillField.onChange("");
                                        }
                                      } else {
                                        setCustomSkillModes((prev) => ({
                                          ...prev,
                                          [field.id]: false,
                                        }));
                                        skillField.onChange(value);
                                      }
                                    }}
                                  >
                                    <SelectTrigger data-testid={`skill-requirement-skill-${index}`}>
                                      <SelectValue placeholder="Select a skill" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {availableSkillOptions.map((option) => (
                                        <SelectItem key={option} value={option}>
                                          {option}
                                        </SelectItem>
                                      ))}
                                      <SelectItem value="__other__">Other</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormControl>
                                {isCustom && (
                                  <div className="mt-3">
                                    <FormControl>
                                      <Input
                                        placeholder="Type a custom skill"
                                        value={rawValue}
                                        onChange={(event) => skillField.onChange(event.target.value)}
                                        data-testid={`skill-requirement-custom-${index}`}
                                      />
                                    </FormControl>
                                  </div>
                                )}
                                <FormMessage />
                              </FormItem>
                            );
                          }}
                        />

                        <FormField
                          control={form.control}
                          name={`skillRequirements.${index}.headcount`}
                          render={({ field: headcountField }) => (
                            <FormItem className="w-full sm:w-32">
                              <FormLabel>Headcount</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={1}
                                  {...headcountField}
                                  value={headcountField.value ?? ""}
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    headcountField.onChange(value === "" ? undefined : Number(value));
                                  }}
                                  data-testid={`skill-requirement-headcount-${index}`}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="self-start text-muted-foreground"
                          onClick={() => {
                            setCustomSkillModes((prev) => {
                              const next = { ...prev };
                              delete next[field.id];
                              return next;
                            });
                            removeSkillRequirement(index);
                          }}
                          data-testid={`button-remove-skill-${index}`}
                          aria-label={`Remove skill requirement ${index + 1}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      <FormField
                        control={form.control}
                        name={`skillRequirements.${index}.notes`}
                        render={({ field: notesField }) => (
                          <FormItem>
                            <FormLabel>Skill-Specific Notes (Optional)</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Add any additional details for this skill..."
                                {...notesField}
                                value={notesField.value ?? ""}
                                onChange={(event) => notesField.onChange(event.target.value)}
                                data-testid={`skill-requirement-notes-${index}`}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="text-sm">
                        <p className="text-muted-foreground">{availabilityLabel}</p>
                        {showWarning && (
                          <p className="mt-1 text-destructive" role="alert">
                            {warningMessage}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <JobLocationPicker
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        id="job-location"
                        placeholder="Search or choose on map"
                        inputProps={{ "data-testid": "input-job-location" } as React.InputHTMLAttributes<HTMLInputElement>}
                      />
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
                render={({ field }) => {
                  const autoCalculated = skillRequirementValues.reduce((sum, req) => {
                    const count = Number(req?.headcount ?? 0);
                    return sum + (isNaN(count) ? 0 : count);
                  }, 0);

                  return (
                    <FormItem>
                      <FormLabel>Required Headcount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="e.g., 6"
                          {...field}
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          data-testid="input-required-headcount"
                          disabled={autoCalculated > 0}
                        />
                      </FormControl>
                      {autoCalculated > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Auto-calculated from skill requirements: {autoCalculated} people
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  );
                }}
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
                        value={field.value ?? ""}
                        data-testid="input-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
            <CardFooter className="flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
              {isEdit && (
                <AlertDialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="destructive"
                      className="w-full sm:w-auto"
                      data-testid="button-cancel-job"
                    >
                      Cancel Job
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel this job?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Confirmed crew members will receive an SMS and the job will be removed from their schedules.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isCancellingJob}>Keep Job</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleCancelJob}
                        disabled={isCancellingJob}
                      >
                        {isCancellingJob ? "Cancelling..." : "Confirm Cancellation"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <div className="flex w-full justify-end gap-3 sm:w-auto">
                <Button type="button" variant="outline" onClick={() => setLocation("/")} data-testid="link-cancel">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-submit-job"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  )}
                  {isEdit ? "Update Job" : "Create Job"}
                </Button>
              </div>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
