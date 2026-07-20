-- 0016's grandfather clause on requests_select ("a supplier can still see
-- a request it has already responded to") added a plain subquery into
-- responses - but responses_select already has a plain subquery back into
-- requests, so the two policies now reference each other directly and
-- Postgres detects infinite recursion evaluating either one. Wrapped the
-- new check in a SECURITY DEFINER function (same pattern as
-- request_matches_supplier()) so it bypasses RLS internally - the
-- function runs as its owner (postgres, who owns both tables), which
-- breaks the cycle instead of re-triggering responses_select.

create or replace function supplier_has_response_to(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from responses resp
    where resp.request_id = p_request_id and resp.supplier_org_id = current_org_id()
  );
$$;

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
    or (current_org_type() = 'supplier' and supplier_has_response_to(id))
  );
