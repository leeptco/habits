'use strict';
/* Росток — план дня (матрица Эйзенхауэра и расписание), время на хобби и поиск работы.
   Данные хранятся только на этом устройстве.
   Напоминания и события подтягиваются через команду iOS «Команды» (адрес вида #sync=...). */

// ---------- утилиты ----------
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);
const pad = n => String(n).padStart(2, '0');
const dkey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hm = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fromKey = k => new Date(k + 'T12:00:00');
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const today = () => dkey();
const daysBetween = (a, b) => Math.round((fromKey(b) - fromKey(a)) / 86400000);
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const fromMin = m => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const plural = (n, one, few, many) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
};
const days = n => `${n} ${plural(n, 'день', 'дня', 'дней')}`;
const fmtMin = m => {
  m = Math.round(m);
  const h = Math.floor(m / 60), r = m % 60;
  if (!h) return `${r} мин`;
  return r ? `${h} ч ${r} мин` : `${h} ч`;
};
const fmtDate = k => fromKey(k).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });

// ---------- иконки (линейные, 24×24) ----------
const ICONS = {
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
  film: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18M17 3v18M3 8h4M3 16h4M17 8h4M17 16h4M3 12h18"/>',
  yarn: '<circle cx="12" cy="12" r="9"/><path d="M5.5 6.5c4.5 1.5 8.5 6 9.5 14M9.5 3.4c3 3.2 5.5 9 5.3 16.5M3.3 11.5c4.5-.8 10.5 1.5 14.5 6.5M14.5 3.4c-1 4 1.5 8 6.3 9"/>',
  walk: '<path d="M4 16v-2.4C4 11.5 3 10.5 3 8c0-2.7 1.5-6 4.5-6C9.4 2 10 3.8 10 5.5c0 3.1-2 5.7-2 8.7V16a2 2 0 1 1-4 0z"/><path d="M20 20v-2.4c0-2.1 1-3.1 1-5.6 0-2.7-1.5-6-4.5-6-1.9 0-2.5 1.8-2.5 3.5 0 3.1 2 5.7 2 8.7V20a2 2 0 1 0 4 0zM16 17h4M4 13h4"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  dumbbell: '<path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
  languages: '<path d="M4 5h8M8 3v2M6 5c0 4 2 7 5 8M10 5c-1 4-3 7-6 8M13 21l4-9 4 9M14.5 18h5"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.7-.9 1.4-1.8-.4-1.2.4-2.2 1.6-2.2H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>',
  pen: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  cup: '<path d="M4 8h13v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6zM17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 2v3M12 2v3"/>',
  home: '<path d="M3 11l9-7 9 7v9H3z"/><path d="M10 20v-6h4v6"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 4 13c0-6 5-9 16-9 0 11-3 16-9 16z"/><path d="M4 20c4-6 7-8 11-10"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',
  activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  award: '<circle cx="12" cy="9" r="6"/><path d="M8.5 14L7 22l5-3 5 3-1.5-8"/>',
  sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>',
  check: '<path d="M5 12l5 5L20 7"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  edit: '<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.9-3.5M4 4v4h4M4 13a8 8 0 0 0 14.9 3.5M20 20v-4h-4"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  bell: '<path d="M6 16v-5a6 6 0 1 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
  forward: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>',
};
const ic = (name, size = 20) => `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.star}</svg>`;
const ACT_ICONS = ['briefcase', 'film', 'yarn', 'walk', 'book', 'sun', 'dumbbell', 'languages', 'camera', 'music', 'palette', 'pen', 'cup', 'home', 'leaf', 'heart', 'activity', 'star'];

// ---------- справочники ----------
const CATS = {
  job:     { name: 'Работа',         hint: 'напоминаю каждый день' },
  restore: { name: 'Восстановление', hint: 'хобби и антистресс' },
  grow:    { name: 'Развитие',       hint: 'тело и ум' },
};
const MOODS = [
  { v: 1, t: 'Хуже' },
  { v: 2, t: 'Так же' },
  { v: 3, t: 'Лучше' },
  { v: 4, t: 'Намного лучше' },
];
const moodText = m => MOODS[Math.min(3, Math.max(0, Math.round(m) - 1))].t.toLowerCase();
const QUADS = {
  1: { name: 'Сделать',       sub: 'важно и срочно',      short: 'Сделать' },
  2: { name: 'Запланировать', sub: 'работа, хобби, здоровье', short: 'План' },
  3: { name: 'Быстро',        sub: 'или попросить',       short: 'Быстро' },
  4: { name: 'Отпустить',     sub: 'можно не делать',     short: 'Отпустить' },
};
const PARTS = {
  morning: { name: 'Утро',  from: 0,  to: 12, def: '09:00' },
  day:     { name: 'День',  from: 12, to: 18, def: '14:00' },
  evening: { name: 'Вечер', from: 18, to: 24, def: '19:00' },
};
const partOf = t => t.time ? (toMin(t.time) < 720 ? 'morning' : toMin(t.time) < 1080 ? 'day' : 'evening') : (t.part || '');
const MILESTONES = [60, 180, 300, 600, 1200, 1800, 3000, 6000, 12000];

const DEFAULT_ACTS = [
  { id: 'job',   name: 'Поиск работы', icon: 'briefcase', cat: 'job',     goal: 30 },
  { id: 'video', name: 'Монтаж видео', icon: 'film',      cat: 'restore', goal: 30 },
  { id: 'knit',  name: 'Вязание',      icon: 'yarn',      cat: 'restore', goal: 20 },
  { id: 'walk',  name: 'Прогулка',     icon: 'walk',      cat: 'restore', goal: 20 },
  { id: 'read',  name: 'Чтение',       icon: 'book',      cat: 'restore', goal: 20 },
  { id: 'morn',  name: 'Зарядка',      icon: 'sun',       cat: 'grow',    goal: 10 },
  { id: 'gym',   name: 'Силовая',      icon: 'dumbbell',  cat: 'grow',    goal: 40 },
  { id: 'eng',   name: 'Английский',   icon: 'languages', cat: 'grow',    goal: 20 },
];

// ---------- состояние ----------
const KEY = 'rostok-v2';
function defaultState() {
  return {
    version: 3, name: '', onboarded: false, tab: 'plan', planView: 'matrix', schedMode: 'hours',
    acts: DEFAULT_ACTS.map(a => ({ ...a })),
    sessions: [],   // {id, aid, date, min, mood, note, at}
    tasks: [],      // {id, text, q, date, time, part, dur, aid, done, doneDate, src, key, calSent}
    wins: [],       // {id, date, text}
    insta: [],      // {at, choice}
    timer: null,    // {aid, start}
    events: [],     // события Календаря на сегодня из синхронизации
    remQuad: {},    // запомненный квадрат для напоминания по ключу
    lastSync: null,
    syncShortcut: 'Росток',
    doneShortcut: 'Росток готово',
    writeBack: false,
  };
}
let state = load();
function load() {
  let s = defaultState();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) s = { ...s, ...JSON.parse(raw) };
  } catch (e) { /* начинаем с чистого листа */ }
  // переход со старой версии: эмодзи → линейные иконки
  const byId = Object.fromEntries(DEFAULT_ACTS.map(a => [a.id, a.icon]));
  for (const a of s.acts) { if (!a.icon) a.icon = byId[a.id] || 'star'; delete a.emoji; }
  s.version = 3;
  return s;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { toast('Не получилось сохранить'); }
}
const actById = id => state.acts.find(a => a.id === id);
const liveActs = () => state.acts.filter(a => !a.archived);
const siteUrl = () => location.href.split('?')[0].split('#')[0];

