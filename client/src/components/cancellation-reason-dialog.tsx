import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface CancellationReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

const CANCELLATION_REASONS = [
  { value: "too_expensive", label: "Too expensive" },
  { value: "not_using", label: "Not using the service enough" },
  { value: "missing_features", label: "Missing features I need" },
  { value: "poor_support", label: "Poor customer support" },
  { value: "technical_issues", label: "Technical issues" },
  { value: "switching_competitor", label: "Switching to a competitor" },
  { value: "business_closure", label: "Business closure/downsizing" },
  { value: "other", label: "Other" },
];

export function CancellationReasonDialog({ open, onOpenChange, onConfirm }: CancellationReasonDialogProps) {
  const { toast } = useToast();
  const [selectedReason, setSelectedReason] = useState("");
  const [additionalComments, setAdditionalComments] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitCancellationMutation = useMutation({
    mutationFn: async ({ reason, comments }: { reason: string; comments: string }) => {
      const response = await apiRequest("POST", "/api/subscription/cancel-with-reason", { 
        reason, 
        comments 
      });
      return response.json();
    },
    onSuccess: (data: { message: string }) => {
      toast({
        title: "Subscription Canceled",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      onOpenChange(false);
      onConfirm();
      // Reset form
      setSelectedReason("");
      setAdditionalComments("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to cancel subscription",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!selectedReason) {
      toast({
        title: "Reason Required",
        description: "Please select a reason for cancellation",
        variant: "destructive",
      });
      return;
    }

    const reasonLabel = CANCELLATION_REASONS.find(r => r.value === selectedReason)?.label || selectedReason;
    const fullReason = additionalComments 
      ? `${reasonLabel}: ${additionalComments}`
      : reasonLabel;

    submitCancellationMutation.mutate({
      reason: fullReason,
      comments: additionalComments,
    });
  };

  const handleCancel = () => {
    setSelectedReason("");
    setAdditionalComments("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel Subscription</DialogTitle>
          <DialogDescription>
            We're sorry to see you go! Please help us improve by telling us why you're canceling.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label className="text-sm font-medium">Why are you canceling? *</Label>
            <RadioGroup value={selectedReason} onValueChange={setSelectedReason}>
              {CANCELLATION_REASONS.map((reason) => (
                <div key={reason.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={reason.value} id={reason.value} />
                  <Label htmlFor={reason.value} className="text-sm font-normal cursor-pointer">
                    {reason.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="comments" className="text-sm font-medium">
              Additional comments (optional)
            </Label>
            <Textarea
              id="comments"
              placeholder="Tell us more about your experience or what we could do better..."
              value={additionalComments}
              onChange={(e) => setAdditionalComments(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={submitCancellationMutation.isPending}
            className="flex-1"
          >
            Keep Subscription
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={submitCancellationMutation.isPending || !selectedReason}
            className="flex-1"
          >
            {submitCancellationMutation.isPending ? "Canceling..." : "Cancel Subscription"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
