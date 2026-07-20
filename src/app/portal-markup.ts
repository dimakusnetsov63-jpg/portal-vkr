export const PORTAL_HTML = `
<div class="app">
  <div class="sidebar-scrim" id="scrim"></div>
  <aside class="sidebar" id="sidebar" aria-label="Основная навигация">
    <div class="sidebar-brand">
      <div class="brand-mark">SF</div>
      <div class="brand-text"><b>StaffFlow Pro</b><span>Портал подбора персонала</span></div>
    </div>
    <nav class="nav" id="nav"></nav>
    <div class="sidebar-foot">
      <button class="user-chip" id="profileTrigger">
        <div class="avatar" style="background:#5856d6">ДК</div>
        <div class="who"><b>Дмитрий Кузнецов</b><span>HR-директор</span></div>
      </button>
    </div>
  </aside>

  <div class="main">
    <header class="topbar">
      <button class="menu-btn" id="menuBtn" aria-label="Открыть меню">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
      </button>
      <h1 class="page-title" id="pageTitle">Обзор</h1>
      <button class="topbar-search" id="cmdTrigger" type="button">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3-3"/></svg>
        <span style="flex:1;text-align:left;color:var(--text-3)">Поиск по порталу…</span>
        <kbd>⌘K</kbd>
      </button>
      <div class="topbar-actions">
        <div class="dropdown">
          <button class="icon-btn" id="notifBtn" aria-label="Уведомления">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
            <span class="dot" id="notifDot"></span>
          </button>
          <div class="dropdown-panel" id="notifPanel">
            <div class="dp-head">Уведомления <a href="#" data-goto="notifications">Все</a></div>
            <div class="dp-list" id="notifDropList"></div>
            <div class="dp-foot"><a href="#" id="markAllTop">Отметить всё прочитанным</a></div>
          </div>
        </div>
        <div class="dropdown">
          <button class="user-chip" id="profileTrigger2" style="padding:4px 8px 4px 4px;">
            <div class="avatar" style="background:#5856d6">ДК</div>
          </button>
          <div class="dropdown-panel profile-menu" id="profilePanel">
            <div class="pm-head"><div class="avatar" style="background:#5856d6">ДК</div><div class="who"><b style="font-size:13px">Дмитрий Кузнецов</b><span style="font-size:11.5px;color:var(--text-3)">dmitry@staffflow.pro</span></div></div>
            <button class="pm-item" data-goto="settings"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></svg>Настройки</button>
            <button class="pm-item" id="logoutBtn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>Выйти</button>
          </div>
        </div>
        <span id="ctxAction"></span>
      </div>
    </header>

    <main class="content" id="content">
      <!-- ===== ОБЗОР ===== -->
      <section class="section" id="page-overview">
        <div class="page-head">
          <div class="eyebrow">Понедельник, 20 июля 2026</div>
          <h2>Сводка по всем проектам подбора и аутсорсинга линейного персонала за текущий период.</h2>
        </div>
        <div class="stat-grid" id="overviewStats"></div>
        <div class="grid-2">
          <div class="panel">
            <div class="panel-head"><h3>Проекты в зоне риска</h3><span class="sub">Требуют внимания</span></div>
            <div id="riskList"></div>
          </div>
          <div class="panel">
            <div class="panel-head"><h3>Важные уведомления</h3><span class="sub">За сегодня</span></div>
            <div id="overviewNotifs"></div>
          </div>
        </div>
      </section>

      <!-- ===== ПОТРЕБНОСТЬ ===== -->
      <section class="section" id="page-demand">
        <div class="page-head">
          <div class="eyebrow">Планирование</div>
          <h2>Матрица потребности в персонале по проектам, городам и датам.</h2>
        </div>
        <div class="panel">
          <div class="toolbar">
            <div class="search-field" style="min-width:200px;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3-3"/></svg>
              <input type="text" placeholder="Поиск по проекту или городу" id="demandSearch">
            </div>
            <select class="select" id="demandProject"><option value="">Все проекты</option></select>
            <select class="select" id="demandCity"><option value="">Все города</option></select>
            <select class="select" id="demandLevel">
              <option value="">Любой уровень</option>
              <option value="critical">Критический дефицит</option>
              <option value="elevated">Повышенный</option>
              <option value="normal">Норма</option>
              <option value="zero">Нет потребности</option>
            </select>
            <button class="btn btn-ghost btn-sm" id="demandReset">Сбросить</button>
            <div class="spacer"></div>
            <div class="seg" id="demandScale">
              <button data-scale="day" class="active">День</button>
              <button data-scale="week">Неделя</button>
              <button data-scale="month">Месяц</button>
            </div>
            <button class="btn btn-primary btn-sm" id="addDemandBtn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
              Добавить потребность
            </button>
          </div>
          <div class="legend">
            <div class="legend-item"><span class="legend-swatch" style="background:var(--green-soft);border:1px solid var(--green)"></span>Норма</div>
            <div class="legend-item"><span class="legend-swatch" style="background:var(--amber-soft);border:1px solid var(--amber)"></span>Повышенная</div>
            <div class="legend-item"><span class="legend-swatch" style="background:var(--red-soft);border:1px solid var(--red)"></span>Критическая</div>
            <div class="legend-item"><span class="legend-swatch" style="background:var(--surface-2);border:1px solid var(--border)"></span>Нет потребности</div>
            <div class="toolbar-demo">Состояние:
              <select id="demandStateDemo">
                <option value="normal">Обычное</option>
                <option value="loading">Загрузка</option>
                <option value="empty">Пустой результат</option>
                <option value="error">Ошибка</option>
              </select>
            </div>
          </div>
          <div class="table-wrap" id="demandWrap">
            <div class="table-scroll scroll-x" id="demandScroll">
              <table class="matrix-table" id="demandTable"></table>
            </div>
            <div class="hscroll-fake scroll-x" id="demandHFake"><div class="hscroll-fake-inner" id="demandHFakeInner"></div></div>
          </div>
        </div>
      </section>

      <!-- ===== КАНДИДАТЫ ===== -->
      <section class="section" id="page-candidates">
        <div class="page-head">
          <div class="eyebrow">Подбор</div>
          <h2>Единый реестр кандидатов и история движения по этапам найма.</h2>
        </div>
        <div class="stat-grid" id="candidateStats" style="grid-template-columns:repeat(4,1fr);"></div>
        <div class="panel">
          <div class="toolbar">
            <div class="search-field" style="min-width:220px;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3-3"/></svg>
              <input type="text" placeholder="Поиск по ФИО или ID" id="candSearch">
            </div>
            <select class="select" id="candProject"><option value="">Все проекты</option></select>
            <select class="select" id="candCity"><option value="">Все города</option></select>
            <select class="select" id="candStage"><option value="">Все стадии</option></select>
            <select class="select" id="candRecruiter"><option value="">Все рекрутеры</option></select>
            <input type="date" class="select" id="candDate" style="padding:0 10px;">
            <button class="btn btn-ghost btn-sm" id="candReset">Сбросить</button>
            <div class="spacer"></div>
            <div class="toolbar-demo">Состояние:
              <select id="candStateDemo">
                <option value="normal">Обычное</option>
                <option value="loading">Загрузка</option>
                <option value="empty">Пустой результат</option>
                <option value="error">Ошибка</option>
              </select>
            </div>
            <button class="btn btn-sm" id="exportCandBtn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>
              Экспорт
            </button>
            <button class="btn btn-primary btn-sm" id="addCandBtn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
              Добавить кандидата
            </button>
          </div>
          <div class="table-wrap" id="candWrap">
            <div class="table-scroll scroll-x" id="candScroll">
              <table id="candTable"></table>
            </div>
            <div class="hscroll-fake scroll-x" id="candHFake"><div class="hscroll-fake-inner" id="candHFakeInner"></div></div>
          </div>
          <footer class="pager" id="candPager"></footer>
        </div>
      </section>

      <!-- ===== МАРКЕТИНГ ===== -->
      <section class="section" id="page-marketing">
        <div class="page-head">
          <div class="eyebrow">Привлечение</div>
          <h2>Эффективность рекламных каналов и стоимость привлечения по воронке найма.</h2>
        </div>
        <div class="stat-grid" id="marketingStats"></div>
        <div class="grid-2">
          <div class="panel">
            <div class="panel-head"><h3>Каналы привлечения</h3><span class="sub">За последние 30 дней</span></div>
            <div class="table-wrap">
              <div class="table-scroll scroll-x">
                <table id="channelTable"></table>
              </div>
            </div>
          </div>
          <div class="panel">
            <div class="panel-head"><h3>Доля бюджета по каналам</h3></div>
            <div class="panel-body" id="channelBars"></div>
          </div>
        </div>
      </section>

      <!-- ===== АНАЛИТИКА ===== -->
      <section class="section" id="page-analytics">
        <div class="page-head">
          <div class="eyebrow">Отчётность</div>
          <h2>Показатели плана, дефицита и конверсии воронки найма по срезам.</h2>
        </div>
        <div class="panel" style="margin-bottom:16px;">
          <div class="toolbar">
            <select class="select" id="anaPeriod">
              <option value="week">Текущая неделя</option>
              <option value="month" selected>Текущий месяц</option>
              <option value="quarter">Текущий квартал</option>
              <option value="q1-2023">Q1 2023 (архив)</option>
            </select>
            <select class="select" id="anaProject"><option value="">Все проекты</option></select>
            <div class="spacer"></div>
            <div class="pill-tabs" id="anaTabs" style="padding:0;"></div>
          </div>
        </div>
        <div class="panel" id="anaPanel"></div>
      </section>

      <!-- ===== УВЕДОМЛЕНИЯ ===== -->
      <section class="section" id="page-notifications">
        <div class="page-head">
          <div class="eyebrow">Центр уведомлений</div>
          <h2>Критические события, важные изменения и информационные сообщения портала.</h2>
        </div>
        <div class="panel">
          <div class="toolbar">
            <div class="seg" id="notifFilter">
              <button data-f="all" class="active">Все</button>
              <button data-f="unread">Непрочитанные</button>
              <button data-f="critical">Критичные</button>
              <button data-f="important">Важные</button>
              <button data-f="info">Инфо</button>
            </div>
          </div>
          <div id="notifFullList"></div>
        </div>
      </section>

      <!-- ===== НАСТРОЙКИ ===== -->
      <section class="section" id="page-settings">
        <div class="page-head">
          <div class="eyebrow">Управление аккаунтом</div>
          <h2>Профиль, команда, уведомления и интеграции портала.</h2>
        </div>
        <div class="grid-2">
          <div style="display:flex;flex-direction:column;gap:16px;">
            <div class="panel">
              <div class="panel-head"><h3>Профиль</h3></div>
              <div class="panel-body">
                <div class="field-row">
                  <div class="field"><label>Имя и фамилия</label><input type="text" value="Дмитрий Кузнецов" id="setName"></div>
                  <div class="field"><label>Роль</label><input type="text" value="HR-директор" id="setRole"></div>
                </div>
                <div class="field-row" style="margin-top:12px;">
                  <div class="field"><label>Email</label><input type="email" value="dmitry@staffflow.pro" id="setEmail"></div>
                  <div class="field"><label>Телефон</label><input type="text" value="+7 999 123-45-67" id="setPhone"></div>
                </div>
              </div>
              <div class="modal-foot" style="border-top:1px solid var(--border);">
                <button class="btn btn-primary" id="saveProfileBtn">Сохранить изменения</button>
              </div>
            </div>

            <div class="panel">
              <div class="panel-head"><h3>Команда и роли</h3><span class="sub" style="margin-left:auto;"></span>
                <button class="btn btn-sm" id="inviteBtn" style="margin-left:auto;">+ Пригласить</button>
              </div>
              <div class="panel-body" id="teamList"></div>
            </div>

            <div class="panel">
              <div class="panel-head"><h3>Интеграции</h3></div>
              <div class="panel-body" id="integrationList"></div>
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:16px;">
            <div class="panel">
              <div class="panel-head"><h3>Уведомления</h3></div>
              <div class="panel-body" id="notifSettings"></div>
            </div>
            <div class="panel">
              <div class="panel-head"><h3>Отображение</h3></div>
              <div class="panel-body">
                <div class="settings-row">
                  <div class="txt"><b>Плотность таблиц</b><span>Компактный режим уменьшает высоту строк</span></div>
                  <div class="ctl"><button class="toggle" id="densityToggle"></button></div>
                </div>
                <div class="settings-row">
                  <div class="txt"><b>Показывать подсказки</b><span>Всплывающие пояснения к элементам интерфейса</span></div>
                  <div class="ctl"><button class="toggle on" id="tipsToggle"></button></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</div>

<nav class="tabbar" id="tabbar"></nav>

<!-- overlays -->
<div class="overlay" id="modalOverlay"></div>
<div class="drawer-overlay" id="drawerOverlay"></div>
<aside class="drawer" id="candDrawer" aria-label="Карточка кандидата"></aside>
<div class="toast-stack" id="toastStack"></div>
`;