// ---------- статистика по занятиям ----------
function actStats(aid) {
  const ss = state.sessions.filter(s => s.aid === aid);
  const weekAgo = dkey(addDays(new Date(), -6));
  const total = ss.reduce((s, x) => s + x.min, 0);
  const week = ss.filter(s => s.date >= weekAgo).reduce((s, x) => s + x.min, 0);
  const todayMin = ss.filter(s => s.date === today()).reduce((s, x) => s + x.min, 0);
  const last = ss.reduce((m, s) => (s.date > m ? s.date : m), '');
  const since = last ? daysBetween(last, today()) : null;
  const moods = ss.filter(s => s.mood).map(s => s.mood);
  const mood = moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : null;
  const dates = new Set(ss.map(s => s.date));
  let streak = 0, d = new Date();
  if (!dates.has(dkey(d))) d = addDays(d, -1);
  while (dates.has(dkey(d))) { streak++; d = addDays(d, -1); }
  return { count: ss.length, total, week, todayMin, since, mood, moodN: moods.length, streak };
}
const nextMilestone = total => MILESTONES.find(m => m > total) || Math.ceil((total + 1) / 6000) * 6000;

// ---------- подсказки дня ----------
function nudges() {
  const out = [];
  const hour = new Date().getHours();

  for (const a of liveActs().filter(a => a.cat === 'job')) {
    const s = actStats(a.id);
    const planned = state.tasks.some(t => t.aid === a.id && t.date <= today() && !t.done);
    if (s.todayMin >= a.goal) {
      out.push({ icon: 'check', html: `<b>${esc(a.name)} сегодня: ${fmtMin(s.todayMin)}.</b> Всего ты вложила ${fmtMin(s.total)}. Дальше — больше.` });
    } else if (s.todayMin > 0) {
      out.push({ icon: a.icon, html: `<b>${esc(a.name)}: уже ${fmtMin(s.todayMin)} сегодня.</b> До цели ${fmtMin(a.goal - s.todayMin)}.`, aid: a.id });
    } else {
      const tail = s.since == null ? 'Начни с малого: открой три вакансии и сохрани одну.'
        : s.since === 1 ? 'Вчера ты это делала — продолжай, пока есть инерция.'
        : `Последний раз — ${days(s.since)} назад. Даже 20 минут сдвинут дело.`;
      out.push({ icon: a.icon, html: `<b>Найди сегодня ${fmtMin(a.goal)} на ${esc(a.name.toLowerCase())}.</b> ${tail}`, aid: a.id, plan: !planned });
    }
  }

  const restore = liveActs().filter(a => a.cat === 'restore').map(a => ({ a, s: actStats(a.id) }));
  const neglected = restore.filter(x => x.s.since !== null && x.s.since >= 3).sort((x, y) => y.s.since - x.s.since)[0];
  if (neglected) {
    const { a, s } = neglected;
    const moodTxt = s.mood ? ` Обычно после этого тебе ${moodText(s.mood)}.` : '';
    out.push({ icon: a.icon, html: `<b>${esc(a.name)}: ${days(s.since)} перерыва.</b>${moodTxt} От этого станет легче — может, ${fmtMin(a.goal)} сегодня?`, aid: a.id, plan: true });
  } else {
    const never = restore.filter(x => x.s.count === 0);
    if (never.length) {
      const { a } = pick(never);
      out.push({ icon: a.icon, html: `<b>${esc(a.name)}</b> ещё ни разу не отмечено. Попробуй ${fmtMin(Math.min(15, a.goal))} — просто посмотреть, как ощущается.`, aid: a.id, plan: true });
    }
  }

  const walk = liveActs().find(a => a.id === 'walk');
  if (walk && hour >= 9 && hour < 21 && !actStats(walk.id).todayMin) {
    out.push({ icon: 'walk', html: '<b>Прогуляйся 15 минут.</b> Можно до магазина и обратно. Телефон — в карман.', aid: walk.id });
  }

  const momentum = liveActs().map(a => ({ a, s: actStats(a.id) })).filter(x => x.s.week > 0 && x.a.cat !== 'job').sort((x, y) => y.s.week - x.s.week)[0];
  if (momentum) {
    const { a, s } = momentum, next = nextMilestone(s.total);
    out.push({ icon: 'trend', html: `<b>${esc(a.name)}: ${fmtMin(s.total)} всего, ${fmtMin(s.week)} за неделю.</b> До отметки «${fmtMin(next)}» осталось ${fmtMin(next - s.total)}.` });
  }

  const old = allWins().filter(w => daysBetween(w.date, today()) >= 2);
  if (old.length) {
    const w = pick(old);
    out.push({ icon: 'award', cls: 'memory', html: `<b>Помнишь?</b> ${fmtDate(w.date)}: «${esc(w.text)}». Ты это уже умеешь.` });
  }
  return out;
}

// ---------- победы ----------
function allWins() {
  const fromSessions = state.sessions.filter(s => s.note).map(s => {
    const a = actById(s.aid);
    return { id: s.id, date: s.date, text: s.note, sub: a ? a.name : '', auto: true };
  });
  return [...state.wins, ...fromSessions].sort((a, b) => (a.date < b.date ? 1 : -1));
}

// ---------- синхронизация с Напоминаниями и Календарём ----------
function parseDT(s) {
  s = (s || '').trim();
  if (!s) return {};
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return { date: s };
  const d = new Date(s);
  if (!isNaN(d)) { const t = hm(d); return { date: dkey(d), time: t === '00:00' ? '' : t }; }
  const m = s.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  const t = s.match(/(\d{1,2}):(\d{2})/);
  if (m) return { date: `${m[3]}-${pad(m[2])}-${pad(m[1])}`, time: t ? `${pad(t[1])}:${t[2]}` : '' };
  return {};
}
const yes = v => /^(yes|да|true|1|вкл)/i.test((v || '').trim());
function parsePayload(raw) {
  const rems = [], events = [];
  for (const line of raw.replace(/\r/g, '').split('\n')) {
    const p = line.split('|').map(x => x.trim());
    const type = (p[0] || '').toUpperCase();
    if (type === 'R' && p.length >= 2) {
      // название может само содержать «|» — остальные поля берём с конца
      const tail = p.length > 6 ? p.slice(-4) : p.slice(2);
      const title = p.length > 6 ? p.slice(1, -4).join('|') : p[1];
      if (!title) continue;
      const d = parseDT(tail[0]);
      rems.push({ title, date: d.date || '', time: d.time || '', list: tail[1] || '', flagged: yes(tail[2]), high: /high|высок|^1$|!!!/i.test(tail[3] || '') });
    } else if (type === 'E' && p[1]) {
      const s = parseDT(p[2]), e = parseDT(p[3]);
      if (s.date) events.push({ title: p[1], date: s.date, time: s.time || '', end: e.time || '', allDay: yes(p[4]) || !s.time });
    }
  }
  return { rems, events };
}
function guessQuad(r) {
  const important = r.flagged || r.high;
  const urgent = r.date && r.date <= today();
  if (important && urgent) return 1;
  if (important) return 2;
  return 0; // неясно — во «Входящие», решишь сама
}
function applySync(raw) {
  const { rems, events } = parsePayload(raw);
  const seen = new Set();
  let added = 0;
  for (const r of rems) {
    const key = `${r.list}::${r.title}`;
    seen.add(key);
    let t = state.tasks.find(x => x.src === 'rem' && x.key === key && !x.gone);
    if (!t) {
      t = { id: uid(), src: 'rem', key, text: r.title, q: state.remQuad[key] ?? guessQuad(r), dur: null, aid: '', part: '', done: false, doneDate: null };
      state.tasks.push(t); added++;
    }
    t.text = r.title; t.list = r.list;
    if (!t.localTime) { t.date = r.date || ''; t.time = r.time; }
  }
  // напоминания, которых больше нет среди невыполненных, — выполнены (или удалены) в приложении Напоминания
  for (const t of state.tasks) {
    if (t.src === 'rem' && !t.done && !t.gone && !seen.has(t.key)) { t.done = true; t.doneDate = today(); t.closedOutside = true; }
  }
  state.events = events.filter(e => e.date === today());
  state.lastSync = Date.now();
  save();
  toast(`Синхронизировано: ${rems.length} ${plural(rems.length, 'напоминание', 'напоминания', 'напоминаний')}${events.length ? `, ${events.length} ${plural(events.length, 'событие', 'события', 'событий')}` : ''}${added ? ` (новых ${added})` : ''}`);
}
function runShortcut(name, text) {
  let url = `shortcuts://x-callback-url/run-shortcut?name=${encodeURIComponent(name)}`;
  if (text != null) url += `&input=text&text=${encodeURIComponent(text)}`;
  url += `&x-success=${encodeURIComponent(siteUrl())}`;
  location.href = url;
}

