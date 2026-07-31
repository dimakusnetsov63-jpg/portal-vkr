-- Добавляет раздел «Ставки» в матрицу «роль → разделы». Доступен всем
-- четырём ролям — как «Адреса» и «Уведомления»: рекрутёр называет ставку
-- кандидату на первом же созвоне, координатор и менеджер сверяют её с
-- условиями клиента. Ограничивать раздел ролями значило бы заставить
-- рекрутёра спрашивать цифру у координатора.
--
-- Повторяет такое же добавление в src/lib/auth/roles.ts (SECTION_ORDER +
-- ROLE_PERMISSIONS) — две матрицы всегда меняются вместе, см.
-- предупреждение у portal_role_sections() в 20260728120000_portal_auth.sql:
-- рассинхронизацию не поймают ни типы, ни тесты, она проявится как «раздел
-- видно, а данные не грузятся».

create or replace function public.portal_role_sections(p_role public.portal_user_role)
returns text[]
language sql
immutable
as $$
  select case p_role
    when 'head' then array[
      'overview', 'demand', 'addresses', 'candidates', 'vacancies', 'rates',
      'marketing', 'analytics', 'notifications', 'settings', 'users'
    ]
    when 'coordinator' then array[
      'overview', 'demand', 'addresses', 'candidates', 'vacancies', 'rates',
      'marketing', 'analytics', 'notifications', 'settings'
    ]
    when 'manager' then array[
      'overview', 'demand', 'addresses', 'candidates', 'vacancies', 'rates', 'notifications'
    ]
    when 'recruiter' then array['addresses', 'candidates', 'vacancies', 'rates', 'notifications']
  end;
$$;
