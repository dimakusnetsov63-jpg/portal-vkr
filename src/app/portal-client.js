"use strict";

export function initPortal(){

/* ===================== ICONS ===================== */
const ICONS = {
  home:'<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  users:'<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3.6 2.9-6.2 6.5-6.2s6.5 2.6 6.5 6.2"/><path d="M16.5 6.2a3.2 3.2 0 0 1 0 6.3"/><path d="M18 14c2.6.5 4 2.3 4 6"/>',
  trend:'<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  bar:'<path d="M4 20V10M12 20V4M20 20v-7"/>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
  building:'<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 21v-4h6v4M8 7h1M8 11h1M15 7h1M15 11h1"/>',
  mapPin:'<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.3"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  alert:'<path d="M10.3 3.9 2 18a1.5 1.5 0 0 0 1.3 2.3h17.4A1.5 1.5 0 0 0 22 18L13.7 3.9a1.5 1.5 0 0 0-2.6 0Z"/><path d="M12 9v4M12 17h.01"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  refresh:'<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/>',
  x:'<path d="M18 6 6 18M6 6l12 12"/>',
  chevron:'<path d="m9 18 6-6-6-6"/>',
  file:'<path d="M8 3h6l4 4v13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M14 3v4h4"/>',
  message:'<path d="M21 11.5a8.5 8.5 0 0 1-8.9 8.49 8.6 8.6 0 0 1-3.9-.9L3 21l1.9-5.2a8.5 8.5 0 1 1 16.1-4.3Z"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
};
function ic(name,size){
  size=size||18;
  return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+ICONS[name]+'</svg>';
}
function esc(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* ===================== SEEDED RANDOM ===================== */
function mulberry32(a){
  return function(){
    a|=0;a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a);
    t=t+Math.imul(t^t>>>7,61|t)^t;
    return ((t^t>>>14)>>>0)/4294967296;
  };
}
const rnd = mulberry32(20260720);
function pick(arr){ return arr[Math.floor(rnd()*arr.length)]; }
function randInt(min,max){ return Math.floor(rnd()*(max-min+1))+min; }

/* ===================== DATA MODEL ===================== */
const TODAY = new Date(2026,6,20);
function addDays(d,n){ const r=new Date(d); r.setDate(r.getDate()+n); return r; }
function fmtDate(d){ return d.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit'}); }
function fmtDateTime(d){ if(!d) return null; return d.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit'})+', '+d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}); }
function fmtMoney(n){ return n.toLocaleString('ru-RU')+' ₽'; }
const DOW = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];

const PROJECTS = [
  {id:'samokat', name:'Самокат', color:'#FF6B4A', cities:['Москва','Санкт-Петербург','Казань']},
  {id:'kuper', name:'Купер', color:'#7C5CFC', cities:['Москва','Санкт-Петербург','Новосибирск']},
  {id:'x5', name:'X5 Group', color:'#12A150', cities:['Москва','Казань','Уфа','Екатеринбург']},
  {id:'ylavka', name:'Яндекс Лавка', color:'#E0B400', cities:['Москва','Санкт-Петербург']},
  {id:'vkusvill', name:'ВкусВилл', color:'#2FAE60', cities:['Москва','Уфа']},
  {id:'ozon', name:'Ozon Fresh', color:'#0064FF', cities:['Санкт-Петербург','Новосибирск','Екатеринбург']},
];
const CITIES = ['Москва','Санкт-Петербург','Казань','Уфа','Новосибирск','Екатеринбург'];
const RECRUITERS = ['Елена Кравцова','Никита Беляков','Светлана Дорохова','Павел Григорьев'];
const MANAGERS = ['Антон Захаров','Марина Волкова','Андрей Котов','Ирина Нестерова'];
const COORDINATORS = ['Ольга Смирнова','Максим Титов','Юлия Фомина','Дмитрий Волков'];

const STAGES = [
  {id:'response', name:'Новый отклик', color:'blue'},
  {id:'invited', name:'Приглашён', color:'amber'},
  {id:'interview', name:'Собеседование', color:'violet'},
  {id:'processing', name:'Оформление', color:'teal'},
  {id:'confirmed', name:'Выход подтверждён', color:'green'},
  {id:'first_shift', name:'1-я смена', color:'green'},
  {id:'rejected', name:'Отказ', color:'red'},
  {id:'no_show', name:'Не вышел', color:'gray'},
];
function stageById(id){ return STAGES.find(s=>s.id===id); }

const FIRST_M = ['Иван','Пётр','Сергей','Алексей','Дмитрий','Максим','Артём','Николай','Роман','Игорь','Владимир','Егор'];
const FIRST_F = ['Анна','Мария','Ольга','Наталья','Екатерина','Юлия','Виктория','Дарья','Полина','Светлана','Алина','Ксения'];
const LAST_M = ['Соколов','Орлов','Белов','Морозов','Сафин','Никитин','Гуров','Ковалёв','Быков','Жуков','Тарасов','Фролов'];
const LAST_F = ['Соколова','Орлова','Белова','Морозова','Сафина','Никитина','Гурова','Ковалёва','Быкова','Жукова','Тарасова','Фролова'];

const CANDIDATES = [];
(function genCandidates(){
  const total = 58;
  for(let i=0;i<total;i++){
    const isM = rnd()>0.5;
    const fio = isM ? pick(FIRST_M)+' '+pick(LAST_M) : pick(FIRST_F)+' '+pick(LAST_F);
    const project = pick(PROJECTS);
    const city = pick(project.cities);
    const recruiter = pick(RECRUITERS);
    const manager = pick(MANAGERS);
    const coordinator = pick(COORDINATORS);
    const stageRoll = rnd();
    let stage;
    if(stageRoll<0.14) stage='response';
    else if(stageRoll<0.30) stage='invited';
    else if(stageRoll<0.42) stage='interview';
    else if(stageRoll<0.56) stage='processing';
    else if(stageRoll<0.64) stage='confirmed';
    else if(stageRoll<0.86) stage='first_shift';
    else if(stageRoll<0.95) stage='rejected';
    else stage='no_show';

    const order = ['response','invited','interview','processing','confirmed','first_shift'];
    const stageIdx = order.indexOf(stage);
    const reached = stageIdx>=0 ? stageIdx : (stage==='rejected'? randInt(0,3) : randInt(1,3));

    const responseAt = addDays(TODAY, -randInt(2,26));
    responseAt.setHours(randInt(9,18), pick([0,10,20,30,40,50]));
    let invitedAt=null, processedAt=null, firstShiftAt=null, interviewAt=null;
    let cursor = new Date(responseAt);
    if(reached>=1){ cursor=addDays(cursor,randInt(0,2)); cursor.setHours(randInt(9,18),pick([0,15,30,45])); invitedAt=new Date(cursor); }
    if(reached>=2){ cursor=addDays(cursor,randInt(0,2)); cursor.setHours(randInt(9,18),pick([0,15,30,45])); interviewAt=new Date(cursor); }
    if(reached>=3){ cursor=addDays(cursor,randInt(0,2)); cursor.setHours(randInt(9,18),pick([0,15,30,45])); processedAt=new Date(cursor); }
    if(reached>=5){ cursor=addDays(cursor,randInt(1,3)); cursor.setHours(randInt(8,16),pick([0,15,30,45])); firstShiftAt=new Date(cursor); }

    CANDIDATES.push({
      id:'KND-'+(3100+i),
      fio, project:project.id, city, stage,
      recruiter, manager, coordinator,
      responseAt, invitedAt, interviewAt, processedAt, firstShiftAt,
      comments:[
        {who:coordinator, at:addDays(responseAt,1), text:'Связались с кандидатом, документы подтверждены.'},
      ],
    });
  }
})();

const CHANNELS = [
  {name:'HeadHunter', budget:420000, responses:612, invites:298, processed:171, shifts:132},
  {name:'Авито Работа', budget:260000, responses:498, invites:231, processed:126, shifts:96},
  {name:'Telegram Ads', budget:150000, responses:344, invites:139, processed:71, shifts:52},
  {name:'VK Реклама', budget:120000, responses:266, invites:104, processed:58, shifts:41},
  {name:'Яндекс Директ', budget:190000, responses:352, invites:168, processed:88, shifts:63},
  {name:'Реферальная программа', budget:60000, responses:158, invites:97, processed:71, shifts:61},
];

const NOTIF_TYPES = {critical:{label:'Критично',icon:'alert'},important:{label:'Важно',icon:'bell'},info:{label:'Инфо',icon:'info'}};
const NOTIFICATIONS = [
  {id:1,type:'critical',title:'Критический дефицит: X5, Уфа',text:'Не закрыто 9 из 12 позиций на ближайшие 3 дня.',project:'X5 Group',minsAgo:35,read:false},
  {id:2,type:'critical',title:'Провал плана выходов: Купер, Новосибирск',text:'Факт выходов ниже плана на 41% третий день подряд.',project:'Купер',minsAgo:80,read:false},
  {id:3,type:'important',title:'Рост стоимости привлечения',text:'CPA по каналу Telegram Ads вырос на 18% за неделю.',project:'Маркетинг',minsAgo:130,read:false},
  {id:4,type:'important',title:'Истекает срок оформления',text:'6 кандидатов ожидают оформления более 48 часов.',project:'Самокат',minsAgo:210,read:false},
  {id:5,type:'info',title:'Новый проект добавлен в систему',text:'Ozon Fresh подключён к порталу, добавлены 3 города.',project:'Ozon Fresh',minsAgo:340,read:true},
  {id:6,type:'important',title:'Отклонение от плана по Казани',text:'X5 в Казани отстаёт от плана на 14%.',project:'X5 Group',minsAgo:420,read:true},
  {id:7,type:'info',title:'Обновлена матрица потребности',text:'Координатор добавил потребность на август для 4 проектов.',project:'Потребность',minsAgo:610,read:true},
  {id:8,type:'critical',title:'Массовый отказ кандидатов',text:'11 кандидатов отменили выход на смену в Санкт-Петербурге.',project:'Купер',minsAgo:900,read:true},
  {id:9,type:'info',title:'Еженедельный отчёт готов',text:'Сводка по конверсии воронки за неделю доступна в Аналитике.',project:'Аналитика',minsAgo:1200,read:true},
  {id:10,type:'important',title:'Новый рекрутер добавлен в команду',text:'Павел Григорьев получил доступ к проектам X5 и Самокат.',project:'Команда',minsAgo:1500,read:true},
  {id:11,type:'info',title:'Плановое обслуживание портала',text:'Технические работы запланированы на выходные, 25 июля.',project:'Система',minsAgo:2200,read:true},
  {id:12,type:'important',title:'Высокая конверсия канала',text:'Реферальная программа показывает конверсию выше среднего на 22%.',project:'Маркетинг',minsAgo:2600,read:true},
];

/* demand matrix data: base daily values per project+city for 60 days (from -14 to +45) */
const DEMAND_START = addDays(TODAY,-14);
const DEMAND_DAYS = 60;
const DEMAND = {}; // DEMAND[projectId][city] = [{date, need, level}]
PROJECTS.forEach(p=>{
  DEMAND[p.id]={};
  p.cities.forEach(city=>{
    const arr=[];
    for(let i=0;i<DEMAND_DAYS;i++){
      const date = addDays(DEMAND_START,i);
      const roll = rnd();
      let level, need;
      if(roll<0.18){ level='zero'; need=0; }
      else if(roll<0.60){ level='normal'; need=randInt(1,4); }
      else if(roll<0.84){ level='elevated'; need=randInt(5,9); }
      else { level='critical'; need=randInt(10,18); }
      arr.push({date, need, level});
    }
    DEMAND[p.id][city]=arr;
  });
});

/* ===================== STATE ===================== */
const state = {
  page:'overview',
  demand:{ search:'', project:'', city:'', level:'', scale:'day', collapsed:{}, demoState:'normal' },
  cand:{ search:'', project:'', city:'', stage:'', recruiter:'', date:'', demoState:'normal', visible:20 },
  notif:{ filter:'all' },
  ana:{ tab:'projects', period:'month', project:'' },
  notifData: JSON.parse(JSON.stringify(NOTIFICATIONS.map(n=>({...n})))),
  candData: CANDIDATES,
};
state.notifData.forEach((n,i)=>{ n.read = NOTIFICATIONS[i].read; });

/* ===================== NAV ===================== */
const NAV_ITEMS = [
  {id:'overview', label:'Обзор', icon:'home'},
  {id:'demand', label:'Потребность', icon:'grid'},
  {id:'candidates', label:'Кандидаты', icon:'users'},
  {id:'marketing', label:'Маркетинг', icon:'trend'},
  {id:'analytics', label:'Аналитика', icon:'bar'},
  {id:'notifications', label:'Уведомления', icon:'bell'},
  {id:'settings', label:'Настройки', icon:'gear'},
];
const TITLES = {overview:'Обзор',demand:'Потребность',candidates:'Кандидаты',marketing:'Маркетинг',analytics:'Аналитика',notifications:'Уведомления',settings:'Настройки'};
const CTX_ACTIONS = {
  demand: {label:'Добавить потребность', act:()=>openDemandModal()},
  candidates: {label:'Добавить кандидата', act:()=>openCandModal()},
  notifications: {label:'Отметить всё прочитанным', act:()=>markAllRead()},
  settings: {label:'Сохранить изменения', act:()=>saveProfile()},
};

function renderNav(){
  const nav = document.getElementById('nav');
  nav.innerHTML = NAV_ITEMS.map(it=>{
    const badge = it.id==='notifications' ? unreadCount() : 0;
    return '<button class="nav-item'+(state.page===it.id?' active':'')+'" data-page="'+it.id+'">'+ic(it.icon,18)+'<span>'+it.label+'</span>'+(badge?'<span class="nav-badge">'+badge+'</span>':'')+'</button>';
  }).join('');
  nav.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>goto(b.dataset.page)));

  const tb = document.getElementById('tabbar');
  const mobileItems = [NAV_ITEMS[0],NAV_ITEMS[1],NAV_ITEMS[2],NAV_ITEMS[4],NAV_ITEMS[6]];
  tb.innerHTML = mobileItems.map(it=>'<button class="'+(state.page===it.id?'active':'')+'" data-page="'+it.id+'">'+ic(it.icon,19)+'<span>'+it.label+'</span></button>').join('');
  tb.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>goto(b.dataset.page)));
}
function unreadCount(){ return state.notifData.filter(n=>!n.read).length; }

