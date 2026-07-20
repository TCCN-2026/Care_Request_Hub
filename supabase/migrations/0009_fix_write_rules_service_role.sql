-- Same class of bug as 0008: these triggers only special-cased is_admin(),
-- which itself resolves false when there's no authenticated caller (e.g.
-- the seed script running as service role). A null auth.uid() means the
-- caller already bypassed RLS entirely, so it's trusted as-is - without
-- this, service-role UPDATEs on requests/responses fail with "Not
-- authorised", silently discarded by callers that don't check the error.

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
  if is_admin() or auth.uid() is null then
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
