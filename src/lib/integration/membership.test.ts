/**
 * Integration tests for membership gating against the live Supabase
 * project - the free-tier request limit, the CCN-membership bypass, the
 * one-off paid-per-request bypass, and supplier access gating are all
 * enforced by database triggers/RLS (see 0016_membership.sql), not
 * application code, so they need to be proven against the real database.
 * Skipped automatically without credentials.
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
  const email = `vitest-mem-${accountType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
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
    })
    .select("id")
    .single();
  if (error || !created) throw new Error(`createOrg: ${error?.message}`);
  createdOrgIds.push(created.id);
  await admin.from("organisation_members").insert({ organisation_id: created.id, user_id: userId, role: "owner" });
  await admin.from("profiles").upsert({ id: userId, full_name: "Vitest Membership User" });
  return created.id as string;
}

/** Creates a draft, submits it (as the provider), then approves it (as a real authenticated admin). */
async function createAndApprove(
  providerClient: SupabaseClient,
  providerUserId: string,
  adminClient: SupabaseClient,
  adminUserId: string,
  providerOrgId: string,
  categoryId: string,
  title: string,
) {
  const { data: draft, error: insertError } = await providerClient
    .from("requests")
    .insert({
      provider_org_id: providerOrgId,
      category_id: categoryId,
      title,
      description: "Integration test fixture request.",
      postcode_prefix: "KA5",
      closing_date: "2027-01-01",
      status: "draft",
      created_by: providerUserId,
    })
    .select("id")
    .single();
  if (insertError || !draft) throw new Error(`insert: ${insertError?.message}`);

  const { error: submitError } = await providerClient.from("requests").update({ status: "submitted" }).eq("id", draft.id);
  if (submitError) throw new Error(`submit: ${submitError.message}`);

  const { error: approveError } = await adminClient
    .from("requests")
    .update({ status: "open", approved_by: adminUserId, approved_at: new Date().toISOString() })
    .eq("id", draft.id);

  return { id: draft.id as string, approveError };
}

