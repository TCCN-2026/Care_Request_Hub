-- Optional budget range and urgency level on a request. Both are shown to
-- suppliers on the anonymous request view (budget range so a supplier can
-- judge realism before spending time on a response, urgency so they can
-- triage) - neither has any different information-disclosure logic yet,
-- so no RLS changes are needed: these are plain columns on `requests`,
-- covered by the existing requests_select/insert/update policies the same
-- way title/description already are.
--
-- text + check constraint rather than a Postgres enum type, matching the
-- existing vat_status column on `responses` - this is a small in-app-only
-- enum with no cross-table references, unlike request_status.

alter table requests
  add column budget_min numeric(12, 2),
  add column budget_max numeric(12, 2),
  add column budget_includes_vat boolean,
  add column urgency text not null default 'standard'
    check (urgency in ('exploring', 'standard', 'urgent'));

-- A provider can give just a floor or just a ceiling ("a rough low/high",
-- not a precise figure) - only enforce ordering when both are present.
alter table requests add constraint requests_budget_range_valid
  check (budget_min is null or budget_max is null or budget_min <= budget_max);

create index requests_urgency_idx on requests (urgency);
