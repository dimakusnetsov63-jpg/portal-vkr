-- Adds the new "Адреса" section to the role → sections matrix. All four
-- roles get it (unlike most sections, which are staged): head, coordinator,
-- manager and recruiter all need to see staffing objects, per the "Адреса"
-- ТЗ. Mirrors the identical addition in src/lib/auth/roles.ts
-- (SECTION_ORDER + ROLE_PERMISSIONS) — the two must always change together,
-- see the warning comment on portal_role_sections() in
-- 20260728120000_portal_auth.sql.

create or replace function public.portal_role_sections(p_role public.portal_user_role)
returns text[]
language sql
immutable
as $$
  select case p_role
    when 'head' then array[
      'overview', 'demand', 'addresses', 'candidates', 'vacancies',
      'marketing', 'analytics', 'notifications', 'settings', 'users'
    ]
    when 'coordinator' then array[
      'overview', 'demand', 'addresses', 'candidates', 'vacancies',
      'marketing', 'analytics', 'notifications', 'settings'
    ]
    when 'manager' then array['overview', 'demand', 'addresses', 'candidates', 'vacancies', 'notifications']
    when 'recruiter' then array['addresses', 'candidates', 'vacancies', 'notifications']
  end;
$$;
