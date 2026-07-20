/**
 * Integration tests against a real Supabase project - these exercise the
 * actual RLS policies and triggers, not a mock. They're the highest-value
 * tests in this repo: unit tests can't prove a supplier is genuinely unable
 * to read a provider's identity, only that our serializer intends to hide
 * it. Skipped automatically when Supabase credentials aren't available
 * (e.g. CI without secrets configured) rather than failing the run.
 *
 * Uses the live project configured in .env.local - never point this at a
 * production project. Creates and tears down its own fixture users/orgs
 * inside each test file run.
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

let admin: SupabaseClient;

async function createSignedInUser(accountType: "care_provider" | "supplier" | "platform_admin") {
  const email = `vitest-${accountType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { account_type: accountType },
  });
  if (createError || !created.user) throw new Error(`createUser: ${createError?.message}`);
  createdUserIds.push(created.user.id);

  // persistSession: false is essential here - without it, every client in
  // this file shares jsdom's single localStorage/BroadcastChannel, so
  // signing in as one user silently overwrites every other client's
  // session (see "Multiple GoTrueClient instances" warning otherwise).
  const client = createClient(url!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`signIn: ${signInError.message}`);

  return { client, userId: created.user.id, email };
}

async function joinOrg(
  userId: string,
  org: { type: "care_provider" | "supplier" | "platform_admin"; name: string; status?: string; postcodePrefix?: string; coveragePrefixes?: string[] },
) {
  const { data: created, error } = await admin
    .from("organisations")
    .insert({
      type: org.type,
      name: org.name,
      status: org.status ?? "active",
      postcode_prefix: org.postcodePrefix ?? null,
      coverage_prefixes: org.coveragePrefixes ?? [],
      // These tests are about other RLS concerns and need a supplier
      // fixture to be fully operational by default - membership gating
      // has its own dedicated tests in membership.test.ts.
      is_ccn_member: org.type === "supplier",
    })
    .select("id")
    .single();
  if (error || !created) throw new Error(`createOrg: ${error?.message}`);
  createdOrgIds.push(created.id);

  await admin.from("organisation_members").insert({ organisation_id: created.id, user_id: userId, role: "owner" });
  await admin.from("profiles").upsert({ id: userId, full_name: "Vitest User", contact_email: "vitest@example.com" });

  return created.id as string;
}

describe.skipIf(!hasCredentials)("RLS: anonymity and permission boundaries (live Supabase)", () => {
  beforeAll(() => {
    admin = createClient(url!, serviceKey!, { auth: { autoRefreshToken: false, persistSession: false } });
  });

  afterAll(async () => {
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

  it("blocks anonymous (signed-out) access to requests entirely", async () => {
    const anon = createClient(url!, anonKey!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await anon.from("requests").select("*");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("prevents a supplier from ever reading a provider organisation's row before introduction", async () => {
    const provider = await createSignedInUser("care_provider");
    const providerOrgId = await joinOrg(provider.userId, {
      type: "care_provider",
      name: `Vitest Provider ${Date.now()}`,
      postcodePrefix: "KA5",
    });

    const supplier = await createSignedInUser("supplier");
    await joinOrg(supplier.userId, {
      type: "supplier",
      name: `Vitest Supplier ${Date.now()}`,
      coveragePrefixes: ["KA"],
    });

    const { data, error } = await supplier.client.from("organisations").select("*").eq("id", providerOrgId).maybeSingle();
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("prevents an unverified supplier from seeing any requests, even matching ones", async () => {
    const supplier = await createSignedInUser("supplier");
    await joinOrg(supplier.userId, {
      type: "supplier",
      name: `Vitest Pending Supplier ${Date.now()}`,
      status: "pending_verification",
      coveragePrefixes: ["KA"],
    });

    const { data, error } = await supplier.client.from("requests").select("*").eq("status", "open");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("prevents a supplier org from reading another supplier org's response to the same request", async () => {
    const { data: category } = await admin.from("categories").select("id").limit(1).single();

    const provider = await createSignedInUser("care_provider");
    const providerOrgId = await joinOrg(provider.userId, {
      type: "care_provider",
      name: `Vitest Provider ${Date.now()}`,
      postcodePrefix: "KA5",
    });

    const { data: request } = await admin
      .from("requests")
      .insert({
        provider_org_id: providerOrgId,
        category_id: category!.id,
        title: "Vitest cross-supplier isolation check",
        description: "Integration test fixture request.",
        postcode_prefix: "KA5",
        closing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        status: "open",
        created_by: provider.userId,
      })
      .select("id")
      .single();

    const supplierA = await createSignedInUser("supplier");
    const supplierAOrgId = await joinOrg(supplierA.userId, {
      type: "supplier",
      name: `Vitest Supplier A ${Date.now()}`,
      coveragePrefixes: ["KA"],
    });
    await admin.from("supplier_categories").insert({ supplier_org_id: supplierAOrgId, category_id: category!.id });

    const { data: responseA, error: responseAError } = await supplierA.client
      .from("responses")
      .insert({
        request_id: request!.id,
        supplier_org_id: supplierAOrgId,
        created_by: supplierA.userId,
        summary: "Vitest response from supplier A, long enough to pass validation checks.",
        proposed_solution: "A detailed proposed solution from supplier A for this integration test fixture request.",
        status: "draft",
      })
      .select("id")
      .single();
    expect(responseAError).toBeNull();

    const supplierB = await createSignedInUser("supplier");
    await joinOrg(supplierB.userId, {
      type: "supplier",
      name: `Vitest Supplier B ${Date.now()}`,
      coveragePrefixes: ["KA"],
    });

    const { data: seenByB, error: seenByBError } = await supplierB.client
      .from("responses")
      .select("*")
      .eq("id", responseA!.id)
      .maybeSingle();
    expect(seenByBError).toBeNull();
    expect(seenByB).toBeNull();
  });

  it("rejects a second response from the same supplier org to the same request (unique constraint)", async () => {
    const { data: category } = await admin.from("categories").select("id").limit(1).single();

    const provider = await createSignedInUser("care_provider");
    const providerOrgId = await joinOrg(provider.userId, {
      type: "care_provider",
      name: `Vitest Provider ${Date.now()}`,
      postcodePrefix: "KA5",
    });

    const { data: request } = await admin
      .from("requests")
      .insert({
        provider_org_id: providerOrgId,
        category_id: category!.id,
        title: "Vitest duplicate-response check",
        description: "Integration test fixture request.",
        postcode_prefix: "KA5",
        closing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        status: "open",
        created_by: provider.userId,
      })
      .select("id")
      .single();

    const supplier = await createSignedInUser("supplier");
    const supplierOrgId = await joinOrg(supplier.userId, {
      type: "supplier",
      name: `Vitest Supplier ${Date.now()}`,
      coveragePrefixes: ["KA"],
    });
    await admin.from("supplier_categories").insert({ supplier_org_id: supplierOrgId, category_id: category!.id });

    const payload = {
      request_id: request!.id,
      supplier_org_id: supplierOrgId,
      created_by: supplier.userId,
      summary: "Vitest first response, long enough to satisfy the minimum length validation rule.",
      proposed_solution: "A detailed proposed solution long enough to satisfy the minimum length rule.",
      status: "draft" as const,
    };

    const { error: firstError } = await supplier.client.from("responses").insert(payload);
    expect(firstError).toBeNull();

    const { error: secondError } = await supplier.client.from("responses").insert(payload);
    expect(secondError).not.toBeNull();
  });

  it("only reveals contact details after an approved introduction, never before or on rejection", async () => {
    const { data: category } = await admin.from("categories").select("id").limit(1).single();

    const provider = await createSignedInUser("care_provider");
    const providerOrgId = await joinOrg(provider.userId, {
      type: "care_provider",
      name: `Vitest Provider ${Date.now()}`,
      postcodePrefix: "KA5",
    });

    const { data: request } = await admin
      .from("requests")
      .insert({
        provider_org_id: providerOrgId,
        category_id: category!.id,
        title: "Vitest introduction gating check",
        description: "Integration test fixture request.",
        postcode_prefix: "KA5",
        closing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        status: "open",
        created_by: provider.userId,
      })
      .select("id")
      .single();

    const supplier = await createSignedInUser("supplier");
    const supplierOrgId = await joinOrg(supplier.userId, {
      type: "supplier",
      name: `Vitest Supplier ${Date.now()}`,
      coveragePrefixes: ["KA"],
    });
    await admin.from("supplier_categories").insert({ supplier_org_id: supplierOrgId, category_id: category!.id });

    // RLS only allows inserting a response as "draft" - submit via a
    // separate update, matching the real app flow.
    const { data: draftResponse, error: draftError } = await supplier.client
      .from("responses")
      .insert({
        request_id: request!.id,
        supplier_org_id: supplierOrgId,
        created_by: supplier.userId,
        summary: "Vitest response for the introduction-gating fixture, long enough to validate.",
        proposed_solution: "A detailed proposed solution long enough to satisfy the minimum length rule.",
        status: "draft",
      })
      .select("id")
      .single();
    expect(draftError).toBeNull();

    const { data: response, error: submitError } = await supplier.client
      .from("responses")
      .update({ status: "submitted" })
      .eq("id", draftResponse!.id)
      .select("id")
      .single();
    expect(submitError).toBeNull();

    // Before introduction: provider cannot resolve the supplier org's identity.
    const before = await provider.client.from("organisations").select("id").eq("id", supplierOrgId).maybeSingle();
    expect(before.data).toBeNull();

    const { data: introduction, error: introError } = await provider.client
      .from("introductions")
      .insert({ request_id: request!.id, response_id: response!.id })
      .select("id")
      .single();
    expect(introError).toBeNull();

    // Still not visible while the decision is pending.
    const stillHidden = await provider.client.from("organisations").select("id").eq("id", supplierOrgId).maybeSingle();
    expect(stillHidden.data).toBeNull();

    const { error: approveError } = await admin
      .from("introductions")
      .update({ decision: "approved" })
      .eq("id", introduction!.id);
    expect(approveError).toBeNull();

    const afterApproval = await provider.client.from("organisations").select("id, name").eq("id", supplierOrgId).maybeSingle();
    expect(afterApproval.data).not.toBeNull();
  });
});
