import { describe, expect, it } from "vitest";
import {
  signUpSchema,
  providerOnboardingSchema,
  supplierOnboardingSchema,
} from "./auth";

describe("signUpSchema", () => {
  it("accepts a valid provider signup", () => {
    const result = signUpSchema.safeParse({
      email: "provider@example.com",
      password: "password123",
      accountType: "care_provider",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a password under 8 characters", () => {
    const result = signUpSchema.safeParse({
      email: "provider@example.com",
      password: "short",
      accountType: "care_provider",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = signUpSchema.safeParse({
      email: "not-an-email",
      password: "password123",
      accountType: "care_provider",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an account type of platform_admin - no public admin registration", () => {
    const result = signUpSchema.safeParse({
      email: "admin@example.com",
      password: "password123",
      accountType: "platform_admin",
    });
    expect(result.success).toBe(false);
  });
});

describe("providerOnboardingSchema", () => {
  const base = {
    accountType: "care_provider" as const,
    organisationName: "Ayrshire Care Homes",
    postcodePrefix: "KA5",
    fullName: "Jane Provider",
    acceptedTerms: true as const,
  };

  it("accepts a valid provider onboarding submission", () => {
    expect(providerOnboardingSchema.safeParse(base).success).toBe(true);
  });

  it("requires terms acceptance to be explicitly true", () => {
    const result = providerOnboardingSchema.safeParse({ ...base, acceptedTerms: false });
    expect(result.success).toBe(false);
  });

  it("requires a postcode prefix", () => {
    const result = providerOnboardingSchema.safeParse({ ...base, postcodePrefix: "" });
    expect(result.success).toBe(false);
  });
});

describe("supplierOnboardingSchema", () => {
  const base = {
    accountType: "supplier" as const,
    organisationName: "Ayrshire Training Solutions",
    coveragePrefixes: ["KA", "G"],
    categoryIds: ["11111111-1111-4111-8111-111111111111"],
    fullName: "Priya Supplier",
    acceptedTerms: true as const,
  };

  it("accepts a valid supplier onboarding submission", () => {
    expect(supplierOnboardingSchema.safeParse(base).success).toBe(true);
  });

  it("requires at least one category", () => {
    const result = supplierOnboardingSchema.safeParse({ ...base, categoryIds: [] });
    expect(result.success).toBe(false);
  });

  it("requires at least one coverage area", () => {
    const result = supplierOnboardingSchema.safeParse({ ...base, coveragePrefixes: [] });
    expect(result.success).toBe(false);
  });
});
