// @vitest-environment node
/**
 * Integration tests for the public "what people are looking for" homepage
 * feed - the one place in this app where the audience is genuinely
 * anonymous (no session at all), not just an unrelated authenticated
 * party. Proves the database-side guarantee behind
 * supabase/migrations/0020_public_activity_feed.sql: an anonymous caller
 * gets category name only for open requests, nothing else, and the
 * underlying `requests` table itself stays completely blocked to them.
 * Skipped automatically without live Supabase credentials, same as the
 * other integration suites.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasCredentials = !!(url && anonKey && serviceKey);

const createdUserIds: string[] = [];
const createdOrgIds: string[] = [];
const createdRequestIds: string[] = [];

let admin: SupabaseClient;
let anon: SupabaseClient;

describe.skipIf(!hasCredentials)("Public activity feed: anonymous access (live Supabase)", () => {
  beforeAll(() => {
    admin = createClient(url!, serviceKey!, { auth: { autoRefreshToken: false, persistSession: false } });
    anon = createClient(url!, anonKey!, { auth: { autoRefreshToken: false, persistSession: false } });
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

  it("shows category-only rows for open requests to a fully anonymous visitor, and excludes anything not open", async () => {
    const { data: category } = await admin.from("categories").select("id, name").limit(1).single();

    // Fixture setup only - the actual thing under test is the anon read
    // further down, which never signs in at all.
    const { data: providerUser } = await admin.auth.admin.createUser({
      email: `vitest-feed-provider-${Date.now()}@example.com`,
      password: "TestPassword123!",
      email_confirm: true,
      user_metadata: { account_type: "care_provider" },
    });
    createdUserIds.push(providerUser!.user!.id);

    const { data: org } = await admin
      .from("organisations")
      .insert({
        type: "care_provider",
        name: `Vitest Feed Provider ${Date.now()}`,
        status: "active",
        postcode_prefix: "KA5",
      })
      .select("id")
      .single();
    createdOrgIds.push(org!.id);
    await admin
      .from("organisation_members")
      .insert({ organisation_id: org!.id, user_id: providerUser!.user!.id, role: "owner" });

    const closingDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    async function createRequest(status: string) {
      const { data, error } = await admin
        .from("requests")
        .insert({
          provider_org_id: org!.id,
          category_id: category!.id,
          title: `Vitest public feed fixture (${status})`,
          description: "Integration test fixture request for the public activity feed.",
          postcode_prefix: "KA5",
          closing_date: closingDate,
          status,
          created_by: providerUser!.user!.id,
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(`insert ${status} fixture: ${error?.message}`);
      createdRequestIds.push(data.id);
      return data.id as string;
    }

    const openId = await createRequest("open");
    const draftId = await createRequest("draft");
    const submittedId = await createRequest("submitted");
    const cancelledId = await createRequest("cancelled");

    // The read under test: no sign-in of any kind, just the anon key -
    // this is exactly what the homepage does for a logged-out visitor.
    const { data: rows, error } = await anon
      .from("public_live_request_categories")
      .select("*")
      .in("id", [openId, draftId, submittedId, cancelledId]);

    expect(error).toBeNull();
    const visibleIds = (rows ?? []).map((r) => r.id);
    expect(visibleIds).toContain(openId);
    expect(visibleIds).not.toContain(draftId);
    expect(visibleIds).not.toContain(submittedId);
    expect(visibleIds).not.toContain(cancelledId);

    const openRow = (rows ?? []).find((r) => r.id === openId);
    expect(openRow?.category_name).toBe(category!.name);
    // The allow-list itself: only these three columns should ever be
    // present, no matter what other columns `requests` gains later.
    expect(Object.keys(openRow!).sort()).toEqual(["category_name", "created_at", "id"].sort());
  });

  it("never lets an anonymous visitor query the underlying requests table directly", async () => {
    const { data } = await anon.from("requests").select("id, title, postcode_prefix, provider_org_id").limit(5);
    // RLS with no anonymous-access branch means this returns success with
    // zero rows rather than an explicit error - either way, nothing leaks.
    expect(data ?? []).toHaveLength(0);
  });
});
