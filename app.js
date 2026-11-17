'use strict';
/* Росток — план дня по Эйзенхауэру + время на хобби и поиск работы.
   Данные хранятся только на этом устройстве. Напоминания — через Календарь iPhone. */

// ---------- утилиты ----------
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);
const dkey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromKey = k => new Date(k + 'T12:00:00');
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const today = () => dkey();
const daysBetween = (a, b) => Math.round((fromKey(b) - fromKey(a)) / 86400000);
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

// ---------- справочники ----------
const CATS = {
  job:     { name: 'Работа',        hint: 'напоминаю каждый день' },
  restore: { name: 'Восстановление', hint: 'хобби и антистресс' },
  grow:    { name: 'Развитие',      hint: 'тело и ум' },
};
const MOODS = [
  { v: 1, e: '😣', t: 'Хуже' },
  { v: 2, e: '😐', t: 'Так же' },
  { v: 3, e: '🙂', t: 'Лучше' },
  { v: 4, e: '😊', t: 'Намного лучше' },
];
const QUADS = {
  1: { name: '🔥 Срочно и важно', sub: 'Сделать сегодня' },
  2: { name: '🌱 Важно, но не срочно', sub: 'Поиск работы, хобби, здоровье. Этот квадрат съедают все остальные, поэтому планируй его первым' },
  3: { name: '⚡ Срочно, не важно', sub: 'Быстро или попросить' },
  4: { name: '🍃 Не важно и не срочно', sub: 'Можно отпустить' },
};
const MILESTONES = [60, 180, 300, 600, 1200, 1800, 3000, 6000, 12000];

const DEFAULT_ACTS = [
  { id: 'job',   name: 'Поиск работы',    emoji: '💼', cat: 'job',     goal: 30 },
  { id: 'video', name: 'Монтаж видео',    emoji: '🎬', cat: 'restore', goal: 30 },
  { id: 'knit',  name: 'Вязание',         emoji: '🧶', cat: 'restore', goal: 20 },
  { id: 'walk',  name: 'Прогулка',        emoji: '🚶‍♀️', cat: 'restore', goal: 20 },
  { id: 'read',  name: 'Чтение',          emoji: '📖', cat: 'restore', goal: 20 },
  { id: 'morn',  name: 'Зарядка',         emoji: '🤸', cat: 'grow',    goal: 10 },
  { id: 'gym',   name: 'Силовая',         emoji: '🏋️', cat: 'grow',    goal: 40 },
  { id: 'eng',   name: 'Английский',      emoji: '🇬🇧', cat: 'grow',    goal: 20 },
];

// ---------- состояние ----------
const KEY = 'rostok-v2';
function defaultState() {
  return {
    version: 2, name: '', onboarded: false, tab: 'plan',
    acts: DEFAULT_ACTS.map(a => ({ ...a })),
    sessions: [],   // {id, aid, date, min, mood, note, at}
    tasks: [],      // {id, text, q, date, time, dur, aid, done, doneDate}
    wins: [],       // {id, date, text}
    insta: [],      // {at, choice}
    timer: null,    // {aid, start}
  };
}
let state = load();
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaultState(), ...JSON.parse(raw) };
  } catch (e) { /* начинаем с чистого листа */ }
  return defaultState();
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { toast('Не получилось сохранить 😔'); }
}
const actById = id => state.acts.find(a => a.id === id);
const liveActs = () => state.acts.filter(a => !a.archived);

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
  const lastMood = [...ss].reverse().find(s => s.mood)?.mood || null;
  // серия: подряд идущие дни с занятием
  const dates = new Set(ss.map(s => s.date));
  let streak = 0, d = new Date();
  if (!dates.has(dkey(d))) d = addDays(d, -1);
  while (dates.has(dkey(d))) { streak++; d = addDays(d, -1); }
  return { count: ss.length, total, week, todayMin, last, since, mood, moodN: moods.length, lastMood, streak };
}
const moodFace = m => MOODS[Math.min(3, Math.max(0, Math.round(m) - 1))].e;
const nextMilestone = total => MILESTONES.find(m => m > total) || Math.ceil((total + 1) / 6000) * 6000;

