import { z } from "zod";
import { postcodePrefixSchema } from "./postcode";

export const requestFormSchema = z
  .object({
    title: z.string().trim().min(5, "Give the request a short, clear title").max(150),
    categoryId: z.string().uuid("Choose a category"),
    description: z.string().trim().min(30, "Describe what you need in a bit more detail"),
    desiredOutcome: z.string().trim().max(2000).optional().or(z.literal("")),
    mandatoryRequirements: z.string().trim().max(2000).optional().or(z.literal("")),
    postcodePrefix: postcodePrefixSchema,
    closingDate: z
      .string()
      .refine((value) => !Number.isNaN(Date.parse(value)), "Enter a valid closing date")
      .refine((value) => new Date(value).getTime() > Date.now(), "Closing date must be in the future"),
    budgetMin: z.number().nonnegative("Budget can't be negative").optional(),
    budgetMax: z.number().nonnegative("Budget can't be negative").optional(),
    budgetIncludesVat: z.boolean().optional(),
    urgency: z.enum(["exploring", "standard", "urgent"]),
    confirmNoPersonalData: z.literal(true, {
      error: "Confirm the request does not include resident, patient or employee personal data",
    }),
  })
  .refine((data) => data.budgetMin === undefined || data.budgetMax === undefined || data.budgetMax >= data.budgetMin, {
    message: "The upper budget can't be lower than the lower budget",
    path: ["budgetMax"],
  });
export type RequestFormInput = z.infer<typeof requestFormSchema>;
