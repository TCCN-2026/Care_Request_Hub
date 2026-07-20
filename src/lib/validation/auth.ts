import { z } from "zod";
import { postcodePrefixSchema, coveragePrefixesSchema } from "./postcode";

export const signUpSchema = z.object({
  email: z.string().trim().email("Enter a valid work email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  accountType: z.enum(["care_provider", "supplier"]),
});
export type SignUpInput = z.infer<typeof signUpSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});
export type LoginInput = z.infer<typeof loginSchema>;

const onboardingBase = z.object({
  organisationName: z.string().trim().min(2, "Enter your organisation's name"),
  fullName: z.string().trim().min(2, "Enter your full name"),
  jobTitle: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(30).optional(),
  acceptedTerms: z.literal(true, {
    error: "You must accept the platform rules to continue",
  }),
});

export const providerOnboardingSchema = onboardingBase.extend({
  accountType: z.literal("care_provider"),
  postcodePrefix: postcodePrefixSchema,
});
export type ProviderOnboardingInput = z.infer<typeof providerOnboardingSchema>;

export const supplierOnboardingSchema = onboardingBase.extend({
  accountType: z.literal("supplier"),
  coveragePrefixes: coveragePrefixesSchema,
  categoryIds: z.array(z.string().uuid()).min(1, "Select at least one category"),
});
export type SupplierOnboardingInput = z.infer<typeof supplierOnboardingSchema>;
