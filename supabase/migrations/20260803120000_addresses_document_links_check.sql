-- H-3 (docs/AUDIT-2026-07-31.md): document_links was jsonb with zero shape
-- enforcement in the database — only application discipline (AddressDrawer.tsx)
-- kept it as [{"id","title","url","type"}, …] with an http(s) url. A direct
-- PostgREST write bypassing the UI could store a `javascript:` scheme, which
-- becomes a stored XSS the moment anyone clicks the rendered link — and
-- "Адреса" is visible to all four roles, including the least-trusted
-- recruiter role. Application-side validation (write + render) is the other
-- half of this fix, in the same commit; this constraint is the second
-- enforcement layer at the data level, per the audit's recommendation.
--
-- Read-only check against production on 2026-08-03 confirmed zero existing
-- rows would violate this constraint (no non-array values, no elements
-- missing required keys, no non-http(s) urls) — a plain CHECK is safe with
-- no backfill/migration step needed.
--
-- Implemented as a function rather than an inline CHECK because PostgreSQL
-- CHECK constraints cannot contain subqueries (even ones that only reference
-- jsonb_array_elements() over the row's own column, not another table) — a
-- function body doesn't have that restriction.
create function public.addresses_document_links_valid(p_links jsonb)
returns boolean
language plpgsql
immutable
as $$
declare
  v_elem jsonb;
begin
  if jsonb_typeof(p_links) is distinct from 'array' then
    return false;
  end if;

  for v_elem in select * from jsonb_array_elements(p_links) loop
    if jsonb_typeof(v_elem) is distinct from 'object' then
      return false;
    end if;
    if not (v_elem ? 'id' and v_elem ? 'title' and v_elem ? 'url' and v_elem ? 'type') then
      return false;
    end if;
    -- Whitelist, not blacklist: only http(s) links are ever rendered as
    -- clickable <a href> in AddressDrawer.tsx — see H-3.
    if not ((v_elem ->> 'url') like 'http://%' or (v_elem ->> 'url') like 'https://%') then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

comment on function public.addresses_document_links_valid(jsonb) is
  'H-3: форма document_links — массив объектов {id,title,url,type}, url только http(s). Используется в CHECK-ограничении addresses_document_links_shape.';

alter table public.addresses
  add constraint addresses_document_links_shape
  check (public.addresses_document_links_valid(document_links));
