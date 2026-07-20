-- File attachments for requests and responses, backed by a private
-- Supabase Storage bucket. Storage RLS mirrors the same access rules as
-- the parent requests/responses tables, keyed by storage_path, so a file
-- can never be reached by anyone who couldn't already see its metadata
-- row - not by guessing/enumerating a path, since "list" and "get" both
-- go through these policies.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'attachments',
  'attachments',
  false,
  10485760, -- 10 MB
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- request_attachments
-- ---------------------------------------------------------------------------

create table request_attachments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  file_size bigint not null,
  mime_type text not null,
  -- Providers choose whether each file is visible to matched suppliers
  -- before introduction, or kept private to themselves and admins.
  visible_to_suppliers boolean not null default false,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index request_attachments_request_id_idx on request_attachments (request_id);

alter table request_attachments enable row level security;

create policy request_attachments_select on request_attachments for select
  using (
    is_admin()
    or exists (select 1 from requests r where r.id = request_id and r.provider_org_id = current_org_id())
    or (
      visible_to_suppliers
      and current_org_type() = 'supplier'
      and is_verified_supplier()
      and exists (
        select 1 from requests r
        where r.id = request_id and r.status = 'open' and request_matches_supplier(r.id, current_org_id())
      )
    )
  );

create policy request_attachments_insert on request_attachments for insert
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from requests r
      where r.id = request_id and r.provider_org_id = current_org_id() and r.status = 'draft'
    )
  );

create policy request_attachments_delete on request_attachments for delete
  using (
    is_admin()
    or exists (
      select 1 from requests r
      where r.id = request_id and r.provider_org_id = current_org_id() and r.status = 'draft'
    )
  );

-- ---------------------------------------------------------------------------
-- response_attachments
-- ---------------------------------------------------------------------------

create table response_attachments (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references responses(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  file_size bigint not null,
  mime_type text not null,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index response_attachments_response_id_idx on response_attachments (response_id);

alter table response_attachments enable row level security;

create policy response_attachments_select on response_attachments for select
  using (
    is_admin()
    or exists (select 1 from responses resp where resp.id = response_id and resp.supplier_org_id = current_org_id())
    or exists (
      select 1 from responses resp
      join requests r on r.id = resp.request_id
      where resp.id = response_id and r.provider_org_id = current_org_id()
    )
  );

create policy response_attachments_insert on response_attachments for insert
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from responses resp
      where resp.id = response_id and resp.supplier_org_id = current_org_id() and resp.status = 'draft'
    )
  );

create policy response_attachments_delete on response_attachments for delete
  using (
    is_admin()
    or exists (
      select 1 from responses resp
      where resp.id = response_id and resp.supplier_org_id = current_org_id() and resp.status = 'draft'
    )
  );

-- ---------------------------------------------------------------------------
-- storage.objects policies for the 'attachments' bucket
--
-- Path convention (enforced by the insert policies below, not just
-- application code): requests/{request_id}/{attachment_id}-{safe_name}
-- and responses/{response_id}/{attachment_id}-{safe_name}.
-- ---------------------------------------------------------------------------

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
              and current_org_type() = 'supplier'
              and is_verified_supplier()
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
    )
  );

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
    )
  );

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
    )
  );
