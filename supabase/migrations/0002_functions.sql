-- Helper functions used by RLS policies and triggers, plus the write-rule
-- and reference-generation triggers that enforce the request/response/
-- introduction state machines at the database layer (not just in the UI).
--
-- Every SECURITY DEFINER function below pins search_path to prevent
-- search_path hijacking, and only ever reads/writes rows it's explicitly
-- meant to - none of them are general-purpose RLS bypasses.

-- ---------------------------------------------------------------------------
-- Identity / role helpers
-- ---------------------------------------------------------------------------

-- MVP assumption: a user belongs to exactly one organisation. Team invites
-- (a user in multiple orgs) are a later slice; this returns the first
-- membership found.
create or replace function current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select organisation_id
  from organisation_members
  where user_id = auth.uid()
  limit 1;
$$;

create or replace function current_org_type()
returns organisation_type
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select o.type
  from organisations o
  where o.id = current_org_id();
$$;

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(current_org_type() = 'platform_admin', false);
$$;

create or replace function is_verified_supplier()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    current_org_type() = 'supplier'
    and exists (
      select 1 from organisations o
      where o.id = current_org_id() and o.status = 'active'
    ),
    false
  );
$$;

-- ---------------------------------------------------------------------------
-- Postcode-prefix matching
-- ---------------------------------------------------------------------------

-- True if the request's postcode prefix falls within any of the supplier's
-- covered prefixes, e.g. request "KA5" matches coverage {"KA", "G"}.
-- Comparison is case-insensitive and whitespace-trimmed.
create or replace function prefix_matches(request_prefix text, coverage text[])
returns boolean
language sql
immutable
as $$
  select exists (
    select 1
    from unnest(coverage) as cov(prefix)
    where upper(trim(request_prefix)) like upper(trim(cov.prefix)) || '%'
  );
$$;

create or replace function request_matches_supplier(p_request_id uuid, p_supplier_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from requests r
    join organisations s on s.id = p_supplier_org_id
    where r.id = p_request_id
      and r.status = 'open'
      and exists (
        select 1 from supplier_categories sc
        where sc.supplier_org_id = p_supplier_org_id and sc.category_id = r.category_id
      )
      and prefix_matches(r.postcode_prefix, s.coverage_prefixes)
  );
$$;

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organisations_set_updated_at before update on organisations
  for each row execute function set_updated_at();
create trigger profiles_set_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger requests_set_updated_at before update on requests
  for each row execute function set_updated_at();
create trigger responses_set_updated_at before update on responses
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Human-readable reference generation
-- ---------------------------------------------------------------------------

create sequence request_reference_seq;
create sequence introduction_reference_seq;

