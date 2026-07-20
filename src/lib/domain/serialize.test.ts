import { describe, expect, it } from "vitest";
import { toSupplierVisibleRequest, anonymousSupplierLabel } from "./serialize";

describe("toSupplierVisibleRequest", () => {
  const fullRow = {
    id: "req-1",
    reference: "CRH-2026-00001",
    provider_org_id: "provider-org-1",
    category_id: "cat-1",
    title: "Manual handling training",
    description: "Need training for staff",
    desired_outcome: "Certified staff",
    mandatory_requirements: null,
    postcode_prefix: "KA5",
    closing_date: "2026-09-01",
    status: "open" as const,
    created_by: "provider-user-1",
    approved_by: "admin-user-1",
    submitted_at: "2026-07-01T00:00:00Z",
    approved_at: "2026-07-02T00:00:00Z",
    created_at: "2026-06-30T00:00:00Z",
    updated_at: "2026-07-02T00:00:00Z",
  };

  it("carries over every safe field", () => {
    const result = toSupplierVisibleRequest(fullRow);
    expect(result).toMatchObject({
      id: "req-1",
      reference: "CRH-2026-00001",
      title: "Manual handling training",
      categoryId: "cat-1",
      description: "Need training for staff",
      desiredOutcome: "Certified staff",
      mandatoryRequirements: null,
      postcodePrefix: "KA5",
      closingDate: "2026-09-01",
      status: "open",
      createdAt: "2026-06-30T00:00:00Z",
    });
  });

  it("never exposes provider-identifying fields, even if present on the source row", () => {
    const result = toSupplierVisibleRequest(fullRow) as unknown as Record<string, unknown>;
    expect(result.provider_org_id).toBeUndefined();
    expect(result.providerOrgId).toBeUndefined();
    expect(result.created_by).toBeUndefined();
    expect(result.createdBy).toBeUndefined();
    expect(result.approved_by).toBeUndefined();
    expect(result.approvedBy).toBeUndefined();
  });

  it("only ever returns the documented allow-list of keys", () => {
    const result = toSupplierVisibleRequest(fullRow);
    expect(Object.keys(result).sort()).toEqual(
      [
        "id",
        "reference",
        "title",
        "categoryId",
        "description",
        "desiredOutcome",
        "mandatoryRequirements",
        "postcodePrefix",
        "closingDate",
        "status",
        "createdAt",
      ].sort(),
    );
  });
});

describe("anonymousSupplierLabel", () => {
  it("labels suppliers A, B, C in order", () => {
    expect(anonymousSupplierLabel(0)).toBe("Supplier A");
    expect(anonymousSupplierLabel(1)).toBe("Supplier B");
    expect(anonymousSupplierLabel(2)).toBe("Supplier C");
  });

  it("wraps around past Z rather than throwing", () => {
    expect(anonymousSupplierLabel(26)).toBe("Supplier A");
  });
});
