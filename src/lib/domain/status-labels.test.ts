import { describe, expect, it } from "vitest";
import {
  requestStatusLabels,
  responseStatusLabels,
  introductionDecisionLabels,
  requestStatusBadgeVariant,
  responseStatusBadgeVariant,
} from "./status-labels";
import type { RequestStatus, ResponseStatus, IntroductionDecision } from "@/types/domain";

const requestStatuses: RequestStatus[] = [
  "draft",
  "submitted",
  "approved",
  "open",
  "closed_to_responses",
  "cancelled",
];

const responseStatuses: ResponseStatus[] = [
  "draft",
  "submitted",
  "withdrawn",
  "shortlisted",
  "declined",
  "introduced",
];

const introductionDecisions: IntroductionDecision[] = ["pending", "approved", "rejected"];

describe("status label completeness", () => {
  it("has a human-readable label and badge variant for every request status", () => {
    for (const status of requestStatuses) {
      expect(requestStatusLabels[status]).toBeTruthy();
      expect(requestStatusBadgeVariant[status]).toBeTruthy();
    }
  });

  it("has a human-readable label and badge variant for every response status", () => {
    for (const status of responseStatuses) {
      expect(responseStatusLabels[status]).toBeTruthy();
      expect(responseStatusBadgeVariant[status]).toBeTruthy();
    }
  });

  it("has a human-readable label for every introduction decision", () => {
    for (const decision of introductionDecisions) {
      expect(introductionDecisionLabels[decision]).toBeTruthy();
    }
  });

  it("never labels a cancelled or declined status with the same wording as a positive one", () => {
    expect(requestStatusLabels.cancelled).not.toBe(requestStatusLabels.open);
    expect(responseStatusLabels.declined).not.toBe(responseStatusLabels.shortlisted);
  });
});
