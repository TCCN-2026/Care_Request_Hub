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

// Supplier coverage areas are broader than a single request's prefix - "KA"
// (no digit) validly covers KA1 through KA30, so the digit is optional here.
const coveragePrefixPattern = /^[A-Za-z]{1,2}[0-9]?[A-Za-z0-9]?$/;

const coveragePrefixSchema = z
  .string()
  .trim()
  .min(1, "Enter a postcode area, e.g. KA or KA5")
  .max(4, "Enter a short postcode area, e.g. KA or KA5")
  .regex(coveragePrefixPattern, "Enter a valid postcode area, e.g. KA, G1 or EH12")
  .transform((value) => value.toUpperCase());

export const coveragePrefixesSchema = z
  .array(coveragePrefixSchema)
  .min(1, "Add at least one postcode area you cover");
