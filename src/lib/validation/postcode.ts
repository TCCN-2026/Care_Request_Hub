import { z } from "zod";

// UK postcode outward-code prefix, e.g. "KA5", "G1", "EH12". Deliberately
// loose (not a full postcode validator) since we only ever match on the
// prefix, never store or expose a full address in this slice.
const postcodePrefixPattern = /^[A-Za-z]{1,2}[0-9][A-Za-z0-9]?$/;

export const postcodePrefixSchema = z
  .string()
  .trim()
  .min(2, "Enter a postcode prefix, e.g. KA5")
  .max(4, "Enter a short postcode prefix, e.g. KA5")
  .regex(postcodePrefixPattern, "Enter a valid postcode prefix, e.g. KA5 or G1")
  .transform((value) => value.toUpperCase());

export const coveragePrefixesSchema = z
  .array(postcodePrefixSchema)
  .min(1, "Add at least one postcode prefix you cover");
