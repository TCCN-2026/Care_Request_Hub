-- Profiles didn't carry a queryable email address (auth.users.email isn't
-- readable by other users' sessions). Needed to reveal contact details
-- after an approved introduction, per the profiles_select RLS policy's
-- has_contact_visibility() clause already in place.

alter table profiles add column contact_email text;

-- Populate the onboarding RPC to capture it from the session's own JWT
-- (never trusts a client-supplied email).
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

  insert into profiles (id, full_name, job_title, phone, contact_email)
  values (auth.uid(), p_full_name, p_job_title, p_phone, auth.jwt() ->> 'email')
  on conflict (id) do update
    set full_name = excluded.full_name,
        job_title = excluded.job_title,
        phone = excluded.phone,
        contact_email = excluded.contact_email,
        updated_at = now();

  return v_org_id;
end;
$$;
