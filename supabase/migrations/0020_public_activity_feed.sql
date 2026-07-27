-- Public "what people are looking for" feed for the marketing homepage -
-- visible to anyone, including fully anonymous visitors with no session
-- at all. This is a new, wider trust boundary than the existing
-- provider/supplier anonymity split (both of those parties are at least
-- authenticated org members) - here the audience is the entire internet.
--
-- Deliberately exposes category only, never title/description/postcode/
-- budget/urgency/reference or any other column - a category name alone
-- (from the fixed, coarse category list) is not specific enough to
-- identify who posted a request, which is the one invariant this view
-- must never violate no matter what other columns get added to
-- `requests` later.
--
-- A plain view (not `security_invoker`) is used deliberately: it runs
-- with the privileges of its owner, so it bypasses requests_select's
-- restriction (which has no anonymous-access branch at all - by design,
-- per the "no default access" posture in 0003_rls.sql) for exactly this
-- one narrow, safe slice, the same way the existing SECURITY DEFINER
-- helper functions (is_admin(), current_org_id(), etc.) deliberately
-- bypass RLS for narrow, safe checks rather than loosening the policy on
-- the sensitive table itself.
create view public_live_request_categories as
select
  r.id,
  c.name as category_name,
  r.created_at
from requests r
join categories c on c.id = r.category_id
where r.status = 'open';

-- anon has no grants at all by default in this project (see 0003_rls.sql)
-- - this is the one deliberate, narrow exception.
grant select on public_live_request_categories to anon, authenticated;