function goto(page){
  state.page = page;
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.getElementById('page-'+page).classList.add('active');
  document.getElementById('pageTitle').textContent = TITLES[page];
  document.getElementById('content').scrollTop = 0;
  renderNav();
  renderCtxAction();
  closeSidebar();
  renderPage(page);
}
function renderCtxAction(){
  const holder = document.getElementById('ctxAction');
  const cfg = CTX_ACTIONS[state.page];
  if(!cfg){ holder.innerHTML=''; return; }
  holder.innerHTML = '<button class="btn btn-primary" id="ctxBtn">'+esc(cfg.label)+'</button>';
  document.getElementById('ctxBtn').addEventListener('click',cfg.act);
}

function renderPage(page){
  if(page==='overview') renderOverview();
  else if(page==='demand') renderDemand();
  else if(page==='candidates') renderCandidates();
  else if(page==='marketing') renderMarketing();
  else if(page==='analytics') renderAnalytics();
  else if(page==='notifications') renderNotifications();
  else if(page==='settings') renderSettings();
}

/* ===================== SIDEBAR / MOBILE ===================== */
function openSidebar(){ document.getElementById('sidebar').classList.add('open'); document.getElementById('scrim').classList.add('open'); }
function closeSidebar(){ document.getElementById('sidebar').classList.remove('open'); document.getElementById('scrim').classList.remove('open'); }
document.getElementById('menuBtn').addEventListener('click',openSidebar);
document.getElementById('scrim').addEventListener('click',closeSidebar);

/* ===================== TOAST ===================== */
function toast(msg,type){
  const stack = document.getElementById('toastStack');
  const el = document.createElement('div');
  el.className = 'toast'+(type==='error'?' error':'');
  el.innerHTML = ic(type==='error'?'alert':'check',16)+'<span>'+esc(msg)+'</span>';
  stack.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translateY(6px)'; el.style.transition='.2s'; setTimeout(()=>el.remove(),200); },2800);
}

/* ===================== DROPDOWNS ===================== */
function toggleDropdown(id, others){
  const panel = document.getElementById(id);
  const willOpen = !panel.classList.contains('open');
  others.forEach(o=>document.getElementById(o).classList.remove('open'));
  panel.classList.toggle('open', willOpen);
}
document.getElementById('notifBtn').addEventListener('click',(e)=>{ e.stopPropagation(); renderNotifDropdown(); toggleDropdown('notifPanel',['profilePanel']); });
document.getElementById('profileTrigger').addEventListener('click',(e)=>{ e.stopPropagation(); toggleDropdown('profilePanel',['notifPanel']); });
document.getElementById('profileTrigger2').addEventListener('click',(e)=>{ e.stopPropagation(); toggleDropdown('profilePanel',['notifPanel']); });
function onDocClick(){ document.getElementById('notifPanel').classList.remove('open'); document.getElementById('profilePanel').classList.remove('open'); }
document.addEventListener('click',onDocClick);
document.querySelectorAll('[data-goto]').forEach(el=>el.addEventListener('click',(e)=>{ e.preventDefault(); goto(el.dataset.goto); }));
document.getElementById('logoutBtn').addEventListener('click',()=>{ toast('Выход из системы недоступен в прототипе'); });

