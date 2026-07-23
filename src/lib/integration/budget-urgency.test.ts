/**
 * Integration tests for the optional budget range and urgency level on a
 * request - covers what a unit test on the serializer alone can't: that a
 * real, RLS-gated supplier query actually returns these fields (and that
 * urgency can be filtered on at the query level, the same way the
 * opportunities feed page does it). Skipped automatically without live
 * Supabase credentials, same as the other integration suites.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCredentials = !!(url && anonKey && serviceKey);

const password = "TestPassword123!";
const createdUserIds: string[] = [];
const createdOrgIds: string[] = [];
const createdRequestIds: string[] = [];

let admin: SupabaseClient;

async function createSignedInUser(accountType: "care_provider" | "supplier" | "platform_admin") {
  const email = `vitest-budget-${accountType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { account_type: accountType },
  });
  if (createError || !created.user) throw new Error(`createUser: ${createError?.message}`);
  createdUserIds.push(created.user.id);

  const client = createClient(url!, anonKey!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`signIn: ${signInError.message}`);

  return { client, userId: created.user.id };
}

async function joinOrg(
  userId: string,
  org: { type: "care_provider" | "supplier" | "platform_admin"; name: string; postcodePrefix?: string; coveragePrefixes?: string[] },
) {
  const { data: created, error } = await admin
    .from("organisations")
    .insert({
      type: org.type,
      name: org.name,
      status: "active",
      postcode_prefix: org.postcodePrefix ?? null,
      coverage_prefixes: org.coveragePrefixes ?? [],
      is_ccn_member: org.type === "supplier",
    })
    .select("id")
    .single();
  if (error || !created) throw new Error(`createOrg: ${error?.message}`);
  createdOrgIds.push(created.id);
  await admin.from("organisation_members").insert({ organisation_id: created.id, user_id: userId, role: "owner" });
  await admin.from("profiles").upsert({ id: userId, full_name: "Vitest Budget User" });
  return created.id as string;
}

describe.skipIf(!hasCredentials)("Budget range and urgency level on requests (live Supabase)", () => {
  beforeAll(() => {
    admin = createClient(url!, serviceKey!, { auth: { autoRefreshToken: false, persistSession: false } });
  });

  afterAll(async () => {
    for (const id of createdRequestIds) {
      try {
        await admin.from("requests").delete().eq("id", id);
      } catch {
        // best-effort cleanup
      }
    }
    for (const id of createdUserIds) {
      try {
        await admin.auth.admin.deleteUser(id);
      } catch {
        // best-effort cleanup
      }
    }
    for (const id of createdOrgIds) {
      try {
        await admin.from("organisations").delete().eq("id", id);
      } catch {
        // best-effort cleanup
      }
    }
  });

  it("shows a matching supplier the provider's budget range and urgency, and never requires a budget to be set", async () => {
    const { data: category } = await admin.from("categories").select("id").limit(1).single();

    const provider = await createSignedInUser("care_provider");
    const providerOrgId = await joinOrg(provider.userId, {
      type: "care_provider",
      name: `Vitest Budget Provider ${Date.now()}`,
      postcodePrefix: "KA5",
    });

    const closingDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const { data: withBudget, error: withBudgetError } = await admin
      .from("requests")
      .insert({
        provider_org_id: providerOrgId,
        category_id: category!.id,
        title: "Vitest request with a budget range",
        description: "Integration test fixture request with a budget range set.",
        postcode_prefix: "KA5",
        closing_date: closingDate,
        budget_min: 500,
        budget_max: 2000,
        budget_includes_vat: false,
        urgency: "urgent",
        status: "open",
        created_by: provider.userId,
      })
      .select("id")
      .single();
    if (withBudgetError || !withBudget) throw new Error(`insert withBudget: ${withBudgetError?.message}`);
    createdRequestIds.push(withBudget.id);

    // No budget given at all - this is the "not mandatory" case.
    const { data: withoutBudget, error: withoutBudgetError } = await admin
      .from("requests")
      .insert({
        provider_org_id: providerOrgId,
        category_id: category!.id,
        title: "Vitest request with no budget given",
        description: "Integration test fixture request with no budget range at all.",
        postcode_prefix: "KA5",
        closing_date: closingDate,
        urgency: "exploring",
        status: "open",
        created_by: provider.userId,
      })
      .select("id")
      .single();
    if (withoutBudgetError || !withoutBudget) throw new Error(`insert withoutBudget: ${withoutBudgetError?.message}`);
    createdRequestIds.push(withoutBudget.id);

    const supplier = await createSignedInUser("supplier");
    const supplierOrgId = await joinOrg(supplier.userId, {
      type: "supplier",
      name: `Vitest Budget Supplier ${Date.now()}`,
      coveragePrefixes: ["KA"],
    });
    await admin.from("supplier_categories").insert({ supplier_org_id: supplierOrgId, category_id: category!.id });

    const { data: seenWithBudget } = await supplier.client
      .from("requests")
      .select("id, budget_min, budget_max, budget_includes_vat, urgency")
      .eq("id", withBudget!.id)
      .maybeSingle();
    expect(seenWithBudget).not.toBeNull();
    expect(seenWithBudget!.budget_min).toBe(500);
    expect(seenWithBudget!.budget_max).toBe(2000);
    expect(seenWithBudget!.budget_includes_vat).toBe(false);
    expect(seenWithBudget!.urgency).toBe("urgent");

    const { data: seenWithoutBudget } = await supplier.client
      .from("requests")
      .select("id, budget_min, budget_max, budget_includes_vat, urgency")
      .eq("id", withoutBudget!.id)
      .maybeSingle();
    expect(seenWithoutBudget).not.toBeNull();
    expect(seenWithoutBudget!.budget_min).toBeNull();
    expect(seenWithoutBudget!.budget_max).toBeNull();
    expect(seenWithoutBudget!.budget_includes_vat).toBeNull();
    expect(seenWithoutBudget!.urgency).toBe("exploring");
  });

  it("lets a supplier filter the open requests they can see by urgency level", async () => {
    const { data: category } = await admin.from("categories").select("id").limit(1).single();

    const provider = await createSignedInUser("care_provider");
    const providerOrgId = await joinOrg(provider.userId, {
      type: "care_provider",
      name: `Vitest Urgency Provider ${Date.now()}`,
      postcodePrefix: "KA5",
    });

    const closingDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const urgencyLevels = ["exploring", "standard", "urgent"] as const;
    const requestIdByUrgency = new Map<string, string>();

    for (const urgency of urgencyLevels) {
      const { data: created, error } = await admin
        .from("requests")
        .insert({
          provider_org_id: providerOrgId,
          category_id: category!.id,
          title: `Vitest urgency filter fixture (${urgency})`,
          description: "Integration test fixture request for urgency filtering.",
          postcode_prefix: "KA5",
          closing_date: closingDate,
          urgency,
          status: "open",
          created_by: provider.userId,
        })
        .select("id")
        .single();
      if (error || !created) throw new Error(`insert ${urgency} fixture: ${error?.message}`);
      createdRequestIds.push(created.id);
      requestIdByUrgency.set(urgency, created.id);
    }

    const supplier = await createSignedInUser("supplier");
    const supplierOrgId = await joinOrg(supplier.userId, {
      type: "supplier",
      name: `Vitest Urgency Supplier ${Date.now()}`,
      coveragePrefixes: ["KA"],
    });
    await admin.from("supplier_categories").insert({ supplier_org_id: supplierOrgId, category_id: category!.id });

    // Same filter the opportunities feed page applies server-side.
    const { data: urgentOnly } = await supplier.client
      .from("requests")
      .select("id")
      .eq("status", "open")
      .eq("urgency", "urgent")
      .in("id", [...requestIdByUrgency.values()]);
    expect(urgentOnly?.map((r) => r.id)).toEqual([requestIdByUrgency.get("urgent")]);

    const { data: allThree } = await supplier.client
      .from("requests")
      .select("id")
      .eq("status", "open")
      .in("id", [...requestIdByUrgency.values()]);
    expect(allThree?.length).toBe(3);
  });
});
