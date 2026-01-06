import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Plus, FileText, Trash2, Pencil, HelpCircle, Sparkles } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTemplateSchema, type InsertTemplate, type Template } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const availableTokens = [
  { token: "{FirstName}", description: "Contact's first name" },
  { token: "{LastName}", description: "Contact's last name" },
  { token: "{JobName}", description: "Job name" },
  { token: "{Date}", description: "Job date" },
  { token: "{Time}", description: "Job time" },
  { token: "{FromDate}", description: "Job start date" },
  { token: "{ToDate}", description: "Job end date" },
  { token: "{FromTime}", description: "Job start time" },
  { token: "{ToTime}", description: "Job end time" },
  { token: "{Location}", description: "Job location" },
  { token: "{Notes}", description: "Job notes" },
];

// Check if template is a job invitation template
const isProtectedTemplate = (template: Template) => {
  const normalized = template.name.toLowerCase().trim();
  return normalized === "job invitation" || 
         normalized === "job cancellation" || 
         normalized === "job update";
};

const isJobInvitationTemplate = (template: Template) => {
  return template.name && 
    (template.name.toLowerCase().includes("invitation") || 
     template.name.toLowerCase().includes("job invitation") ||
     template.name.toLowerCase() === "job invitation");
};

export default function Templates() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: templates, isLoading } = useQuery<Template[]>({
    queryKey: ["/api/templates"],
  });

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
          <h1 className="text-3xl font-semibold" data-testid="text-page-title">Message Templates</h1>
          <p className="text-muted-foreground mt-1">Create reusable message templates with dynamic variables</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-create-template">
              <Plus className="h-4 w-4" />
              Create Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <TemplateForm onSuccess={() => setIsDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {templates && templates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No templates yet</h3>
            <p className="text-muted-foreground mb-6">Create your first message template to speed up communication</p>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2" data-testid="button-create-first-template">
                  <Plus className="h-4 w-4" />
                  Create Your First Template
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <TemplateForm onSuccess={() => setIsDialogOpen(false)} />
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TemplateCard({ template }: { template: Template }) {
  const { toast } = useToast();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/templates/${template.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({
        title: "Template Deleted",
        description: "Template has been deleted successfully",
      });
    },
  });

  return (
    <>
      <Card className="hover-elevate" data-testid={`card-template-${template.id}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-lg" data-testid={`text-template-name-${template.id}`}>{template.name}</h3>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsEditDialogOpen(true)}
                data-testid={`button-edit-template-${template.id}`}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              {!isProtectedTemplate(template) && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => deleteMutation.mutate()}
                  data-testid={`button-delete-template-${template.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <Badge variant="secondary" className="w-fit text-xs">{template.type}</Badge>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/50 p-3 rounded-md">
            <p className="text-sm whitespace-pre-wrap" data-testid={`text-template-content-${template.id}`}>
              {template.content}
            </p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <TemplateForm 
            template={template}
            onSuccess={() => setIsEditDialogOpen(false)} 
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function TemplateForm({ template, onSuccess }: { template?: Template; onSuccess: () => void }) {
  const { toast } = useToast();
  const isEdit = !!template;

  const form = useForm<InsertTemplate>({
    resolver: zodResolver(insertTemplateSchema),
    defaultValues: template || {
      name: "",
      content: "",
      type: "standard",
      includeRosterLink: false,
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertTemplate) => apiRequest("POST", "/api/templates", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({
        title: "Template Created",
        description: "New template has been created successfully",
      });
      form.reset();
      onSuccess();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create template",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: InsertTemplate) => apiRequest("PATCH", `/api/templates/${template?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({
        title: "Template Updated",
        description: "Template has been updated successfully",
      });
      onSuccess();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update template",
        variant: "destructive",
      });
    },
  });

  const insertToken = (token: string) => {
    const currentContent = form.getValues("content");
    form.setValue("content", currentContent + token);
  };

  const handleSubmit = (data: InsertTemplate) => {
    if (isEdit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <TooltipProvider>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {isEdit ? "Edit Message Template" : "Create Message Template"}
          <Tooltip>
            <TooltipTrigger asChild>
              <Sparkles className="h-4 w-4 text-primary cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>Templates help you send consistent, personalized messages quickly. Use tokens to auto-fill recipient details!</p>
            </TooltipContent>
          </Tooltip>
        </DialogTitle>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => {
              const isProtected = template && isProtectedTemplate(template);
              return (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    Template Name
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Give your template a descriptive name like "Job Invitation" or "Availability Request" so you can easily find it later</p>
                      </TooltipContent>
                    </Tooltip>
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., Job Invitation" 
                      {...field} 
                      data-testid="input-template-name"
                      disabled={isProtected}
                      className={isProtected ? "opacity-60 cursor-not-allowed" : ""}
                    />
                  </FormControl>
                  {isProtected && (
                    <FormDescription className="text-muted-foreground italic">
                      The name of the {template?.name} template cannot be changed
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              );
            }}
          />

          <FormField
            control={form.control}
            name="content"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  Message Content
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="font-medium mb-1">Pro tip: Click token buttons to insert them</p>
                      <p className="text-xs">Tokens like {"{FirstName}"} will automatically be replaced with actual data when you send the message!</p>
                    </TooltipContent>
                  </Tooltip>
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Hi {FirstName}, we have a new job at {Location} on {Date}. Reply Y to confirm or N to decline."
                    className="resize-none h-32"
                    {...field}
                    data-testid="input-template-content"
                  />
                </FormControl>
                <FormDescription className="flex items-start gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                  <span>Click token buttons below to insert them at the cursor position. Tokens will be replaced with real data when sending.</span>
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="includeRosterLink"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base flex items-center gap-2">
                    Include Schedule Link
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="font-medium mb-1">What's a schedule link?</p>
                        <p className="text-xs">A secure URL that shows the recipient their upcoming jobs for the week. Great for reminders and confirmations!</p>
                      </TooltipContent>
                    </Tooltip>
                  </FormLabel>
                  <FormDescription>
                    Automatically add a personalized schedule link to show the recipient's weekly schedule
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    data-testid="switch-include-roster-link"
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <div>
            <label className="text-sm font-medium mb-2 flex items-center gap-2">
              Available Tokens
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-sm">
                  <p className="font-medium mb-2">Token Magic ✨</p>
                  <p className="text-xs mb-2">Click any token to insert it into your message. When you send, they'll be replaced with:</p>
                  <ul className="text-xs space-y-1">
                    <li>• {"{FirstName}"} → John</li>
                    <li>• {"{Location}"} → Central Office</li>
                    <li>• {"{Date}"} → 15/11/2025</li>
                    <li>• {"{Time}"} → 09:00</li>
                  </ul>
                </TooltipContent>
              </Tooltip>
            </label>
            <div className="flex flex-wrap gap-2">
              {availableTokens.map(({ token, description }) => (
                <Tooltip key={token}>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => insertToken(token)}
                      className="text-xs"
                      data-testid={`button-insert-${token}`}
                    >
                      {token}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">{description}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button 
              type="submit" 
              disabled={createMutation.isPending || updateMutation.isPending} 
              data-testid="button-submit-template"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <div className="animate-spin w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full mr-2" />
              )}
              {isEdit ? "Update Template" : "Create Template"}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </TooltipProvider>
  );
}
