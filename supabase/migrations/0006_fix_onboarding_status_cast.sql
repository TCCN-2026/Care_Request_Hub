-- Fix: the CASE expression producing the initial organisation status
-- couldn't infer the organisation_status enum type from bare string
-- literals, causing every onboarding attempt to fail with
-- "column status is of type organisation_status but expression is of type text".

create or replace function create_organisation_and_join(
  p_org_type organisation_type,
  p_org_name text,
  p_postcode_prefix text,
  p_coverage_prefixes text[],
  p_full_name text,
  p_job_title text,
  p_phone text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in';
  end if;

  if p_org_type = 'platform_admin' then
    raise exception 'Public registration is not available for admin accounts';
  end if;

  if exists (select 1 from organisation_members where user_id = auth.uid()) then
    raise exception 'You already belong to an organisation';
  end if;

  if p_org_name is null or length(trim(p_org_name)) = 0 then
    raise exception 'Organisation name is required';
  end if;

  insert into organisations (type, name, postcode_prefix, coverage_prefixes, status)
  values (
    p_org_type,
    trim(p_org_name),
    case when p_org_type = 'care_provider' then upper(trim(p_postcode_prefix)) else null end,
    case when p_org_type = 'supplier'
      then (select array_agg(upper(trim(prefix))) from unnest(coalesce(p_coverage_prefixes, '{}')) as prefix)
      else '{}'
    end,
    case when p_org_type = 'supplier' then 'pending_verification' else 'active' end::organisation_status
  )
  returning id into v_org_id;

  insert into organisation_members (organisation_id, user_id, role)
  values (v_org_id, auth.uid(), 'owner');

  insert into profiles (id, full_name, job_title, phone)
  values (auth.uid(), p_full_name, p_job_title, p_phone)
  on conflict (id) do update
    set full_name = excluded.full_name,
        job_title = excluded.job_title,
        phone = excluded.phone,
        updated_at = now();

  return v_org_id;
end;
$$;
