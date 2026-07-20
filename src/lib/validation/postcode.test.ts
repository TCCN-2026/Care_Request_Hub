import { describe, expect, it } from "vitest";
import { postcodePrefixSchema, coveragePrefixesSchema } from "./postcode";

describe("postcodePrefixSchema (single request prefix)", () => {
  it.each(["KA5", "G1", "EH12", "ka5"])("accepts %s", (value) => {
    expect(postcodePrefixSchema.safeParse(value).success).toBe(true);
  });

  it("uppercases the result", () => {
    const result = postcodePrefixSchema.safeParse("ka5");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("KA5");
  });

  it.each(["KA", "G", "", "TOOLONG5", "5KA"])("rejects %s (must include a digit, e.g. KA5)", (value) => {
    expect(postcodePrefixSchema.safeParse(value).success).toBe(false);
  });
});

describe("coveragePrefixesSchema (supplier coverage areas)", () => {
  it("accepts broad areas without a digit, e.g. KA or G", () => {
    const result = coveragePrefixesSchema.safeParse(["KA", "G", "ML"]);
    expect(result.success).toBe(true);
  });

  it("also accepts a specific prefix like KA5", () => {
    expect(coveragePrefixesSchema.safeParse(["KA5"]).success).toBe(true);
  });

  it("rejects an empty list", () => {
    expect(coveragePrefixesSchema.safeParse([]).success).toBe(false);
  });

  it("rejects clearly invalid entries", () => {
    expect(coveragePrefixesSchema.safeParse(["12345", ""]).success).toBe(false);
  });
});
