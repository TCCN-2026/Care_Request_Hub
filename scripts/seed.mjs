// Seeds fictional demo data for local development and manual QA.
// Safe to re-run - looks up existing users/orgs by email/name before
// creating anything, so it won't create duplicates.
//
// Usage: npm run seed
//
// Requires SUPABASE_SERVICE_ROLE_KEY - never run this against a
// production project, and never commit real credentials to run it.

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.local).");
  process.exit(1);
}

const DEMO_PASSWORD = "DemoPass123!";
const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function getOrCreateUser(email, accountType) {
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = list?.users.find((u) => u.email === email);
  if (existing) {
    console.log(`  user exists: ${email}`);
    return existing.id;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { account_type: accountType },
  });
  if (error) throw new Error(`createUser(${email}): ${error.message}`);
  console.log(`  created user: ${email}`);
  return data.user.id;
}

async function getOrCreateOrg({ type, name, status, postcodePrefix, coveragePrefixes, isMember, ownerId, profile }) {
  const { data: existing } = await admin.from("organisations").select("id, is_ccn_member").eq("name", name).maybeSingle();
  let orgId = existing?.id;

  if (!orgId) {
    const { data: created, error } = await admin
      .from("organisations")
      .insert({
        type,
        name,
        status,
        postcode_prefix: postcodePrefix ?? null,
        coverage_prefixes: coveragePrefixes ?? [],
        is_ccn_member: isMember ?? false,
      })
      .select("id")
      .single();
    if (error) throw new Error(`createOrg(${name}): ${error.message}`);
    orgId = created.id;
    console.log(`  created org: ${name}`);
  } else {
    console.log(`  org exists: ${name}`);
    if (existing.is_ccn_member !== (isMember ?? false)) {
      await admin.from("organisations").update({ is_ccn_member: isMember ?? false }).eq("id", orgId);
    }
  }

  const { data: membership } = await admin
    .from("organisation_members")
    .select("id")
    .eq("organisation_id", orgId)
    .eq("user_id", ownerId)
    .maybeSingle();
  if (!membership) {
    await admin.from("organisation_members").insert({ organisation_id: orgId, user_id: ownerId, role: "owner" });
  }

  await admin
    .from("profiles")
    .upsert({ id: ownerId, ...profile }, { onConflict: "id" });

  return orgId;
}

async function getOrCreateRequest({ reference, providerOrgId, categoryId, createdBy, ...rest }) {
  const { data: existing } = await admin.from("requests").select("id").eq("reference", reference).maybeSingle();
  if (existing) {
    console.log(`  request exists: ${reference}`);
    return existing.id;
  }
  const { data: created, error } = await admin
    .from("requests")
    .insert({ reference, provider_org_id: providerOrgId, category_id: categoryId, created_by: createdBy, ...rest })
    .select("id")
    .single();
  if (error) throw new Error(`createRequest(${reference}): ${error.message}`);
  console.log(`  created request: ${reference}`);
  return created.id;
}

async function getOrCreateResponse({ requestId, supplierOrgId, createdBy, ...rest }) {
  const { data: existing } = await admin
    .from("responses")
    .select("id")
    .eq("request_id", requestId)
    .eq("supplier_org_id", supplierOrgId)
    .maybeSingle();
  if (existing) {
    console.log("  response exists");
    return existing.id;
  }
  const { data: created, error } = await admin
    .from("responses")
    .insert({ request_id: requestId, supplier_org_id: supplierOrgId, created_by: createdBy, ...rest })
    .select("id")
    .single();
  if (error) throw new Error(`createResponse: ${error.message}`);
  console.log("  created response");
  return created.id;
}