function renderNotifDropdown(){
  const list = state.notifData.slice(0,5);
  document.getElementById('notifDropList').innerHTML = list.map(n=>{
    const t = NOTIF_TYPES[n.type];
    return '<div class="notif-row" style="padding:11px 16px;'+(n.read?'':'background:var(--accent-soft)')+'">'
      +'<div class="notif-ico '+n.type+'">'+ic(t.icon,15)+'</div>'
      +'<div class="notif-main"><b>'+esc(n.title)+'</b><p>'+esc(n.text)+'</p></div>'
      +'<span class="notif-time">'+relTime(n.minsAgo)+'</span></div>';
  }).join('');
}
document.getElementById('markAllTop').addEventListener('click',(e)=>{ e.preventDefault(); markAllRead(); });
function markAllRead(){
  state.notifData.forEach(n=>n.read=true);
  renderNav(); renderNotifDropdown();
  if(state.page==='notifications') renderNotifications();
  toast('Все уведомления отмечены прочитанными');
}
function relTime(mins){
  if(mins<60) return mins+' мин назад';
  if(mins<60*24) return Math.floor(mins/60)+' ч назад';
  return Math.floor(mins/(60*24))+' дн назад';
}

/* ===================== MODAL SYSTEM ===================== */
const modalOverlay = document.getElementById('modalOverlay');
function openModal(html){
  modalOverlay.innerHTML = html;
  modalOverlay.classList.add('open');
  const closer = modalOverlay.querySelectorAll('[data-close-modal]');
  closer.forEach(b=>b.addEventListener('click',closeModal));
}
function closeModal(){ modalOverlay.classList.remove('open'); modalOverlay.innerHTML=''; }
modalOverlay.addEventListener('click',(e)=>{ if(e.target===modalOverlay) closeModal(); });
function onDocKeydown(e){
  if(e.key==='Escape'){ closeModal(); closeDrawer(); closeCommand(); }
  if((e.metaKey||e.ctrlKey) && e.key.toLowerCase()==='k'){ e.preventDefault(); openCommand(); }
}
document.addEventListener('keydown',onDocKeydown);

function optionsHtml(arr, withAll){
  let out = withAll ? '<option value="">Не выбрано</option>' : '';
  out += arr.map(v=>'<option value="'+esc(v.id||v)+'">'+esc(v.name||v)+'</option>').join('');
  return out;
}

function openDemandModal(){
  openModal(
    '<div class="modal"><div class="modal-head"><h3>Добавить потребность</h3><button class="modal-close" data-close-modal>'+ic('x',15)+'</button></div>'
    +'<div class="modal-body">'
    +'<div class="field"><label>Проект</label><select id="mdProject">'+optionsHtml(PROJECTS)+'</select></div>'
    +'<div class="field"><label>Город</label><select id="mdCity"></select></div>'
    +'<div class="field-row"><div class="field"><label>Дата</label><input type="date" id="mdDate" value="'+TODAY.toISOString().slice(0,10)+'"></div>'
    +'<div class="field"><label>Количество позиций</label><input type="number" id="mdQty" min="0" value="5"></div></div>'
    +'<div class="field"><label>Комментарий (необязательно)</label><textarea placeholder="Например: усиление на период акции"></textarea></div>'
    +'</div><div class="modal-foot"><button class="btn" data-close-modal>Отмена</button><button class="btn btn-primary" id="mdSave">Сохранить</button></div></div>'
  );
  const projSel = document.getElementById('mdProject');
  function fillCities(){ const p = PROJECTS.find(p=>p.id===projSel.value); document.getElementById('mdCity').innerHTML = optionsHtml(p.cities); }
  fillCities();
  projSel.addEventListener('change',fillCities);
  document.getElementById('mdSave').addEventListener('click',()=>{
    const pid = projSel.value, city = document.getElementById('mdCity').value;
    const qty = parseInt(document.getElementById('mdQty').value||'0',10);
    const date = new Date(document.getElementById('mdDate').value);
    let level = qty===0?'zero':qty<=4?'normal':qty<=9?'elevated':'critical';
    const arr = DEMAND[pid][city];
    const existing = arr.find(d=>d.date.toDateString()===date.toDateString());
    if(existing){ existing.need=qty; existing.level=level; } else { arr.push({date,need:qty,level}); arr.sort((a,b)=>a.date-b.date); }
    closeModal();
    toast('Потребность добавлена');
    renderDemand();
  });
}

function openCandModal(){
  openModal(
    '<div class="modal"><div class="modal-head"><h3>Добавить кандидата</h3><button class="modal-close" data-close-modal>'+ic('x',15)+'</button></div>'
    +'<div class="modal-body">'
    +'<div class="field"><label>ФИО</label><input type="text" id="mcFio" placeholder="Иванов Иван Иванович"></div>'
    +'<div class="field-row"><div class="field"><label>Проект</label><select id="mcProject">'+optionsHtml(PROJECTS)+'</select></div>'
    +'<div class="field"><label>Город</label><select id="mcCity"></select></div></div>'
    +'<div class="field-row"><div class="field"><label>Рекрутер</label><select id="mcRecruiter">'+optionsHtml(RECRUITERS)+'</select></div>'
    +'<div class="field"><label>Стадия</label><select id="mcStage">'+STAGES.slice(0,3).map(s=>'<option value="'+s.id+'">'+s.name+'</option>').join('')+'</select></div></div>'
    +'</div><div class="modal-foot"><button class="btn" data-close-modal>Отмена</button><button class="btn btn-primary" id="mcSave">Добавить</button></div></div>'
  );
  const projSel = document.getElementById('mcProject');
  function fillCities(){ const p = PROJECTS.find(p=>p.id===projSel.value); document.getElementById('mcCity').innerHTML = optionsHtml(p.cities); }
  fillCities();
  projSel.addEventListener('change',fillCities);
  document.getElementById('mcSave').addEventListener('click',()=>{
    const fio = document.getElementById('mcFio').value.trim();
    if(!fio){ toast('Укажите ФИО кандидата','error'); return; }
    const now = new Date(TODAY); now.setHours(12,0);
    state.candData.unshift({
      id:'KND-'+(4000+Math.floor(rnd()*900)),
      fio, project:document.getElementById('mcProject').value, city:document.getElementById('mcCity').value,
      stage:document.getElementById('mcStage').value, recruiter:document.getElementById('mcRecruiter').value,
      manager:pick(MANAGERS), coordinator:pick(COORDINATORS),
      responseAt:now, invitedAt:null, interviewAt:null, processedAt:null, firstShiftAt:null, comments:[],
    });
    closeModal();
    toast('Кандидат добавлен в реестр');
    renderCandidates();
  });
}

function openInviteModal(){
  openModal(
    '<div class="modal"><div class="modal-head"><h3>Пригласить сотрудника</h3><button class="modal-close" data-close-modal>'+ic('x',15)+'</button></div>'
    +'<div class="modal-body">'
    +'<div class="field"><label>Email</label><input type="email" placeholder="name@company.ru"></div>'
    +'<div class="field"><label>Роль</label><select><option>Рекрутер</option><option>Менеджер проекта</option><option>Координатор</option><option>Администратор</option></select></div>'
    +'</div><div class="modal-foot"><button class="btn" data-close-modal>Отмена</button><button class="btn btn-primary" id="inviteSend">Отправить приглашение</button></div></div>'
  );
  document.getElementById('inviteSend').addEventListener('click',()=>{ closeModal(); toast('Приглашение отправлено'); });
}

/* ===================== COMMAND PALETTE ===================== */
function openCommand(){
  openModal(
    '<div class="modal command-modal"><div class="command-input">'+ic('grid',17)+'<input type="text" id="cmdInput" placeholder="Перейти в раздел или найти кандидата…" autofocus><button class="modal-close" data-close-modal>'+ic('x',15)+'</button></div>'
    +'<div class="command-list" id="cmdList"></div></div>'
  );
  const input = document.getElementById('cmdInput');
  input.focus();
  input.addEventListener('input',()=>renderCmdList(input.value.trim().toLowerCase()));
  renderCmdList('');
}
function closeCommand(){ if(modalOverlay.querySelector('.command-modal')) closeModal(); }
document.getElementById('cmdTrigger').addEventListener('click',openCommand);
function renderCmdList(q){
  const list = document.getElementById('cmdList');
  let html = '';
  const navMatches = NAV_ITEMS.filter(it=>!q || it.label.toLowerCase().includes(q));
  if(navMatches.length){
    html += '<div class="command-group">Разделы</div>';
    html += navMatches.map(it=>'<div class="command-item" data-page="'+it.id+'"><span class="ico">'+ic(it.icon,15)+'</span><b>'+it.label+'</b></div>').join('');
  }
  if(q){
    const cand = state.candData.filter(c=>c.fio.toLowerCase().includes(q)||c.id.toLowerCase().includes(q)).slice(0,6);
    if(cand.length){
      html += '<div class="command-group">Кандидаты</div>';
      html += cand.map(c=>'<div class="command-item" data-cand="'+c.id+'"><span class="ico">'+ic('users',15)+'</span><b>'+esc(c.fio)+'</b><span>'+c.id+'</span></div>').join('');
    }
  }
  if(!html) html = '<div class="state-block" style="padding:30px 20px;"><p>Ничего не найдено</p></div>';
  list.innerHTML = html;
  list.querySelectorAll('[data-page]').forEach(el=>el.addEventListener('click',()=>{ closeModal(); goto(el.dataset.page); }));
  list.querySelectorAll('[data-cand]').forEach(el=>el.addEventListener('click',()=>{ closeModal(); goto('candidates'); setTimeout(()=>openCandidateDrawer(el.dataset.cand),150); }));
}