// ---------- подсказки дня ----------
function nudges() {
  const out = [];
  const hour = new Date().getHours();

  // 1. Поиск работы — каждый день
  for (const a of liveActs().filter(a => a.cat === 'job')) {
    const s = actStats(a.id);
    const planned = state.tasks.some(t => t.aid === a.id && t.date === today() && !t.done);
    if (s.todayMin >= a.goal) {
      out.push({ e: '✅', html: `<b>${esc(a.name)} сегодня: ${fmtMin(s.todayMin)}.</b> Всего ты уже вложила ${fmtMin(s.total)}. Дальше — больше!` });
    } else if (s.todayMin > 0) {
      out.push({ e: a.emoji, html: `<b>${esc(a.name)}: уже ${fmtMin(s.todayMin)} сегодня.</b> До цели ${fmtMin(a.goal - s.todayMin)}. Добьёшь?`, aid: a.id });
    } else {
      const tail = s.since == null ? 'Начни с малого: открой 3 вакансии и сохрани одну.'
        : s.since === 1 ? 'Вчера ты это делала — продолжай, пока есть инерция.'
        : `Последний раз — ${days(s.since)} назад. Даже 20 минут сдвинут дело.`;
      out.push({ e: a.emoji, html: `<b>Найди сегодня ${fmtMin(a.goal)} на ${esc(a.name.toLowerCase())}.</b> ${tail}`, aid: a.id, plan: !planned });
    }
  }

  // 2. Давно не было восстанавливающего занятия
  const restore = liveActs().filter(a => a.cat === 'restore').map(a => ({ a, s: actStats(a.id) }));
  const neglected = restore.filter(x => x.s.since !== null && x.s.since >= 3).sort((x, y) => y.s.since - x.s.since)[0];
  if (neglected) {
    const { a, s } = neglected;
    const moodTxt = s.mood ? ` Обычно после этого тебе ${s.mood >= 3.5 ? 'намного лучше' : s.mood >= 2.5 ? 'лучше' : 'чуть спокойнее'} ${moodFace(s.mood)}.` : '';
    out.push({ e: a.emoji, html: `<b>${esc(a.name)}: ${days(s.since)} перерыва.</b>${moodTxt} От этого правда станет легче — может, ${fmtMin(a.goal)} сегодня?`, aid: a.id, plan: true });
  } else {
    const never = restore.filter(x => x.s.count === 0);
    if (never.length) {
      const { a } = pick(never);
      out.push({ e: a.emoji, html: `<b>${esc(a.name)}</b> ещё ни разу не было отмечено. Попробуй ${fmtMin(Math.min(15, a.goal))} — просто посмотреть, как ощущается.`, aid: a.id, plan: true });
    }
  }

  // 3. Прогулка
  const walk = liveActs().find(a => a.id === 'walk' && !a.archived);
  if (walk && hour >= 9 && hour < 21 && !actStats(walk.id).todayMin) {
    out.push({ e: '🚶‍♀️', html: '<b>Прогуляйся 15 минут.</b> Можно до магазина и обратно. Телефон — в карман, не в руку.', aid: walk.id });
  }

  // 4. Набранный темп
  const momentum = liveActs().map(a => ({ a, s: actStats(a.id) })).filter(x => x.s.week > 0 && x.a.cat !== 'job').sort((x, y) => y.s.week - x.s.week)[0];
  if (momentum) {
    const { a, s } = momentum, next = nextMilestone(s.total);
    out.push({ e: '📈', html: `<b>${esc(a.name)}: ${fmtMin(s.total)} всего, ${fmtMin(s.week)} за неделю.</b> До отметки «${fmtMin(next)}» осталось ${fmtMin(next - s.total)}. Дальше — больше!` });
  }

  // 5. Вспомнить победу
  const old = allWins().filter(w => daysBetween(w.date, today()) >= 2);
  if (old.length) {
    const w = pick(old);
    out.push({ e: '💚', cls: 'memory', html: `<b>Помнишь?</b> ${fmtDate(w.date)}: «${esc(w.text)}». Ты это уже умеешь.` });
  }
  return out;
}

// ---------- победы ----------
function allWins() {
  const fromSessions = state.sessions.filter(s => s.note).map(s => {
    const a = actById(s.aid);
    return { id: s.id, date: s.date, text: `${a ? a.emoji + ' ' : ''}${s.note}`, auto: true };
  });
  return [...state.wins, ...fromSessions].sort((a, b) => (a.date < b.date ? 1 : -1));
}

// ---------- календарь (.ics) ----------
const icsEsc = s => String(s).replace(/\\/g, '\\\\').replace(/[,;]/g, m => '\\' + m).replace(/\n/g, '\\n');
const icsDT = (k, hm) => k.replace(/-/g, '') + 'T' + hm.replace(':', '') + '00';
function icsEvent({ title, date, time, dur, rrule, note }) {
  const start = new Date(`${date}T${time}:00`);
  const end = new Date(start.getTime() + (dur || 30) * 60000);
  const endKey = dkey(end), endHM = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  return [
    'BEGIN:VEVENT',
    `UID:${uid()}-${Date.now()}@rostok`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${icsDT(date, time)}`,
    `DTEND:${icsDT(endKey, endHM)}`,
    rrule ? `RRULE:${rrule}` : null,
    `SUMMARY:${icsEsc(title)}`,
    note ? `DESCRIPTION:${icsEsc(note)}` : null,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(title)}`, 'TRIGGER:-PT0M', 'END:VALARM',
    'END:VEVENT',
  ].filter(Boolean).join('\r\n');
}
function openIcs(events, filename) {
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Rostok//RU', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR'].join('\r\n');
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS) {
    // Safari на iPhone открывает окно «Добавить в Календарь»
    location.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
  } else {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
}
const taskTitle = t => { const a = actById(t.aid); return a && !t.text.includes(a.emoji) ? `${a.emoji} ${t.text}` : t.text; };

