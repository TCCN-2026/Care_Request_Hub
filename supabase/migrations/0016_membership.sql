-- Membership gating, set manually by an admin for now (no payment
-- processing). Suppliers need to be a CCN member (in addition to being
-- verified) to see or respond to live requests. Providers get 5 free live
-- requests, after which further approvals are blocked unless the
-- organisation is a member or that specific request has been marked
-- paid-per-request by an admin.
--
-- The gate fires at the moment a request goes live (status -> 'open'),
-- not at creation or submission - drafts stay free and unlimited, since
-- what's actually being rationed is publication, not authoring.

alter table organisations add column is_ccn_member boolean not null default false;
alter table requests add column paid_per_request boolean not null default false;

-- ---------------------------------------------------------------------------
-- Pre-existing gap, closed here because it's directly load-bearing for
-- this feature: organisations_update had no field-level restriction, so
-- an organisation could already update its own `status` (self-verify a
-- pending supplier) via a plain table update, RLS only checked "is this
-- my org". Without closing this, an org could just as easily grant itself
-- is_ccn_member. Self-service profile fields (name, postcode_prefix,
-- coverage_prefixes) remain editable; type/status/membership do not.
-- ---------------------------------------------------------------------------

create or replace function enforce_organisation_write_rules()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if is_admin() or auth.uid() is null then
    return new;
  end if;

  if new.type is distinct from old.type
    or new.status is distinct from old.status
    or new.is_ccn_member is distinct from old.is_ccn_member
  then
    raise exception 'Only an admin can change organisation type, verification status or membership';
  end if;

  return new;
end;
$$;

create trigger organisations_enforce_write_rules before update on organisations
  for each row execute function enforce_organisation_write_rules();

-- ---------------------------------------------------------------------------
-- Supplier eligibility: verified AND a CCN member. Centralised here so
-- every policy that gates supplier access to a live request uses the same
-- rule - update this once, not five places.
-- ---------------------------------------------------------------------------

create or replace function is_eligible_supplier()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    is_verified_supplier()
    and exists (select 1 from organisations o where o.id = current_org_id() and o.is_ccn_member = true),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- requests_select: swap is_verified_supplier() for the full eligibility
-- check, and add a grandfather clause so a supplier who already has a
-- response to a request keeps read access to it even if their membership
-- or verification status changes afterwards (matches how responses_select
-- already doesn't re-check verification for a supplier's own responses).
-- ---------------------------------------------------------------------------

drop policy requests_select on requests;

create policy requests_select on requests for select
  using (
    is_admin()
    or provider_org_id = current_org_id()
    or (
      is_eligible_supplier()
      and status = 'open'
      and request_matches_supplier(id, current_org_id())
    )
    or (
      current_org_type() = 'supplier'
      and exists (
        select 1 from responses resp
        where resp.request_id = requests.id and resp.supplier_org_id = current_org_id()
      )
    )
  );

-- requests_insert: a provider must never be able to set paid_per_request
-- themselves - only an admin grants that, via UPDATE.

drop policy requests_insert on requests;

create policy requests_insert on requests for insert
  with check (
    current_org_type() = 'care_provider'
    and provider_org_id = current_org_id()
    and created_by = auth.uid()
    and status = 'draft'
    and coalesce(paid_per_request, false) = false
  );

-- ---------------------------------------------------------------------------
-- responses_insert: same eligibility swap.
-- ---------------------------------------------------------------------------

drop policy responses_insert on responses;

create policy responses_insert on responses for insert
  with check (
    supplier_org_id = current_org_id()
    and created_by = auth.uid()
    and is_eligible_supplier()
    and request_matches_supplier(request_id, supplier_org_id)
    and status = 'draft'
  );

-- ---------------------------------------------------------------------------
-- request_attachments_select: same eligibility swap.
-- ---------------------------------------------------------------------------

drop policy request_attachments_select on request_attachments;

create policy request_attachments_select on request_attachments for select
  using (
    is_admin()
    or exists (select 1 from requests r where r.id = request_id and r.provider_org_id = current_org_id())
    or (
      visible_to_suppliers
      and is_eligible_supplier()
      and exists (
        select 1 from requests r
        where r.id = request_id and r.status = 'open' and request_matches_supplier(r.id, current_org_id())
      )
    )
  );

-- ---------------------------------------------------------------------------
-- attachments_storage_select: same eligibility swap, request-attachments
-- branch only (the response-attachments branch doesn't gate on supplier
-- eligibility - it's scoped to a specific response the supplier already
-- owns, same grandfathering logic as elsewhere).
-- ---------------------------------------------------------------------------

drop policy attachments_storage_select on storage.objects;

