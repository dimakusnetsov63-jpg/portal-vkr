-- RLS policies for public.addresses. Same trust model as the rest of the
-- portal since 20260728120000_portal_auth.sql: access is gated by
-- `public.portal_can('addresses')`, not an unconditional `using (true)`.
--
-- All four operations are granted to anyone with the "Адреса" section —
-- like public.candidates (soft-delete via archived_at, no delete policy)
-- and unlike public.staffing_demand (which needs a real DELETE because it
-- has no archived_at column at all). Archiving/restoring an address is a
-- plain UPDATE of archived_at, so DELETE is not needed here either — this
-- table has none, matching candidates.

create policy "portal_select_addresses"
  on public.addresses for select to authenticated
  using (public.portal_can('addresses'));

create policy "portal_insert_addresses"
  on public.addresses for insert to authenticated
  with check (public.portal_can('addresses'));

create policy "portal_update_addresses"
  on public.addresses for update to authenticated
  using (public.portal_can('addresses'))
  with check (public.portal_can('addresses'));
