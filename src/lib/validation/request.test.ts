import { describe, expect, it } from "vitest";
import { requestFormSchema } from "./request";

const validInput = {
  title: "Manual handling training for care staff",
  categoryId: "11111111-1111-4111-8111-111111111111",
  description: "We need an accredited trainer to deliver manual handling training for our staff.",
  desiredOutcome: "",
  mandatoryRequirements: "",
  postcodePrefix: "KA5",
  closingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  urgency: "standard" as const,
  confirmNoPersonalData: true as const,
};

describe("requestFormSchema", () => {
  it("accepts a well-formed request", () => {
    expect(requestFormSchema.safeParse(validInput).success).toBe(true);
  });

  it("rejects a closing date in the past", () => {
    const result = requestFormSchema.safeParse({ ...validInput, closingDate: "2020-01-01" });
    expect(result.success).toBe(false);
  });

  it("rejects a title that's too short to be meaningful", () => {
    const result = requestFormSchema.safeParse({ ...validInput, title: "Hi" });
    expect(result.success).toBe(false);
  });

  it("rejects a description that's too short to be meaningful", () => {
    const result = requestFormSchema.safeParse({ ...validInput, description: "Need stuff" });
    expect(result.success).toBe(false);
  });

  it("requires the no-personal-data confirmation to be explicitly true", () => {
    const result = requestFormSchema.safeParse({ ...validInput, confirmNoPersonalData: false });
    expect(result.success).toBe(false);
  });

  it("requires a category to be chosen", () => {
    const result = requestFormSchema.safeParse({ ...validInput, categoryId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("does not require a budget range at all", () => {
    const result = requestFormSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.budgetMin).toBeUndefined();
      expect(result.data.budgetMax).toBeUndefined();
    }
  });

  it("accepts just a lower bound with no upper bound", () => {
    const result = requestFormSchema.safeParse({ ...validInput, budgetMin: 500 });
    expect(result.success).toBe(true);
  });

  it("accepts just an upper bound with no lower bound", () => {
    const result = requestFormSchema.safeParse({ ...validInput, budgetMax: 2000 });
    expect(result.success).toBe(true);
  });

  it("rejects a budget range where the upper bound is below the lower bound", () => {
    const result = requestFormSchema.safeParse({ ...validInput, budgetMin: 2000, budgetMax: 500 });
    expect(result.success).toBe(false);
  });

  it("rejects a negative budget figure", () => {
    const result = requestFormSchema.safeParse({ ...validInput, budgetMin: -100 });
    expect(result.success).toBe(false);
  });

  it("requires an urgency level to be chosen", () => {
    const { urgency, ...withoutUrgency } = validInput;
    void urgency;
    const result = requestFormSchema.safeParse(withoutUrgency);
    expect(result.success).toBe(false);
  });

  it("accepts an explicit urgency level", () => {
    const result = requestFormSchema.safeParse({ ...validInput, urgency: "urgent" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.urgency).toBe("urgent");
    }
  });

  it("rejects an unrecognised urgency value", () => {
    const result = requestFormSchema.safeParse({ ...validInput, urgency: "asap" });
    expect(result.success).toBe(false);
  });
});