async function main() {
  console.log("Categories");
  const { data: categories } = await admin.from("categories").select("id, name");
  const categoryId = (name) => {
    const found = categories?.find((c) => c.name === name);
    if (!found) throw new Error(`Category not seeded: ${name}. Run migrations first.`);
    return found.id;
  };

  console.log("Admin");
  const adminUserId = await getOrCreateUser("admin@example.com", "platform_admin", "Demo Admin");
  await getOrCreateOrg({
    type: "platform_admin",
    name: "Care Connector Network Admin",
    status: "active",
    ownerId: adminUserId,
    profile: { full_name: "Demo Admin", contact_email: "admin@example.com" },
  });

  console.log("Providers");
  const provider1UserId = await getOrCreateUser("provider1@example.com", "care_provider", "Fiona Cameron");
  const provider1OrgId = await getOrCreateOrg({
    type: "care_provider",
    name: "Ayrshire Care Homes Group",
    status: "active",
    postcodePrefix: "KA5",
    ownerId: provider1UserId,
    profile: { full_name: "Fiona Cameron", job_title: "Operations Manager", contact_email: "provider1@example.com" },
  });

  const provider2UserId = await getOrCreateUser("provider2@example.com", "care_provider", "Amir Hassan");
  const provider2OrgId = await getOrCreateOrg({
    type: "care_provider",
    name: "Glasgow Residential Care Ltd",
    status: "active",
    postcodePrefix: "G2",
    ownerId: provider2UserId,
    profile: { full_name: "Amir Hassan", job_title: "Registered Manager", contact_email: "provider2@example.com" },
  });

  console.log("Suppliers");
  const supplier1UserId = await getOrCreateUser("supplier1@example.com", "supplier", "Priya Shah");
  const supplier1OrgId = await getOrCreateOrg({
    type: "supplier",
    name: "Ayrshire Training Solutions",
    status: "active",
    isMember: true,
    coveragePrefixes: ["KA"],
    ownerId: supplier1UserId,
    profile: { full_name: "Priya Shah", job_title: "Sales Lead", contact_email: "supplier1@example.com" },
  });
  await admin.from("supplier_categories").upsert(
    [
      { supplier_org_id: supplier1OrgId, category_id: categoryId("Training and development") },
      { supplier_org_id: supplier1OrgId, category_id: categoryId("PPE and consumables") },
    ],
    { onConflict: "supplier_org_id,category_id" },
  );

  const supplier2UserId = await getOrCreateUser("supplier2@example.com", "supplier", "Callum Reid");
  const supplier2OrgId = await getOrCreateOrg({
    type: "supplier",
    name: "Glasgow IT Support Co",
    status: "active",
    isMember: true,
    coveragePrefixes: ["G"],
    ownerId: supplier2UserId,
    profile: { full_name: "Callum Reid", job_title: "Account Manager", contact_email: "supplier2@example.com" },
  });
  await admin.from("supplier_categories").upsert(
    [
      { supplier_org_id: supplier2OrgId, category_id: categoryId("IT support and equipment") },
      { supplier_org_id: supplier2OrgId, category_id: categoryId("Cleaning and infection control") },
    ],
    { onConflict: "supplier_org_id,category_id" },
  );

  const supplier3UserId = await getOrCreateUser("supplier3@example.com", "supplier", "Nadia Ali");
  const supplier3OrgId = await getOrCreateOrg({
    type: "supplier",
    name: "Pending Verification Supplies Ltd",
    status: "pending_verification",
    coveragePrefixes: ["KA"],
    ownerId: supplier3UserId,
    profile: { full_name: "Nadia Ali", job_title: "Director", contact_email: "supplier3@example.com" },
  });
  await admin.from("supplier_categories").upsert(
    [{ supplier_org_id: supplier3OrgId, category_id: categoryId("Property maintenance") }],
    { onConflict: "supplier_org_id,category_id" },
  );

  console.log("Requests");
  const futureDate = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  await getOrCreateRequest({
    reference: "CRH-DEMO-00001",
    providerOrgId: provider1OrgId,
    categoryId: categoryId("PPE and consumables"),
    createdBy: provider1UserId,
    title: "PPE stock top-up",
    description: "Looking for a reliable supplier of gloves, aprons and masks for our three homes.",
    postcode_prefix: "KA5",
    closing_date: futureDate(30),
    status: "draft",
  });

  await getOrCreateRequest({
    reference: "CRH-DEMO-00002",
    providerOrgId: provider1OrgId,
    categoryId: categoryId("Training and development"),
    createdBy: provider1UserId,
    title: "First aid training for new starters",
    description: "Need emergency first aid at work training for a group of 12 new starters.",
    postcode_prefix: "KA5",
    closing_date: futureDate(21),
    status: "submitted",
    submitted_at: new Date().toISOString(),
  });

  const openReq1 = await getOrCreateRequest({
    reference: "CRH-DEMO-00003",
    providerOrgId: provider1OrgId,
    categoryId: categoryId("Training and development"),
    createdBy: provider1UserId,
    title: "Manual handling training for care staff",
    description: "Accredited manual handling training for around 20 staff across two sites.",
    postcode_prefix: "KA5",
    closing_date: futureDate(40),
    status: "open",
    submitted_at: new Date().toISOString(),
    approved_at: new Date().toISOString(),
    approved_by: adminUserId,
  });

  const openReq2 = await getOrCreateRequest({
    reference: "CRH-DEMO-00004",
    providerOrgId: provider2OrgId,
    categoryId: categoryId("IT support and equipment"),
    createdBy: provider2UserId,
    title: "Ongoing IT support contract",
    description: "Seeking a managed IT support contract covering helpdesk, patching and on-site visits.",
    postcode_prefix: "G2",
    closing_date: futureDate(45),
    status: "open",
    submitted_at: new Date().toISOString(),
    approved_at: new Date().toISOString(),
    approved_by: adminUserId,
  });

  await getOrCreateRequest({
    reference: "CRH-DEMO-00005",
    providerOrgId: provider1OrgId,
    categoryId: categoryId("PPE and consumables"),
    createdBy: provider1UserId,
    title: "Winter PPE order (closed)",
    description: "One-off winter stock order, now closed to new responses.",
    postcode_prefix: "KA5",
    closing_date: futureDate(-5),
    status: "closed_to_responses",
    submitted_at: new Date().toISOString(),
    approved_at: new Date().toISOString(),
    approved_by: adminUserId,
  });

  await getOrCreateRequest({
    reference: "CRH-DEMO-00006",
    providerOrgId: provider2OrgId,
    categoryId: categoryId("Cleaning and infection control"),
    createdBy: provider2UserId,
    title: "Deep clean contract (cancelled)",
    description: "No longer required - kept as a cancelled example.",
    postcode_prefix: "G2",
    closing_date: futureDate(10),
    status: "cancelled",
    submitted_at: new Date().toISOString(),
  });

  await getOrCreateRequest({
    reference: "CRH-DEMO-00007",
    providerOrgId: provider1OrgId,
    categoryId: categoryId("Training and development"),
    createdBy: provider1UserId,
    title: "Dementia awareness training",
    description: "Half-day dementia awareness session for care and support staff.",
    postcode_prefix: "KA5",
    closing_date: futureDate(35),
    status: "open",
    submitted_at: new Date().toISOString(),
    approved_at: new Date().toISOString(),
    approved_by: adminUserId,
  });

  await getOrCreateRequest({
    reference: "CRH-DEMO-00008",
    providerOrgId: provider2OrgId,
    categoryId: categoryId("IT support and equipment"),
    createdBy: provider2UserId,
    title: "CCTV upgrade at reception",
    description: "Upgrade of ageing CCTV system covering reception and communal areas.",
    postcode_prefix: "G2",
    closing_date: futureDate(25),
    status: "submitted",
    submitted_at: new Date().toISOString(),
  });

  console.log("Responses");
  await getOrCreateResponse({
    requestId: openReq1,
    supplierOrgId: supplier1OrgId,
    createdBy: supplier1UserId,
    summary: "CPCAB-accredited manual handling training delivered on-site across both locations.",
    proposed_solution:
      "A certified trainer delivers a full-day session at each site for up to 20 staff, including refresher materials and certificates within a week.",
    one_off_cost: 950,
    vat_status: "exclusive",
    timescale: "3 weeks from confirmation",
    status: "submitted",
    submitted_at: new Date().toISOString(),
  });

  const response2 = await getOrCreateResponse({
    requestId: openReq2,
    supplierOrgId: supplier2OrgId,
    createdBy: supplier2UserId,
    summary: "Fully managed IT support contract with helpdesk, patching and quarterly on-site visits.",
    proposed_solution:
      "24/5 remote helpdesk, automated patch management, and a quarterly on-site health check, with a dedicated account manager.",
    recurring_cost: 380,
    vat_status: "exclusive",
    timescale: "Live within 2 weeks of signature",
    status: "shortlisted",
    submitted_at: new Date().toISOString(),
  });

  console.log("Introductions");
  const { data: existingIntro } = await admin
    .from("introductions")
    .select("id")
    .eq("response_id", response2)
    .maybeSingle();

  if (!existingIntro) {
    const { data: intro, error: introError } = await admin
      .from("introductions")
      .insert({
        reference: "INTRO-DEMO-00001",
        request_id: openReq2,
        response_id: response2,
        provider_org_id: provider2OrgId,
        supplier_org_id: supplier2OrgId,
        requested_by: provider2UserId,
        requested_at: new Date().toISOString(),
        decision: "approved",
        decision_notes: "Looks like a good match - approved.",
        reviewed_by: adminUserId,
        reviewed_at: new Date().toISOString(),
        contact_released_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (introError) throw new Error(`createIntroduction: ${introError.message}`);
    const { error: introducedError } = await admin
      .from("responses")
      .update({ status: "introduced" })
      .eq("id", response2);
    if (introducedError) throw new Error(`mark response introduced: ${introducedError.message}`);
    console.log("  created introduction:", intro.id);
  } else {
    console.log("  introduction exists");
  }

  // response1 stays "submitted" (not yet shortlisted) so the admin/provider
  // demo accounts have at least one live decision still to make.

  console.log("\nDone. Demo accounts (password for all: " + DEMO_PASSWORD + "):");
  console.log("  Admin:      admin@example.com");
  console.log("  Provider 1: provider1@example.com (Ayrshire Care Homes Group)");
  console.log("  Provider 2: provider2@example.com (Glasgow Residential Care Ltd)");
  console.log("  Supplier 1: supplier1@example.com (Ayrshire Training Solutions, verified)");
  console.log("  Supplier 2: supplier2@example.com (Glasgow IT Support Co, verified)");
  console.log("  Supplier 3: supplier3@example.com (Pending Verification Supplies Ltd, pending)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
