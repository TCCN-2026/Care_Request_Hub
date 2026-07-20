// @vitest-environment node
//
// Node's native File/Blob (not jsdom's polyfill) is required here - jsdom's
// File implementation doesn't reliably propagate `type` through fetch,
// which made every upload arrive as "text/plain" regardless of what was
// passed to the File constructor or the upload() contentType option.
/**
 * Integration tests for file attachments against the live Supabase
 * project - covers the storage.objects RLS policies specifically, since
 * those can't be exercised by unit tests at all (they're pure Postgres
 * policies with no application-layer equivalent to unit test). Skipped
 * automatically without credentials, same as rls.test.ts.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCredentials = !!(url && anonKey && serviceKey);

const password = "TestPassword123!";
const BUCKET = "attachments";
const createdUserIds: string[] = [];
const createdOrgIds: string[] = [];
const createdStoragePaths: string[] = [];

let admin: SupabaseClient;

async function createSignedInUser(accountType: "care_provider" | "supplier" | "platform_admin") {
  const email = `vitest-attach-${accountType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
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
      // Membership gating has its own dedicated tests in
      // membership.test.ts - these fixtures need to be fully operational.
      is_ccn_member: org.type === "supplier",
    })
    .select("id")
    .single();
  if (error || !created) throw new Error(`createOrg: ${error?.message}`);
  createdOrgIds.push(created.id);
  await admin.from("organisation_members").insert({ organisation_id: created.id, user_id: userId, role: "owner" });
  await admin.from("profiles").upsert({ id: userId, full_name: "Vitest Attachment User" });
  return created.id as string;
}

function testFile() {
  return new File(["%PDF-1.4 test content"], "test.pdf", { type: "application/pdf" });
}

// jsdom's File polyfill doesn't reliably propagate `type` through
// fetch/FormData, so the storage API sees "text/plain" unless contentType
// is passed explicitly here - the real server actions already do this.
function uploadTestFile(client: SupabaseClient, path: string) {
  return client.storage.from(BUCKET).upload(path, testFile(), { contentType: "application/pdf" });
}

describe.skipIf(!hasCredentials)("Attachments: storage RLS (live Supabase)", () => {
  beforeAll(() => {
    admin = createClient(url!, serviceKey!, { auth: { autoRefreshToken: false, persistSession: false } });
  });

  afterAll(async () => {
    if (createdStoragePaths.length) {
      await admin.storage.from(BUCKET).remove(createdStoragePaths).catch(() => {});
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

  it("keeps a private request attachment hidden from a matching supplier, but lets a matching supplier see one marked visible", async () => {
    const { data: category } = await admin.from("categories").select("id").limit(1).single();

    const provider = await createSignedInUser("care_provider");
    const providerOrgId = await joinOrg(provider.userId, {
      type: "care_provider",
      name: `Vitest Attach Provider ${Date.now()}`,
      postcodePrefix: "KA5",
    });

    const { data: request } = await admin
      .from("requests")
      .insert({
        provider_org_id: providerOrgId,
        category_id: category!.id,
        title: "Vitest attachment visibility check",
        description: "Integration test fixture request.",
        postcode_prefix: "KA5",
        closing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        status: "draft",
        created_by: provider.userId,
      })
      .select("id")
      .single();

    const privateId = crypto.randomUUID();
    const privatePath = `requests/${request!.id}/${privateId}-private.pdf`;
    const visibleId = crypto.randomUUID();
    const visiblePath = `requests/${request!.id}/${visibleId}-visible.pdf`;
    createdStoragePaths.push(privatePath, visiblePath);

    const { error: uploadPrivateError } = await uploadTestFile(provider.client, privatePath);
    expect(uploadPrivateError).toBeNull();
    const { error: uploadVisibleError } = await uploadTestFile(provider.client, visiblePath);
    expect(uploadVisibleError).toBeNull();

    await admin.from("request_attachments").insert([
      {
        id: privateId,
        request_id: request!.id,
        storage_path: privatePath,
        file_name: "private.pdf",
        file_size: 20,
        mime_type: "application/pdf",
        visible_to_suppliers: false,
        uploaded_by: provider.userId,
      },
      {
        id: visibleId,
        request_id: request!.id,
        storage_path: visiblePath,
        file_name: "visible.pdf",
        file_size: 20,
        mime_type: "application/pdf",
        visible_to_suppliers: true,
        uploaded_by: provider.userId,
      },
    ]);

    // Open the request and get a matching, verified supplier in place.
    await admin.from("requests").update({ status: "open" }).eq("id", request!.id);
    const supplier = await createSignedInUser("supplier");
    const supplierOrgId = await joinOrg(supplier.userId, {
      type: "supplier",
      name: `Vitest Attach Supplier ${Date.now()}`,
      coveragePrefixes: ["KA"],
    });
    await admin.from("supplier_categories").insert({ supplier_org_id: supplierOrgId, category_id: category!.id });

    // Metadata row: private is invisible, visible one is visible.
    const privateRow = await supplier.client.from("request_attachments").select("id").eq("id", privateId).maybeSingle();
    expect(privateRow.data).toBeNull();
    const visibleRow = await supplier.client.from("request_attachments").select("id").eq("id", visibleId).maybeSingle();
    expect(visibleRow.data).not.toBeNull();

    // Storage object itself: private download is blocked even with the
    // exact known path, visible one succeeds.
    const privateDownload = await supplier.client.storage.from(BUCKET).download(privatePath);
    expect(privateDownload.error).not.toBeNull();
    const visibleDownload = await supplier.client.storage.from(BUCKET).download(visiblePath);
    expect(visibleDownload.error).toBeNull();

    // Signed URL creation is equally gated - can't get a URL for a file
    // you're not allowed to read.
    const privateSigned = await supplier.client.storage.from(BUCKET).createSignedUrl(privatePath, 60);
    expect(privateSigned.error).not.toBeNull();
    const visibleSigned = await supplier.client.storage.from(BUCKET).createSignedUrl(visiblePath, 60);
    expect(visibleSigned.error).toBeNull();
  });

  it("prevents a supplier from reading another supplier's response attachment", async () => {
    const { data: category } = await admin.from("categories").select("id").limit(1).single();

    const provider = await createSignedInUser("care_provider");
    const providerOrgId = await joinOrg(provider.userId, {
      type: "care_provider",
      name: `Vitest Attach Provider ${Date.now()}`,
      postcodePrefix: "KA5",
    });
    const { data: request } = await admin
      .from("requests")
      .insert({
        provider_org_id: providerOrgId,
        category_id: category!.id,
        title: "Vitest response attachment isolation check",
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
      name: `Vitest Attach Supplier A ${Date.now()}`,
      coveragePrefixes: ["KA"],
    });
    await admin.from("supplier_categories").insert({ supplier_org_id: supplierAOrgId, category_id: category!.id });

    const { data: response } = await supplierA.client
      .from("responses")
      .insert({
        request_id: request!.id,
        supplier_org_id: supplierAOrgId,
        created_by: supplierA.userId,
        summary: "Vitest response for the attachment isolation fixture, long enough to validate.",
        proposed_solution: "A detailed proposed solution long enough to satisfy the minimum length rule.",
        status: "draft",
      })
      .select("id")
      .single();

    const attachmentId = crypto.randomUUID();
    const path = `responses/${response!.id}/${attachmentId}-response-file.pdf`;
    createdStoragePaths.push(path);

    const { error: uploadError } = await uploadTestFile(supplierA.client, path);
    expect(uploadError).toBeNull();
    const { error: insertError } = await supplierA.client.from("response_attachments").insert({
      id: attachmentId,
      response_id: response!.id,
      storage_path: path,
      file_name: "response-file.pdf",
      file_size: 20,
      mime_type: "application/pdf",
      uploaded_by: supplierA.userId,
    });
    expect(insertError).toBeNull();

    // The owning provider can read it.
    const providerRead = await provider.client.storage.from(BUCKET).download(path);
    expect(providerRead.error).toBeNull();

    // A second, unrelated supplier cannot - neither the metadata row nor
    // the file itself.
    const supplierB = await createSignedInUser("supplier");
    await joinOrg(supplierB.userId, {
      type: "supplier",
      name: `Vitest Attach Supplier B ${Date.now()}`,
      coveragePrefixes: ["KA"],
    });

    const rowSeenByB = await supplierB.client
      .from("response_attachments")
      .select("id")
      .eq("id", attachmentId)
      .maybeSingle();
    expect(rowSeenByB.data).toBeNull();

    const downloadByB = await supplierB.client.storage.from(BUCKET).download(path);
    expect(downloadByB.error).not.toBeNull();
  });

  it("blocks uploading into another organisation's request folder, even with a guessed path", async () => {
    const { data: category } = await admin.from("categories").select("id").limit(1).single();

    const providerA = await createSignedInUser("care_provider");
    const providerAOrgId = await joinOrg(providerA.userId, {
      type: "care_provider",
      name: `Vitest Attach Provider A ${Date.now()}`,
      postcodePrefix: "KA5",
    });
    const { data: requestA } = await admin
      .from("requests")
      .insert({
        provider_org_id: providerAOrgId,
        category_id: category!.id,
        title: "Vitest path-forgery check",
        description: "Integration test fixture request.",
        postcode_prefix: "KA5",
        closing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        status: "draft",
        created_by: providerA.userId,
      })
      .select("id")
      .single();

    const providerB = await createSignedInUser("care_provider");
    await joinOrg(providerB.userId, {
      type: "care_provider",
      name: `Vitest Attach Provider B ${Date.now()}`,
      postcodePrefix: "G2",
    });

    // Provider B tries to upload directly into Provider A's request folder.
    const forgedPath = `requests/${requestA!.id}/${crypto.randomUUID()}-forged.pdf`;
    const { error: forgedUploadError } = await uploadTestFile(providerB.client, forgedPath);
    expect(forgedUploadError).not.toBeNull();
  });
});
