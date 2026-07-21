// @vitest-environment node
//
// Node's native File/Blob (not jsdom's polyfill) is required here - jsdom's
// File implementation doesn't reliably propagate `type` through fetch,
// which made every upload arrive as "text/plain" regardless of what was
// passed to the File constructor or the upload() contentType option.
/**
 * Integration tests for supplier verification documents against the live
 * Supabase project - covers the verification_documents RLS policies, the
 * storage.objects verification/ path branch, and the self-approval
 * prevention trigger, none of which have an application-layer equivalent
 * to unit test. Skipped automatically without credentials, same as the
 * other integration suites.
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
  const email = `vitest-verdoc-${accountType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
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
  await admin.from("profiles").upsert({ id: userId, full_name: "Vitest Verification User" });
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

describe.skipIf(!hasCredentials)("Verification documents: RLS + self-approval prevention (live Supabase)", () => {
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

  it("prevents a supplier from seeing another supplier's verification documents", async () => {
    const supplierA = await createSignedInUser("supplier");
    const supplierAOrgId = await joinOrg(supplierA.userId, {
      type: "supplier",
      name: `Vitest VerDoc Supplier A ${Date.now()}`,
      coveragePrefixes: ["KA"],
    });

    const documentId = crypto.randomUUID();
    const path = `verification/${supplierAOrgId}/${documentId}-pli.pdf`;
    createdStoragePaths.push(path);

    const { error: uploadError } = await uploadTestFile(supplierA.client, path);
    expect(uploadError).toBeNull();

    const { error: insertError } = await supplierA.client.from("verification_documents").insert({
      id: documentId,
      supplier_org_id: supplierAOrgId,
      document_type: "public_liability_insurance",
      storage_path: path,
      file_name: "pli.pdf",
      file_size: 20,
      mime_type: "application/pdf",
      uploaded_by: supplierA.userId,
    });
    expect(insertError).toBeNull();

    // Supplier A can see their own document.
    const ownRow = await supplierA.client
      .from("verification_documents")
      .select("id")
      .eq("id", documentId)
      .maybeSingle();
    expect(ownRow.data).not.toBeNull();

    const supplierB = await createSignedInUser("supplier");
    await joinOrg(supplierB.userId, {
      type: "supplier",
      name: `Vitest VerDoc Supplier B ${Date.now()}`,
      coveragePrefixes: ["KA"],
    });

    // Supplier B can neither see the metadata row nor download the file,
    // even with the exact known storage path.
    const rowSeenByB = await supplierB.client
      .from("verification_documents")
      .select("id")
      .eq("id", documentId)
      .maybeSingle();
    expect(rowSeenByB.data).toBeNull();

    const downloadByB = await supplierB.client.storage.from(BUCKET).download(path);
    expect(downloadByB.error).not.toBeNull();

    // Supplier B also can't upload into Supplier A's verification folder.
    const forgedPath = `verification/${supplierAOrgId}/${crypto.randomUUID()}-forged.pdf`;
    const { error: forgedUploadError } = await uploadTestFile(supplierB.client, forgedPath);
    expect(forgedUploadError).not.toBeNull();
  });

  it("never lets a provider see verification documents", async () => {
    const supplier = await createSignedInUser("supplier");
    const supplierOrgId = await joinOrg(supplier.userId, {
      type: "supplier",
      name: `Vitest VerDoc Supplier ${Date.now()}`,
      coveragePrefixes: ["KA"],
    });

    const documentId = crypto.randomUUID();
    const path = `verification/${supplierOrgId}/${documentId}-pli.pdf`;
    createdStoragePaths.push(path);

    await uploadTestFile(supplier.client, path);
    await admin.from("verification_documents").insert({
      id: documentId,
      supplier_org_id: supplierOrgId,
      document_type: "public_liability_insurance",
      storage_path: path,
      file_name: "pli.pdf",
      file_size: 20,
      mime_type: "application/pdf",
      uploaded_by: supplier.userId,
    });

    const provider = await createSignedInUser("care_provider");
    await joinOrg(provider.userId, {
      type: "care_provider",
      name: `Vitest VerDoc Provider ${Date.now()}`,
      postcodePrefix: "KA5",
    });

    const rowSeenByProvider = await provider.client
      .from("verification_documents")
      .select("id")
      .eq("id", documentId)
      .maybeSingle();
    expect(rowSeenByProvider.data).toBeNull();

    const downloadByProvider = await provider.client.storage.from(BUCKET).download(path);
    expect(downloadByProvider.error).not.toBeNull();

    // A provider also can't upload into a verification/ path at all - the
    // storage insert policy requires current_org_type() = 'supplier'.
    const forgedPath = `verification/${supplierOrgId}/${crypto.randomUUID()}-forged.pdf`;
    const { error: forgedUploadError } = await uploadTestFile(provider.client, forgedPath);
    expect(forgedUploadError).not.toBeNull();
  });

  it("prevents a supplier from self-approving their own verification document", async () => {
    const supplier = await createSignedInUser("supplier");
    const supplierOrgId = await joinOrg(supplier.userId, {
      type: "supplier",
      name: `Vitest VerDoc Self-Approve Supplier ${Date.now()}`,
      coveragePrefixes: ["KA"],
    });

    const documentId = crypto.randomUUID();
    const path = `verification/${supplierOrgId}/${documentId}-pli.pdf`;
    createdStoragePaths.push(path);

    await uploadTestFile(supplier.client, path);
    const { error: insertError } = await supplier.client.from("verification_documents").insert({
      id: documentId,
      supplier_org_id: supplierOrgId,
      document_type: "public_liability_insurance",
      storage_path: path,
      file_name: "pli.pdf",
      file_size: 20,
      mime_type: "application/pdf",
      uploaded_by: supplier.userId,
    });
    expect(insertError).toBeNull();

    // A self-update attempt matches 0 rows under RLS (the USING clause
    // requires is_admin()), so PostgREST reports success with no error -
    // the row itself must be checked to prove nothing actually changed.
    await supplier.client.from("verification_documents").update({ status: "approved" }).eq("id", documentId);

    const { data: afterSelfApprove } = await admin
      .from("verification_documents")
      .select("status, reviewed_by")
      .eq("id", documentId)
      .single();
    expect(afterSelfApprove!.status).toBe("pending_review");
    expect(afterSelfApprove!.reviewed_by).toBeNull();

    // An admin can genuinely approve it, and the review is stamped
    // server-side regardless of what the client sends.
    const adminUser = await createSignedInUser("platform_admin");
    await joinOrg(adminUser.userId, {
      type: "platform_admin",
      name: `Vitest VerDoc Admin ${Date.now()}`,
    });

    const { error: adminUpdateError } = await adminUser.client
      .from("verification_documents")
      .update({ status: "approved" })
      .eq("id", documentId);
    expect(adminUpdateError).toBeNull();

    const { data: afterAdminApprove } = await admin
      .from("verification_documents")
      .select("status, reviewed_by")
      .eq("id", documentId)
      .single();
    expect(afterAdminApprove!.status).toBe("approved");
    expect(afterAdminApprove!.reviewed_by).toBe(adminUser.userId);
  });

  it("blocks marking a supplier active without an approved public liability insurance document", async () => {
    const supplier = await createSignedInUser("supplier");
    const supplierOrgId = await joinOrg(supplier.userId, {
      type: "supplier",
      name: `Vitest VerDoc Gate Supplier ${Date.now()}`,
      coveragePrefixes: ["KA"],
    });
    await admin.from("organisations").update({ status: "pending_verification" }).eq("id", supplierOrgId);

    const adminUser = await createSignedInUser("platform_admin");
    await joinOrg(adminUser.userId, {
      type: "platform_admin",
      name: `Vitest VerDoc Gate Admin ${Date.now()}`,
    });

    // No approved document yet - blocked.
    const { error: blockedError } = await adminUser.client
      .from("organisations")
      .update({ status: "active" })
      .eq("id", supplierOrgId);
    expect(blockedError).not.toBeNull();

    // Upload and approve a public liability insurance document.
    const documentId = crypto.randomUUID();
    const path = `verification/${supplierOrgId}/${documentId}-pli.pdf`;
    createdStoragePaths.push(path);
    await uploadTestFile(supplier.client, path);
    await supplier.client.from("verification_documents").insert({
      id: documentId,
      supplier_org_id: supplierOrgId,
      document_type: "public_liability_insurance",
      storage_path: path,
      file_name: "pli.pdf",
      file_size: 20,
      mime_type: "application/pdf",
      uploaded_by: supplier.userId,
    });
    await adminUser.client.from("verification_documents").update({ status: "approved" }).eq("id", documentId);

    // Now the gate lets it through.
    const { error: allowedError } = await adminUser.client
      .from("organisations")
      .update({ status: "active" })
      .eq("id", supplierOrgId);
    expect(allowedError).toBeNull();

    const { data: org } = await admin.from("organisations").select("status").eq("id", supplierOrgId).single();
    expect(org!.status).toBe("active");
  });
});