/* ===================== OVERVIEW ===================== */
function renderOverview(){
  const activeProjects = PROJECTS.length;
  const totalNeed = 214;
  const totalCandidates = state.candData.length;
  const plannedShifts = 168;
  const actualShifts = 141;
  const deficit = plannedShifts-actualShifts;
  const planPct = Math.round(actualShifts/plannedShifts*100);
  const cpa = 3260;

  const stats = [
    {icon:'building', label:'Активные проекты', value:activeProjects, delta:'+1 за месяц', dtype:'up'},
    {icon:'target', label:'Общая потребность', value:totalNeed, delta:'на ближайшие 30 дней', dtype:'flat'},
    {icon:'users', label:'Кандидаты в работе', value:totalCandidates, delta:'+12% за неделю', dtype:'up'},
    {icon:'clock', label:'Запланировано выходов', value:plannedShifts, delta:'на этой неделе', dtype:'flat'},
    {icon:'check', label:'Фактические выходы', value:actualShifts, delta:'84% от плана', dtype:'down'},
    {icon:'alert', label:'Дефицит персонала', value:deficit, delta:'требует внимания', dtype:'down'},
    {icon:'bar', label:'Выполнение плана', value:planPct+'%', delta:'−6 п.п. к цели', dtype:'down'},
    {icon:'trend', label:'Стоимость привлечения', value:fmtMoney(cpa), delta:'−4% за месяц', dtype:'up'},
  ];
  document.getElementById('overviewStats').innerHTML = stats.map(s=>
    '<div class="stat-card"><div class="stat-top"><div class="stat-ico">'+ic(s.icon,16)+'</div><span class="stat-delta '+s.dtype+'">'+esc(s.delta)+'</span></div>'
    +'<div class="stat-value">'+s.value+'</div><div class="stat-label">'+s.label+'</div></div>'
  ).join('');

  const risks = [
    {name:'X5 Group — Уфа', detail:'9 из 12 позиций не закрыто', num:'−9', level:'critical'},
    {name:'Купер — Новосибирск', detail:'Факт выходов ниже плана на 41%', num:'−41%', level:'critical'},
    {name:'X5 Group — Казань', detail:'Отставание от плана', num:'−14%', level:'elevated'},
    {name:'Яндекс Лавка — СПб', detail:'Рост стоимости отклика', num:'+18%', level:'elevated'},
  ];
  document.getElementById('riskList').innerHTML = risks.map(r=>
    '<div class="risk-row"><span class="risk-dot '+r.level+'"></span><div class="risk-main"><b>'+esc(r.name)+'</b><span>'+esc(r.detail)+'</span></div><span class="risk-num">'+r.num+'</span></div>'
  ).join('');

  document.getElementById('overviewNotifs').innerHTML = state.notifData.slice(0,4).map(n=>{
    const t = NOTIF_TYPES[n.type];
    return '<div class="notif-row"><div class="notif-ico '+n.type+'">'+ic(t.icon,14)+'</div><div class="notif-main"><b>'+esc(n.title)+'</b><p>'+esc(n.text)+'</p></div><span class="notif-time">'+relTime(n.minsAgo)+'</span></div>';
  }).join('');
}

/* ===================== DEMAND MATRIX ===================== */
function getScaleColumns(){
  const s = state.demand.scale;
  if(s==='day'){
    const cols=[];
    for(let i=0;i<45;i++) cols.push({key:i, label:fmtDate(addDays(DEMAND_START,i)), dow:DOW[addDays(DEMAND_START,i).getDay()], from:i, span:1, weekend:[0,6].includes(addDays(DEMAND_START,i).getDay())});
    return cols;
  }
  if(s==='week'){
    const cols=[];
    for(let i=0;i<Math.ceil(DEMAND_DAYS/7);i++) cols.push({key:i, label:'Нед '+(i+1), dow:fmtDate(addDays(DEMAND_START,i*7))+'–'+fmtDate(addDays(DEMAND_START,Math.min(i*7+6,DEMAND_DAYS-1))), from:i*7, span:7, weekend:false});
    return cols;
  }
  const cols=[];
  for(let i=0;i<2;i++) cols.push({key:i, label:i===0?'Июль':'Август', dow:'2026', from:i*31, span:31, weekend:false});
  return cols;
}
function aggCell(dayArr, from, span){
  const slice = dayArr.slice(from, Math.min(from+span, dayArr.length));
  if(!slice.length) return {need:0, level:'zero'};
  const need = slice.reduce((a,c)=>a+c.need,0);
  const hasCritical = slice.some(c=>c.level==='critical');
  const hasElevated = slice.some(c=>c.level==='elevated');
  let level = need===0?'zero': hasCritical?'critical': hasElevated?'elevated':'normal';
  return {need, level};
}
function fillDemandFilters(){
  document.getElementById('demandProject').innerHTML = '<option value="">Все проекты</option>'+optionsHtml(PROJECTS);
  document.getElementById('demandCity').innerHTML = '<option value="">Все города</option>'+CITIES.map(c=>'<option value="'+c+'">'+c+'</option>').join('');
}
function renderDemand(){
  const wrap = document.getElementById('demandWrap');
  const ds = state.demand.demoState;
  if(ds==='loading'){ wrap.innerHTML = skeletonRows(8); return; }
  if(ds==='error'){
    wrap.innerHTML = errorState();
    wireStateAction(wrap,()=>{ state.demand.demoState='normal'; document.getElementById('demandStateDemo').value='normal'; renderDemand(); });
    return;
  }

  const cols = getScaleColumns();
  let projects = PROJECTS.filter(p=> !state.demand.project || p.id===state.demand.project);
  const q = state.demand.search.toLowerCase();

  const rows = [];
  projects.forEach(p=>{
    let cities = p.cities.filter(c=> !state.demand.city || c===state.demand.city);
    if(q) cities = cities.filter(c=> p.name.toLowerCase().includes(q) || c.toLowerCase().includes(q));
    else if(state.demand.search) cities=[];
    if(state.demand.level){
      cities = cities.filter(c=>{
        return cols.some(col=>aggCell(DEMAND[p.id][c],col.from,col.span).level===state.demand.level);
      });
    }
    if(!cities.length) return;
    rows.push({project:p, cities});
  });

  if(ds==='empty' || (rows.length===0)){
    wrap.innerHTML = emptyState('Ничего не найдено','Попробуйте изменить фильтры или сбросить поиск.');
    wireStateAction(wrap,()=>document.getElementById('demandReset').click());
    return;
  }

  let thead = '<thead><tr><th class="col-sticky" style="width:230px;">Проект / Город</th>'
    + cols.map(c=>'<th class="date-col'+(c.weekend?' weekend':'')+'">'+esc(c.label)+'<span class="dow">'+esc(c.dow)+'</span></th>').join('')
    + '<th class="date-col" style="width:64px;">Итого</th></tr></thead>';

  let tbody='<tbody>';
  rows.forEach(r=>{
    const collapsed = !!state.demand.collapsed[r.project.id];
    const projTotal = r.cities.reduce((sum,c)=>sum+DEMAND[r.project.id][c].reduce((a,x)=>a+x.need,0),0);
    tbody += '<tr class="proj-row"><td class="col-sticky" colspan="1">'
      + '<div class="proj-head'+(collapsed?' collapsed':'')+'"><button data-toggle-proj="'+r.project.id+'">'+ic('chevron',14)+'</button>'
      + '<span class="swatch" style="background:'+r.project.color+'"></span>'+esc(r.project.name)
      + '<span class="proj-total">'+projTotal+' чел.</span></div></td>'
      + cols.map(()=>'<td></td>').join('') + '<td></td></tr>';
    if(!collapsed){
      r.cities.forEach(city=>{
        const dayArr = DEMAND[r.project.id][city];
        const total = dayArr.reduce((a,x)=>a+x.need,0);
        tbody += '<tr><td class="col-sticky"><div class="city-cell">'+ic('mapPin',13)+esc(city)+'</div></td>'
          + cols.map(col=>{ const cell=aggCell(dayArr,col.from,col.span); return '<td class="demand-cell lvl-'+cell.level+'" title="'+esc(city)+', '+esc(col.label)+': '+cell.need+' чел.">'+(cell.need||'—')+'</td>'; }).join('')
          + '<td class="proj-total-cell">'+total+'</td></tr>';
      });
    }
  });
  tbody+='</tbody>';

  wrap.innerHTML = '<div class="table-scroll scroll-x" id="demandScroll"><table class="matrix-table" id="demandTable">'+thead+tbody+'</table></div>'
    + '<div class="hscroll-fake scroll-x" id="demandHFake"><div class="hscroll-fake-inner" id="demandHFakeInner"></div></div>';
  const table = document.getElementById('demandTable');
  table.querySelectorAll('[data-toggle-proj]').forEach(b=>b.addEventListener('click',(e)=>{
    e.stopPropagation();
    const id=b.dataset.toggleProj; state.demand.collapsed[id]=!state.demand.collapsed[id]; renderDemand();
  }));
  syncFakeScroll('demandScroll','demandHFake','demandHFakeInner');
}
function skeletonRows(n){
  let out='<div>';
  for(let i=0;i<n;i++) out+='<div class="sk-row"><div class="skeleton" style="width:180px;"></div><div class="skeleton" style="width:60px;"></div><div class="skeleton" style="width:60px;"></div><div class="skeleton" style="width:60px;"></div><div class="skeleton" style="width:60px;"></div><div class="skeleton" style="width:60px;flex:1;"></div></div>';
  return out+'</div>';
}
function emptyState(title,text){
  return '<div class="state-block"><div class="state-ico">'+ic('grid',24)+'</div><h4>'+esc(title)+'</h4><p>'+esc(text)+'</p><button class="btn btn-sm js-state-action" type="button" style="margin-top:6px;">Сбросить фильтры</button></div>';
}
function noDataState(title,text){
  return '<div class="state-block"><div class="state-ico">'+ic('bar',24)+'</div><h4>'+esc(title)+'</h4><p>'+esc(text)+'</p></div>';
}
function errorState(){
  return '<div class="state-block is-error"><div class="state-ico">'+ic('alert',24)+'</div><h4>Не удалось загрузить данные</h4><p>Проверьте соединение и повторите попытку.</p><button class="btn btn-primary btn-sm js-state-action" type="button" style="margin-top:6px;">Повторить</button></div>';
}
function wireStateAction(container,handler){
  const b = container.querySelector('.js-state-action');
  if(b) b.addEventListener('click',handler);
}
function syncFakeScroll(scrollId,fakeId,fakeInnerId){
  const real = document.getElementById(scrollId), fake = document.getElementById(fakeId), inner = document.getElementById(fakeInnerId);
  if(!real||!fake) return;
  requestAnimationFrame(()=>{ inner.style.width = real.scrollWidth+'px'; });
  let lock=false;
  real.onscroll = ()=>{ if(lock)return; lock=true; fake.scrollLeft=real.scrollLeft; lock=false; };
  fake.onscroll = ()=>{ if(lock)return; lock=true; real.scrollLeft=fake.scrollLeft; lock=false; };
}

