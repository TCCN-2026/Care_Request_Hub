-- Threaded messages between a provider and a specific supplier about a
-- request. One thread per (request, supplier) pair, so Supplier A's
-- conversation is fully isolated from Supplier B's - neither the provider
-- comparing threads nor the suppliers themselves can see across threads.
--
-- Identity is hidden the same way as elsewhere: RLS never exposes the
-- counterpart's organisation/profile row before an approved introduction,
-- so the UI has nothing to reveal even if it wanted to - it falls back to
-- role labels ("Provider" / "Supplier A") purely because the real name
-- isn't queryable yet, not because of a client-side check.

create table message_threads (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  supplier_org_id uuid not null references organisations(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (request_id, supplier_org_id)
);

create index message_threads_request_id_idx on message_threads (request_id);

create table messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references message_threads(id) on delete cascade,
  sender_org_id uuid not null references organisations(id),
  sender_user_id uuid not null references auth.users(id),
  body text not null,
  -- Always computed server-side by a trigger below - never trust a
  -- client-supplied value, so a message can't dodge review by simply not
  -- setting it.
  flagged boolean not null default false,
  flag_reason text,
  created_at timestamptz not null default now()
);

create index messages_thread_id_idx on messages (thread_id, created_at);
create index messages_flagged_idx on messages (flagged) where flagged;

alter table message_threads enable row level security;
alter table messages enable row level security;

-- ---------------------------------------------------------------------------
-- message_threads
-- ---------------------------------------------------------------------------

create policy message_threads_select on message_threads for select
  using (
    is_admin()
    or supplier_org_id = current_org_id()
    or exists (select 1 from requests r where r.id = request_id and r.provider_org_id = current_org_id())
  );

-- A provider may only open a thread with a supplier who has already
-- engaged (submitted a response) - they have no way to address a supplier
-- they don't yet know the org id of, which keeps this consistent with the
-- anonymity model rather than an arbitrary restriction. A supplier may
-- open a thread with any request they're currently eligible to respond
-- to, or one they've already responded to (so the conversation stays
-- usable after the request closes).
create policy message_threads_insert on message_threads for insert
  with check (
    is_admin()
    or (
      current_org_type() = 'care_provider'
      and exists (select 1 from requests r where r.id = request_id and r.provider_org_id = current_org_id())
      and exists (
        select 1 from responses resp
        where resp.request_id = message_threads.request_id and resp.supplier_org_id = message_threads.supplier_org_id
      )
    )
    or (
      current_org_type() = 'supplier'
      and supplier_org_id = current_org_id()
      and is_verified_supplier()
      and (
        request_matches_supplier(request_id, current_org_id())
        or exists (
          select 1 from responses resp
          where resp.request_id = message_threads.request_id and resp.supplier_org_id = current_org_id()
        )
      )
    )
  );

-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------

create policy messages_select on messages for select
  using (
    is_admin()
    or exists (
      select 1 from message_threads mt
      join requests r on r.id = mt.request_id
      where mt.id = thread_id
        and (mt.supplier_org_id = current_org_id() or r.provider_org_id = current_org_id())
    )
  );

create policy messages_insert on messages for insert
  with check (
    sender_user_id = auth.uid()
    and sender_org_id = current_org_id()
    and exists (
      select 1 from message_threads mt
      join requests r on r.id = mt.request_id
      where mt.id = thread_id
        and (mt.supplier_org_id = current_org_id() or r.provider_org_id = current_org_id())
    )
  );

-- No update/delete policies - messages are immutable once sent.

-- ---------------------------------------------------------------------------
-- Contact-info flagging: heuristic, review-oriented (not a hard block).
-- Always recomputed here, ignoring any client-supplied flagged/flag_reason.
-- ---------------------------------------------------------------------------

create or replace function flag_message_contact_info()
returns trigger
language plpgsql
as $$
declare
  v_reasons text[] := '{}';
begin
  if new.body ~* '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' then
    v_reasons := array_append(v_reasons, 'possible email address');
  end if;

  if new.body ~ '(\+?[0-9][0-9\s\-\.\(\)]{7,}[0-9])' then
    v_reasons := array_append(v_reasons, 'possible phone number');
  end if;

  if new.body ~* '\y(whatsapp|whats app|skype|telegram|signal|call me|text me|email me|mail me|my email|my number|my mobile|phone me|ring me|contact me directly|outside the platform|off platform|off-platform|reach me at|dm me|message me on|find me on)\y' then
    v_reasons := array_append(v_reasons, 'possible request to contact outside the platform');
  end if;

  if array_length(v_reasons, 1) > 0 then
    new.flagged := true;
    new.flag_reason := array_to_string(v_reasons, '; ');
  else
    new.flagged := false;
    new.flag_reason := null;
  end if;

  return new;
end;
$$;

create trigger messages_flag_contact_info before insert on messages
  for each row execute function flag_message_contact_info();
