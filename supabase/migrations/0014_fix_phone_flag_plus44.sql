-- The \y word-boundary check immediately before "+44" never matched: `\y`
-- requires a transition between a word character and a non-word one, but
-- neither a preceding space nor "+" itself count as word characters, so
-- there's no boundary there at all. Moved \y to only guard the leading-0
-- branch (where it's meaningful, since digits are word characters) and
-- dropped it from the +44 branch, where the literal "+44" is distinctive
-- enough on its own.

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

  if new.body ~ '(\+44[\s\-]?[0-9]{2,4}[\s\-]?[0-9]{3,4}[\s\-]?[0-9]{2,4}|\y0[0-9]{2,4}[\s\-]?[0-9]{3,4}[\s\-]?[0-9]{2,4}\y)' then
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
