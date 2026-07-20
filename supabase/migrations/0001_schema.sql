-- Care Request Hub - core loop schema (MVP slice).
--
-- This covers only what the smallest working loop needs: provider signs up,
-- creates a request, admin approves it, a matched supplier sees the
-- anonymous version and replies, the provider requests an introduction and
-- an admin approves it. The full spec's larger entity set (attachments,
-- messaging, complaints, terms versioning, integration mappings, etc.) is
-- deferred to later slices - see AGENTS.md / README.md "Known limitations".

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type organisation_type as enum ('care_provider', 'supplier', 'platform_admin');

create type organisation_status as enum ('pending_verification', 'active', 'suspended');

create type organisation_member_role as enum ('owner', 'manager', 'contributor', 'viewer');

create type request_status as enum (
  'draft',
  'submitted',
  'approved',
  'open',
  'closed_to_responses',
  'cancelled'
);

-- "Introduction requested/approved" is tracked via the introductions table
-- (one row per response, decision pending/approved/rejected) rather than
-- duplicated here, so there is a single source of truth for that state.
create type response_status as enum (
  'draft',
  'submitted',
  'withdrawn',
  'shortlisted',
  'declined',
  'introduced'
);

create type introduction_decision as enum ('pending', 'approved', 'rejected');

-- ---------------------------------------------------------------------------
-- Organisations & people
-- ---------------------------------------------------------------------------

create table organisations (
  id uuid primary key default gen_random_uuid(),
  type organisation_type not null,
  name text not null,
  status organisation_status not null default 'active',
  -- Care providers: the postcode prefix of their main location, e.g. "KA5".
  postcode_prefix text,
  -- Suppliers: the postcode prefixes they cover, e.g. {"KA", "G", "ML"}.
  coverage_prefixes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Suppliers start pending verification; providers and the platform admin
-- org are active immediately since they aren't the anonymity-sensitive side.
alter table organisations
  add constraint organisations_supplier_status_check
  check (type = 'supplier' or status = 'active');

create table organisation_members (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role organisation_member_role not null default 'owner',
  created_at timestamptz not null default now(),
  unique (organisation_id, user_id)
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  job_title text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  sort_order integer not null default 0
);

create table supplier_categories (
  supplier_org_id uuid not null references organisations(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  primary key (supplier_org_id, category_id)
);

-- ---------------------------------------------------------------------------
-- Requests
-- ---------------------------------------------------------------------------

create table requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  provider_org_id uuid not null references organisations(id) on delete cascade,
  category_id uuid not null references categories(id),
  title text not null,
  description text not null,
  desired_outcome text,
  mandatory_requirements text,
  postcode_prefix text not null,
  closing_date date not null,
  status request_status not null default 'draft',
  created_by uuid not null references auth.users(id),
  approved_by uuid references auth.users(id),
  submitted_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index requests_provider_org_id_idx on requests (provider_org_id);
create index requests_status_idx on requests (status);
create index requests_category_id_idx on requests (category_id);

-- Kept off the requests row entirely (not just hidden client-side) so no
-- future change to the requests SELECT policy can ever expose it to a
-- supplier - only admins can read this table.
create table request_admin_notes (
  request_id uuid primary key references requests(id) on delete cascade,
  note text not null default '',
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Responses
-- ---------------------------------------------------------------------------

create table responses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  supplier_org_id uuid not null references organisations(id) on delete cascade,
  summary text not null,
  proposed_solution text not null,
  one_off_cost numeric(12, 2),
  recurring_cost numeric(12, 2),
  vat_status text not null default 'not_applicable'
    check (vat_status in ('inclusive', 'exclusive', 'not_applicable')),
  timescale text,
  status response_status not null default 'draft',
  created_by uuid not null references auth.users(id),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, supplier_org_id)
);

create index responses_request_id_idx on responses (request_id);
create index responses_supplier_org_id_idx on responses (supplier_org_id);

-- Provider-private notes about a response. Kept off the responses row so
-- the owning supplier - who can read their own response - never sees them.
create table provider_response_notes (
  response_id uuid primary key references responses(id) on delete cascade,
  note text not null default '',
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Introductions
-- ---------------------------------------------------------------------------

create table introductions (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  request_id uuid not null references requests(id) on delete cascade,
  response_id uuid not null references responses(id) on delete cascade,
  provider_org_id uuid not null references organisations(id) on delete cascade,
  supplier_org_id uuid not null references organisations(id) on delete cascade,
  requested_by uuid not null references auth.users(id),
  requested_at timestamptz not null default now(),
  decision introduction_decision not null default 'pending',
  decision_notes text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  contact_released_at timestamptz,
  unique (response_id)
);

create index introductions_provider_org_id_idx on introductions (provider_org_id);
create index introductions_supplier_org_id_idx on introductions (supplier_org_id);

-- ---------------------------------------------------------------------------
-- Notifications (in-app; email delivery is a separate abstraction)
-- ---------------------------------------------------------------------------

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_id_idx on notifications (user_id, created_at desc);
