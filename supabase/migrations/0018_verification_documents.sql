-- Supplier verification documents (public liability insurance,
-- professional indemnity insurance, accreditations). Reuses the existing
-- private 'attachments' bucket with a new verification/{supplier_org_id}/...
-- path prefix, rather than a separate bucket - same size/type limits,
-- same proven RLS pattern (keyed by storage_path, so a file can never be
-- reached by anyone who couldn't already see its metadata row).
--
-- Visible only to the uploading supplier and admins - a provider has no
-- branch in this policy at all, unlike requests/responses where a
-- provider legitimately needs some visibility.

create type verification_document_type as enum (
  'public_liability_insurance',
  'professional_indemnity_insurance',
  'accreditation'
);

create type verification_document_status as enum ('pending_review', 'approved', 'rejected');

create table verification_documents (
  id uuid primary key default gen_random_uuid(),
  supplier_org_id uuid not null references organisations(id) on delete cascade,
  document_type verification_document_type not null,
  storage_path text not null unique,
  file_name text not null,
  file_size bigint not null,
  mime_type text not null,
  status verification_document_status not null default 'pending_review',
  rejection_reason text,
  uploaded_by uuid not null references auth.users(id),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index verification_documents_supplier_org_id_idx on verification_documents (supplier_org_id);

alter table verification_documents enable row level security;

create policy verification_documents_select on verification_documents for select
  using (is_admin() or supplier_org_id = current_org_id());

create policy verification_documents_insert on verification_documents for insert
  with check (
    current_org_type() = 'supplier'
    and supplier_org_id = current_org_id()
    and uploaded_by = auth.uid()
    and status = 'pending_review'
  );

-- Only an admin may change a document's review status - this is the
-- self-approval prevention. A supplier has no UPDATE path at all; to
-- change anything about an already-reviewed document they delete and
-- re-upload (delete is blocked once reviewed, see below, so a rejected
-- document stays as a permanent record unless an admin removes it).
create policy verification_documents_update on verification_documents for update
  using (is_admin())
  with check (is_admin());

create policy verification_documents_delete on verification_documents for delete
  using (
    is_admin()
    or (supplier_org_id = current_org_id() and status = 'pending_review')
  );

-- Always overwrites reviewed_by/reviewed_at server-side when the status
-- actually changes - never trusts a client-supplied value. RLS above
-- already restricts UPDATE to admins (or a null auth.uid() service-role
-- caller), so this doesn't need its own admin check.
create or replace function stamp_verification_document_review()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status is distinct from old.status then
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  end if;
  return new;
end;
$$;

create trigger verification_documents_stamp_review before update on verification_documents
  for each row execute function stamp_verification_document_review();

-- ---------------------------------------------------------------------------
-- Verification gate: a supplier organisation can't be marked 'active'
-- (verified) until it has at least one approved public liability
-- insurance document. Applies to admin too, deliberately - the whole
-- point is that the document approval has to happen first.
-- ---------------------------------------------------------------------------

create or replace function enforce_supplier_verification_gate()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.type <> 'supplier' or new.status <> 'active' or old.status = 'active' then
    return new;
  end if;

  -- Trusted service-role callers (seed scripts) bypass business rules
  -- entirely, consistent with the rest of this schema.
  if auth.uid() is null then
    return new;
  end if;

  if not exists (
    select 1 from verification_documents vd
    where vd.supplier_org_id = new.id
      and vd.document_type = 'public_liability_insurance'
      and vd.status = 'approved'
  ) then
    raise exception 'Cannot verify this supplier - an approved public liability insurance document is required first';
  end if;

  return new;
end;
$$;

create trigger organisations_enforce_supplier_verification before update on organisations
  for each row execute function enforce_supplier_verification_gate();

-- ---------------------------------------------------------------------------
-- Extend the existing storage.objects policies with the verification/
-- path prefix.
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
      or exists (
        select 1 from verification_documents vd
        where vd.storage_path = storage.objects.name
          and (is_admin() or vd.supplier_org_id = current_org_id())
      )
    )
  );

drop policy attachments_storage_insert on storage.objects;

create policy attachments_storage_insert on storage.objects for insert
  with check (
    bucket_id = 'attachments'
    and (
      (
        (storage.foldername(name))[1] = 'requests'
        and exists (
          select 1 from requests r
          where r.id::text = (storage.foldername(name))[2]
            and r.provider_org_id = current_org_id()
            and r.status = 'draft'
        )
      )
      or
      (
        (storage.foldername(name))[1] = 'responses'
        and exists (
          select 1 from responses resp
          where resp.id::text = (storage.foldername(name))[2]
            and resp.supplier_org_id = current_org_id()
            and resp.status = 'draft'
        )
      )
      or
      (
        (storage.foldername(name))[1] = 'verification'
        and (storage.foldername(name))[2] = current_org_id()::text
        and current_org_type() = 'supplier'
      )
    )
  );

drop policy attachments_storage_delete on storage.objects;

create policy attachments_storage_delete on storage.objects for delete
  using (
    bucket_id = 'attachments'
    and (
      is_admin()
      or (
        (storage.foldername(name))[1] = 'requests'
        and exists (
          select 1 from requests r
          where r.id::text = (storage.foldername(name))[2]
            and r.provider_org_id = current_org_id()
            and r.status = 'draft'
        )
      )
      or (
        (storage.foldername(name))[1] = 'responses'
        and exists (
          select 1 from responses resp
          where resp.id::text = (storage.foldername(name))[2]
            and resp.supplier_org_id = current_org_id()
            and resp.status = 'draft'
        )
      )
      or (
        (storage.foldername(name))[1] = 'verification'
        and (storage.foldername(name))[2] = current_org_id()::text
        and exists (
          select 1 from verification_documents vd
          where vd.storage_path = storage.objects.name and vd.status = 'pending_review'
        )
      )
    )
  );