create or replace function generate_request_reference()
returns trigger
language plpgsql
as $$
begin
  if new.reference is null then
    new.reference := 'CRH-' || to_char(now(), 'YYYY') || '-'
      || lpad(nextval('request_reference_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

create trigger requests_generate_reference before insert on requests
  for each row execute function generate_request_reference();

create or replace function generate_introduction_reference()
returns trigger
language plpgsql
as $$
begin
  if new.reference is null then
    new.reference := 'INTRO-' || to_char(now(), 'YYYY') || '-'
      || lpad(nextval('introduction_reference_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

create trigger introductions_generate_reference before insert on introductions
  for each row execute function generate_introduction_reference();

-- ---------------------------------------------------------------------------
-- Request write rules: enforces who may change status and when content is
-- locked, on top of (not instead of) the RLS policies in 0003_rls.sql.
-- ---------------------------------------------------------------------------

create or replace function enforce_request_write_rules()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if is_admin() then
    return new;
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

create trigger requests_enforce_write_rules before update on requests
  for each row execute function enforce_request_write_rules();

-- ---------------------------------------------------------------------------
-- Response write rules
-- ---------------------------------------------------------------------------

create or replace function enforce_response_write_rules()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request_provider_org_id uuid;
  v_request_status request_status;
begin
  if is_admin() then
    return new;
  end if;

  if new.request_id is distinct from old.request_id
    or new.supplier_org_id is distinct from old.supplier_org_id
  then
    raise exception 'Cannot reassign a response to a different request or organisation';
  end if;

  select provider_org_id, status into v_request_provider_org_id, v_request_status
  from requests where id = old.request_id;

  -- Provider of the parent request: may only shortlist/decline, never edit
  -- the supplier's content.
  if current_org_type() = 'care_provider' and current_org_id() = v_request_provider_org_id then
    if old.status not in ('submitted', 'shortlisted', 'declined')
      or new.status not in ('submitted', 'shortlisted', 'declined')
    then
      raise exception 'Providers may only shortlist or decline a submitted response';
    end if;
    if new.summary is distinct from old.summary
      or new.proposed_solution is distinct from old.proposed_solution
      or new.one_off_cost is distinct from old.one_off_cost
      or new.recurring_cost is distinct from old.recurring_cost
      or new.vat_status is distinct from old.vat_status
      or new.timescale is distinct from old.timescale
    then
      raise exception 'Providers cannot edit supplier response content';
    end if;
    return new;
  end if;

  -- Supplier owner of the response.
  if current_org_type() = 'supplier' and current_org_id() = old.supplier_org_id then
    if old.status = 'draft' then
      if new.status not in ('draft', 'submitted') then
        raise exception 'Cannot change response status from draft to %', new.status;
      end if;
      if new.status = 'submitted' and new.submitted_at is null then
        new.submitted_at := now();
      end if;
      return new;
    end if;

    if old.status = 'submitted' then
      if new.status = 'withdrawn' then
        return new;
      end if;
      if new.status is distinct from old.status then
        raise exception 'Suppliers cannot change response status from submitted to %', new.status;
      end if;
      if v_request_status <> 'open' then
        raise exception 'Cannot edit a response once the request has closed';
      end if;
      return new;
    end if;

    raise exception 'Cannot modify a % response', old.status;
  end if;

  raise exception 'Not authorised to update this response';
end;
$$;

create trigger responses_enforce_write_rules before update on responses
  for each row execute function enforce_response_write_rules();

-- ---------------------------------------------------------------------------
-- Introductions: derive provider/supplier org and reference server-side so
-- a client can never spoof which organisations an introduction links.
-- ---------------------------------------------------------------------------

create or replace function enforce_introduction_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request requests%rowtype;
  v_response responses%rowtype;
begin
  select * into v_request from requests where id = new.request_id;
  select * into v_response from responses where id = new.response_id;

  if v_request.id is null or v_response.id is null or v_response.request_id <> v_request.id then
    raise exception 'Response does not belong to the specified request';
  end if;

  if not is_admin() and current_org_id() <> v_request.provider_org_id then
    raise exception 'Only the owning provider organisation may request an introduction';
  end if;

  if v_response.status not in ('submitted', 'shortlisted') then
    raise exception 'Can only request an introduction for a submitted or shortlisted response';
  end if;

  new.provider_org_id := v_request.provider_org_id;
  new.supplier_org_id := v_response.supplier_org_id;
  new.requested_by := auth.uid();
  new.requested_at := coalesce(new.requested_at, now());
  new.decision := 'pending';
  return new;
end;
$$;

create trigger introductions_enforce_insert before insert on introductions
  for each row execute function enforce_introduction_insert();

-- Only admins may decide an introduction, and only once.
create or replace function enforce_introduction_decision()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_admin() then
    raise exception 'Only an admin may decide an introduction';
  end if;
  if old.decision <> 'pending' then
    raise exception 'This introduction has already been decided';
  end if;
  if new.decision = 'approved' then
    new.contact_released_at := now();
    update responses set status = 'introduced' where id = new.response_id;
  end if;
  new.reviewed_by := auth.uid();
  new.reviewed_at := now();
  return new;
end;
$$;

create trigger introductions_enforce_decision before update on introductions
  for each row execute function enforce_introduction_decision();

-- ---------------------------------------------------------------------------
-- Notifications: created only by trusted server-side logic, never inserted
-- directly by a user, so the notifications table can't be used to spam or
-- impersonate the system.
-- ---------------------------------------------------------------------------

create or replace function create_notification(p_user_id uuid, p_type text, p_title text, p_body text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into notifications (user_id, type, title, body)
  values (p_user_id, p_type, p_title, p_body);
end;
$$;

create or replace function notify_on_request_opened()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'open' and old.status is distinct from 'open' then
    perform create_notification(
      new.created_by,
      'request_approved',
      'Your request ' || new.reference || ' is now live',
      'Suppliers matching your category and area can now see and respond to your request.'
    );
  end if;
  return new;
end;
$$;

create trigger requests_notify_opened after update on requests
  for each row execute function notify_on_request_opened();

create or replace function notify_on_response_submitted()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request requests%rowtype;
begin
  if new.status = 'submitted' and old.status is distinct from 'submitted' then
    select * into v_request from requests where id = new.request_id;
    perform create_notification(
      v_request.created_by,
      'response_received',
      'New response to ' || v_request.reference,
      'A supplier has submitted a response to your request. Sign in to review it.'
    );
  end if;
  return new;
end;
$$;

create trigger responses_notify_submitted after update on responses
  for each row execute function notify_on_response_submitted();

create or replace function notify_on_introduction_decision()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_supplier_user uuid;
begin
  if new.decision = old.decision then
    return new;
  end if;

  select created_by into v_supplier_user from responses where id = new.response_id;

  if new.decision = 'approved' then
    perform create_notification(
      new.requested_by,
      'introduction_approved',
      'Introduction approved for ' || new.reference,
      'The supplier''s contact details are now available on the request page.'
    );
    perform create_notification(
      v_supplier_user,
      'introduction_approved',
      'Introduction approved for ' || new.reference,
      'The provider''s contact details are now available on this response.'
    );
  elsif new.decision = 'rejected' then
    perform create_notification(
      new.requested_by,
      'introduction_rejected',
      'Introduction request declined for ' || new.reference,
      coalesce(new.decision_notes, 'The Care Connector Network was unable to approve this introduction.')
    );
  end if;

  return new;
end;
$$;

create trigger introductions_notify_decision after update on introductions
  for each row execute function notify_on_introduction_decision();
