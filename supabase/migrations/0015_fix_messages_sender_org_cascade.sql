-- messages.sender_org_id referenced organisations without ON DELETE
-- CASCADE, unlike every other child table in this schema - deleting an
-- organisation that had ever sent a message failed with a foreign key
-- violation instead of cascading. Message content is already cleaned up
-- transitively via message_threads -> requests/organisations cascades in
-- the normal case, but sender_org_id is a direct FK too and needs the
-- same behaviour so it doesn't block deletion on its own.

alter table messages drop constraint messages_sender_org_id_fkey;
alter table messages
  add constraint messages_sender_org_id_fkey
  foreign key (sender_org_id) references organisations(id) on delete cascade;
