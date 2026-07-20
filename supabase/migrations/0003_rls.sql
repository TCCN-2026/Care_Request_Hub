-- Row Level Security policies. This is the primary enforcement point for
-- the anonymity boundary: a supplier must never be able to SELECT a row
-- that resolves to a provider's identity (or vice versa) before an
-- introduction is approved, regardless of what the application code does.
--
-- Relies on Supabase's default grants (SELECT/INSERT/UPDATE/DELETE on
-- public schema tables to the `authenticated` role, nothing to `anon`) -
-- RLS then narrows those grants down to specific rows. Every table below
-- has RLS enabled, so the default posture is "no access" until a policy
-- explicitly allows it.

alter table organisations enable row level security;
alter table organisation_members enable row level security;
alter table profiles enable row level security;
alter table categories enable row level security;
alter table supplier_categories enable row level security;
alter table requests enable row level security;
alter table request_admin_notes enable row level security;
alter table responses enable row level security;
alter table provider_response_notes enable row level security;
alter table introductions enable row level security;
alter table notifications enable row level security;

-- ---------------------------------------------------------------------------
-- Contact-visibility helper: true once an approved introduction links the
-- caller's organisation to the given user as their contact.
-- ---------------------------------------------------------------------------

create or replace function has_contact_visibility(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from introductions i
    join responses r on r.id = i.response_id
    where i.decision = 'approved'
      and (
        (i.provider_org_id = current_org_id() and r.created_by = target_user_id)
        or (i.supplier_org_id = current_org_id() and i.requested_by = target_user_id)
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- organisations
-- ---------------------------------------------------------------------------

create policy organisations_select on organisations for select
  using (
    is_admin()
    or id = current_org_id()
    or exists (
      select 1 from introductions i
      where i.decision = 'approved'
        and (
          (i.provider_org_id = current_org_id() and i.supplier_org_id = organisations.id)
          or (i.supplier_org_id = current_org_id() and i.provider_org_id = organisations.id)
        )
    )
  );

create policy organisations_update on organisations for update
  using (is_admin() or id = current_org_id())
  with check (is_admin() or id = current_org_id());

-- No insert policy: organisation creation only happens via the
-- create_organisation_and_join() SECURITY DEFINER function in
-- 0004_onboarding.sql, so every new org is created consistently with a
-- valid owner membership in the same transaction.

-- ---------------------------------------------------------------------------
-- organisation_members
-- ---------------------------------------------------------------------------

create policy organisation_members_select on organisation_members for select
  using (is_admin() or organisation_id = current_org_id());

create policy organisation_members_admin_write on organisation_members for all
  using (is_admin())
  with check (is_admin());

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create policy profiles_select on profiles for select
  using (
    id = auth.uid()
    or is_admin()
    or exists (
      select 1 from organisation_members m
      where m.organisation_id = current_org_id() and m.user_id = profiles.id
    )
    or has_contact_visibility(id)
  );

create policy profiles_insert_self on profiles for insert
  with check (id = auth.uid());

create policy profiles_update on profiles for update
  using (id = auth.uid() or is_admin())
  with check (id = auth.uid() or is_admin());

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------

create policy categories_select on categories for select
  using (is_active or is_admin());

create policy categories_admin_write on categories for all
  using (is_admin())
  with check (is_admin());

-- ---------------------------------------------------------------------------
-- supplier_categories
-- ---------------------------------------------------------------------------

create policy supplier_categories_select on supplier_categories for select
  using (is_admin() or supplier_org_id = current_org_id());

create policy supplier_categories_write on supplier_categories for all
  using (is_admin() or supplier_org_id = current_org_id())
  with check (is_admin() or supplier_org_id = current_org_id());

-- ---------------------------------------------------------------------------
-- requests
-- ---------------------------------------------------------------------------

create policy requests_select on requests for select
  using (
    is_admin()
    or provider_org_id = current_org_id()
    or (
      current_org_type() = 'supplier'
      and is_verified_supplier()
      and status = 'open'
      and request_matches_supplier(id, current_org_id())
    )
  );

create policy requests_insert on requests for insert
  with check (
    current_org_type() = 'care_provider'
    and provider_org_id = current_org_id()
    and created_by = auth.uid()
    and status = 'draft'
  );

create policy requests_update on requests for update
  using (is_admin() or provider_org_id = current_org_id())
  with check (is_admin() or provider_org_id = current_org_id());

-- ---------------------------------------------------------------------------
-- request_admin_notes - admin-only, full stop.
-- ---------------------------------------------------------------------------

create policy request_admin_notes_admin_only on request_admin_notes for all
  using (is_admin())
  with check (is_admin());

-- ---------------------------------------------------------------------------
-- responses
-- ---------------------------------------------------------------------------

create policy responses_select on responses for select
  using (
    is_admin()
    or (current_org_type() = 'supplier' and supplier_org_id = current_org_id())
    or (
      current_org_type() = 'care_provider'
      and exists (
        select 1 from requests r
        where r.id = responses.request_id and r.provider_org_id = current_org_id()
      )
    )
  );

create policy responses_insert on responses for insert
  with check (
    current_org_type() = 'supplier'
    and supplier_org_id = current_org_id()
    and created_by = auth.uid()
    and is_verified_supplier()
    and request_matches_supplier(request_id, supplier_org_id)
    and status = 'draft'
  );

create policy responses_update on responses for update
  using (
    is_admin()
    or supplier_org_id = current_org_id()
    or exists (
      select 1 from requests r
      where r.id = responses.request_id and r.provider_org_id = current_org_id()
    )
  )
  with check (
    is_admin()
    or supplier_org_id = current_org_id()
    or exists (
      select 1 from requests r
      where r.id = responses.request_id and r.provider_org_id = current_org_id()
    )
  );

-- ---------------------------------------------------------------------------
-- provider_response_notes - only the owning provider org (and admin).
-- Never visible to the supplier who submitted the response.
-- ---------------------------------------------------------------------------

create policy provider_response_notes_access on provider_response_notes for all
  using (
    is_admin()
    or exists (
      select 1 from responses r
      join requests req on req.id = r.request_id
      where r.id = provider_response_notes.response_id
        and req.provider_org_id = current_org_id()
    )
  )
  with check (
    is_admin()
    or exists (
      select 1 from responses r
      join requests req on req.id = r.request_id
      where r.id = provider_response_notes.response_id
        and req.provider_org_id = current_org_id()
    )
  );

-- ---------------------------------------------------------------------------
-- introductions
-- ---------------------------------------------------------------------------

create policy introductions_select on introductions for select
  using (is_admin() or provider_org_id = current_org_id() or supplier_org_id = current_org_id());

create policy introductions_insert on introductions for insert
  with check (current_org_type() = 'care_provider' and provider_org_id = current_org_id());

create policy introductions_update on introductions for update
  using (is_admin())
  with check (is_admin());

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------

create policy notifications_select on notifications for select
  using (user_id = auth.uid());

create policy notifications_update_own on notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Direct inserts are restricted to admins; all other notifications are
-- created by SECURITY DEFINER trigger functions (owned by the table owner,
-- which bypasses RLS) so a user can never insert a notification impersonating
-- the system or spamming another user.
create policy notifications_admin_insert on notifications for insert
  with check (is_admin());