document.getElementById('demandSearch').addEventListener('input',(e)=>{ state.demand.search=e.target.value; renderDemand(); });
document.getElementById('demandProject').addEventListener('change',(e)=>{ state.demand.project=e.target.value; renderDemand(); });
document.getElementById('demandCity').addEventListener('change',(e)=>{ state.demand.city=e.target.value; renderDemand(); });
document.getElementById('demandLevel').addEventListener('change',(e)=>{ state.demand.level=e.target.value; renderDemand(); });
document.getElementById('demandReset').addEventListener('click',()=>{
  state.demand.search=''; state.demand.project=''; state.demand.city=''; state.demand.level='';
  document.getElementById('demandSearch').value=''; document.getElementById('demandProject').value=''; document.getElementById('demandCity').value=''; document.getElementById('demandLevel').value='';
  renderDemand();
});
document.getElementById('demandScale').addEventListener('click',(e)=>{
  const btn=e.target.closest('button'); if(!btn) return;
  document.querySelectorAll('#demandScale button').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active'); state.demand.scale=btn.dataset.scale; renderDemand();
});
document.getElementById('addDemandBtn').addEventListener('click',openDemandModal);
document.getElementById('demandStateDemo').addEventListener('change',(e)=>{ state.demand.demoState=e.target.value; renderDemand(); });

/* ===================== CANDIDATES ===================== */
function fillCandFilters(){
  document.getElementById('candProject').innerHTML='<option value="">Все проекты</option>'+optionsHtml(PROJECTS);
  document.getElementById('candCity').innerHTML='<option value="">Все города</option>'+CITIES.map(c=>'<option value="'+c+'">'+c+'</option>').join('');
  document.getElementById('candStage').innerHTML='<option value="">Все стадии</option>'+STAGES.map(s=>'<option value="'+s.id+'">'+s.name+'</option>').join('');
  document.getElementById('candRecruiter').innerHTML='<option value="">Все рекрутеры</option>'+RECRUITERS.map(r=>'<option value="'+r+'">'+r+'</option>').join('');
}
function initials(fio){ return fio.split(' ').slice(0,2).map(s=>s[0]).join('').toUpperCase(); }
const AV_COLORS = ['#0071e3','#7C5CFC','#12A150','#E0A100','#d33a2c','#0f8b8d','#5856d6','#ff6b4a'];
function avColor(seed){ let h=0; for(let i=0;i<seed.length;i++) h=seed.charCodeAt(i)+((h<<5)-h); return AV_COLORS[Math.abs(h)%AV_COLORS.length]; }