create policy attachments_storage_select on storage.objects for select
  using (
    bucket_id = 'attachments'
    and (
      exists (
        select 1 from request_attachments ra
        join requests r on r.id = ra.request_id
        where ra.storage_path = storage.objects.name
          and (
            is_admin()
            or r.provider_org_id = current_org_id()
            or (
              ra.visible_to_suppliers
              and is_eligible_supplier()
              and r.status = 'open'
              and request_matches_supplier(r.id, current_org_id())
            )
          )
      )
      or exists (
        select 1 from response_attachments rp
        join responses resp on resp.id = rp.response_id
        join requests r2 on r2.id = resp.request_id
        where rp.storage_path = storage.objects.name
          and (is_admin() or resp.supplier_org_id = current_org_id() or r2.provider_org_id = current_org_id())
      )
    )
  );

-- ---------------------------------------------------------------------------
-- message_threads_insert: eligibility swap for the "first contact" path
-- only. The "already responded" path is left as-is (no re-check), same
-- grandfathering rationale as requests_select above.
-- ---------------------------------------------------------------------------

drop policy message_threads_insert on message_threads;

create policy message_threads_insert on message_threads for insert
  with check (
    is_admin()
    or (
      current_org_type() = 'care_provider'
      and exists (select 1 from requests r where r.id = request_id and r.provider_org_id = current_org_id())
      and exists (
        select 1 from responses resp
        where resp.request_id = message_threads.request_id and resp.supplier_org_id = message_threads.supplier_org_id
      )
    )
    or (
      supplier_org_id = current_org_id()
      and (
        (is_eligible_supplier() and request_matches_supplier(request_id, current_org_id()))
        or exists (
          select 1 from responses resp
          where resp.request_id = message_threads.request_id and resp.supplier_org_id = current_org_id()
        )
      )
    )
  );

-- ---------------------------------------------------------------------------
-- enforce_request_write_rules: block a provider from setting
-- paid_per_request themselves via UPDATE (INSERT is already blocked by
-- requests_insert above). Only an admin (who returns early) may set it.
-- ---------------------------------------------------------------------------

create or replace function enforce_request_write_rules()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if is_admin() or auth.uid() is null then
    return new;
  end if;

  if new.paid_per_request is distinct from old.paid_per_request then
    raise exception 'Only an admin can mark a request as paid-per-request';
  end if;

  if new.provider_org_id is distinct from old.provider_org_id then
    raise exception 'Cannot reassign a request to a different organisation';
  end if;

  if old.status = 'draft' then
    if new.status not in ('draft', 'submitted') then
      raise exception 'Cannot change request status from draft to %', new.status;
    end if;
    if new.status = 'submitted' and new.submitted_at is null then
      new.submitted_at := now();
    end if;
    return new;
  end if;

  if old.status in ('submitted', 'approved', 'open') then
    if new.status = 'cancelled' then
      -- Cancelling is allowed; content must stay as it was.
    elsif new.status is distinct from old.status then
      raise exception 'Providers cannot change request status from % to %', old.status, new.status;
    end if;
    if new.title is distinct from old.title
      or new.description is distinct from old.description
      or new.desired_outcome is distinct from old.desired_outcome
      or new.mandatory_requirements is distinct from old.mandatory_requirements
      or new.postcode_prefix is distinct from old.postcode_prefix
      or new.closing_date is distinct from old.closing_date
      or new.category_id is distinct from old.category_id
    then
      raise exception 'Cannot edit request content once it has been submitted';
    end if;
    return new;
  end if;

  raise exception 'Cannot modify a % request', old.status;
end;
$$;

-- ---------------------------------------------------------------------------
-- The membership/free-tier gate itself: fires whenever a request is about
-- to go live. Applies to admin too - that's the point, admin is the one
-- being asked to grant membership or the one-off pass first.
-- ---------------------------------------------------------------------------

create or replace function enforce_provider_membership_gate()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_is_member boolean;
  v_live_count integer;
begin
  if new.status <> 'open' or old.status = 'open' then
    return new;
  end if;

  -- Trusted service-role callers (seed scripts, admin scripts) bypass
  -- business rules entirely, consistent with the rest of this schema.
  if auth.uid() is null then
    return new;
  end if;

  select is_ccn_member into v_is_member from organisations where id = new.provider_org_id;

  if v_is_member then
    return new;
  end if;

  if new.paid_per_request then
    return new;
  end if;

  select count(*) into v_live_count
  from requests
  where provider_org_id = new.provider_org_id
    and approved_at is not null
    and id <> new.id;

  if v_live_count >= 5 then
    raise exception 'This organisation has used its 5 free live requests. Mark it as a CCN member, or approve this request as paid-per-request, to publish it.';
  end if;

  return new;
end;
$$;

create trigger requests_enforce_membership_gate before update on requests
  for each row execute function enforce_provider_membership_gate();
