import { z } from "zod";
import { postcodePrefixSchema } from "./postcode";

export const requestFormSchema = z.object({
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
  confirmNoPersonalData: z.literal(true, {
    error: "Confirm the request does not include resident, patient or employee personal data",
  }),
});
export type RequestFormInput = z.infer<typeof requestFormSchema>;
