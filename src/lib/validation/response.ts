import { z } from "zod";

export const responseFormSchema = z.object({
  summary: z.string().trim().min(20, "Summarise your response in a bit more detail").max(500),
  proposedSolution: z.string().trim().min(30, "Describe your proposed solution"),
  oneOffCost: z.number().nonnegative().optional(),
  recurringCost: z.number().nonnegative().optional(),
  vatStatus: z.enum(["inclusive", "exclusive", "not_applicable"]),
  timescale: z.string().trim().max(200).optional().or(z.literal("")),
  declarationAccurate: z.literal(true, {
    error: "Confirm the information provided is accurate",
  }),
});
export type ResponseFormInput = z.infer<typeof responseFormSchema>;
