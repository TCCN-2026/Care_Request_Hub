-- Same class of bug as 0008/0009: enforce_introduction_decision required
-- is_admin() unconditionally, so a trusted service-role UPDATE (already
-- past RLS entirely) was rejected with "Only an admin may decide an
-- introduction". A null auth.uid() means the caller bypassed RLS already.

create or replace function enforce_introduction_decision()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not is_admin() and auth.uid() is not null then
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
