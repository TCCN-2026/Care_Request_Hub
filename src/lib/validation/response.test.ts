import { describe, expect, it } from "vitest";
import { responseFormSchema } from "./response";

const validInput = {
  summary: "We can deliver accredited training on-site within your timeframe.",
  proposedSolution: "A certified trainer delivers a full-day session covering all required topics.",
  oneOffCost: 950,
  recurringCost: undefined,
  vatStatus: "exclusive" as const,
  timescale: "3 weeks from confirmation",
  declarationAccurate: true as const,
};

describe("responseFormSchema", () => {
  it("accepts a well-formed response", () => {
    expect(responseFormSchema.safeParse(validInput).success).toBe(true);
  });

  it("accepts a response with no costs given (both optional)", () => {
    const result = responseFormSchema.safeParse({
      ...validInput,
      oneOffCost: undefined,
      recurringCost: undefined,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a negative cost", () => {
    const result = responseFormSchema.safeParse({ ...validInput, oneOffCost: -50 });
    expect(result.success).toBe(false);
  });

  it("rejects a summary that's too short to be meaningful", () => {
    const result = responseFormSchema.safeParse({ ...validInput, summary: "We can help" });
    expect(result.success).toBe(false);
  });

  it("requires the accuracy declaration to be explicitly true", () => {
    const result = responseFormSchema.safeParse({ ...validInput, declarationAccurate: false });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid VAT status", () => {
    const result = responseFormSchema.safeParse({ ...validInput, vatStatus: "maybe" });
    expect(result.success).toBe(false);
  });
});
