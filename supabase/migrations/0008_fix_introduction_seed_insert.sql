-- The introduction insert trigger unconditionally overwrote
-- provider_org_id/supplier_org_id/requested_by with auth.uid(), which is
-- null for service-role callers (e.g. the seed script) - violating the
-- not-null constraint on requested_by. Only override when there's an
-- actual authenticated caller to spoof-proof against; a null auth.uid()
-- means the caller already bypassed RLS entirely (service role), so its
-- values are trusted as-is.

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

  if auth.uid() is not null then
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
  end if;

  return new;
end;
$$;