describe.skipIf(!hasCredentials)("Membership gating (live Supabase)", () => {
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

  it("blocks a 6th live request for a non-member provider, lets membership remove the limit, and lets a one-off paid approval through exactly once", async () => {
    const { data: category } = await admin.from("categories").select("id").limit(1).single();

    const adminUser = await createSignedInUser("platform_admin");
    await joinOrg(adminUser.userId, { type: "platform_admin", name: `Vitest Membership Admin ${Date.now()}` });

    const provider = await createSignedInUser("care_provider");
    const providerOrgId = await joinOrg(provider.userId, {
      type: "care_provider",
      name: `Vitest Membership Provider ${Date.now()}`,
      postcodePrefix: "KA5",
    });

    // Fill the free tier: 5 requests should approve cleanly.
    for (let i = 1; i <= 5; i++) {
      const { approveError } = await createAndApprove(
        provider.client,
        provider.userId,
        adminUser.client,
        adminUser.userId,
        providerOrgId,
        category!.id,
        `Vitest free request ${i}`,
      );
      expect(approveError).toBeNull();
    }

    // The 6th is blocked.
    const sixth = await createAndApprove(
      provider.client,
      provider.userId,
      adminUser.client,
      adminUser.userId,
      providerOrgId,
      category!.id,
      "Vitest free request 6 (should be blocked)",
    );
    expect(sixth.approveError).not.toBeNull();

    // Membership removes the limit entirely.
    await admin.from("organisations").update({ is_ccn_member: true }).eq("id", providerOrgId);
    const asMember = await createAndApprove(
      provider.client,
      provider.userId,
      adminUser.client,
      adminUser.userId,
      providerOrgId,
      category!.id,
      "Vitest request as CCN member",
    );
    expect(asMember.approveError).toBeNull();
    await admin.from("organisations").update({ is_ccn_member: false }).eq("id", providerOrgId);

    // A one-off paid-per-request approval lets exactly one extra request
    // through - the next one after it is blocked again.
    const { data: paidDraft } = await provider.client
      .from("requests")
      .insert({
        provider_org_id: providerOrgId,
        category_id: category!.id,
        title: "Vitest paid one-off request",
        description: "Integration test fixture request.",
        postcode_prefix: "KA5",
        closing_date: "2027-01-01",
        status: "draft",
        created_by: provider.userId,
      })
      .select("id")
      .single();
    await provider.client.from("requests").update({ status: "submitted" }).eq("id", paidDraft!.id);

    const { error: markPaidError } = await admin.from("requests").update({ paid_per_request: true }).eq("id", paidDraft!.id);
    expect(markPaidError).toBeNull();

    const { error: paidApproveError } = await adminUser.client
      .from("requests")
      .update({ status: "open", approved_by: adminUser.userId, approved_at: new Date().toISOString() })
      .eq("id", paidDraft!.id);
    expect(paidApproveError).toBeNull();

    const afterPaidOneOff = await createAndApprove(
      provider.client,
      provider.userId,
      adminUser.client,
      adminUser.userId,
      providerOrgId,
      category!.id,
      "Vitest request after the paid one-off (should be blocked again)",
    );
    expect(afterPaidOneOff.approveError).not.toBeNull();

    // Security: a provider can never grant itself membership or mark its
    // own request paid-per-request - only an admin can, via UPDATE.
    const { error: selfMembershipError } = await provider.client
      .from("organisations")
      .update({ is_ccn_member: true })
      .eq("id", providerOrgId);
    expect(selfMembershipError).not.toBeNull();

    const { error: selfPaidError } = await provider.client
      .from("requests")
      .update({ paid_per_request: true })
      .eq("id", sixth.id); // currently false on this still-blocked request
    expect(selfPaidError).not.toBeNull();
  });

  it("prevents a non-member (but verified) supplier from seeing any live requests, and restores access once made a member", async () => {
    const { data: category } = await admin.from("categories").select("id").limit(1).single();

    const provider = await createSignedInUser("care_provider");
    const providerOrgId = await joinOrg(provider.userId, {
      type: "care_provider",
      name: `Vitest Membership Provider 2 ${Date.now()}`,
      postcodePrefix: "KA5",
    });
    await admin.from("organisations").update({ is_ccn_member: true }).eq("id", providerOrgId);
    const { data: request } = await admin
      .from("requests")
      .insert({
        provider_org_id: providerOrgId,
        category_id: category!.id,
        title: "Vitest supplier membership gate check",
        description: "Integration test fixture request.",
        postcode_prefix: "KA5",
        closing_date: "2027-01-01",
        status: "open",
        created_by: provider.userId,
        approved_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    const supplier = await createSignedInUser("supplier");
    const supplierOrgId = await joinOrg(supplier.userId, {
      type: "supplier",
      name: `Vitest Membership Supplier ${Date.now()}`,
      coveragePrefixes: ["KA"],
    });
    await admin.from("supplier_categories").insert({ supplier_org_id: supplierOrgId, category_id: category!.id });

    // Verified, but not a CCN member - should see nothing.
    const seenBeforeMembership = await supplier.client.from("requests").select("id").eq("id", request!.id).maybeSingle();
    expect(seenBeforeMembership.data).toBeNull();

    // Can't respond either.
    const { error: respondBeforeMembershipError } = await supplier.client.from("responses").insert({
      request_id: request!.id,
      supplier_org_id: supplierOrgId,
      created_by: supplier.userId,
      summary: "Vitest response attempt before membership, long enough to pass validation.",
      proposed_solution: "A detailed proposed solution long enough to satisfy the minimum length rule.",
      status: "draft",
    });
    expect(respondBeforeMembershipError).not.toBeNull();

    // Once made a member, the same request becomes visible and respondable.
    await admin.from("organisations").update({ is_ccn_member: true }).eq("id", supplierOrgId);
    const seenAfterMembership = await supplier.client.from("requests").select("id").eq("id", request!.id).maybeSingle();
    expect(seenAfterMembership.data).not.toBeNull();

    const { error: respondAfterMembershipError } = await supplier.client.from("responses").insert({
      request_id: request!.id,
      supplier_org_id: supplierOrgId,
      created_by: supplier.userId,
      summary: "Vitest response attempt after membership, long enough to pass validation.",
      proposed_solution: "A detailed proposed solution long enough to satisfy the minimum length rule.",
      status: "draft",
    });
    expect(respondAfterMembershipError).toBeNull();

    // Security: the supplier can't have granted itself that membership.
    const { error: selfMembershipError } = await supplier.client
      .from("organisations")
      .update({ is_ccn_member: false })
      .eq("id", supplierOrgId);
    expect(selfMembershipError).not.toBeNull();
  });
});
