// @vitest-environment node
/**
 * Integration tests for request/response messaging against the live
 * Supabase project - covers exactly the guarantees that can't be proven
 * by unit tests: cross-supplier thread isolation, identity staying hidden
 * in a live conversation until an introduction is approved, and the
 * contact-info flagging trigger actually firing for real inserts (not
 * just admin-authored ones). Skipped automatically without credentials.
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
  const email = `vitest-msg-${accountType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
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
  await admin.from("profiles").upsert({ id: userId, full_name: "Vitest Messaging User" });
  return created.id as string;
}

async function makeOpenRequest(providerOrgId: string, createdBy: string, title: string) {
  const { data: category } = await admin.from("categories").select("id").limit(1).single();
  const { data: request } = await admin
    .from("requests")
    .insert({
      provider_org_id: providerOrgId,
      category_id: category!.id,
      title,
      description: "Integration test fixture request.",
      postcode_prefix: "KA5",
      closing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      status: "open",
      created_by: createdBy,
    })
    .select("id")
    .single();
  return request!.id as string;
}

async function makeVerifiedSupplier(name: string) {
  const { data: category } = await admin.from("categories").select("id").limit(1).single();
  const supplier = await createSignedInUser("supplier");
  const supplierOrgId = await joinOrg(supplier.userId, { type: "supplier", name, coveragePrefixes: ["KA"] });
  await admin.from("supplier_categories").insert({ supplier_org_id: supplierOrgId, category_id: category!.id });
  return { ...supplier, orgId: supplierOrgId };
}

async function submitResponse(supplierClient: SupabaseClient, requestId: string, supplierOrgId: string, userId: string) {
  // RLS only allows inserting a response as "draft" - submit via a
  // separate update, matching the real app flow.
  const { data: draft, error: draftError } = await supplierClient
    .from("responses")
    .insert({
      request_id: requestId,
      supplier_org_id: supplierOrgId,
      created_by: userId,
      summary: "Vitest messaging fixture response, long enough to satisfy validation.",
      proposed_solution: "A detailed proposed solution long enough to satisfy the minimum length rule.",
      status: "draft",
    })
    .select("id")
    .single();
  if (draftError) throw new Error(`submitResponse (draft): ${draftError.message}`);

  const { data: submitted, error: submitError } = await supplierClient
    .from("responses")
    .update({ status: "submitted" })
    .eq("id", draft!.id)
    .select("id")
    .single();
  if (submitError) throw new Error(`submitResponse (submit): ${submitError.message}`);
  return submitted!.id as string;
}

describe.skipIf(!hasCredentials)("Messaging: RLS and content flagging (live Supabase)", () => {
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

  it("prevents a supplier from seeing another supplier's message thread or messages", async () => {
    const provider = await createSignedInUser("care_provider");
    const providerOrgId = await joinOrg(provider.userId, {
      type: "care_provider",
      name: `Vitest Msg Provider ${Date.now()}`,
      postcodePrefix: "KA5",
    });
    const requestId = await makeOpenRequest(providerOrgId, provider.userId, "Vitest cross-supplier thread isolation");

    const supplierA = await makeVerifiedSupplier(`Vitest Msg Supplier A ${Date.now()}`);
    await submitResponse(supplierA.client, requestId, supplierA.orgId, supplierA.userId);

    const { data: threadA, error: threadAError } = await supplierA.client
      .from("message_threads")
      .insert({ request_id: requestId, supplier_org_id: supplierA.orgId })
      .select("id")
      .single();
    expect(threadAError).toBeNull();

    const { error: messageAError } = await supplierA.client.from("messages").insert({
      thread_id: threadA!.id,
      sender_org_id: supplierA.orgId,
      sender_user_id: supplierA.userId,
      body: "Hello, I have a question about site access.",
    });
    expect(messageAError).toBeNull();

    const supplierB = await makeVerifiedSupplier(`Vitest Msg Supplier B ${Date.now()}`);
    await submitResponse(supplierB.client, requestId, supplierB.orgId, supplierB.userId);

    // Supplier B can't see supplier A's thread at all...
    const threadSeenByB = await supplierB.client.from("message_threads").select("id").eq("id", threadA!.id).maybeSingle();
    expect(threadSeenByB.data).toBeNull();

    // ...nor A's messages, even querying by thread_id directly.
    const messagesSeenByB = await supplierB.client.from("messages").select("*").eq("thread_id", threadA!.id);
    expect(messagesSeenByB.data).toEqual([]);

    // Nor can B insert into A's thread by guessing its id.
    const { error: forgedInsertError } = await supplierB.client.from("messages").insert({
      thread_id: threadA!.id,
      sender_org_id: supplierB.orgId,
      sender_user_id: supplierB.userId,
      body: "Trying to inject a message into someone else's thread.",
    });
    expect(forgedInsertError).not.toBeNull();
  });

  it("keeps both sides anonymous in the conversation until an introduction is approved, then reveals identity", async () => {
    const provider = await createSignedInUser("care_provider");
    const providerOrgId = await joinOrg(provider.userId, {
      type: "care_provider",
      name: `Vitest Msg Provider ${Date.now()}`,
      postcodePrefix: "KA5",
    });
    const requestId = await makeOpenRequest(providerOrgId, provider.userId, "Vitest identity-hidden-until-introduction");

    const supplier = await makeVerifiedSupplier(`Vitest Msg Supplier ${Date.now()}`);
    const responseId = await submitResponse(supplier.client, requestId, supplier.orgId, supplier.userId);

    const { data: thread } = await supplier.client
      .from("message_threads")
      .insert({ request_id: requestId, supplier_org_id: supplier.orgId })
      .select("id")
      .single();
    await supplier.client.from("messages").insert({
      thread_id: thread!.id,
      sender_org_id: supplier.orgId,
      sender_user_id: supplier.userId,
      body: "Happy to discuss further, let me know what else you need.",
    });

    // Provider can read the conversation content...
    const messagesForProvider = await provider.client.from("messages").select("*").eq("thread_id", thread!.id);
    expect(messagesForProvider.data).toHaveLength(1);

    // ...but still can't resolve the supplier's real identity.
    const orgBeforeIntro = await provider.client.from("organisations").select("name").eq("id", supplier.orgId).maybeSingle();
    expect(orgBeforeIntro.data).toBeNull();
    const profileBeforeIntro = await provider.client.from("profiles").select("full_name").eq("id", supplier.userId).maybeSingle();
    expect(profileBeforeIntro.data).toBeNull();

    // Approve an introduction for this response.
    const { data: introduction } = await provider.client
      .from("introductions")
      .insert({ request_id: requestId, response_id: responseId })
      .select("id")
      .single();
    await admin.from("introductions").update({ decision: "approved" }).eq("id", introduction!.id);

    // Now identity resolves for the provider.
    const orgAfterIntro = await provider.client.from("organisations").select("name").eq("id", supplier.orgId).maybeSingle();
    expect(orgAfterIntro.data).not.toBeNull();
  });

  it("flags messages containing contact details or off-platform requests, sent by real users through RLS", async () => {
    const provider = await createSignedInUser("care_provider");
    const providerOrgId = await joinOrg(provider.userId, {
      type: "care_provider",
      name: `Vitest Msg Provider ${Date.now()}`,
      postcodePrefix: "KA5",
    });
    const requestId = await makeOpenRequest(providerOrgId, provider.userId, "Vitest flagging via RLS-authenticated insert");

    const supplier = await makeVerifiedSupplier(`Vitest Msg Supplier ${Date.now()}`);
    await submitResponse(supplier.client, requestId, supplier.orgId, supplier.userId);

    const { data: thread } = await supplier.client
      .from("message_threads")
      .insert({ request_id: requestId, supplier_org_id: supplier.orgId })
      .select("id")
      .single();

    async function send(body: string) {
      const { data, error } = await supplier.client
        .from("messages")
        .insert({ thread_id: thread!.id, sender_org_id: supplier.orgId, sender_user_id: supplier.userId, body })
        .select("flagged, flag_reason")
        .single();
      expect(error).toBeNull();
      return data!;
    }

    const clean = await send("We can deliver within the timescale you mentioned.");
    expect(clean.flagged).toBe(false);

    const withEmail = await send("Contact me at supplier@example.com if easier.");
    expect(withEmail.flagged).toBe(true);
    expect(withEmail.flag_reason).toContain("email");

    const withPhone = await send("Feel free to call 07123 456789 anytime.");
    expect(withPhone.flagged).toBe(true);
    expect(withPhone.flag_reason).toContain("phone");

    const offPlatform = await send("Let's move this conversation to WhatsApp.");
    expect(offPlatform.flagged).toBe(true);
    expect(offPlatform.flag_reason).toContain("outside the platform");

    // Client-supplied flagged/flag_reason values are ignored - the trigger
    // always recomputes them, so a malicious client can't fake "clean".
    const { data: spoofAttempt, error: spoofError } = await supplier.client
      .from("messages")
      .insert({
        thread_id: thread!.id,
        sender_org_id: supplier.orgId,
        sender_user_id: supplier.userId,
        body: "email me at spoof@example.com",
        flagged: false,
        flag_reason: null,
      })
      .select("flagged, flag_reason")
      .single();
    expect(spoofError).toBeNull();
    expect(spoofAttempt?.flagged).toBe(true);

    // Admin can see the flagged messages for review.
    const { data: flaggedForAdmin } = await admin.from("messages").select("*").eq("thread_id", thread!.id).eq("flagged", true);
    expect((flaggedForAdmin ?? []).length).toBeGreaterThanOrEqual(3);
  });
});