function candFiltered(){
  const q = state.cand.search.toLowerCase();
  return state.candData.filter(c=>{
    if(q && !(c.fio.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))) return false;
    if(state.cand.project && c.project!==state.cand.project) return false;
    if(state.cand.city && c.city!==state.cand.city) return false;
    if(state.cand.stage && c.stage!==state.cand.stage) return false;
    if(state.cand.recruiter && c.recruiter!==state.cand.recruiter) return false;
    if(state.cand.date){ const d=new Date(state.cand.date); if(c.responseAt.toDateString()!==d.toDateString()) return false; }
    return true;
  });
}
function renderCandidateStats(){
  const total = state.candData.length;
  const invited = state.candData.filter(c=>['invited','interview','processing','confirmed','first_shift'].includes(c.stage)).length;
  const processed = state.candData.filter(c=>['processing','confirmed','first_shift'].includes(c.stage)).length;
  const shifted = state.candData.filter(c=>c.stage==='first_shift').length;
  const items = [
    {label:'Отклики', value:total},
    {label:'Приглашены', value:invited, pct:Math.round(invited/total*100)},
    {label:'Оформление', value:processed, pct:Math.round(processed/invited*100)},
    {label:'1-я смена', value:shifted, pct:Math.round(shifted/processed*100)},
  ];
  document.getElementById('candidateStats').innerHTML = items.map(it=>
    '<div class="stat-card"><div class="stat-value">'+it.value.toLocaleString('ru-RU')+'</div><div class="stat-label">'+it.label+(it.pct?' · '+it.pct+'%':'')+'</div></div>'
  ).join('');
}
function renderCandidates(){
  renderCandidateStats();
  const wrap = document.getElementById('candWrap');
  const ds = state.cand.demoState;
  if(ds==='loading'){ wrap.innerHTML = skeletonRows(9); document.getElementById('candPager').innerHTML=''; return; }
  if(ds==='error'){
    wrap.innerHTML = errorState();
    wireStateAction(wrap,()=>{ state.cand.demoState='normal'; document.getElementById('candStateDemo').value='normal'; renderCandidates(); });
    document.getElementById('candPager').innerHTML='';
    return;
  }

  const all = candFiltered();
  if(ds==='empty' || all.length===0){
    wrap.innerHTML = emptyState('Кандидаты не найдены','Измените условия поиска или сбросьте фильтры.');
    wireStateAction(wrap,()=>document.getElementById('candReset').click());
    document.getElementById('candPager').innerHTML='';
    return;
  }
  const visible = all.slice(0, state.cand.visible);

  const thead = '<thead><tr>'
    +'<th class="col-sticky" style="width:220px;">ФИО</th><th>Проект</th><th>Город</th><th>Стадия</th><th>Рекрутер</th><th>Менеджер</th><th>Координатор</th><th>ID</th>'
    +'<th>Отклик</th><th>Приглашение</th><th>Оформление</th><th>1-я смена</th></tr></thead>';
  const tbody = '<tbody>'+visible.map(c=>{
    const st = stageById(c.stage);
    const proj = PROJECTS.find(p=>p.id===c.project);
    return '<tr class="clickable" data-cand="'+c.id+'">'
      +'<td class="col-sticky"><div class="name-cell"><div class="avatar" style="width:26px;height:26px;font-size:10px;background:'+avColor(c.fio)+'">'+initials(c.fio)+'</div>'+esc(c.fio)+'</div></td>'
      +'<td>'+esc(proj?proj.name:'—')+'</td><td>'+esc(c.city)+'</td>'
      +'<td><span class="badge b-'+st.color+'">'+st.name+'</span></td>'
      +'<td class="muted">'+esc(c.recruiter)+'</td><td class="muted">'+esc(c.manager)+'</td><td class="muted">'+esc(c.coordinator)+'</td>'
      +'<td class="mono muted">'+c.id+'</td>'
      +'<td class="mono">'+(fmtDateTime(c.responseAt)||'—')+'</td><td class="mono">'+(fmtDateTime(c.invitedAt)||'—')+'</td>'
      +'<td class="mono">'+(fmtDateTime(c.processedAt)||'—')+'</td><td class="mono">'+(fmtDateTime(c.firstShiftAt)||'—')+'</td></tr>';
  }).join('')+'</tbody>';

  wrap.innerHTML = '<div class="table-scroll scroll-x" id="candScroll"><table id="candTable">'+thead+tbody+'</table></div>'
    + '<div class="hscroll-fake scroll-x" id="candHFake"><div class="hscroll-fake-inner" id="candHFakeInner"></div></div>';
  const table = document.getElementById('candTable');
  table.querySelectorAll('[data-cand]').forEach(tr=>tr.addEventListener('click',()=>openCandidateDrawer(tr.dataset.cand)));
  syncFakeScroll('candScroll','candHFake','candHFakeInner');

  const pager = document.getElementById('candPager');
  pager.innerHTML = '<span>Показано '+visible.length+' из '+all.length+'</span>'
    + (visible.length<all.length ? '<button class="btn btn-sm" id="loadMoreCand">Показать ещё</button>' : '<span>Прокрутите таблицу ползунком снизу →</span>');
  const lm = document.getElementById('loadMoreCand');
  if(lm) lm.addEventListener('click',()=>{ state.cand.visible+=20; renderCandidates(); });
}
document.getElementById('candSearch').addEventListener('input',(e)=>{ state.cand.search=e.target.value; state.cand.visible=20; renderCandidates(); });
['candProject','candCity','candStage','candRecruiter'].forEach(id=>{
  document.getElementById(id).addEventListener('change',(e)=>{ state.cand[id.replace('cand','').toLowerCase()]=e.target.value; state.cand.visible=20; renderCandidates(); });
});
document.getElementById('candDate').addEventListener('change',(e)=>{ state.cand.date=e.target.value; state.cand.visible=20; renderCandidates(); });
document.getElementById('candReset').addEventListener('click',()=>{
  state.cand.search='';state.cand.project='';state.cand.city='';state.cand.stage='';state.cand.recruiter='';state.cand.date='';state.cand.visible=20;
  ['candSearch'].forEach(id=>document.getElementById(id).value='');
  ['candProject','candCity','candStage','candRecruiter'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('candDate').value='';
  renderCandidates();
});
document.getElementById('candStateDemo').addEventListener('change',(e)=>{ state.cand.demoState=e.target.value; renderCandidates(); });
document.getElementById('exportCandBtn').addEventListener('click',()=>{
  const rows = candFiltered();
  const header = ['ФИО','Проект','Город','Стадия','Рекрутер','Менеджер','Координатор','ID','Отклик','Приглашение','Оформление','1-я смена'];
  const lines = [header.join(';')].concat(rows.map(c=>{
    const proj = PROJECTS.find(p=>p.id===c.project);
    const st = stageById(c.stage);
    return [c.fio,proj?proj.name:'',c.city,st.name,c.recruiter,c.manager,c.coordinator,c.id,fmtDateTime(c.responseAt)||'',fmtDateTime(c.invitedAt)||'',fmtDateTime(c.processedAt)||'',fmtDateTime(c.firstShiftAt)||''].join(';');
  }));
  const blob = new Blob(['﻿'+lines.join('\n')], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='staffflow-candidates.csv'; a.click();
  URL.revokeObjectURL(url);
  toast('Экспорт сформирован: staffflow-candidates.csv');
});
document.getElementById('addCandBtn').addEventListener('click',openCandModal);

/* ===================== CANDIDATE DRAWER ===================== */
const drawerOverlay = document.getElementById('drawerOverlay');
const drawerEl = document.getElementById('candDrawer');
function openCandidateDrawer(id){
  const c = state.candData.find(x=>x.id===id);
  if(!c) return;
  const proj = PROJECTS.find(p=>p.id===c.project);
  const st = stageById(c.stage);
  const order = ['response','invited','interview','processing','confirmed','first_shift'];
  const isTerminalBad = c.stage==='rejected' || c.stage==='no_show';

  let timelineHtml = order.map((sid,idx)=>{
    const s = stageById(sid);
    const dateMap = {response:c.responseAt, invited:c.invitedAt, interview:c.interviewAt, processing:c.processedAt, confirmed:c.processedAt, first_shift:c.firstShiftAt};
    const date = dateMap[sid];
    return '<div class="tl-item"><div class="tl-dot-wrap"><div class="tl-dot'+(date?'':' pending')+'"></div>'+(idx<order.length-1?'<div class="tl-line"></div>':'')+'</div>'
      +'<div class="tl-main'+(date?'':' pending')+'"><b>'+s.name+'</b><span>'+(date?fmtDateTime(date):'Ожидается')+'</span></div></div>';
  }).join('');
  if(isTerminalBad){
    timelineHtml += '<div class="tl-item"><div class="tl-dot-wrap"><div class="tl-dot" style="background:var(--red)"></div></div><div class="tl-main"><b style="color:var(--red)">'+st.name+'</b><span>Причина: не подтвердил выход по телефону</span></div></div>';
  }

  const commentsHtml = (c.comments||[]).map(cm=>
    '<div class="comment"><div class="who"><b>'+esc(cm.who)+'</b><span>'+fmtDateTime(cm.at)+'</span></div><p>'+esc(cm.text)+'</p></div>'
  ).join('') || '<p class="muted" style="font-size:12.5px;">Комментариев пока нет.</p>';

  drawerEl.innerHTML =
    '<div class="drawer-head"><div class="avatar" style="background:'+avColor(c.fio)+'">'+initials(c.fio)+'</div>'
    + '<div><h3>'+esc(c.fio)+'</h3><p>'+c.id+' · '+esc(proj?proj.name:'')+', '+esc(c.city)+'</p></div>'
    + '<button class="drawer-close" id="drawerCloseBtn">'+ic('x',16)+'</button></div>'
    + '<div class="drawer-body">'
    + '<div><span class="badge b-'+st.color+'" style="font-size:13px;padding:6px 12px;">'+st.name+'</span></div>'
    + '<div class="drawer-section"><h4>Ответственные</h4><div class="info-grid">'
    + '<div><span>Рекрутер</span><b>'+esc(c.recruiter)+'</b></div>'
    + '<div><span>Менеджер проекта</span><b>'+esc(c.manager)+'</b></div>'
    + '<div><span>Координатор</span><b>'+esc(c.coordinator)+'</b></div>'
    + '<div><span>ID кандидата</span><b>'+c.id+'</b></div>'
    + '</div></div>'
    + '<div class="drawer-section"><h4>Временная шкала этапов</h4><div class="timeline">'+timelineHtml+'</div></div>'
    + '<div class="drawer-section"><h4>Комментарии</h4><div style="display:flex;flex-direction:column;gap:10px;">'+commentsHtml+'</div>'
    + '<div class="comment-input" style="margin-top:10px;"><input type="text" id="drawerCommentInput" placeholder="Добавить комментарий…"><button class="btn btn-sm" id="drawerCommentSend">Отправить</button></div>'
    + '</div></div>';

  document.getElementById('drawerCloseBtn').addEventListener('click',closeDrawer);
  document.getElementById('drawerCommentSend').addEventListener('click',()=>{
    const input = document.getElementById('drawerCommentInput');
    const val = input.value.trim();
    if(!val) return;
    c.comments = c.comments||[];
    c.comments.push({who:'Дмитрий Кузнецов', at:new Date(), text:val});
    openCandidateDrawer(c.id);
    toast('Комментарий добавлен');
  });

  drawerOverlay.classList.add('open');
  drawerEl.classList.add('open');
}
function closeDrawer(){ drawerOverlay.classList.remove('open'); drawerEl.classList.remove('open'); }
drawerOverlay.addEventListener('click',closeDrawer);

/* ===================== MARKETING ===================== */
function renderMarketing(){
  const totals = CHANNELS.reduce((a,c)=>({budget:a.budget+c.budget,responses:a.responses+c.responses,invites:a.invites+c.invites,processed:a.processed+c.processed,shifts:a.shifts+c.shifts}),{budget:0,responses:0,invites:0,processed:0,shifts:0});
  const cpl = Math.round(totals.budget/totals.responses);
  const cph = Math.round(totals.budget/totals.shifts);
  const stats = [
    {icon:'trend', label:'Бюджет за 30 дней', value:fmtMoney(totals.budget)},
    {icon:'users', label:'Всего откликов', value:totals.responses.toLocaleString('ru-RU')},
    {icon:'target', label:'Стоимость отклика', value:fmtMoney(cpl)},
    {icon:'check', label:'Стоимость 1 выхода', value:fmtMoney(cph)},
  ];
  document.getElementById('marketingStats').innerHTML = stats.map(s=>
    '<div class="stat-card"><div class="stat-top"><div class="stat-ico">'+ic(s.icon,16)+'</div></div><div class="stat-value">'+s.value+'</div><div class="stat-label">'+s.label+'</div></div>'
  ).join('');

  const thead = '<thead><tr><th class="col-sticky">Канал</th><th>Бюджет</th><th>Отклики</th><th>Cost/отклик</th><th>Приглашения</th><th>Оформления</th><th>Выходы</th><th>Cost/выход</th><th>Конверсия</th></tr></thead>';
  const tbody = '<tbody>'+CHANNELS.map(ch=>{
    const cpl = Math.round(ch.budget/ch.responses);
    const cph = Math.round(ch.budget/ch.shifts);
    const conv = Math.round(ch.shifts/ch.responses*100);
    return '<tr><td class="col-sticky" style="font-weight:600;">'+esc(ch.name)+'</td><td>'+fmtMoney(ch.budget)+'</td><td>'+ch.responses+'</td><td class="muted">'+fmtMoney(cpl)+'</td>'
      +'<td>'+ch.invites+'</td><td>'+ch.processed+'</td><td>'+ch.shifts+'</td><td class="muted">'+fmtMoney(cph)+'</td>'
      +'<td><span class="badge b-'+(conv>=20?'green':conv>=12?'amber':'red')+'">'+conv+'%</span></td></tr>';
  }).join('')+'</tbody>';
  document.getElementById('channelTable').innerHTML = thead+tbody;

  const maxBudget = Math.max(...CHANNELS.map(c=>c.budget));
  document.getElementById('channelBars').innerHTML = CHANNELS.slice().sort((a,b)=>b.budget-a.budget).map(ch=>
    '<div class="bar-row"><span style="font-size:12.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(ch.name)+'</span>'
    +'<div class="bar-track"><div class="bar-fill" style="width:'+(ch.budget/maxBudget*100)+'%"></div></div>'
    +'<span class="mono" style="font-size:12px;color:var(--text-2);">'+fmtMoney(ch.budget)+'</span></div>'
  ).join('');
}

/* ===================== ANALYTICS ===================== */
const ANA_TABS = [
  {id:'projects', label:'Проекты и города'},
  {id:'recruiters', label:'Рекрутеры'},
  {id:'channels', label:'Каналы'},
  {id:'planfact', label:'План / Факт'},
  {id:'funnel', label:'Воронка и прогноз'},
];
function renderAnalytics(){
  document.getElementById('anaTabs').innerHTML = ANA_TABS.map(t=>'<button data-t="'+t.id+'" class="'+(state.ana.tab===t.id?'active':'')+'">'+t.label+'</button>').join('');
  document.querySelectorAll('#anaTabs button').forEach(b=>b.addEventListener('click',()=>{ state.ana.tab=b.dataset.t; renderAnalytics(); }));

  const panel = document.getElementById('anaPanel');
  if(state.ana.period==='q1-2023'){
    panel.innerHTML = noDataState('Нет данных за выбранный период','Портал ведёт учёт с февраля 2026 года. Выберите другой период.');
    return;
  }

  if(state.ana.tab==='projects') return renderAnaProjects(panel);
  if(state.ana.tab==='recruiters') return renderAnaRecruiters(panel);
  if(state.ana.tab==='channels') return renderAnaChannels(panel);
  if(state.ana.tab==='planfact') return renderAnaPlanFact(panel);
  if(state.ana.tab==='funnel') return renderAnaFunnel(panel);
}
function projectDemandTotal(pid){
  let sum=0; PROJECTS.find(p=>p.id===pid).cities.forEach(c=>DEMAND[pid][c].slice(0,30).forEach(d=>sum+=d.need));
  return sum;
}
function renderAnaProjects(panel){
  const rows = PROJECTS.map(p=>{
    const plan = projectDemandTotal(p.id);
    const fact = Math.round(plan*(0.6+rnd()*0.5));
    const pct = plan? Math.round(fact/plan*100):0;
    return {p,plan,fact,pct};
  });
  panel.innerHTML = '<div class="panel-head"><h3>Выполнение плана по проектам</h3><span class="sub">30 дней</span></div><div class="panel-body">'
    + rows.map(r=>'<div class="bar-row" style="grid-template-columns:170px 1fr auto;">'
      +'<span style="font-size:13px;font-weight:600;">'+esc(r.p.name)+'</span>'
      +'<div class="bar-track"><div class="bar-fill" style="width:'+Math.min(r.pct,100)+'%;background:'+(r.pct>=100?'var(--green)':r.pct>=75?'var(--accent)':'var(--red)')+'"></div></div>'
      +'<span class="mono" style="font-size:12.5px;">'+r.fact+' / '+r.plan+' · '+r.pct+'%</span></div>').join('')
    + '</div>';
}
function renderAnaRecruiters(panel){
  const rows = RECRUITERS.map(r=>{
    const total = state.candData.filter(c=>c.recruiter===r).length;
    const processed = state.candData.filter(c=>c.recruiter===r && ['processing','confirmed','first_shift'].includes(c.stage)).length;
    const conv = total? Math.round(processed/total*100):0;
    return {r,total,processed,conv};
  }).sort((a,b)=>b.conv-a.conv);
  const thead='<thead><tr><th class="col-sticky">Рекрутер</th><th>Передано кандидатов</th><th>Оформлено</th><th>Конверсия</th></tr></thead>';
  const tbody='<tbody>'+rows.map(r=>'<tr><td class="col-sticky" style="font-weight:600;">'+esc(r.r)+'</td><td>'+r.total+'</td><td>'+r.processed+'</td>'
    +'<td><span class="badge b-'+(r.conv>=45?'green':r.conv>=25?'amber':'red')+'">'+r.conv+'%</span></td></tr>').join('')+'</tbody>';
  panel.innerHTML = '<div class="panel-head"><h3>Эффективность рекрутеров</h3></div><div class="table-wrap"><div class="table-scroll scroll-x"><table>'+thead+tbody+'</table></div></div>';
}
function renderAnaChannels(panel){
  const total = CHANNELS.reduce((a,c)=>a+c.shifts,0);
  const thead='<thead><tr><th class="col-sticky">Канал</th><th>Отклики</th><th>Оформления</th><th>Cost/выход</th><th>Доля найма</th></tr></thead>';
  const tbody='<tbody>'+CHANNELS.map(ch=>{
    const share = Math.round(ch.shifts/total*100);
    return '<tr><td class="col-sticky" style="font-weight:600;">'+esc(ch.name)+'</td><td>'+ch.responses+'</td><td>'+ch.processed+'</td><td>'+fmtMoney(Math.round(ch.budget/ch.shifts))+'</td>'
      +'<td><div class="bar-row" style="grid-template-columns:1fr auto;padding:0;"><div class="bar-track" style="width:100px;"><div class="bar-fill" style="width:'+share+'%"></div></div><span class="mono" style="font-size:12px;">'+share+'%</span></div></td></tr>';
  }).join('')+'</tbody>';
  panel.innerHTML = '<div class="panel-head"><h3>Вклад каналов в фактический найм</h3></div><div class="table-wrap"><div class="table-scroll scroll-x"><table>'+thead+tbody+'</table></div></div>';
}
function renderAnaPlanFact(panel){
  const rows = PROJECTS.map(p=>{
    const plan = projectDemandTotal(p.id);
    const fact = Math.round(plan*(0.6+rnd()*0.5));
    const pct = plan? Math.round(fact/plan*100):0;
    return {p,plan,fact,pct};
  });
  panel.innerHTML = '<div class="panel-head"><h3>План против факта</h3><span class="sub">По проектам, 30 дней</span></div>'
    + (rows.every(r=>r.pct>=100) ? '<div class="banner success">'+ic('check',15)+' Все проекты выполняют план на 100% и выше</div>' : '')
    + '<div class="panel-body kv-list">'
    + rows.map(r=>'<div class="kv-row"><span>'+esc(r.p.name)+'</span><b style="color:'+(r.pct>=100?'var(--green)':r.pct<70?'var(--red)':'var(--text-1)')+'">'+r.fact+' / '+r.plan+' ('+r.pct+'%)</b></div>').join('')
    + '</div>';
}
function renderAnaFunnel(panel){
  const steps = [
    {name:'Отклик', val: state.candData.length},
    {name:'Приглашён', val: state.candData.filter(c=>['invited','interview','processing','confirmed','first_shift'].includes(c.stage)).length},
    {name:'Собеседование', val: state.candData.filter(c=>['interview','processing','confirmed','first_shift'].includes(c.stage)).length},
    {name:'Оформление', val: state.candData.filter(c=>['processing','confirmed','first_shift'].includes(c.stage)).length},
    {name:'1-я смена', val: state.candData.filter(c=>c.stage==='first_shift').length},
  ];
  const max = steps[0].val;
  const forecast = 82;
  panel.innerHTML = '<div class="panel-head"><h3>Воронка найма и прогноз</h3><span class="sub">Текущий месяц</span></div>'
    + '<div class="grid-2" style="padding:20px;gap:24px;">'
    + '<div>' + steps.map((s,i)=>{
        const pct = Math.round(s.val/max*100);
        const convPrev = i>0? Math.round(s.val/steps[i-1].val*100):100;
        return '<div class="bar-row" style="grid-template-columns:120px 1fr auto;">'
          +'<span style="font-size:13px;font-weight:600;">'+s.name+'</span>'
          +'<div class="bar-track"><div class="bar-fill" style="width:'+pct+'%"></div></div>'
          +'<span class="mono" style="font-size:12.5px;">'+s.val+(i>0?' · '+convPrev+'%':'')+'</span></div>';
      }).join('') + '</div>'
    + '<div style="display:flex;flex-direction:column;align-items:center;gap:10px;">'
      + '<div class="progress-ring"><svg width="118" height="118"><circle cx="59" cy="59" r="50" stroke="var(--gray-soft)" stroke-width="10" fill="none"/><circle cx="59" cy="59" r="50" stroke="var(--accent)" stroke-width="10" fill="none" stroke-linecap="round" stroke-dasharray="'+(2*Math.PI*50)+'" stroke-dashoffset="'+(2*Math.PI*50*(1-forecast/100))+'"/></svg><div class="center"><b>'+forecast+'%</b><span>прогноз</span></div></div>'
      + '<p style="font-size:12.5px;color:var(--text-2);text-align:center;max-width:220px;">Прогноз выполнения плана к концу месяца при текущем темпе найма</p>'
    + '</div></div>';
}
document.getElementById('anaPeriod').addEventListener('change',(e)=>{ state.ana.period=e.target.value; renderAnalytics(); });
document.getElementById('anaProject').addEventListener('change',(e)=>{ state.ana.project=e.target.value; renderAnalytics(); });

/* ===================== NOTIFICATIONS PAGE ===================== */
function renderNotifications(){
  const f = state.notif.filter;
  const list = state.notifData.filter(n=>{
    if(f==='unread') return !n.read;
    if(f==='all') return true;
    return n.type===f;
  });
  const holder = document.getElementById('notifFullList');
  if(!list.length){
    holder.innerHTML = emptyState('Уведомлений нет','В выбранной категории пока нет сообщений.');
    wireStateAction(holder,()=>{ state.notif.filter='all'; document.querySelectorAll('#notifFilter button').forEach(b=>b.classList.toggle('active',b.dataset.f==='all')); renderNotifications(); });
    return;
  }
  holder.innerHTML = list.map(n=>{
    const t = NOTIF_TYPES[n.type];
    return '<div class="notif-full'+(n.read?'':' unread')+'"><div class="notif-ico '+n.type+'">'+ic(t.icon,16)+'</div>'
      +'<div class="body"><div class="top"><b>'+esc(n.title)+'</b><span class="tag">'+esc(n.project)+'</span></div><p>'+esc(n.text)+'</p>'
      +'<div class="foot"><span>'+relTime(n.minsAgo)+'</span>'+(n.read?'':'<button data-read="'+n.id+'">Отметить прочитанным</button>')+'</div></div></div>';
  }).join('');
  holder.querySelectorAll('[data-read]').forEach(b=>b.addEventListener('click',()=>{
    const n = state.notifData.find(x=>x.id==b.dataset.read); n.read=true; renderNav(); renderNotifications();
  }));
}
document.getElementById('notifFilter').addEventListener('click',(e)=>{
  const b=e.target.closest('button'); if(!b) return;
  document.querySelectorAll('#notifFilter button').forEach(x=>x.classList.remove('active'));
  b.classList.add('active'); state.notif.filter=b.dataset.f; renderNotifications();
});

/* ===================== SETTINGS ===================== */
const TEAM = [
  {name:'Елена Кравцова', role:'Рекрутер', projects:'Самокат, X5'},
  {name:'Никита Беляков', role:'Рекрутер', projects:'Купер'},
  {name:'Антон Захаров', role:'Менеджер проекта', projects:'Самокат, Яндекс Лавка'},
  {name:'Марина Волкова', role:'Менеджер проекта', projects:'Купер, Ozon Fresh'},
  {name:'Ольга Смирнова', role:'Координатор', projects:'Все проекты'},
];
const INTEGRATIONS = [
  {name:'1С:Зарплата и управление персоналом', desc:'Синхронизация оформленных сотрудников', on:true},
  {name:'Telegram-бот уведомлений', desc:'Критические оповещения в чат команды', on:true},
  {name:'Google Календарь', desc:'Синхронизация выходов на смены', on:false},
  {name:'HR-система заказчика', desc:'Обмен статусами кандидатов по API', on:false},
];
function renderSettings(){
  document.getElementById('teamList').innerHTML = TEAM.map(m=>
    '<div class="team-row"><div class="avatar" style="width:32px;height:32px;font-size:11px;background:'+avColor(m.name)+'">'+initials(m.name)+'</div>'
    +'<div class="txt"><b>'+esc(m.name)+'</b><span>'+esc(m.projects)+'</span></div>'
    +'<div class="ctl"><select class="select" style="height:30px;font-size:12px;"><option>'+esc(m.role)+'</option><option>Рекрутер</option><option>Менеджер проекта</option><option>Координатор</option><option>Администратор</option></select></div></div>'
  ).join('');
  document.getElementById('integrationList').innerHTML = INTEGRATIONS.map((it,i)=>
    '<div class="settings-row"><div class="txt"><b>'+esc(it.name)+'</b><span>'+esc(it.desc)+'</span></div><div class="ctl"><button class="toggle'+(it.on?' on':'')+'" data-int="'+i+'"></button></div></div>'
  ).join('');
  document.querySelectorAll('[data-int]').forEach(b=>b.addEventListener('click',()=>{
    const i=b.dataset.int; INTEGRATIONS[i].on=!INTEGRATIONS[i].on; b.classList.toggle('on'); toast(INTEGRATIONS[i].on?'Интеграция подключена':'Интеграция отключена');
  }));
  document.getElementById('notifSettings').innerHTML = [
    ['Email-уведомления','Дублировать критичные события на почту',true],
    ['Push-уведомления','Уведомления в браузере в реальном времени',true],
    ['Ежедневный дайджест','Сводка за день в 9:00 по МСК',false],
  ].map(([b,s,on],i)=>'<div class="settings-row"><div class="txt"><b>'+b+'</b><span>'+s+'</span></div><div class="ctl"><button class="toggle'+(on?' on':'')+'" data-ns="'+i+'"></button></div></div>').join('');
  document.querySelectorAll('[data-ns]').forEach(b=>b.addEventListener('click',()=>b.classList.toggle('on')));
}
document.getElementById('inviteBtn').addEventListener('click',openInviteModal);
document.getElementById('saveProfileBtn').addEventListener('click',saveProfile);
function saveProfile(){ toast('Изменения профиля сохранены'); }
document.getElementById('densityToggle').addEventListener('click',(e)=>{
  e.target.classList.toggle('on');
  document.body.classList.toggle('density-compact');
});
document.getElementById('tipsToggle').addEventListener('click',(e)=>e.target.classList.toggle('on'));

/* ===================== INIT ===================== */
function onWindowResize(){
  if(state.page==='demand') syncFakeScroll('demandScroll','demandHFake','demandHFakeInner');
  if(state.page==='candidates') syncFakeScroll('candScroll','candHFake','candHFakeInner');
}
function init(){
  fillDemandFilters();
  fillCandFilters();
  document.getElementById('anaProject').innerHTML = '<option value="">Все проекты</option>'+optionsHtml(PROJECTS);
  renderNav();
  renderCtxAction();
  renderPage('overview');
  document.getElementById('page-overview').classList.add('active');
  window.addEventListener('resize',onWindowResize);
}
init();

return function cleanupPortal(){
  document.removeEventListener('click',onDocClick);
  document.removeEventListener('keydown',onDocKeydown);
  window.removeEventListener('resize',onWindowResize);
};

}