// ---------- календарь (.ics) ----------
const icsEsc = s => String(s).replace(/\\/g, '\\\\').replace(/[,;]/g, m => '\\' + m).replace(/\n/g, '\\n');
const icsDT = (k, t) => k.replace(/-/g, '') + 'T' + t.replace(':', '') + '00';
function icsEvent({ title, date, time, dur, rrule, note }) {
  const start = new Date(`${date}T${time}:00`);
  const end = new Date(start.getTime() + (dur || 30) * 60000);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  return [
    'BEGIN:VEVENT', `UID:${uid()}-${Date.now()}@rostok`, `DTSTAMP:${stamp}`,
    `DTSTART:${icsDT(date, time)}`, `DTEND:${icsDT(dkey(end), hm(end))}`,
    rrule ? `RRULE:${rrule}` : null,
    `SUMMARY:${icsEsc(title)}`, note ? `DESCRIPTION:${icsEsc(note)}` : null,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(title)}`, 'TRIGGER:-PT0M', 'END:VALARM',
    'END:VEVENT',
  ].filter(Boolean).join('\r\n');
}
function openIcs(events, filename) {
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Rostok//RU', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR'].join('\r\n');
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS) {
    location.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
  } else {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
}
// дела со временем, которые ещё не ушли в Календарь (у напоминаний уже есть свои уведомления)
const calPending = () => state.tasks.filter(t => !t.done && t.time && t.src !== 'rem' && !t.calSent && (t.date || today()) >= today());

// ---------- тосты и модалки ----------
function toast(text) {
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = text;
  const box = $('#toasts');
  while (box.children.length >= 2) box.firstChild.remove();
  box.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}
function openModal(html, onMount) {
  $('#sheet').innerHTML = html;
  $('#modal').classList.remove('hidden');
  $('#sheet').scrollTop = 0;
  if (onMount) onMount($('#sheet'));
}
const closeModal = () => $('#modal').classList.add('hidden');
$('#modal').addEventListener('click', e => {
  if (e.target.id === 'modal' || e.target.closest('[data-close]')) closeModal();
});

// ---------- навигация и отрисовка ----------
$$('.tabs button').forEach(b => {
  b.innerHTML = ic(b.dataset.icon, 24) + b.textContent;
  b.addEventListener('click', () => { state.tab = b.dataset.tab; save(); render(); window.scrollTo(0, 0); });
});
function render() {
  $$('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === state.tab));
  const views = { plan: viewPlan, acts: viewActs, wins: viewWins, more: viewMore };
  $('#screen').innerHTML = (views[state.tab] || viewPlan)();
  renderTimer();
}
function commit(msg) { save(); render(); if (msg) toast(msg); }

// ---------- экран «План» ----------
let showAllNudges = false;
function greeting() {
  const h = new Date().getHours(), name = state.name ? `, ${esc(state.name)}` : '';
  if (h < 6) return `Доброй ночи${name}`;
  if (h < 12) return `Доброе утро${name}`;
  if (h < 18) return `Добрый день${name}`;
  return `Добрый вечер${name}`;
}
const todayTasks = () => {
  const t = today();
  return state.tasks.filter(x => !x.gone && ((x.done && x.doneDate === t) || (!x.done && (!x.date || x.date <= t))));
};
function taskMeta(t) {
  const bits = [];
  if (t.time) bits.push(t.time); else if (t.part) bits.push(PARTS[t.part].name.toLowerCase());
  if (t.dur) bits.push(fmtMin(t.dur));
  if (!t.done && t.date && t.date < today()) bits.push('с ' + fmtDate(t.date));
  const icons = (t.src === 'rem' ? ic('list', 12) : '') + (t.calSent ? ic('bell', 12) : '') + (t.aid && actById(t.aid) ? ic(actById(t.aid).icon, 12) : '');
  return bits.length || icons ? `<span class="meta">${icons}${esc(bits.join(' · '))}</span>` : '';
}
function taskHtml(t) {
  return `<div class="task ${t.done ? 'done' : ''}">
    <button class="chk" data-toggle="${t.id}" aria-label="Готово">${t.done ? ic('check', 14) : ''}</button>
    <span class="t" data-task="${t.id}">${esc(t.text)}${taskMeta(t)}</span>
  </div>`;
}
function viewPlan() {
  const tt = todayTasks();
  const doneToday = tt.filter(t => t.done).length;
  const inbox = tt.filter(t => !t.done && !t.q);
  const ns = nudges();
  const shown = showAllNudges ? ns : ns.slice(0, 2);
  let html = `
  <h1>${greeting()}</h1>
  <div class="muted small">${new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}${doneToday ? ` · сделано ${doneToday}` : ''}</div>
  <h2>На сегодня</h2>`;
  for (const n of shown) {
    html += `<div class="card nudge ${n.cls || ''}"><div class="ico">${ic(n.icon)}</div><div>${n.html}
      ${n.aid ? `<div class="acts">
        <button class="btn primary sm" data-start="${n.aid}">${ic('play', 14)} Начать</button>
        ${n.plan ? `<button class="btn sm" data-plan-act="${n.aid}">${ic('calendar', 14)} Запланировать</button>` : ''}
      </div>` : ''}</div></div>`;
  }
  if (ns.length > 2) html += `<button class="more-link" data-more-nudges>${showAllNudges ? 'Свернуть' : `Ещё ${ns.length - 2}`}</button>`;

  if (state.lastSync || state.tasks.some(t => t.src === 'rem')) {
    html += `<div class="row between small muted" style="margin-top:14px">
      <span>${ic('list', 14)} Напоминания: ${state.lastSync ? 'обновлены в ' + hm(new Date(state.lastSync)) : 'ещё не обновлялись'}</span>
      <button class="iconbtn" data-sync aria-label="Обновить">${ic('refresh', 18)}</button></div>`;
  }

  if (inbox.length) {
    html += `<h2>Из Напоминаний — куда отнести?</h2><div class="card inbox">`;
    for (const t of inbox) {
      html += `<div class="item"><div data-task="${t.id}" style="cursor:pointer">${esc(t.text)}${taskMeta(t)}</div>
        <div class="qpick">${[1, 2, 3, 4].map(q => `<button style="border-color:var(--q${q})" data-setq="${t.id}" data-q="${q}">${QUADS[q].short}</button>`).join('')}</div></div>`;
    }
    html += `</div>`;
  }

  html += `<div class="seg" style="margin-top:20px">
    <button class="${state.planView === 'matrix' ? 'on' : ''}" data-pv="matrix">Матрица</button>
    <button class="${state.planView === 'sched' ? 'on' : ''}" data-pv="sched">Расписание</button></div>`;
  html += state.planView === 'sched' ? viewSched(tt) : viewMatrix(tt);

  const pend = calPending();
  html += `<button class="btn ${pend.length ? 'primary' : ''} block" style="margin-top:14px" data-cal-day ${pend.length ? '' : 'disabled'}>
    ${ic('bell', 18)} ${pend.length ? `Поставить напоминания в Календарь (${pend.length})` : 'Все дела со временем уже в Календаре'}</button>`;
  return html;
}
function viewMatrix(tt) {
  const q = n => tt.filter(t => t.q === n).sort((a, b) => (a.done - b.done) || (a.time || '99').localeCompare(b.time || '99'));
  const quad = n => `<div class="quad q${n}"><h4>${QUADS[n].name}</h4><div class="sub">${QUADS[n].sub}</div>
    ${q(n).map(taskHtml).join('')}
    <button class="add" data-add-task="${n}">${ic('plus', 14)} добавить</button></div>`;
  return `<div class="mx" style="margin-top:12px">
    <div></div><div class="ax">срочно</div><div class="ax">не срочно</div>
    <div class="ay">важно</div>${quad(1)}${quad(2)}
    <div class="ay">не важно</div>${quad(3)}${quad(4)}
  </div>`;
}
function blockHtml(t) {
  return `<div class="blk q${t.q || 0} ${t.done ? 'done' : ''}">
    <button class="chk" data-toggle="${t.id}" aria-label="Готово">${t.done ? ic('check', 14) : ''}</button>
    <span class="t" data-task="${t.id}">${esc(t.text)}${taskMeta(t)}</span></div>`;
}
const eventHtml = e => `<div class="blk ev"><span class="t">${esc(e.title)}<span class="meta">${e.allDay ? 'весь день' : esc(e.time + (e.end ? '–' + e.end : ''))} · Календарь</span></span></div>`;
function viewSched(tt) {
  const open = tt.filter(t => !t.done || t.time || t.part);
  const evs = state.events || [];
  let html = `<div class="seg" style="margin-top:8px">
    <button class="${state.schedMode === 'hours' ? 'on' : ''}" data-sm="hours">По часам</button>
    <button class="${state.schedMode === 'parts' ? 'on' : ''}" data-sm="parts">Утро · день · вечер</button></div>`;

  // нагрузка: сколько осталось запланировано до конца дня
  const now = nowMin(), dayEnd = 23 * 60;
  const left = Math.max(0, dayEnd - now);
  const planned = open.filter(t => !t.done && t.time && toMin(t.time) >= now).reduce((s, t) => s + (t.dur || 30), 0)
    + evs.filter(e => !e.allDay && e.time && toMin(e.time) >= now).reduce((s, e) => s + (e.end ? Math.max(15, toMin(e.end) - toMin(e.time)) : 60), 0);
  const ratio = left ? planned / left : 0;
  html += `<div class="card soft" style="margin-top:10px">
    <div class="row between small"><span>Запланировано до конца дня</span><b>${fmtMin(planned)} из ${fmtMin(left)}</b></div>
    <div class="load ${ratio > .6 ? 'heavy' : ''}"><i style="width:${Math.min(100, ratio * 100)}%"></i></div>
    <p class="small muted" style="margin-top:8px">${ratio > .6
      ? 'План плотный — такой обычно давит. Что можно отпустить или перенести на завтра?'
      : 'Оставляй хотя бы треть дня свободной: на отдых, дорогу и то, что пойдёт не по плану. Время — это рамка, а не экзамен.'}</p>
  </div>`;

  const overdue = open.filter(t => !t.done && t.time && toMin(t.time) + (t.dur || 30) <= now);
  if (overdue.length) html += `<button class="btn block" data-shift>${ic('forward', 16)} Сдвинуть несделанное (${overdue.length}) на ближайшее время</button>`;

  if (state.schedMode === 'parts') {
    for (const [k, p] of Object.entries(PARTS)) {
      const items = open.filter(t => partOf(t) === k).sort((a, b) => (a.time || p.def).localeCompare(b.time || p.def));
      const pe = evs.filter(e => !e.allDay && e.time && Math.floor(toMin(e.time) / 60) >= p.from && Math.floor(toMin(e.time) / 60) < p.to);
      html += `<div class="part" style="margin-top:14px"><h3><span>${p.name}</span><button class="iconbtn" data-add-part="${k}" aria-label="Добавить">${ic('plus', 18)}</button></h3>
        ${[...pe.map(e => [e.time, eventHtml(e)]), ...items.map(t => [t.time || p.def, blockHtml(t)])]
          .sort((x, y) => x[0].localeCompare(y[0])).map(x => x[1]).join('') || '<div class="muted small">свободно</div>'}</div>`;
    }
  } else {
    const timed = open.filter(t => t.time);
    const hours = [...timed.map(t => toMin(t.time) / 60), ...evs.filter(e => e.time).map(e => toMin(e.time) / 60)].map(Math.floor);
    const from = Math.min(7, ...hours), to = Math.max(22, ...hours);
    const curH = Math.floor(now / 60);
    const allDay = evs.filter(e => e.allDay);
    html += `<div class="tl" style="margin-top:12px">${allDay.map(eventHtml).join('')}`;
    for (let h = from; h <= to; h++) {
      const items = timed.filter(t => Math.floor(toMin(t.time) / 60) === h).sort((a, b) => a.time.localeCompare(b.time));
      const he = evs.filter(e => e.time && !e.allDay && Math.floor(toMin(e.time) / 60) === h);
      html += `<div class="hour ${h === curH ? 'now' : h < curH ? 'past' : ''}"><div class="h">${pad(h)}:00</div><div class="slot">
        ${he.map(eventHtml).join('')}${items.map(blockHtml).join('')}
        ${!items.length && !he.length && h >= curH ? `<button class="free" data-add-at="${pad(h)}:00">＋ ${pad(h)}:00</button>` : ''}</div></div>`;
    }
    html += `</div>`;
  }
  const loose = open.filter(t => !t.done && !t.time && !t.part && t.q);
  if (loose.length) {
    html += `<h2>Без времени</h2><div class="card">${loose.map(taskHtml).join('')}
      <p class="small muted">Нажми на дело, чтобы выбрать время или часть дня.</p></div>`;
  }
  return html;
}

// ---------- экран «Занятия» ----------
function viewActs() {
  const stats = liveActs().map(a => ({ a, s: actStats(a.id) }));
  const ranked = stats.filter(x => x.s.moodN >= 1).sort((x, y) => (y.s.mood - x.s.mood) || (y.s.total - x.s.total));
  const byTime = stats.filter(x => x.s.total > 0).sort((x, y) => y.s.total - x.s.total);
  let html = `<h1>Занятия</h1><p class="muted small">Сколько времени ты уже вложила и что помогает больше всего.</p>`;

  html += `<h2>Что помогает тебе больше всего</h2><div class="card">`;
  if (ranked.length) {
    html += ranked.map((x, i) => `<div class="rank"><span class="n">${i + 1}</span>${ic(x.a.icon)}
      <span>${esc(x.a.name)}<div class="muted small">после занятия обычно ${moodText(x.s.mood)}</div></span>
      <span class="muted small">${fmtMin(x.s.total)}</span></div>`).join('');
    html += `<p class="muted small" style="margin-top:6px">Рейтинг из твоих ответов «как ты после занятия». Когда тяжело — выбирай из верхних строк.</p>`;
  } else {
    html += `<p class="muted small">После занятия я спрошу, как ты себя чувствуешь. Через несколько раз здесь появится рейтинг того, что помогает именно тебе.</p>`;
  }
  html += `</div>`;

  if (byTime.length) {
    const sum = byTime.reduce((s, x) => s + x.s.total, 0);
    html += `<div class="card soft"><div class="row between"><b>Всего вложено в себя</b><b>${fmtMin(sum)}</b></div>
      ${byTime.slice(0, 4).map(x => `<div class="row between small muted" style="margin-top:4px"><span>${esc(x.a.name)}</span><span>${fmtMin(x.s.total)}</span></div>`).join('')}</div>`;
  }

  for (const cat of Object.keys(CATS)) {
    const list = stats.filter(x => x.a.cat === cat);
    if (!list.length) continue;
    html += `<h2>${CATS[cat].name} <span class="muted small" style="font-weight:400">· ${CATS[cat].hint}</span></h2>`;
    for (const { a, s } of list) {
      const sinceTxt = s.since === null ? 'ещё не было' : s.since === 0 ? 'сегодня' : s.since === 1 ? 'вчера' : `${days(s.since)} назад`;
      html += `<div class="card act">
        <div class="ico">${ic(a.icon, 22)}</div>
        <div><b>${esc(a.name)}</b>
          <div class="nums">Всего ${fmtMin(s.total)} · неделя ${fmtMin(s.week)}${s.streak > 1 ? ` · ${days(s.streak)} подряд` : ''}</div>
          <div class="nums ${s.since >= 5 ? 'warn' : ''}">Последний раз: ${sinceTxt}</div></div>
        <button class="iconbtn" data-edit-act="${a.id}" aria-label="Настроить">${ic('edit', 18)}</button>
        <div class="btns">
          <button class="btn primary" data-start="${a.id}">${ic('play', 14)} Таймер</button>
          <button class="btn" data-log="${a.id}">${ic('check', 14)} Уже сделала</button>
        </div></div>`;
    }
  }
  html += `<button class="btn ghost block" data-add-act>${ic('plus', 16)} Новое занятие</button>`;
  return html;
}

// ---------- экран «Победы» ----------
function viewWins() {
  const wins = allWins();
  const t = today();
  const memories = [7, 14, 30, 90, 365].map(n => {
    const k = dkey(addDays(new Date(), -n));
    return { n, k, w: wins.filter(x => x.date === k), min: state.sessions.filter(s => s.date === k).reduce((a, s) => a + s.min, 0) };
  }).filter(m => m.w.length || m.min);
  const week = state.sessions.filter(s => s.date >= dkey(addDays(new Date(), -6)));
  const labels = { 7: 'Неделю назад', 14: 'Две недели назад', 30: 'Месяц назад', 90: 'Три месяца назад', 365: 'Год назад' };
  let html = `<h1>Маленькие победы</h1>
  <p class="muted small">Ответила на письмо, вышла на улицу, поела нормально — это считается. При выгорании мозг забывает хорошее, поэтому записываем.</p>
  <form class="row" id="winForm" style="margin:12px 0">
    <input id="winInput" maxlength="160" autocomplete="off" aria-label="Победа">
    <button class="btn primary" type="submit" aria-label="Добавить">${ic('plus', 18)}</button>
  </form>
  <div class="card soft"><div class="row between small"><span>Занятий за 7 дней</span><b>${week.length} · ${fmtMin(week.reduce((a, s) => a + s.min, 0))}</b></div>
  <div class="row between small" style="margin-top:4px"><span>Побед записано</span><b>${wins.length}</b></div></div>`;
  if (memories.length) {
    html += `<h2>В этот день раньше</h2>`;
    for (const m of memories) {
      html += `<div class="card memory-card"><b>${labels[m.n]}</b> <span class="muted small">${fmtDate(m.k)}</span>
        ${m.min ? `<div class="small muted">Занималась собой ${fmtMin(m.min)}</div>` : ''}
        ${m.w.map(w => `<div>${esc(w.text)}</div>`).join('')}</div>`;
    }
  }
  html += `<h2>Все победы</h2>`;
  if (!wins.length) html += `<p class="muted small">Пока пусто. Начни с самой маленькой.</p>`;
  let cur = '';
  for (const w of wins.slice(0, 200)) {
    if (w.date !== cur) { cur = w.date; html += `<div class="muted small" style="margin:12px 0 4px">${w.date === t ? 'Сегодня' : fmtDate(w.date)}</div>`; }
    html += `<div class="card win"><div class="row between"><span>${esc(w.text)}${w.sub ? `<span class="muted small"> · ${esc(w.sub)}</span>` : ''}</span>
      ${w.auto ? '' : `<button class="iconbtn" data-del-win="${w.id}" aria-label="Удалить">${ic('x', 16)}</button>`}</div></div>`;
  }
  return html;
}

// ---------- экран «Ещё» ----------
function viewMore() {
  const url = siteUrl();
  return `<h1>Настройки и помощь</h1>

  <h2>Как работают напоминания</h2>
  <div class="card small">
    <p>Сам Росток уведомлений не присылает: сайт на iPhone не умеет делать это без сервера. Поэтому напоминания идут через приложения, которыми ты уже пользуешься:</p>
    <ol class="steps">
      <li><b>Календарь.</b> У дела есть точное время → на «Плане» нажми «Поставить напоминания в Календарь». Событие появится в Календаре и пришлёт уведомление в начале. Дела, которые уже там, помечены колокольчиком.</li>
      <li><b>Регулярные занятия.</b> «Занятия» → карандаш → «Регулярное напоминание». Например, поиск работы Пн–Пт в 11:00.</li>
      <li><b>Напоминания.</b> Они продолжают работать как обычно. Росток только показывает их в матрице (см. ниже).</li>
    </ol>
  </div>

  <h2>Синхронизация с Напоминаниями</h2>
  <div class="card small">
    <p>Росток сам забирает невыполненные напоминания и сегодняшние события Календаря — без выгрузки руками. Для этого один раз нужно собрать команду в приложении «Команды» и открывать Росток через неё.</p>
    <p class="muted">Последняя синхронизация: ${state.lastSync ? new Date(state.lastSync).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : 'ещё не было'}</p>
    <details><summary>Собрать команду «${esc(state.syncShortcut)}» (5 минут)</summary>
    <ol class="steps">
      <li>«Команды» → ＋ → назови команду <b>${esc(state.syncShortcut)}</b>.</li>
      <li><b>«Найти напоминания»</b> <span class="muted">(Find Reminders)</span> → фильтр <b>«Выполнено» — «нет»</b> <span class="muted">(Is Not Completed)</span>.</li>
      <li><b>«Повторить с каждым»</b> <span class="muted">(Repeat with Each)</span>. Внутри повтора — <b>«Текст»</b> <span class="muted">(Text)</span>:
        <br><code>R|Название|Дата выполнения</code> <span class="muted">(R|Title|Due Date)</span>. Если захочешь, потом добавь <code>|Список|С флажком|Приоритет</code> <span class="muted">(List, Is Flagged, Priority)</span>.
        <ul><li>Каждое слово — переменная «Повторяемый объект» <span class="muted">(Repeat Item)</span>. Нажми на неё и выбери свойство: «Название» <span class="muted">(Title)</span> и т. д.</li>
        <li>У даты: «Формат даты» → <b>ISO 8601</b>, включи время <span class="muted">(Date Format → ISO 8601, Include ISO 8601 Time)</span>.</li></ul></li>
      <li>После «Конца повтора» — <b>«Объединить текст»</b> из «Результатов повтора», разделитель «Новая строка» <span class="muted">(Combine Repeat Results with New Lines)</span>.</li>
      <li><i>По желанию, события Календаря:</i> <b>«Найти события Календаря»</b>, где дата начала — сегодня. Затем повтор и «Текст» вида <code>E|Название|Дата начала|Дата окончания|Весь день</code> (даты — в ISO 8601). Объединить так же. Оба объединённых текста сложи в один «Текст» через новую строку.</li>
      <li><b>«Кодировать URL»</b> для объединённого текста <span class="muted">(URL Encode Combined Text)</span>.</li>
      <li>Действие <b>«URL»</b>: <code>${esc(url)}#sync=</code> и сразу за ним переменная «Кодированный текст» <span class="muted">(URL Encoded Text)</span>.</li>
      <li>Последним — <b>«Открыть URL-адреса»</b> <span class="muted">(Open URLs)</span>.</li>
      <li>Нажми ⓘ → <b>«На экран „Домой“»</b> и поставь эту команду на место иконки Ростка. Открываешь Росток — напоминания уже там.</li>
    </ol>
    <button class="btn block" data-copy="${esc(url)}#sync=">Скопировать адрес</button>
    </details>
    <label>Название команды синхронизации</label>
    <input id="syncName" value="${esc(state.syncShortcut)}">
    <button class="btn block" data-sync>${ic('refresh', 16)} Обновить сейчас</button>
  </div>

  <h2>Отмечать выполненное в Напоминаниях</h2>
  <div class="card small">
    <div class="switch"><span>Когда отмечаю напоминание в Ростке — закрывать его и в Напоминаниях</span><input type="checkbox" id="writeBack" ${state.writeBack ? 'checked' : ''}></div>
    <details style="margin-top:8px"><summary>Нужна вторая команда «${esc(state.doneShortcut)}»</summary>
    <ol class="steps">
      <li>Новая команда <b>${esc(state.doneShortcut)}</b>.</li>
      <li><b>«Найти напоминания»</b>: «Название» — «является» — <b>Входные данные команды</b>; «Выполнено» — «нет»; лимит 1.</li>
      <li><b>«Изменить напоминание»</b> (в некоторых версиях iOS — «Задать параметр напоминания») → <b>Выполнено</b> → вкл.</li>
    </ol>
    <p class="muted">Росток запустит её сам и вернётся обратно.</p>
    </details>
    <label>Название команды</label>
    <input id="doneName" value="${esc(state.doneShortcut)}">
  </div>

  <h2>Когда открываешь Instagram</h2>
  <div class="card small">
    <details><summary>Автоматизация в «Командах» (3 минуты)</summary>
    <ol class="steps">
      <li>«Команды» → <b>Автоматизация</b> → ＋ → <b>Приложение</b> → Instagram и YouTube → <b>Открыто</b> → <b>Выполнять сразу</b>.</li>
      <li>Действие <b>«Выбрать из меню»</b> с вопросом, например: «Что выберешь сейчас?»</li>
      <li>Пункты: <b>«Открыть Росток»</b> и <b>«Мне правда нужно сюда»</b>.</li>
      <li>Под «Открыть Росток» — <b>«Открыть URL-адреса»</b>: <code>${esc(url)}?from=insta</code></li>
      <li>Под «Мне правда нужно сюда» — ничего: останешься в приложении.</li>
    </ol>
    <button class="btn block" data-copy="${esc(url)}?from=insta">Скопировать адрес</button>
    </details>
    <details style="margin-top:6px"><summary>Instagram и YouTube в браузере</summary>
    <ol class="steps">
      <li><b>Настройки → Экранное время → Лимиты приложений → Добавить лимит</b>.</li>
      <li>Раздел <b>Веб-сайты</b>: добавь <code>instagram.com</code> и <code>youtube.com</code>, например на 20 минут в день.</li>
      <li>Задай <b>код-пароль Экранного времени</b> и попроси кого-нибудь его придумать.</li>
    </ol>
    </details>
  </div>

  <h2>Профиль и данные</h2>
  <div class="card">
    <label>Как к тебе обращаться</label>
    <input id="nameInput" value="${esc(state.name)}" maxlength="30">
    <button class="btn block" data-export>Сохранить копию данных</button>
    <button class="btn block" data-import>Загрузить копию</button>
    <input type="file" id="importFile" accept="application/json,.json" class="hidden">
    <button class="btn danger block" data-reset>Удалить все данные</button>
    <p class="muted small" style="margin-top:10px">Всё хранится только на этом телефоне. Раз в неделю-две сохраняй копию в Файлы.</p>
  </div>
  <p class="muted small center" style="margin-top:20px">Если тяжесть и бессилие держатся неделями — сходи к психологу или врачу. Выгорание лечится.</p>`;
}

// ---------- таймер ----------
let timerIv = null;
function renderTimer() {
  const bar = $('#timerBar');
  clearInterval(timerIv);
  if (!state.timer) { bar.classList.add('hidden'); return; }
  const a = actById(state.timer.aid);
  const upd = () => {
    const sec = Math.floor((Date.now() - state.timer.start) / 1000);
    const t = `${Math.floor(sec / 3600) ? Math.floor(sec / 3600) + ':' : ''}${pad(Math.floor(sec / 60) % 60)}:${pad(sec % 60)}`;
    bar.innerHTML = `<span class="row" style="gap:8px">${a ? ic(a.icon, 18) + esc(a.name) : ''} · ${t}</span><button data-stop>Готово</button>`;
  };
  upd();
  bar.classList.remove('hidden');
  timerIv = setInterval(upd, 1000);
}
function startTimer(aid) {
  if (state.timer) { toast('Таймер уже идёт — сначала заверши его'); return; }
  state.timer = { aid, start: Date.now() };
  closeModal();
  commit('Таймер пошёл. Можно отложить телефон');
}
function stopTimer() {
  const { aid, start } = state.timer;
  const min = Math.max(1, Math.round((Date.now() - start) / 60000));
  state.timer = null; save(); renderTimer();
  logSession(aid, min);
}
function logSession(aid, min, taskId) {
  const a = actById(aid);
  let mood = null;
  openModal(`
    <div class="big-ic">${ic(a.icon, 32)}</div>
    <h2 class="center">${esc(a.name)}</h2>
    <label>Сколько минут</label>
    <input id="logMin" type="number" inputmode="numeric" min="1" max="600" value="${min || a.goal}">
    <label>Как ты себя чувствуешь после</label>
    <div class="moods">${MOODS.map(m => `<button type="button" data-mood="${m.v}">${m.t}</button>`).join('')}</div>
    <label>Что получилось (попадёт в победы)</label>
    <input id="logNote" maxlength="160">
    <button class="btn primary block" id="logSave" style="margin-top:16px">Сохранить</button>
    <button class="btn ghost block" data-close>Отмена</button>`, sheet => {
    $$('[data-mood]', sheet).forEach(b => b.onclick = () => {
      mood = +b.dataset.mood;
      $$('[data-mood]', sheet).forEach(x => x.classList.toggle('on', x === b));
    });
    $('#logSave', sheet).onclick = () => {
      const m = Math.max(1, parseInt($('#logMin').value, 10) || 1);
      const note = $('#logNote').value.trim();
      state.sessions.push({ id: uid(), aid, date: today(), min: m, mood, note, at: Date.now() });
      closeModal();
      const s = actStats(aid);
      const passed = MILESTONES.find(x => s.total >= x && s.total - m < x);
      if (taskId) completeTask(state.tasks.find(x => x.id === taskId), true);
      commit(passed ? `${a.name}: уже ${fmtMin(passed)}. Дальше — больше` : `+${fmtMin(m)} · всего ${fmtMin(s.total)}`);
    };
  });
}

// ---------- дела ----------
function completeTask(t, silent) {
  t.done = true; t.doneDate = today();
  navigator.vibrate?.(20);
  if (t.src === 'rem' && state.writeBack) { save(); runShortcut(state.doneShortcut, t.text); return; }
  if (!silent) commit('Готово');
}
function shiftOverdue() {
  const now = nowMin();
  let cur = Math.ceil((now + 5) / 15) * 15;
  const overdue = todayTasks().filter(t => !t.done && t.time && toMin(t.time) + (t.dur || 30) <= now).sort((a, b) => a.time.localeCompare(b.time));
  for (const t of overdue) {
    if (cur >= 24 * 60) { t.date = dkey(addDays(new Date(), 1)); t.time = ''; t.part = 'morning'; continue; }
    t.time = fromMin(cur); t.localTime = true; t.calSent = false;
    cur += (t.dur || 30) + 10; // 10 минут на передышку между делами
  }
  commit('Сдвинула. Можно выдохнуть');
}
function editTask(id, q, preset = {}) {
  const t = id ? state.tasks.find(x => x.id === id) : { text: '', q: +q || 2, date: today(), time: '', part: '', dur: '', aid: '', ...preset };
  const tomorrow = dkey(addDays(new Date(), 1));
  let when = t.time ? 'exact' : (t.part || 'none');
  openModal(`
    <h2>${id ? 'Дело' : 'Новое дело'}</h2>
    ${t.src === 'rem' ? `<p class="muted small">${ic('list', 14)} Из Напоминаний${t.list ? ` · ${esc(t.list)}` : ''}</p>` : ''}
    <form id="taskForm">
      <label>Что сделать</label>
      <input name="text" value="${esc(t.text)}" required maxlength="100" ${t.src === 'rem' ? 'readonly' : ''}>
      <label>Квадрат</label>
      <select name="q">${t.src === 'rem' && !t.q ? '<option value="0" selected>Ещё не решила</option>' : ''}${[1, 2, 3, 4].map(n => `<option value="${n}" ${t.q === n ? 'selected' : ''}>${QUADS[n].name} — ${QUADS[n].sub}</option>`).join('')}</select>
      <label>Занятие (время засчитается)</label>
      <select name="aid"><option value="">—</option>${liveActs().map(a => `<option value="${a.id}" ${t.aid === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select>
      <label>День</label>
      <div class="seg" id="daySeg">
        <button type="button" data-d="${today()}" class="${!t.date || t.date <= today() ? 'on' : ''}">Сегодня</button>
        <button type="button" data-d="${tomorrow}" class="${t.date === tomorrow ? 'on' : ''}">Завтра</button></div>
      <label>Когда</label>
      <div class="seg" id="whenSeg">
        ${[['none', 'Любое'], ['morning', 'Утро'], ['day', 'День'], ['evening', 'Вечер'], ['exact', 'Точно']].map(([k, n]) => `<button type="button" data-w="${k}" class="${when === k ? 'on' : ''}">${n}</button>`).join('')}</div>
      <div class="row" style="align-items:flex-end">
        <div class="grow ${when === 'exact' ? '' : 'hidden'}" id="timeBox"><label>Время</label><input name="time" type="time" value="${esc(t.time || '')}"></div>
        <div class="grow"><label>Минут</label><input name="dur" type="number" inputmode="numeric" min="5" max="600" step="5" value="${t.dur || ''}"></div>
      </div>
      <button class="btn primary block" type="submit" style="margin-top:16px">Сохранить</button>
      ${id && t.time && t.src !== 'rem' ? `<button class="btn block" type="button" data-cal-task="${id}">${ic('bell', 16)} ${t.calSent ? 'Ещё раз в Календарь' : 'Поставить напоминание в Календарь'}</button>` : ''}
      ${id && t.src !== 'rem' ? `<button class="btn danger block" type="button" data-del-task="${id}">Удалить</button>` : ''}
      <button class="btn ghost block" type="button" data-close>Отмена</button>
    </form>`, sheet => {
    const form = $('#taskForm', sheet);
    let date = !t.date || t.date <= today() ? today() : t.date;
    $$('#daySeg button', sheet).forEach(b => b.onclick = () => { date = b.dataset.d; $$('#daySeg button', sheet).forEach(x => x.classList.toggle('on', x === b)); });
    $$('#whenSeg button', sheet).forEach(b => b.onclick = () => {
      when = b.dataset.w;
      $$('#whenSeg button', sheet).forEach(x => x.classList.toggle('on', x === b));
      $('#timeBox', sheet).classList.toggle('hidden', when !== 'exact');
      if (when === 'exact' && !form.time.value) form.time.value = fromMin(Math.min(23 * 60, Math.ceil((nowMin() + 15) / 30) * 30));
    });
    form.aid.onchange = () => {
      const a = actById(form.aid.value);
      if (a && !form.text.value) form.text.value = a.name;
      if (a && !form.dur.value) form.dur.value = a.goal;
    };
    form.onsubmit = e => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(form));
      const time = when === 'exact' ? f.time : '';
      const data = { text: f.text.trim(), q: +f.q, aid: f.aid, date, time, part: ['morning', 'day', 'evening'].includes(when) ? when : '', dur: f.dur ? +f.dur : null };
      if (id) {
        if (t.time !== time || t.date !== date) data.calSent = false;
        if (t.src === 'rem') { data.localTime = true; state.remQuad[t.key] = data.q; }
        Object.assign(t, data);
      } else state.tasks.push({ id: uid(), done: false, doneDate: null, ...data });
      closeModal();
      commit(data.time && t.src !== 'rem' ? 'Сохранено. Чтобы пришло уведомление — отправь в Календарь' : 'Сохранено');
    };
  });
}
function editAct(id) {
  const a = id ? actById(id) : { name: '', icon: 'star', cat: 'restore', goal: 20 };
  let icon = a.icon;
  const dayNames = [['MO', 'Пн'], ['TU', 'Вт'], ['WE', 'Ср'], ['TH', 'Чт'], ['FR', 'Пт'], ['SA', 'Сб'], ['SU', 'Вс']];
  openModal(`
    <h2>${id ? 'Настроить занятие' : 'Новое занятие'}</h2>
    <form id="actForm">
      <label>Название</label>
      <input name="name" value="${esc(a.name)}" required maxlength="40">
      <label>Иконка</label>
      <div class="iconpick">${ACT_ICONS.map(k => `<button type="button" data-ic="${k}" class="${k === icon ? 'on' : ''}">${ic(k, 22)}</button>`).join('')}</div>
      <label>Тип</label>
      <select name="cat">${Object.entries(CATS).map(([k, c]) => `<option value="${k}" ${a.cat === k ? 'selected' : ''}>${c.name} — ${c.hint}</option>`).join('')}</select>
      <label>Обычно занимаюсь, минут</label>
      <input name="goal" type="number" inputmode="numeric" min="5" max="600" step="5" value="${a.goal}">
      <button class="btn primary block" type="submit" style="margin-top:16px">Сохранить</button>
    </form>
    ${id ? `
    <h2>Регулярное напоминание</h2>
    <p class="muted small">Повторяющееся событие в Календаре iPhone — он сам будет напоминать.</p>
    <label>Время</label><input id="recTime" type="time" value="${a.cat === 'job' ? '11:00' : '19:00'}">
    <label>Дни</label>
    <div class="pills" id="recDays">${dayNames.map(([k, n], i) => `<button type="button" class="pill ${a.cat === 'job' ? (i < 5 ? 'on' : '') : (i % 2 === 0 ? 'on' : '')}" data-rd="${k}">${n}</button>`).join('')}</div>
    <button class="btn block" id="recAdd" style="margin-top:10px">${ic('bell', 16)} Добавить в Календарь</button>
    <button class="btn danger block" data-del-act="${id}">Убрать занятие</button>` : ''}
    <button class="btn ghost block" data-close>Закрыть</button>`, sheet => {
    $$('[data-ic]', sheet).forEach(b => b.onclick = () => { icon = b.dataset.ic; $$('[data-ic]', sheet).forEach(x => x.classList.toggle('on', x === b)); });
    $('#actForm', sheet).onsubmit = e => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      f.goal = Math.max(5, parseInt(f.goal, 10) || 20);
      f.icon = icon;
      if (id) Object.assign(a, f); else state.acts.push({ id: uid(), ...f });
      closeModal(); commit('Сохранено');
    };
    $$('[data-rd]', sheet).forEach(b => b.onclick = () => b.classList.toggle('on'));
    const rec = $('#recAdd', sheet);
    if (rec) rec.onclick = () => {
      const byday = $$('[data-rd].on', sheet).map(b => b.dataset.rd);
      if (!byday.length) { toast('Выбери хотя бы один день'); return; }
      openIcs([icsEvent({
        title: a.name, date: today(), time: $('#recTime').value || '19:00', dur: a.goal,
        rrule: `FREQ=WEEKLY;BYDAY=${byday.join(',')}`,
        note: a.cat === 'job' ? 'Даже 20 минут сдвигают дело. Отметь в Ростке, когда закончишь.' : 'Это время для тебя. Отметь в Ростке, как себя чувствуешь после.',
      })], 'rostok.ics');
    };
  });
}
function showWelcome() {
  openModal(`
    <div class="big-ic">${ic('leaf', 32)}</div>
    <h2 class="center">Росток</h2>
    <p><b>План дня</b> — матрица Эйзенхауэра или расписание по часам. Поиск работы и хобби живут в квадрате «Запланировать»: его обычно съедают все остальные.</p>
    <p><b>Каждый день подскажу</b> найти время на поиск работы, прогуляться, вернуться к хобби, которое давно забросила, — и покажу, сколько времени ты уже вложила.</p>
    <p><b>Напоминания</b> приходят из твоего Календаря, а дела из Напоминаний подтягиваются сюда. Как это настроить — во вкладке «Ещё».</p>
    <label>Как к тебе обращаться (необязательно)</label><input id="onbName" maxlength="30">
    <button class="btn primary block" data-onb-done>Начать</button>`);
}
function showInsta() {
  const job = liveActs().find(a => a.cat === 'job');
  const jobS = job ? actStats(job.id) : null;
  const restore = liveActs().filter(a => a.cat === 'restore').map(a => ({ a, s: actStats(a.id) }));
  const best = restore.filter(x => x.s.mood).sort((x, y) => y.s.mood - x.s.mood)[0]
    || [...restore].sort((x, y) => (y.s.since ?? 999) - (x.s.since ?? 999))[0];
  const walk = actById('walk');
  const saidNo = state.insta.filter(i => i.choice !== 'scroll').length;
  const opt = (icon, title, sub, attrs) => `<button class="option" ${attrs}><span class="ico">${ic(icon, 24)}</span><span><b>${title}</b><span class="muted">${sub}</span></span></button>`;
  openModal(`
    <div class="big-ic">${ic('eye', 30)}</div>
    <h2 class="center">Ты собиралась в ленту</h2>
    <p class="center muted small">Мозг устал и ищет отдых — это нормально. Но есть отдых, после которого не болит голова.</p>
    ${best ? opt(best.a.icon, `${esc(best.a.name)} · ${fmtMin(Math.min(15, best.a.goal))}`, best.s.mood ? `После этого тебе обычно ${moodText(best.s.mood)}` : best.s.since ? `Не было уже ${days(best.s.since)}` : 'Попробуй — вдруг понравится', `data-insta="start" data-aid="${best.a.id}"`) : ''}
    ${walk && !walk.archived && best?.a.id !== 'walk' ? opt('walk', 'Прогуляться 15 минут', 'Воздух снимает головную боль лучше ленты', 'data-insta="start" data-aid="walk"') : ''}
    ${job && jobS.todayMin < job.goal ? opt(job.icon, `${esc(job.name)} · 20 минут`, jobS.todayMin ? `Сегодня уже ${fmtMin(jobS.todayMin)}` : 'Сегодня ещё не было', `data-insta="start" data-aid="${job.id}"`) : ''}
    ${opt('calendar', 'Посмотреть план дня', 'Что важного на сегодня', 'data-insta="plan"')}
    <button class="btn ghost block" data-insta="scroll" style="margin-top:14px">Всё равно полистаю 10 минут</button>
    ${saidNo ? `<p class="center muted small">Ты уже ${saidNo} ${plural(saidNo, 'раз', 'раза', 'раз')} выбрала не ленту</p>` : ''}`);
}