// ---------- тосты и модалки ----------
function toast(text) {
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = text;
  const box = $('#toasts');
  while (box.children.length >= 2) box.firstChild.remove();
  box.appendChild(el);
  setTimeout(() => el.remove(), 2600);
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
$$('.tabs button').forEach(b => b.addEventListener('click', () => { state.tab = b.dataset.tab; save(); render(); window.scrollTo(0, 0); }));
function render() {
  $$('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === state.tab));
  const views = { plan: viewPlan, acts: viewActs, wins: viewWins, more: viewMore };
  $('#screen').innerHTML = (views[state.tab] || viewPlan)();
  renderTimer();
}
function commit(msg) { save(); render(); if (msg) toast(msg); }

// ---------- экран «План» ----------
function greeting() {
  const h = new Date().getHours(), name = state.name ? `, ${esc(state.name)}` : '';
  if (h < 6) return `Доброй ночи${name}`;
  if (h < 12) return `Доброе утро${name}`;
  if (h < 18) return `Добрый день${name}`;
  return `Добрый вечер${name}`;
}
function visibleTasks(q) {
  const t = today();
  return state.tasks
    .filter(x => x.q === q && ((x.done && x.doneDate === t) || (!x.done && (!x.date || x.date <= t))))
    .sort((a, b) => (a.done - b.done) || (a.time || '99').localeCompare(b.time || '99'));
}
function taskHtml(t) {
  const meta = [t.time, t.dur ? fmtMin(t.dur) : null, (!t.done && t.date && t.date < today()) ? 'перенесено' : null].filter(Boolean).join(' · ');
  return `<div class="task ${t.done ? 'done' : ''}">
    <button class="chk" data-toggle="${t.id}" aria-label="Готово">${t.done ? '✓' : ''}</button>
    <span class="t" data-task="${t.id}">${esc(taskTitle(t))}${meta ? `<span class="meta">${esc(meta)}</span>` : ''}</span>
  </div>`;
}
function viewPlan() {
  const tasksToday = state.tasks.filter(t => t.doneDate === today()).length;
  const instaToday = state.insta.filter(i => dkey(new Date(i.at)) === today() && i.choice !== 'scroll').length;
  const timed = state.tasks.filter(t => !t.done && t.time && (t.date || today()) <= today());
  let html = `
  <h1>${greeting()}</h1>
  <div class="muted">${new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
    ${tasksToday ? ` · сделано ${tasksToday}` : ''}${instaToday ? ` · ${instaToday}× выбрала не ленту` : ''}</div>

  <h2>Подсказки на сегодня</h2>`;
  for (const n of nudges()) {
    html += `<div class="card nudge ${n.cls || ''}"><div class="e">${n.e}</div><div>${n.html}
      ${n.aid ? `<div class="acts">
        <button class="btn primary" data-start="${n.aid}">▶ Начать</button>
        ${n.plan ? `<button class="btn" data-plan-act="${n.aid}">🗓️ Запланировать</button>` : ''}
      </div>` : ''}</div></div>`;
  }

  html += `<h2>Матрица дня</h2><div class="matrix">`;
  for (const q of [1, 3, 2, 4]) {
    const ts = visibleTasks(q);
    html += `<div class="quad q${q}"><h4>${QUADS[q].name}</h4><div class="sub">${QUADS[q].sub}</div>
      ${ts.map(taskHtml).join('') || (q === 2 ? '<div class="muted small">Пусто. Добавь сюда хотя бы одно дело для себя.</div>' : '')}
      <button class="add" data-add-task="${q}">＋ добавить</button></div>`;
  }
  html += `</div>`;
  html += `<button class="btn ${timed.length ? 'primary' : ''} block" style="margin-top:12px" data-cal-day ${timed.length ? '' : 'disabled'}>
    📅 Отправить дела со временем в Календарь${timed.length ? ` (${timed.length})` : ''}</button>
    <p class="muted small center">Календарь сам напомнит тебе в нужное время — даже если ты в Instagram.</p>`;
  return html;
}

// ---------- экран «Занятия» ----------
function viewActs() {
  const stats = liveActs().map(a => ({ a, s: actStats(a.id) }));
  const ranked = stats.filter(x => x.s.moodN >= 1).sort((x, y) => (y.s.mood - x.s.mood) || (y.s.total - x.s.total));
  const byTime = stats.filter(x => x.s.total > 0).sort((x, y) => y.s.total - x.s.total);
  let html = `<h1>Занятия</h1><p class="muted">Сколько времени ты уже вложила и что тебе помогает больше всего.</p>`;

  html += `<h2>Что помогает тебе больше всего</h2><div class="card">`;
  if (ranked.length) {
    html += ranked.map((x, i) => `<div class="rank"><span class="n">${i + 1}</span><span style="font-size:22px">${x.a.emoji}</span>
      <span>${esc(x.a.name)}<div class="muted small">после занятия обычно: ${moodFace(x.s.mood)} · ${x.s.moodN} ${plural(x.s.moodN, 'оценка', 'оценки', 'оценок')}</div></span>
      <span class="muted small">${fmtMin(x.s.total)}</span></div>`).join('');
    html += `<p class="muted small" style="margin-top:6px">Рейтинг строится из твоих ответов «как ты после занятия». Когда плохо — выбирай что-то из верхних строк.</p>`;
  } else {
    html += `<p class="muted">После каждого занятия я спрошу, как ты себя чувствуешь. Через несколько раз здесь появится рейтинг того, что помогает именно тебе.</p>`;
  }
  html += `</div>`;

  if (byTime.length) {
    const sum = byTime.reduce((s, x) => s + x.s.total, 0);
    html += `<div class="card soft"><div class="row between"><b>Всего вложено в себя</b><b>${fmtMin(sum)}</b></div>
      ${byTime.slice(0, 4).map(x => `<div class="row between small"><span>${x.a.emoji} ${esc(x.a.name)}</span><span>${fmtMin(x.s.total)}</span></div>`).join('')}</div>`;
  }

  for (const cat of Object.keys(CATS)) {
    const list = stats.filter(x => x.a.cat === cat);
    if (!list.length) continue;
    html += `<h2>${CATS[cat].name} <span class="muted small">· ${CATS[cat].hint}</span></h2>`;
    for (const { a, s } of list) {
      const sinceTxt = s.since === null ? 'ещё не было' : s.since === 0 ? 'сегодня' : s.since === 1 ? 'вчера' : `${days(s.since)} назад`;
      const warn = s.since !== null && s.since >= 5;
      html += `<div class="card act">
        <div class="emo">${a.emoji}</div>
        <div><b>${esc(a.name)}</b>
          <div class="nums">Всего ${fmtMin(s.total)} · неделя ${fmtMin(s.week)}${s.streak > 1 ? ` · 🔥 ${s.streak} ${plural(s.streak, 'день', 'дня', 'дней')} подряд` : ''}</div>
          <div class="nums ${warn ? 'warn' : ''}">Последний раз: ${sinceTxt}</div></div>
        <button class="iconbtn" data-edit-act="${a.id}" aria-label="Настроить">✏️</button>
        <div class="btns">
          <button class="btn primary" data-start="${a.id}">▶ Таймер</button>
          <button class="btn" data-log="${a.id}">＋ Уже сделала</button>
        </div></div>`;
    }
  }
  html += `<button class="btn ghost block" data-add-act>＋ Новое занятие</button>`;
  return html;
}

// ---------- экран «Победы» ----------
function viewWins() {
  const wins = allWins();
  const t = today();
  const memories = [7, 14, 30, 90, 365].map(n => {
    const k = dkey(addDays(new Date(), -n));
    const w = wins.filter(x => x.date === k);
    const ss = state.sessions.filter(s => s.date === k);
    return { n, k, w, min: ss.reduce((a, s) => a + s.min, 0) };
  }).filter(m => m.w.length || m.min);
  const week = state.sessions.filter(s => s.date >= dkey(addDays(new Date(), -6)));
  let html = `<h1>Маленькие победы</h1>
  <p class="muted">Ответила на письмо, вышла на улицу, поела нормально — это считается. Мозг при выгорании забывает хорошее, поэтому записываем.</p>
  <form class="row" id="winForm" style="margin:12px 0">
    <input id="winInput" placeholder="Что получилось сегодня?" maxlength="160" autocomplete="off">
    <button class="btn primary" type="submit">＋</button>
  </form>
  <div class="card soft"><div class="row between"><span>За 7 дней занятий</span><b>${week.length}, ${fmtMin(week.reduce((a, s) => a + s.min, 0))}</b></div>
  <div class="row between"><span>Всего побед записано</span><b>${wins.length}</b></div></div>`;
  if (memories.length) {
    html += `<h2>В этот день раньше</h2>`;
    for (const m of memories) {
      const label = m.n === 7 ? 'Неделю назад' : m.n === 14 ? 'Две недели назад' : m.n === 30 ? 'Месяц назад' : m.n === 90 ? 'Три месяца назад' : 'Год назад';
      html += `<div class="card memory"><b>${label}</b> <span class="muted small">${fmtDate(m.k)}</span>
        ${m.min ? `<div class="small">Занималась собой ${fmtMin(m.min)}</div>` : ''}
        ${m.w.map(w => `<div>• ${esc(w.text)}</div>`).join('')}</div>`;
    }
  }
  html += `<h2>Все победы</h2>`;
  if (!wins.length) html += `<p class="muted">Пока пусто. Начни с самой маленькой.</p>`;
  let cur = '';
  for (const w of wins.slice(0, 200)) {
    if (w.date !== cur) { cur = w.date; html += `<div class="muted small" style="margin:12px 0 4px">${w.date === t ? 'Сегодня' : fmtDate(w.date)}</div>`; }
    html += `<div class="card" style="padding:10px 14px;margin-bottom:6px"><div class="row between"><span>${esc(w.text)}</span>
      ${w.auto ? '' : `<button class="iconbtn small" data-del-win="${w.id}" aria-label="Удалить">✕</button>`}</div></div>`;
  }
  return html;
}

// ---------- экран «Ещё» ----------
function siteUrl() { return location.href.split('?')[0].split('#')[0]; }
function viewMore() {
  const url = siteUrl() + '?from=insta';
  return `<h1>Настройки и помощь</h1>

  <h2>📵 Когда открываешь Instagram</h2>
  <div class="card">
    <p>Ты права: в ленте про Росток не вспомнишь. Поэтому пусть iPhone сам остановит тебя на входе.</p>
    <details style="margin-top:8px"><summary>Настроить автоматизацию (3 минуты)</summary>
    <ol class="steps small">
      <li>Открой приложение <b>Команды</b> (Shortcuts) → вкладка <b>Автоматизация</b> → <b>＋</b>.</li>
      <li>Выбери <b>Приложение</b> → Instagram (и YouTube) → <b>Открыто</b> → <b>Выполнять сразу</b> → Далее.</li>
      <li>Добавь действие <b>«Выбрать из меню»</b>. В заголовок напиши: <i>«Ты хотела жить свою жизнь. Что выберешь?»</i></li>
      <li>Пункты меню: <b>«Открыть Росток»</b> и <b>«Мне правда нужно сюда»</b>.</li>
      <li>Под «Открыть Росток» добавь действие <b>«Открыть URL»</b> с адресом:<br><code>${esc(url)}</code></li>
      <li>Под «Мне правда нужно сюда» ничего не добавляй — ты просто останешься в Instagram.</li>
    </ol>
    <button class="btn block" data-copy="${esc(url)}">📋 Скопировать адрес</button>
    <p class="muted small">По этому адресу Росток откроется сразу с предложением, чем заняться вместо ленты.</p>
    </details>
  </div>

  <h2>🌐 Instagram и YouTube в браузере</h2>
  <div class="card">
    <ol class="steps small">
      <li><b>Настройки → Экранное время → Лимиты приложений → Добавить лимит</b>.</li>
      <li>Внизу раздел <b>Веб-сайты</b>: добавь <code>instagram.com</code> и <code>youtube.com</code>.</li>
      <li>Поставь, например, 20 минут в день. После лимита сайт закроется заставкой.</li>
      <li>Чтобы не снимать лимит одним нажатием, задай <b>код-пароль Экранного времени</b> и попроси кого-нибудь его придумать.</li>
    </ol>
  </div>

  <h2>📱 Как держать Росток под рукой</h2>
  <div class="card small">
    <p>В Safari: <b>Поделиться → На экран «Домой»</b>. Поставь иконку туда, где была Instagram.</p>
    <p class="muted">Важно: если при добавлении есть переключатель <b>«Открывать как веб-приложение»</b>, выключи его. Тогда иконка и автоматизация из Команд откроют Росток в одном и том же Safari, и все данные будут в одном месте.</p>
  </div>

  <h2>Профиль и данные</h2>
  <div class="card">
    <label>Как к тебе обращаться?</label>
    <input id="nameInput" value="${esc(state.name)}" placeholder="Имя" maxlength="30">
    <button class="btn block" data-export>💾 Сохранить копию данных</button>
    <button class="btn block" data-import>📂 Загрузить копию</button>
    <input type="file" id="importFile" accept="application/json,.json" class="hidden">
    <button class="btn danger block" data-reset>Удалить все данные</button>
    <p class="muted small" style="margin-top:10px">Всё хранится только на этом телефоне. Раз в неделю-две сохраняй копию в Файлы.</p>
  </div>
  <p class="muted small center" style="margin-top:20px">Если тяжесть и бессилие держатся неделями — сходи к психологу или врачу. Выгорание лечится, и просить помощи — нормально.</p>`;
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
    const t = `${Math.floor(sec / 3600) ? Math.floor(sec / 3600) + ':' : ''}${String(Math.floor(sec / 60) % 60).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
    bar.innerHTML = `<span>${a ? a.emoji + ' ' + esc(a.name) : ''} · ${t}</span><button data-stop>Готово</button>`;
  };
  upd();
  bar.classList.remove('hidden');
  timerIv = setInterval(upd, 1000);
}
function startTimer(aid) {
  if (state.timer) { toast('Таймер уже идёт — сначала заверши его'); return; }
  state.timer = { aid, start: Date.now() };
  closeModal();
  commit('Таймер пошёл. Можно отложить телефон 🌿');
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
    <div class="big-emoji">${a.emoji}</div>
    <h2 class="center">${esc(a.name)}</h2>
    <label>Сколько минут?</label>
    <input id="logMin" type="number" min="1" max="600" value="${min || a.goal}">
    <label>Как ты себя чувствуешь после?</label>
    <div class="moods">${MOODS.map(m => `<button type="button" data-mood="${m.v}"><span>${m.e}</span>${m.t}</button>`).join('')}</div>
    <label>Что получилось? (попадёт в победы)</label>
    <input id="logNote" maxlength="160" placeholder="Например: довязала рукав">
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
      if (taskId) { const t = state.tasks.find(x => x.id === taskId); if (t) { t.done = true; t.doneDate = today(); } }
      closeModal();
      const s = actStats(aid);
      const passed = MILESTONES.find(x => s.total >= x && s.total - m < x);
      commit(passed ? `🎉 ${a.name}: уже ${fmtMin(passed)}! Дальше — больше` : `+${fmtMin(m)} · всего ${fmtMin(s.total)}`);
    };
  });
}

// ---------- формы ----------
function editTask(id, q, preset = {}) {
  const t = id ? state.tasks.find(x => x.id === id) : { text: '', q: +q || 2, date: today(), time: '', dur: '', aid: '', ...preset };
  const tomorrow = dkey(addDays(new Date(), 1));
  openModal(`
    <h2>${id ? 'Дело' : 'Новое дело'}</h2>
    <form id="taskForm">
      <label>Что сделать?</label>
      <input name="text" value="${esc(t.text)}" required maxlength="100" placeholder="Например: откликнуться на 2 вакансии">
      <label>Квадрат</label>
      <select name="q">${[1, 2, 3, 4].map(n => `<option value="${n}" ${t.q === n ? 'selected' : ''}>${QUADS[n].name}</option>`).join('')}</select>
      <label>Связать с занятием (время засчитается)</label>
      <select name="aid"><option value="">—</option>${liveActs().map(a => `<option value="${a.id}" ${t.aid === a.id ? 'selected' : ''}>${a.emoji} ${esc(a.name)}</option>`).join('')}</select>
      <div class="row">
        <div class="grow"><label>Когда</label><select name="date">
          <option value="${today()}" ${!t.date || t.date <= today() ? 'selected' : ''}>Сегодня</option>
          <option value="${tomorrow}" ${t.date === tomorrow ? 'selected' : ''}>Завтра</option></select></div>
        <div class="grow"><label>Во сколько</label><input name="time" type="time" value="${esc(t.time || '')}"></div>
        <div style="width:80px"><label>Минут</label><input name="dur" type="number" min="5" max="600" step="5" value="${t.dur || ''}"></div>
      </div>
      <button class="btn primary block" type="submit" style="margin-top:16px">Сохранить</button>
      ${id && t.time ? `<button class="btn block" type="button" data-cal-task="${id}">📅 Добавить в Календарь</button>` : ''}
      ${id ? `<button class="btn danger block" type="button" data-del-task="${id}">Удалить</button>` : ''}
      <button class="btn ghost block" type="button" data-close>Отмена</button>
    </form>`, sheet => {
    const form = $('#taskForm', sheet);
    form.aid.onchange = () => {
      const a = actById(form.aid.value);
      if (a && !form.text.value) form.text.value = a.name;
      if (a && !form.dur.value) form.dur.value = a.goal;
      if (a && a.cat !== 'job') form.q.value = '2';
    };
    form.onsubmit = e => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(form));
      const data = { text: f.text.trim(), q: +f.q, aid: f.aid, date: f.date, time: f.time, dur: f.dur ? +f.dur : null };
      if (id) Object.assign(t, data); else state.tasks.push({ id: uid(), done: false, doneDate: null, ...data });
      closeModal();
      commit(data.time ? 'Сохранено. Отправь в Календарь, чтобы пришло напоминание' : 'Сохранено');
    };
  });
}
function editAct(id) {
  const a = id ? actById(id) : { name: '', emoji: '⭐', cat: 'restore', goal: 20 };
  const dayNames = [['MO', 'Пн'], ['TU', 'Вт'], ['WE', 'Ср'], ['TH', 'Чт'], ['FR', 'Пт'], ['SA', 'Сб'], ['SU', 'Вс']];
  openModal(`
    <h2>${id ? 'Настроить занятие' : 'Новое занятие'}</h2>
    <form id="actForm">
      <div class="row"><div style="width:70px"><label>Значок</label><input name="emoji" value="${esc(a.emoji)}" maxlength="4"></div>
      <div class="grow"><label>Название</label><input name="name" value="${esc(a.name)}" required maxlength="40"></div></div>
      <label>Тип</label>
      <select name="cat">${Object.entries(CATS).map(([k, c]) => `<option value="${k}" ${a.cat === k ? 'selected' : ''}>${c.name} — ${c.hint}</option>`).join('')}</select>
      <label>Обычно занимаюсь, минут</label>
      <input name="goal" type="number" min="5" max="600" step="5" value="${a.goal}">
      <button class="btn primary block" type="submit" style="margin-top:16px">Сохранить</button>
    </form>
    ${id ? `
    <h2>🔁 Регулярное напоминание</h2>
    <p class="muted small">Добавлю повторяющееся событие в Календарь iPhone — он будет напоминать сам.</p>
    <div class="row"><div class="grow"><label>Время</label><input id="recTime" type="time" value="${a.cat === 'job' ? '11:00' : '19:00'}"></div></div>
    <label>Дни</label>
    <div class="pills" id="recDays">${dayNames.map(([k, n], i) => `<button type="button" class="pill ${a.cat === 'job' ? (i < 5 ? 'on' : '') : (i % 2 === 0 ? 'on' : '')}" data-rd="${k}">${n}</button>`).join('')}</div>
    <button class="btn block" id="recAdd" style="margin-top:10px">📅 Добавить в Календарь</button>
    <button class="btn danger block" data-del-act="${id}">Убрать занятие</button>` : ''}
    <button class="btn ghost block" data-close>Закрыть</button>`, sheet => {
    $('#actForm', sheet).onsubmit = e => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      f.goal = Math.max(5, parseInt(f.goal, 10) || 20);
      if (id) Object.assign(a, f); else state.acts.push({ id: uid(), ...f });
      closeModal(); commit('Сохранено');
    };
    $$('[data-rd]', sheet).forEach(b => b.onclick = () => b.classList.toggle('on'));
    const rec = $('#recAdd', sheet);
    if (rec) rec.onclick = () => {
      const byday = $$('[data-rd].on', sheet).map(b => b.dataset.rd);
      if (!byday.length) { toast('Выбери хотя бы один день'); return; }
      const time = $('#recTime').value || '19:00';
      openIcs([icsEvent({
        title: `${a.emoji} ${a.name}`, date: today(), time, dur: a.goal,
        rrule: `FREQ=WEEKLY;BYDAY=${byday.join(',')}`,
        note: a.cat === 'job' ? 'Даже 20 минут сдвигают дело. Отметь в Ростке, когда закончишь.' : 'Это время для тебя. Отметь в Ростке, как себя чувствуешь после.',
      })], `${a.name}.ics`);
    };
  });
}
function showWelcome() {
  openModal(`
    <div class="big-emoji">🌱</div>
    <h2 class="center">Росток</h2>
    <p><b>План дня по Эйзенхауэру.</b> Поиск работы и хобби живут в квадрате «важно, но не срочно» — его обычно съедают все остальные. Здесь он в центре.</p>
    <p><b>Подсказки каждый день:</b> найти время на поиск работы, прогуляться, вернуться к хобби, которое давно забросила. Плюс сколько времени ты уже вложила.</p>
    <p><b>Напоминания — в твоём Календаре.</b> Дела со временем отправляются туда одной кнопкой, информация не разбросана.</p>
    <p><b>Рейтинг занятий.</b> После занятия отмечаешь, как себя чувствуешь, — и видишь, что помогает именно тебе.</p>
    <p class="muted small">Во вкладке «Ещё» есть инструкция: как сделать, чтобы iPhone предлагал Росток при открытии Instagram.</p>
    <label>Как к тебе обращаться? (необязательно)</label><input id="onbName" maxlength="30" placeholder="Имя">
    <button class="btn primary block" data-onb-done>Начать</button>`);
}
function showInsta() {
  const job = liveActs().find(a => a.cat === 'job');
  const jobS = job ? actStats(job.id) : null;
  const restore = liveActs().filter(a => a.cat === 'restore').map(a => ({ a, s: actStats(a.id) }));
  // что предложить: лучшее по самочувствию, иначе давно забытое
  const best = [...restore].filter(x => x.s.mood).sort((x, y) => y.s.mood - x.s.mood)[0]
    || [...restore].sort((x, y) => (y.s.since ?? 999) - (x.s.since ?? 999))[0];
  const saidNo = state.insta.filter(i => i.choice !== 'scroll').length;
  openModal(`
    <div class="big-emoji">👀</div>
    <h2 class="center">Ты собиралась в ленту</h2>
    <p class="center muted">Это не плохо — мозг устал и ищет отдых. Но есть отдых, после которого не болит голова.</p>
    ${best ? `<button class="option" data-insta="start" data-aid="${best.a.id}"><span class="e">${best.a.emoji}</span><span><b>${esc(best.a.name)} · ${fmtMin(Math.min(15, best.a.goal))}</b>
      <span class="muted small">${best.s.mood ? `После этого тебе обычно ${moodFace(best.s.mood)}` : best.s.since ? `Не было уже ${days(best.s.since)}` : 'Попробуй — вдруг понравится'}</span></span></button>` : ''}
    ${actById('walk') && !actById('walk').archived && best?.a.id !== 'walk' ? `<button class="option" data-insta="start" data-aid="walk"><span class="e">🚶‍♀️</span><span><b>Прогуляться 15 минут</b><span class="muted small">Свежий воздух лучше ленты снимает головную боль</span></span></button>` : ''}
    ${job && jobS.todayMin < job.goal ? `<button class="option" data-insta="start" data-aid="${job.id}"><span class="e">${job.emoji}</span><span><b>${esc(job.name)} · 20 минут</b><span class="muted small">${jobS.todayMin ? `Сегодня уже ${fmtMin(jobS.todayMin)}` : 'Сегодня ещё не было'}</span></span></button>` : ''}
    <button class="option" data-insta="plan"><span class="e">🗓️</span><span><b>Посмотреть план дня</b><span class="muted small">Что важного на сегодня</span></span></button>
    <button class="btn ghost block" data-insta="scroll" style="margin-top:14px">Всё равно полистаю — поставлю таймер на 10 минут</button>
    ${saidNo ? `<p class="center muted small">Ты уже ${saidNo} ${plural(saidNo, 'раз', 'раза', 'раз')} выбрала не ленту 💚</p>` : ''}`);
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
    task.done = true; task.doneDate = today(); commit('✓ Готово'); navigator.vibrate?.(20); return;
  }
  if (ds.task) return editTask(ds.task);
  if (ds.addTask) return editTask(null, ds.addTask);
  if (ds.delTask) { state.tasks = state.tasks.filter(x => x.id !== ds.delTask); closeModal(); commit('Удалено'); return; }
  if (ds.calTask) {
    const task = state.tasks.find(x => x.id === ds.calTask);
    openIcs([icsEvent({ title: taskTitle(task), date: task.date && task.date > today() ? task.date : today(), time: task.time, dur: task.dur })], 'rostok.ics');
    return;
  }
  if ('calDay' in ds) {
    const timed = state.tasks.filter(x => !x.done && x.time && (x.date || today()) <= today());
    openIcs(timed.map(x => icsEvent({ title: taskTitle(x), date: today(), time: x.time, dur: x.dur })), 'rostok-day.ics');
    return;
  }
  if (ds.planAct) {
    const a = actById(ds.planAct);
    return editTask(null, a.cat === 'job' ? 2 : 2, { text: a.name, aid: a.id, dur: a.goal, time: a.cat === 'job' ? '11:00' : '19:00' });
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
    if (ds.insta === 'plan') { state.tab = 'plan'; closeModal(); commit('Отличный выбор 💚'); return; }
    if (ds.insta === 'scroll') {
      save();
      openModal(`<div class="big-emoji">⏱️</div><h2 class="center">Хорошо, без вины</h2>
        <p class="center">Скажи Siri: <b>«Таймер на 10 минут»</b> — и листай спокойно.</p>
        <p class="center muted">Когда прозвенит, вспомни: голова потом болит не от отдыха, а от бесконечной ленты.</p>
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
  commit('💚 Записано');
});
document.addEventListener('change', e => {
  if (e.target.id === 'nameInput') { state.name = e.target.value.trim(); save(); toast('Запомнила 💚'); }
  if (e.target.id === 'importFile') {
    const file = e.target.files[0];
    if (!file) return;
    file.text().then(txt => {
      const data = JSON.parse(txt);
      if (!data || data.version !== 2 || !Array.isArray(data.acts)) throw new Error('bad');
      state = { ...defaultState(), ...data }; save(); render(); toast('Данные загружены ✅');
    }).catch(() => toast('Не получилось прочитать файл'));
  }
});
// подсказки зависят от времени суток — обновляем при возвращении в приложение
document.addEventListener('visibilitychange', () => { if (!document.hidden && $('#modal').classList.contains('hidden')) render(); });

// ---------- старт ----------
render();
const params = new URLSearchParams(location.search);
if (!state.onboarded) showWelcome();
else if (params.get('from') === 'insta') showInsta();
if (params.has('from')) history.replaceState(null, '', siteUrl());
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
