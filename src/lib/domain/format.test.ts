import { describe, expect, it } from "vitest";
import { formatBudgetRange } from "./format";

describe("formatBudgetRange", () => {
  it("returns null when no budget was given at all", () => {
    expect(formatBudgetRange(null, null, null)).toBeNull();
  });

  it("formats a full low-high range", () => {
    expect(formatBudgetRange(500, 2000, null)).toBe("£500 - £2,000");
  });

  it("formats a lower bound only as 'From'", () => {
    expect(formatBudgetRange(500, null, null)).toBe("From £500");
  });

  it("formats an upper bound only as 'Up to'", () => {
    expect(formatBudgetRange(null, 2000, null)).toBe("Up to £2,000");
  });

  it("appends the VAT status when known", () => {
    expect(formatBudgetRange(500, 2000, true)).toBe("£500 - £2,000 (incl. VAT)");
    expect(formatBudgetRange(500, 2000, false)).toBe("£500 - £2,000 (excl. VAT)");
  });

  it("omits the VAT note when not specified", () => {
    expect(formatBudgetRange(500, 2000, null)).toBe("£500 - £2,000");
  });
});