// ---------- обработка нажатий ----------
document.addEventListener('click', e => {
  const t = e.target.closest('button, [data-task]');
  if (!t) return;
  const ds = t.dataset;

  if (ds.toggle) {
    const task = state.tasks.find(x => x.id === ds.toggle);
    if (task.done) { task.done = false; task.doneDate = null; commit(); return; }
    if (task.aid && actById(task.aid)) { logSession(task.aid, task.dur, task.id); return; }
    completeTask(task); return;
  }
  if (ds.setq) {
    const task = state.tasks.find(x => x.id === ds.setq);
    task.q = +ds.q; if (task.key) state.remQuad[task.key] = task.q;
    commit(); return;
  }
  if (ds.task) return editTask(ds.task);
  if (ds.addTask) return editTask(null, ds.addTask);
  if (ds.addAt) return editTask(null, 2, { time: ds.addAt });
  if (ds.addPart) return editTask(null, 2, { part: ds.addPart });
  if (ds.delTask) { state.tasks = state.tasks.filter(x => x.id !== ds.delTask); closeModal(); commit('Удалено'); return; }
  if (ds.calTask) {
    const task = state.tasks.find(x => x.id === ds.calTask);
    task.calSent = true; save();
    openIcs([icsEvent({ title: task.text, date: task.date && task.date > today() ? task.date : today(), time: task.time, dur: task.dur })], 'rostok.ics');
    return;
  }
  if ('calDay' in ds) {
    const pend = calPending();
    pend.forEach(x => { x.calSent = true; });
    save(); render();
    openIcs(pend.map(x => icsEvent({ title: x.text, date: x.date && x.date > today() ? x.date : today(), time: x.time, dur: x.dur })), 'rostok-day.ics');
    return;
  }
  if (ds.pv) { state.planView = ds.pv; commit(); return; }
  if (ds.sm) { state.schedMode = ds.sm; commit(); return; }
  if ('shift' in ds) return shiftOverdue();
  if ('moreNudges' in ds) { showAllNudges = !showAllNudges; render(); return; }
  if ('sync' in ds) { runShortcut(state.syncShortcut); return; }
  if (ds.planAct) {
    const a = actById(ds.planAct);
    return editTask(null, 2, { text: a.name, aid: a.id, dur: a.goal, part: a.cat === 'job' ? 'morning' : 'evening' });
  }
  if (ds.start) return startTimer(ds.start);
  if ('stop' in ds) return stopTimer();
  if (ds.log) return logSession(ds.log);
  if (ds.editAct) return editAct(ds.editAct);
  if ('addAct' in ds) return editAct(null);
  if (ds.delAct) {
    if (confirm('Убрать занятие? Вложенное время останется в истории.')) { actById(ds.delAct).archived = true; closeModal(); commit('Убрано'); }
    return;
  }
  if (ds.delWin) { state.wins = state.wins.filter(w => w.id !== ds.delWin); commit(); return; }

  if (ds.insta) {
    state.insta.push({ at: Date.now(), choice: ds.insta });
    if (ds.insta === 'start') return startTimer(ds.aid);
    if (ds.insta === 'plan') { state.tab = 'plan'; closeModal(); commit(); return; }
    if (ds.insta === 'scroll') {
      save();
      openModal(`<div class="big-ic">${ic('timer', 30)}</div><h2 class="center">Хорошо, без вины</h2>
        <p class="center">Скажи Siri: <b>«Таймер на 10 минут»</b> — и листай спокойно.</p>
        <p class="center muted small">Когда прозвенит, вспомни: голова болит не от отдыха, а от бесконечной ленты.</p>
        <button class="btn primary block" data-close>Поняла</button>`);
    }
    return;
  }
  if (ds.copy) {
    navigator.clipboard?.writeText(ds.copy).then(() => toast('Скопировано'), () => toast('Не получилось — выдели адрес вручную'));
    return;
  }
  if ('export' in ds) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
    a.download = `rostok-${today()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    return;
  }
  if ('import' in ds) { $('#importFile').click(); return; }
  if ('onbDone' in ds) {
    const n = $('#onbName')?.value.trim();
    if (n) state.name = n;
    state.onboarded = true; closeModal(); commit(); return;
  }
  if ('reset' in ds) {
    if (confirm('Удалить все данные? Это нельзя отменить.')) { state = defaultState(); save(); render(); showWelcome(); }
  }
});
document.addEventListener('submit', e => {
  if (e.target.id !== 'winForm') return;
  e.preventDefault();
  const v = $('#winInput').value.trim();
  if (!v) return;
  state.wins.push({ id: uid(), date: today(), text: v });
  commit('Записано');
});
document.addEventListener('change', e => {
  const id = e.target.id;
  if (id === 'nameInput') { state.name = e.target.value.trim(); save(); toast('Запомнила'); }
  if (id === 'syncName') { state.syncShortcut = e.target.value.trim() || 'Росток'; commit(); }
  if (id === 'doneName') { state.doneShortcut = e.target.value.trim() || 'Росток готово'; commit(); }
  if (id === 'writeBack') { state.writeBack = e.target.checked; save(); }
  if (id === 'importFile') {
    const file = e.target.files[0];
    if (!file) return;
    file.text().then(txt => {
      const data = JSON.parse(txt);
      if (!data || !Array.isArray(data.acts)) throw new Error('bad');
      localStorage.setItem(KEY, JSON.stringify(data));
      state = load(); save(); render(); toast('Данные загружены');
    }).catch(() => toast('Не получилось прочитать файл'));
  }
});

// данные из команды «Росток» приходят в адресе после #sync=
function handleHash() {
  const h = location.hash;
  if (!h.startsWith('#sync=')) return false;
  let raw = h.slice(6);
  try { raw = decodeURIComponent(raw); } catch (e) { /* уже раскодировано */ }
  applySync(raw);
  history.replaceState(null, '', location.pathname + location.search);
  return true;
}
window.addEventListener('hashchange', () => { if (handleHash()) render(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && $('#modal').classList.contains('hidden')) render(); });

// ---------- старт ----------
handleHash();
render();
const params = new URLSearchParams(location.search);
if (!state.onboarded) showWelcome();
else if (params.get('from') === 'insta') showInsta();
if (params.has('from')) history.replaceState(null, '', siteUrl());
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
