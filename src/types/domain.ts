export type OrganisationType = "care_provider" | "supplier" | "platform_admin";

export type OrganisationMemberRole = "owner" | "manager" | "contributor" | "viewer";

/**
 * MVP core-loop status set. The full spec's larger state machine
 * (returned/rejected/archived/etc.) is deferred to a later slice.
 */
export type RequestStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "open"
  | "closed_to_responses"
  | "cancelled";

// "Introduction requested/approved" is tracked via the introductions table
// (decision: pending/approved/rejected) rather than duplicated here.
export type ResponseStatus =
  | "draft"
  | "submitted"
  | "withdrawn"
  | "shortlisted"
  | "declined"
  | "introduced";

export type IntroductionDecision = "pending" | "approved" | "rejected";

export type UserRole = "provider" | "supplier" | "admin";

export type VerificationDocumentType =
  | "public_liability_insurance"
  | "professional_indemnity_insurance"
  | "accreditation";

export type VerificationDocumentStatus = "pending_review" | "approved" | "rejected";
