import type { RequestStatus, ResponseStatus, IntroductionDecision } from "@/types/domain";

/**
 * Status is always shown with this text label, never colour alone -
 * badges pair a colour variant with one of these strings.
 */
export const requestStatusLabels: Record<RequestStatus, string> = {
  draft: "Draft",
  submitted: "Submitted for review",
  approved: "Approved",
  open: "Open for responses",
  closed_to_responses: "Closed to responses",
  cancelled: "Cancelled",
};

export const responseStatusLabels: Record<ResponseStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  withdrawn: "Withdrawn",
  shortlisted: "Shortlisted",
  declined: "Declined",
  introduced: "Introduced",
};

export const introductionDecisionLabels: Record<IntroductionDecision, string> = {
  pending: "Awaiting admin review",
  approved: "Approved",
  rejected: "Not approved",
};

export const requestStatusBadgeVariant: Record<RequestStatus, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  submitted: "secondary",
  approved: "secondary",
  open: "default",
  closed_to_responses: "outline",
  cancelled: "destructive",
};

export const responseStatusBadgeVariant: Record<ResponseStatus, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  submitted: "secondary",
  withdrawn: "destructive",
  shortlisted: "default",
  declined: "destructive",
  introduced: "default",
};
