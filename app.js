'use strict';
/* Росток — мягкий трекер привычек в игровом формате.
   Все данные хранятся только на этом устройстве (localStorage). */

// ---------- утилиты ----------
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);
const dkey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const plural = (n, one, few, many) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
};

// ---------- справочники ----------
const STATS = {
  body:   { name: 'Тело',    emoji: '💪' },
  mind:   { name: 'Разум',   emoji: '🧠' },
  craft:  { name: 'Ремесло', emoji: '🧶' },
  career: { name: 'Карьера', emoji: '💼' },
  free:   { name: 'Свобода', emoji: '🕊️' },
  calm:   { name: 'Покой',   emoji: '🌿' },
};
const PLANTS = ['🌰', '🌱', '🌿', '🪴', '🌳', '🌸', '🌺', '🌻', '🏵️', '🌈'];
const TITLES = ['Семечко', 'Проклюнулась', 'Росточек', 'Тянется к свету', 'Крепнет', 'Цветёт', 'Сад внутри', 'Солнечная', 'Легенда сада', 'Радуга'];
const ENERGY = {
  low:  { label: '🪫 На нуле',   text: 'Режим минималок. Сегодня достаточно одного мини-дела — правда. Каждое дело даёт ×1.5 опыта, потому что сейчас это сложнее, чем обычно.' },
  mid:  { label: '🔋 Так себе',  text: 'Выбери 1–3 дела. Мини-версия — это не «халтура», это и есть победа.' },
  high: { label: '⚡ Есть силы', text: 'Здорово! Но без рывков — выгорание их не любит. Пара полных версий, остальное мини.' },
};
const FOCUS_PRESETS = [2, 5, 10, 15, 25];

const DEFAULT_HABITS = [
  { id: 'h1', name: 'Зарядка утром', emoji: '🤸', stat: 'body',   mini: '1 упражнение',       full: '10 минут' },
  { id: 'h2', name: 'Силовая',       emoji: '🏋️', stat: 'body',   mini: '10 приседаний',      full: 'Тренировка' },
  { id: 'h3', name: 'Английский',    emoji: '🇬🇧', stat: 'mind',   mini: '5 новых слов',       full: '20 минут' },
  { id: 'h4', name: 'Чтение',        emoji: '📖', stat: 'mind',   mini: '1 страница',         full: '20 минут' },
  { id: 'h5', name: 'Вязание',       emoji: '🧶', stat: 'craft',  mini: '1 ряд',              full: '30 минут' },
  { id: 'h6', name: 'Поиск работы',  emoji: '🔎', stat: 'career', mini: 'Открыть 1 вакансию', full: 'Отправить отклик' },
];
const DEFAULT_REWARDS = [
  { id: 'r1', name: 'Вкусный кофе или десерт',       emoji: '☕', cost: 30 },
  { id: 'r2', name: 'Серия любимого сериала',        emoji: '📺', cost: 40 },
  { id: 'r3', name: 'Вечер ничегонеделания без вины', emoji: '🛋️', cost: 60 },
  { id: 'r4', name: 'Новый моток пряжи',             emoji: '🧶', cost: 150 },
];

const ACHIEVEMENTS = [
  { id: 'first',   emoji: '👣', name: 'Первый шаг',        hint: 'Отметь любое дело',             test: a => a.habitsDone >= 1 },
  { id: 'low',     emoji: '🪫', name: 'Через силу',        hint: 'Дело в день «на нуле»',          test: a => a.lowDone >= 1 },
  { id: 'rest',    emoji: '🛌', name: 'Право на отдых',    hint: 'Осознанный день отдыха',         test: a => a.rest >= 1 },
  { id: 'f5',      emoji: '🤫', name: '5 минут тишины',    hint: 'Квест без телефона 5 мин',       test: a => a.focusBest >= 5 },
  { id: 'f15',     emoji: '🕊️', name: '15 минут свободы',  hint: 'Квест без телефона 15 мин',      test: a => a.focusBest >= 15 },
  { id: 'f60',     emoji: '⏳', name: 'Час на воле',        hint: 'Всего 60 мин без телефона',      test: a => a.focusTotal >= 60 },
  { id: 'door',    emoji: '🚪', name: 'Дверь закрыта',     hint: 'Душ/туалет без телефона',        test: a => a.doors >= 1 },
  { id: 'door10',  emoji: '🛁', name: 'Свободная ванна',   hint: '10 раз без телефона за дверью',  test: a => a.doors >= 10 },
  { id: 'wave',    emoji: '🌊', name: 'Сёрферка',          hint: 'Пережди волну желания',          test: a => a.waves >= 1 },
  { id: 'wave10',  emoji: '🏄', name: 'Укротительница волн', hint: 'Пережди 10 волн',              test: a => a.waves >= 10 },
  { id: 'back',    emoji: '🧭', name: 'Вернулась сама',    hint: 'Осознанно посмотри и вернись',   test: a => a.scrolls >= 1 },
  { id: 's3',      emoji: '🔥', name: '3 дня подряд',      hint: 'Серия 3 дня',                    test: a => a.streakBest >= 3 },
  { id: 's7',      emoji: '🌟', name: 'Неделя',            hint: 'Серия 7 дней',                   test: a => a.streakBest >= 7 },
  { id: 's30',     emoji: '👑', name: 'Месяц',             hint: 'Серия 30 дней',                  test: a => a.streakBest >= 30 },
  { id: 'full10',  emoji: '🚀', name: 'Разогналась',       hint: '10 полных версий',               test: a => a.fullDone >= 10 },
  { id: 'job5',    emoji: '📨', name: 'В поиске',          hint: '5 дел по карьере',               test: a => a.careerDone >= 5 },
  { id: 'buy',     emoji: '🎁', name: 'Заслужила',         hint: 'Возьми первую награду',          test: a => a.purchases >= 1 },
  { id: 'lvl5',    emoji: '🌸', name: 'Цветение',          hint: 'Достигни 5 уровня',              test: a => a.level >= 5 },
];

// ---------- состояние ----------
const KEY = 'rostok-v1';
function defaultState() {
  return {
    version: 1, name: '', onboarded: false,
    habits: DEFAULT_HABITS.map(h => ({ ...h })),
    rewards: DEFAULT_REWARDS.map(r => ({ ...r })),
    log: {}, purchases: [], seenAch: [],
    scroll: null,   // {start} — «смотрю осознанно»
    door: null,     // {start} — телефон за дверью
    lastFocus: 5, tab: 'today',
  };
}
let state = load();
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...defaultState(), ...JSON.parse(raw) };
  } catch (e) { /* пустое хранилище — начинаем заново */ }
  return defaultState();
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { toast('Не получилось сохранить 😔'); }
}
const today = () => dkey();
function day(k = today()) {
  if (!state.log[k]) state.log[k] = { energy: null, done: {}, focus: [], waves: 0, doors: 0, scrolls: 0, rest: false, wins: [] };
  return state.log[k];
}
const peek = k => state.log[k];
const habitById = id => state.habits.find(h => h.id === id);
const activeHabits = () => state.habits.filter(h => !h.archived);

// ---------- очки ----------
function habitXP(level, low) { const base = level === 'full' ? 25 : 10; return low ? Math.round(base * 1.5) : base; }
function dayEvents(d) {
  const ev = [];
  const low = d.energy === 'low';
  for (const [hid, lvl] of Object.entries(d.done || {})) {
    const h = habitById(hid);
    ev.push({ stat: h ? h.stat : 'calm', xp: habitXP(lvl, low), coins: lvl === 'full' ? 5 : 2 });
  }
  for (const f of d.focus || []) ev.push({ stat: 'free', xp: f.ok ? f.min * 3 : f.done, coins: f.ok ? f.min : 0 });
  if (d.waves) ev.push({ stat: 'calm', xp: d.waves * 15, coins: d.waves * 3 });
  if (d.doors) ev.push({ stat: 'free', xp: d.doors * 10, coins: d.doors * 2 });
  if (d.scrolls) ev.push({ stat: 'calm', xp: d.scrolls * 5, coins: 0 });
  if (d.rest) ev.push({ stat: 'calm', xp: 15, coins: 2 });
  if (d.wins?.length) ev.push({ stat: 'calm', xp: d.wins.length * 3, coins: d.wins.length });
  return ev;
}
function totals() {
  const stats = Object.fromEntries(Object.keys(STATS).map(k => [k, 0]));
  let xp = 0, coins = 0;
  for (const d of Object.values(state.log)) for (const e of dayEvents(d)) { xp += e.xp; coins += e.coins; stats[e.stat] = (stats[e.stat] || 0) + e.xp; }
  const spent = state.purchases.reduce((s, p) => s + p.cost, 0);
  return { xp, coins: coins - spent, stats };
}
const dayXP = d => d ? dayEvents(d).reduce((s, e) => s + e.xp, 0) : 0;
function levelInfo(xp) {
  let L = 1, need = 100, rest = xp;
  while (rest >= need) { rest -= need; L++; need = 100 + (L - 1) * 50; }
  return { L, cur: rest, need };
}
const isActive = d => !!d && dayXP(d) > 0;
function streak() {
  let n = 0, d = new Date();
  if (!isActive(peek(dkey(d)))) d = addDays(d, -1);
  while (isActive(peek(dkey(d)))) { n++; d = addDays(d, -1); }
  return n;
}
function bestStreak() {
  const keys = Object.keys(state.log).filter(k => isActive(state.log[k])).sort();
  let best = 0, cur = 0, prev = null;
  for (const k of keys) {
    const dt = new Date(k + 'T12:00:00');
    cur = (prev && dkey(addDays(prev, 1)) === k) ? cur + 1 : 1;
    best = Math.max(best, cur); prev = dt;
  }
  return best;
}
function aggregates() {
  const a = { habitsDone: 0, fullDone: 0, lowDone: 0, careerDone: 0, focusBest: 0, focusTotal: 0, waves: 0, doors: 0, scrolls: 0, rest: 0 };
  for (const d of Object.values(state.log)) {
    for (const [hid, lvl] of Object.entries(d.done || {})) {
      a.habitsDone++; if (lvl === 'full') a.fullDone++;
      if (d.energy === 'low') a.lowDone++;
      if (habitById(hid)?.stat === 'career') a.careerDone++;
    }
    for (const f of d.focus || []) { if (f.ok) a.focusBest = Math.max(a.focusBest, f.min); a.focusTotal += f.ok ? f.min : f.done; }
    a.waves += d.waves || 0; a.doors += d.doors || 0; a.scrolls += d.scrolls || 0; if (d.rest) a.rest++;
  }
  a.purchases = state.purchases.length;
  a.streakBest = bestStreak();
  a.level = levelInfo(totals().xp).L;
  return a;
}

// ---------- действие + награды ----------
function commit(msg) {
  const before = levelInfo(lastXP).L;
  save();
  const t = totals();
  const after = levelInfo(t.xp).L;
  lastXP = t.xp;
  if (msg) toast(msg);
  render();
  if (after > before) setTimeout(() => levelUp(after), 400);
  checkAchievements();
}
let lastXP = totals().xp;
function checkAchievements() {
  const a = aggregates();
  for (const ach of ACHIEVEMENTS) {
    if (!state.seenAch.includes(ach.id) && ach.test(a)) {
      state.seenAch.push(ach.id);
      setTimeout(() => toast(`🏆 ${ach.emoji} ${ach.name}`), 700);
    }
  }
  save();
}
function levelUp(L) {
  openModal(`
    <div class="big-emoji">${PLANTS[Math.min(L - 1, PLANTS.length - 1)]}</div>
    <h2 class="center">Уровень ${L}!</h2>
    <p class="center">Твой росток: <b>${TITLES[Math.min(L - 1, TITLES.length - 1)]}</b>.</p>
    <p class="center muted">Это сложилось из маленьких шагов. Именно так это и работает.</p>
    <button class="btn primary block" data-close>Ура 🌿</button>`);
  navigator.vibrate?.([80, 60, 80, 60, 160]);
}

// ---------- тосты и модалки ----------
function toast(text) {
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = text;
  const box = $('#toasts');
  while (box.children.length >= 2) box.firstChild.remove();
  box.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}
let modalCleanup = null;
function openModal(html, onMount) {
  closeModal();
  $('#sheet').innerHTML = html;
  $('#modal').classList.remove('hidden');
  if (onMount) modalCleanup = onMount($('#sheet')) || null;
}
function closeModal() {
  if (modalCleanup) { modalCleanup(); modalCleanup = null; }
  $('#modal').classList.add('hidden');
}
$('#modal').addEventListener('click', e => {
  if (e.target.id === 'modal' || e.target.closest('[data-close]')) closeModal();
});

// ---------- навигация ----------
$$('.tabs button').forEach(b => b.addEventListener('click', () => { state.tab = b.dataset.tab; save(); render(); window.scrollTo(0, 0); }));
$('#sos').addEventListener('click', openSOS);

function render() {
  $$('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === state.tab));
  const views = { today: viewToday, focus: viewFocus, hero: viewHero, shop: viewShop };
  $('#screen').innerHTML = (views[state.tab] || viewToday)();
}

// ---------- экран «Сегодня» ----------
function greeting() {
  const h = new Date().getHours();
  const name = state.name ? `, ${esc(state.name)}` : '';
  if (h < 6) return `Доброй ночи${name}`;
  if (h < 12) return `Доброе утро${name}`;
  if (h < 18) return `Добрый день${name}`;
  return `Добрый вечер${name}`;
}
function header() {
  const t = totals(), lv = levelInfo(t.xp), s = streak();
  return `
  <div class="top">
    <div>
      <h1>${greeting()}</h1>
      <div class="muted">${new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
    </div>
    <div class="badges">
      <span class="badge" title="Серия дней">🔥 ${s}</span>
      <span class="badge" title="Монетки">🪙 ${t.coins}</span>
    </div>
  </div>
  <div class="card soft" style="margin-top:12px">
    <div class="row between small"><span>${PLANTS[Math.min(lv.L - 1, PLANTS.length - 1)]} Уровень ${lv.L} · ${TITLES[Math.min(lv.L - 1, TITLES.length - 1)]}</span><span class="muted">${lv.cur}/${lv.need} XP</span></div>
    <div class="bar" style="margin-top:6px"><i style="width:${(lv.cur / lv.need) * 100}%"></i></div>
  </div>`;
}
function weekDots(hid) {
  let s = '';
  for (let i = 6; i >= 0; i--) {
    const v = peek(dkey(addDays(new Date(), -i)))?.done?.[hid];
    s += `<i class="${v === 'full' ? 'f' : v === 'mini' ? 'm' : ''}"></i>`;
  }
  return `<div class="dots" title="Последние 7 дней">${s}</div>`;
}
function viewToday() {
  const d = peek(today()) || {};
  const energy = d.energy;
  const doneCount = Object.keys(d.done || {}).length;
  let html = header();

  if (!energy) {
    html += `
    <div class="card banner">
      <h3>Как твой заряд сегодня?</h3>
      <p class="muted">От этого зависит, сколько стоит от себя ждать. Честный ответ — лучший.</p>
      <div class="pills" style="margin-top:10px">
        ${Object.entries(ENERGY).map(([k, v]) => `<button class="pill" data-energy="${k}">${v.label}</button>`).join('')}
      </div>
    </div>`;
  } else {
    html += `
    <div class="card banner ${energy === 'low' ? 'low' : ''}">
      <div class="row between"><b>${ENERGY[energy].label}</b><button class="iconbtn small" data-energy-reset>изменить</button></div>
      <p class="muted">${ENERGY[energy].text}</p>
    </div>`;
  }

  html += `<h2>Квесты дня ${doneCount ? `<span class="muted small">· сделано ${doneCount}</span>` : ''}</h2>`;
  for (const h of activeHabits()) {
    const v = d.done?.[h.id];
    const low = energy === 'low';
    html += `
    <div class="card habit ${v ? 'done-' + v : ''}">
      <div class="emo">${esc(h.emoji)}</div>
      <div class="grow">
        <div class="row"><b>${esc(h.name)}</b><span class="stat-chip">${STATS[h.stat]?.emoji || ''} ${STATS[h.stat]?.name || ''}</span></div>
        ${weekDots(h.id)}
      </div>
      <button class="iconbtn" data-edit-habit="${h.id}" aria-label="Изменить">✏️</button>
      <div class="habit-actions">
        <button class="choice ${v === 'mini' ? 'on' : ''}" data-do="${h.id}" data-lvl="mini"><b>Мини · +${habitXP('mini', low)} XP</b>${esc(h.mini)}</button>
        <button class="choice ${v === 'full' ? 'on' : ''}" data-do="${h.id}" data-lvl="full"><b>Полностью · +${habitXP('full', low)} XP</b>${esc(h.full)}</button>
      </div>
    </div>`;
  }
  html += `<button class="btn ghost block" data-add-habit>＋ Добавить привычку</button>`;

  html += `
  <h2>Отдых — тоже квест</h2>
  <div class="card">
    <p class="muted">Если сил нет совсем — это не провал. Отдохни <i>осознанно</i>: без чувства вины, лучше без ленты. Серия не прервётся.</p>
    <button class="btn ${d.rest ? 'primary' : ''} block" data-rest>${d.rest ? '🌿 Сегодня я отдыхаю — засчитано' : '🛌 Сегодня день отдыха'}</button>
  </div>

  <h2>Маленькие победы</h2>
  <div class="card">
    <p class="muted">Помыла посуду? Ответила на сообщение? Вышла на улицу? Это считается. Запиши — мозгу важно видеть, что ты делаешь.</p>
    <form class="row" id="winForm" style="margin-top:8px">
      <input id="winInput" placeholder="Например: поела нормальную еду" maxlength="120" autocomplete="off">
      <button class="btn primary" type="submit">＋</button>
    </form>
    ${d.wins?.length ? `<ul class="wins">${d.wins.map((w, i) => `<li>${esc(w)} <button class="iconbtn small" data-del-win="${i}">✕</button></li>`).join('')}</ul>` : ''}
  </div>`;
  return html;
}

// ---------- экран «Без телефона» ----------
function viewFocus() {
  const a = aggregates();
  const d = peek(today()) || {};
  const todayMin = (d.focus || []).reduce((s, f) => s + (f.ok ? f.min : f.done), 0);
  const opts = activeHabits().map(h => `<option value="${h.id}">${esc(h.emoji)} ${esc(h.name)}</option>`).join('');
  return `
  <h1>Время без телефона</h1>
  <p class="muted">Телефон — не враг, просто его создавали так, чтобы оторваться было трудно. Тренируем это понемногу, как мышцу.</p>

  <div class="card">
    <h3>📵 Квест «Тишина»</h3>
    <p class="muted small">Нажми «Начать», положи телефон экраном вниз и займись чем-нибудь. Экран будет тёмным и не погаснет. Если выйдешь из приложения раньше — квест прервётся, но прожитые минуты всё равно засчитаются.</p>
    <label>Сколько минут?</label>
    <div class="pills">${FOCUS_PRESETS.map(m => `<button class="pill ${state.lastFocus === m ? 'on' : ''}" data-fmin="${m}">${m}</button>`).join('')}</div>
    <label>Чем займёшься? (необязательно)</label>
    <select id="focusWhat"><option value="">🫖 Просто побуду без телефона</option>${opts}</select>
    <button class="btn primary block" data-focus-start>Начать на ${state.lastFocus} мин · +${state.lastFocus * 3} XP</button>
  </div>

  <div class="card">
    <h3>🚪 Квест «Дверь»</h3>
    <p class="muted small">Душ, туалет, готовка, прогулка до магазина — телефон остаётся за дверью. Нажми перед уходом, вернись и отметь.</p>
    ${state.door
      ? `<p>Телефон отдыхает с ${new Date(state.door.start).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}.</p>
         <button class="btn primary block" data-door-back>Я вернулась ✨</button>
         <button class="btn ghost block" data-door-cancel>Отменить</button>`
      : `<button class="btn warm block" data-door-go>Оставляю телефон и ухожу · +10 XP</button>`}
  </div>

  <div class="card soft">
    <div class="row between"><span>Сегодня без телефона</span><b>${todayMin} мин</b></div>
    <div class="row between"><span>Рекорд квеста</span><b>${a.focusBest} мин</b></div>
    <div class="row between"><span>Всего</span><b>${a.focusTotal} мин</b></div>
    <div class="row between"><span>Раз за дверью</span><b>${a.doors}</b></div>
  </div>

  <h2>Если рука сама тянется</h2>
  <div class="card">
    <ul class="wins muted small">
      <li>Начни с 2 минут. Серьёзно. Цель — не 15 минут, а опыт «я смогла».</li>
      <li>Поставь лимит в «Экранном времени» (iPhone) или «Цифровом благополучии» (Android) — и на приложения, и на сайты instagram.com и youtube.com в браузере.</li>
      <li>Убери соцсети с первого экрана, а на их место поставь Росток.</li>
      <li>Включи чёрно-белый режим экрана — лента сразу становится скучнее.</li>
      <li>Заряжай телефон не у кровати, а в другой комнате.</li>
    </ul>
  </div>`;
}

let focus = null; // {min, what, start, end, timer, wake}
async function startFocus() {
  const min = state.lastFocus;
  const what = $('#focusWhat')?.value || '';
  focus = { min, what, start: Date.now(), end: Date.now() + min * 60000, timer: null, wake: null };
  try { focus.wake = await navigator.wakeLock?.request('screen'); } catch (e) { /* не поддерживается */ }
  const h = habitById(what);
  const ov = $('#focusOverlay');
  ov.innerHTML = `
    <div class="small">${h ? `${esc(h.emoji)} ${esc(h.name)}` : '🫖 Просто без телефона'}</div>
    <svg class="ring" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="none" stroke="#222" stroke-width="3"/>
      <circle id="ringArc" cx="50" cy="50" r="45" fill="none" stroke="#6f9b67" stroke-width="3" stroke-linecap="round"
        stroke-dasharray="283" stroke-dashoffset="0" transform="rotate(-90 50 50)"/></svg>
    <div class="time" id="focusTime">${min}:00</div>
    <p>Положи телефон экраном вниз.<br>Он будет здесь, когда ты вернёшься.</p>
    <button class="btn ghost" style="margin-top:30px;color:#8a8698;border-color:#333" id="focusStop">Закончить раньше</button>`;
  ov.classList.remove('hidden');
  $('#focusStop').onclick = () => endFocus(false);
  tickFocus();
  focus.timer = setInterval(tickFocus, 500);
}
function tickFocus() {
  if (!focus) return;
  const left = Math.max(0, focus.end - Date.now());
  const s = Math.ceil(left / 1000);
  $('#focusTime').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  $('#ringArc')?.setAttribute('stroke-dashoffset', String(283 * (1 - left / (focus.min * 60000))));
  if (left <= 0) endFocus(true);
}
function endFocus(ok, interrupted = false) {
  if (!focus) return;
  clearInterval(focus.timer);
  try { focus.wake?.release(); } catch (e) { /* ничего */ }
  const doneMin = Math.min(focus.min, Math.floor((Date.now() - focus.start) / 60000));
  const f = focus; focus = null;
  $('#focusOverlay').classList.add('hidden');
  day().focus.push({ min: f.min, done: ok ? f.min : doneMin, ok, what: f.what, at: Date.now() });
  if (ok) {
    navigator.vibrate?.([200, 100, 200]);
    commit(`+${f.min * 3} XP · +${f.min} 🪙`);
    const h = habitById(f.what);
    openModal(`
      <div class="big-emoji">🕊️</div>
      <h2 class="center">${f.min} ${plural(f.min, 'минута', 'минуты', 'минут')} без телефона!</h2>
      <p class="center muted">Ты это сделала. Запомни это ощущение.</p>
      ${h && !day().done[h.id] ? `<button class="btn primary block" data-do-close="${h.id}" data-lvl="full">Отметить «${esc(h.name)}» выполненной</button>` : ''}
      <button class="btn block" data-close>Дальше</button>`);
  } else {
    commit(doneMin ? `+${doneMin} XP за ${doneMin} мин` : null);
    openModal(`
      <div class="big-emoji">🌱</div>
      <h2 class="center">${interrupted ? 'Квест прервался' : 'Закончила раньше'}</h2>
      <p class="center">${doneMin ? `Ты продержалась <b>${doneMin} ${plural(doneMin, 'минуту', 'минуты', 'минут')}</b> — и они засчитаны.` : 'Ничего страшного.'}</p>
      <p class="center muted">Это не провал, а информация. Может, в следующий раз попробовать чуть короче?</p>
      <button class="btn primary block" data-close>Хорошо</button>`);
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (focus) endFocus(false, true);
  } else {
    if (state.scroll) returnFromScroll();
  }
});

// ---------- SOS: тянет залипнуть ----------
function openSOS() {
  openModal(`
    <h2>Тянет в ленту? Это нормально.</h2>
    <p class="muted">Уставший мозг ищет быстрый дофамин — это не слабость характера. Давай выберем, что сделать с этим желанием:</p>
    <button class="option" data-sos="wave"><span class="e">🌊</span><span><b>Переждать волну · 90 секунд</b><span class="muted small">Желание растёт и спадает, как волна. Просто подыши.</span></span></button>
    <button class="option" data-sos="mini"><span class="e">🎲</span><span><b>Одно мини-дело вместо</b><span class="muted small">Самое крошечное. Потом можешь вернуться к ленте, если захочешь.</span></span></button>
    <button class="option" data-sos="door"><span class="e">🚪</span><span><b>Оставить телефон и выйти из комнаты</b><span class="muted small">Попить воды, умыться, выглянуть в окно.</span></span></button>
    <button class="option" data-sos="scroll"><span class="e">⏱️</span><span><b>Посмотреть осознанно, 10 минут</b><span class="muted small">Можно! Но с таймером. Вернёшься — получишь опыт за возвращение.</span></span></button>
    <button class="btn ghost block" data-close style="margin-top:14px">Закрыть</button>`);
}
function sosWave() {
  let left = 90;
  openModal(`
    <h2 class="center">Переждать волну</h2>
    <div class="breath"></div>
    <p class="center" id="breathText">Вдох… 4 секунды</p>
    <p class="center muted" id="breathLeft">90 с</p>
    <p class="center muted small">Заметь желание. Где оно в теле? Не надо с ним бороться — просто наблюдай, как оно меняется.</p>
    <button class="btn ghost block" data-close>Остановить</button>`, () => {
    const t0 = Date.now();
    const iv = setInterval(() => {
      const el = (Date.now() - t0) / 1000;
      left = Math.max(0, 90 - Math.floor(el));
      const phase = el % 10;
      const bt = $('#breathText'), bl = $('#breathLeft');
      if (bt) bt.textContent = phase < 4 ? 'Вдох… 4 секунды' : 'Выдох… 6 секунд';
      if (bl) bl.textContent = `${left} с`;
      if (left <= 0) {
        clearInterval(iv);
        day().waves++;
        commit('🌊 Волна пережита · +15 XP');
        openModal(`
          <div class="big-emoji">🏄‍♀️</div>
          <h2 class="center">Волна прошла</h2>
          <p class="center muted">Как ты сейчас? Желание стало меньше? Даже если нет — ты дала себе выбор, а это главное.</p>
          <button class="btn primary block" data-sos="mini">Сделать мини-дело</button>
          <button class="btn block" data-close>Готово</button>`);
      }
    }, 250);
    return () => clearInterval(iv);
  });
}
function sosMini() {
  const d = peek(today()) || {};
  const free = activeHabits().filter(h => !d.done?.[h.id]);
  if (!free.length) {
    openModal(`<div class="big-emoji">🌟</div><h2 class="center">Все дела на сегодня уже отмечены!</h2>
      <p class="center muted">Ты можешь просто отдохнуть. Попробуй переждать волну или выйти на пару минут.</p>
      <button class="btn primary block" data-sos="wave">Переждать волну</button>`);
    return;
  }
  const h = pick(free);
  openModal(`
    <div class="big-emoji">${esc(h.emoji)}</div>
    <h2 class="center">${esc(h.name)}</h2>
    <p class="center" style="font-size:20px"><b>${esc(h.mini)}</b></p>
    <p class="center muted">Только это. Не больше. Можно прямо сейчас.</p>
    <button class="btn primary block" data-do-close="${h.id}" data-lvl="mini">Сделала! ✨</button>
    <button class="btn block" data-sos="mini">🎲 Другое дело</button>
    <button class="btn ghost block" data-close>Не сейчас</button>`);
}
function sosScroll() {
  state.scroll = { start: Date.now() };
  save();
  openModal(`
    <div class="big-emoji">⏱️</div>
    <h2 class="center">Хорошо, 10 минут</h2>
    <p class="muted">1. Поставь таймер на 10 минут в часах телефона.<br>2. Смотри без вины — ты выбрала это сама.<br>3. Когда таймер прозвонит, открой Росток — тут ждёт +5 XP за возвращение.</p>
    <button class="btn primary block" data-close>Поняла</button>
    <button class="btn ghost block" data-scroll-cancel>Передумала 💚</button>`);
}
function returnFromScroll() {
  const min = Math.round((Date.now() - state.scroll.start) / 60000);
  if (min < 1) return; // ещё не уходила
  state.scroll = null;
  day().scrolls++;
  commit('🧭 С возвращением · +5 XP');
  openModal(`
    <div class="big-emoji">🧭</div>
    <h2 class="center">С возвращением!</h2>
    <p class="center">Тебя не было ${min} ${plural(min, 'минуту', 'минуты', 'минут')}.</p>
    <p class="center muted">Без оценок. Как ты себя чувствуешь? Если голова тяжёлая — выпей воды и посмотри в окно пару минут.</p>
    <button class="btn primary block" data-sos="mini">Мини-дело</button>
    <button class="btn block" data-sos="wave">Подышать 90 секунд</button>
    <button class="btn ghost block" data-close>Просто закрыть</button>`);
}

// ---------- экран «Росток» ----------
function viewHero() {
  const t = totals(), lv = levelInfo(t.xp), a = aggregates();
  const idx = Math.min(lv.L - 1, PLANTS.length - 1);
  let heat = '';
  const start = addDays(new Date(), -27);
  for (let i = 0; i < 28; i++) {
    const k = dkey(addDays(start, i)), d = peek(k), x = dayXP(d);
    const cls = !x ? '' : (d.rest && x <= 25) ? 'rest' : x < 20 ? 'l1' : x < 50 ? 'l2' : x < 90 ? 'l3' : 'l4';
    heat += `<i class="${cls} ${k === today() ? 'today' : ''}" title="${k}: ${x} XP"></i>`;
  }
  return `
  <div class="card center" style="padding-top:20px">
    <div class="plant">${PLANTS[idx]}</div>
    <h1>${state.name ? esc(state.name) + ' · ' : ''}Уровень ${lv.L}</h1>
    <div class="muted">${TITLES[Math.min(lv.L - 1, TITLES.length - 1)]}</div>
    <div class="bar" style="margin:12px 0 4px"><i style="width:${(lv.cur / lv.need) * 100}%"></i></div>
    <div class="muted small">${lv.cur} / ${lv.need} XP до следующего уровня · всего ${t.xp} XP</div>
    <div class="row" style="justify-content:center;margin-top:10px;gap:16px">
      <span>🔥 серия ${streak()}</span><span>🏅 рекорд ${a.streakBest}</span><span>🪙 ${t.coins}</span>
    </div>
  </div>

  <h2>Характеристики</h2>
  <div class="card stats-grid">
    ${Object.entries(STATS).map(([k, s]) => {
      const x = t.stats[k] || 0, l = Math.floor(x / 100) + 1;
      return `<div class="stat-row"><span>${s.emoji}</span><div><div class="small">${s.name}</div><div class="bar"><i style="width:${x % 100}%"></i></div></div><span class="small muted">ур. ${l}</span></div>`;
    }).join('')}
  </div>

  <h2>Последние 4 недели</h2>
  <div class="card">
    <div class="heat">${heat}</div>
    <p class="muted small" style="margin-top:8px">Пустые клетки — не провал. Цель — чтобы зелёных постепенно стало чуть больше, а не чтобы всё было идеально.</p>
  </div>

  <h2>Достижения · ${state.seenAch.length}/${ACHIEVEMENTS.length}</h2>
  <div class="ach">
    ${ACHIEVEMENTS.map(x => `<div class="${state.seenAch.includes(x.id) ? '' : 'locked'}" title="${esc(x.hint)}"><span>${x.emoji}</span>${esc(x.name)}<div class="muted" style="font-size:10px">${esc(x.hint)}</div></div>`).join('')}
  </div>

  <h2>Настройки</h2>
  <div class="card">
    <label>Как к тебе обращаться?</label>
    <input id="nameInput" value="${esc(state.name)}" placeholder="Имя" maxlength="30">
    <button class="btn block" data-export>💾 Сохранить копию данных</button>
    <button class="btn block" data-import>📂 Загрузить копию</button>
    <input type="file" id="importFile" accept="application/json" class="hidden">
    <button class="btn block" data-about>ℹ️ Как это работает</button>
    <button class="btn danger block" data-reset>Начать всё заново</button>
    <p class="muted small" style="margin-top:10px">Все данные хранятся только на этом телефоне. Иногда сохраняй копию на всякий случай.</p>
  </div>`;
}

// ---------- экран «Награды» ----------
function viewShop() {
  const t = totals();
  const hist = state.purchases.slice(-8).reverse();
  return `
  <div class="top"><div><h1>Награды</h1><div class="muted">Трать монетки на приятное — без вины, ты их заработала.</div></div>
    <span class="badge" style="font-size:18px">🪙 ${t.coins}</span></div>
  <div style="margin-top:14px">
  ${state.rewards.map(r => `
    <div class="card reward">
      <div class="emo">${esc(r.emoji)}</div>
      <div><b>${esc(r.name)}</b><div class="muted small">🪙 ${r.cost}</div></div>
      <div class="row" style="gap:4px">
        <button class="iconbtn" data-edit-reward="${r.id}" aria-label="Изменить">✏️</button>
        <button class="btn ${t.coins >= r.cost ? 'primary' : ''}" data-buy="${r.id}" ${t.coins >= r.cost ? '' : 'disabled'}>Взять</button>
      </div>
    </div>`).join('')}
  </div>
  <button class="btn ghost block" data-add-reward>＋ Своя награда</button>
  <div class="card soft" style="margin-top:14px">
    <p class="small muted"><b>Как копятся монетки:</b> мини-дело — 2 🪙, полное — 5 🪙, минута без телефона — 1 🪙, волна пережита — 3 🪙, телефон за дверью — 2 🪙, победа дня — 1 🪙.</p>
  </div>
  ${hist.length ? `<h2>Недавно</h2><div class="card">${hist.map(p => `<div class="row between small"><span>${esc(p.emoji)} ${esc(p.name)}</span><span class="muted">${new Date(p.at).toLocaleDateString('ru-RU')} · −${p.cost}</span></div>`).join('')}</div>` : ''}`;
}

// ---------- формы ----------
function editHabit(id) {
  const h = id ? habitById(id) : { emoji: '⭐', name: '', stat: 'mind', mini: '', full: '' };
  openModal(`
    <h2>${id ? 'Изменить привычку' : 'Новая привычка'}</h2>
    <form id="habitForm">
      <div class="row"><div style="width:70px"><label>Значок</label><input name="emoji" value="${esc(h.emoji)}" maxlength="4"></div>
      <div class="grow"><label>Название</label><input name="name" value="${esc(h.name)}" required maxlength="40" placeholder="Например: Прогулка"></div></div>
      <label>Характеристика</label>
      <select name="stat">${Object.entries(STATS).map(([k, s]) => `<option value="${k}" ${h.stat === k ? 'selected' : ''}>${s.emoji} ${s.name}</option>`).join('')}</select>
      <label>Мини-версия — настолько маленькая, что смешно не сделать</label>
      <input name="mini" value="${esc(h.mini)}" required maxlength="50" placeholder="Например: выйти на крыльцо">
      <label>Полная версия</label>
      <input name="full" value="${esc(h.full)}" required maxlength="50" placeholder="Например: 30 минут пешком">
      <button class="btn primary block" type="submit" style="margin-top:16px">Сохранить</button>
      ${id ? `<button class="btn danger block" type="button" data-del-habit="${id}">Убрать привычку</button>` : ''}
      <button class="btn ghost block" type="button" data-close>Отмена</button>
    </form>`, sheet => {
    $('#habitForm', sheet).onsubmit = e => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      if (id) Object.assign(h, f); else state.habits.push({ id: uid(), ...f });
      closeModal(); commit(id ? 'Сохранено' : 'Новая привычка добавлена 🌱');
    };
  });
}
function editReward(id) {
  const r = id ? state.rewards.find(x => x.id === id) : { emoji: '🎀', name: '', cost: 30 };
  openModal(`
    <h2>${id ? 'Изменить награду' : 'Своя награда'}</h2>
    <form id="rewardForm">
      <div class="row"><div style="width:70px"><label>Значок</label><input name="emoji" value="${esc(r.emoji)}" maxlength="4"></div>
      <div class="grow"><label>Что это?</label><input name="name" value="${esc(r.name)}" required maxlength="50" placeholder="Например: ванна с пеной"></div></div>
      <label>Цена в монетках</label>
      <input name="cost" type="number" min="1" max="9999" value="${r.cost}" required>
      <button class="btn primary block" type="submit" style="margin-top:16px">Сохранить</button>
      ${id ? `<button class="btn danger block" type="button" data-del-reward="${id}">Удалить</button>` : ''}
      <button class="btn ghost block" type="button" data-close>Отмена</button>
    </form>`, sheet => {
    $('#rewardForm', sheet).onsubmit = e => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      f.cost = Math.max(1, parseInt(f.cost, 10) || 1);
      if (id) Object.assign(r, f); else state.rewards.push({ id: uid(), ...f });
      closeModal(); commit('Сохранено');
    };
  });
}
function showAbout(first) {
  openModal(`
    <div class="big-emoji">🌱</div>
    <h2 class="center">${first ? 'Привет! Это Росток' : 'Как это работает'}</h2>
    <p><b>Мини-версии засчитываются.</b> Одна страница книги — это чтение. Один ряд — это вязание. Маленькие шаги и есть путь.</p>
    <p><b>Отдых — тоже квест.</b> При выгорании отдыхать — это не лень, а лечение. Отмечай день отдыха, и серия не сломается.</p>
    <p><b>Телефон — твой помощник.</b> Когда рука тянется к ленте, жми оранжевую кнопку 🆘 — там есть варианты, и ни один тебя не ругает.</p>
    <p><b>Квест «Тишина».</b> Начни с 2–5 минут без телефона. Это тренировка, как в спортзале.</p>
    <p class="muted small">Если тяжесть, бессилие и вина не отпускают неделями — это повод поговорить с психологом или врачом. Выгорание правда лечится, и просить помощи — нормально.</p>
    ${first ? `<label>Как к тебе обращаться? (необязательно)</label><input id="onbName" maxlength="30" placeholder="Имя">` : ''}
    <button class="btn primary block" data-onb-done>${first ? 'Начнём потихоньку' : 'Понятно'}</button>`);
}

// ---------- обработка нажатий ----------
document.addEventListener('click', e => {
  const t = e.target.closest('button');
  if (!t) return;
  const ds = t.dataset;

  if (ds.energy) { day().energy = ds.energy; commit(ds.energy === 'low' ? 'Спасибо за честность 💚' : null); return; }
  if ('energyReset' in ds) { day().energy = null; commit(); return; }

  if (ds.do || ds.doClose) {
    const hid = ds.do || ds.doClose, lvl = ds.lvl, d = day();
    if (d.done[hid] === lvl) { delete d.done[hid]; commit('Отметка снята'); }
    else {
      d.done[hid] = lvl;
      commit(`+${habitXP(lvl, d.energy === 'low')} XP · +${lvl === 'full' ? 5 : 2} 🪙`);
      navigator.vibrate?.(30);
    }
    if (ds.doClose) closeModal();
    return;
  }
  if (ds.editHabit) return editHabit(ds.editHabit);
  if ('addHabit' in ds) return editHabit(null);
  if (ds.delHabit) {
    if (confirm('Убрать эту привычку? История и опыт сохранятся.')) { habitById(ds.delHabit).archived = true; closeModal(); commit('Привычка убрана'); }
    return;
  }
  if ('rest' in ds) { const d = day(); d.rest = !d.rest; commit(d.rest ? '🌿 Отдыхай спокойно · +15 XP' : null); return; }
  if (ds.delWin !== undefined) { day().wins.splice(+ds.delWin, 1); commit(); return; }

  if (ds.fmin) { state.lastFocus = +ds.fmin; save(); render(); return; }
  if ('focusStart' in ds) { startFocus(); return; }
  if ('doorGo' in ds) { state.door = { start: Date.now() }; save(); render(); toast('Иди! Телефон подождёт 🚪'); return; }
  if ('doorBack' in ds) {
    const min = (Date.now() - state.door.start) / 60000;
    state.door = null;
    if (min < 1) { save(); render(); toast('Так быстро? Засчитаю в следующий раз 😉'); return; }
    day().doors++; commit('🚪 Без телефона! · +10 XP'); return;
  }
  if ('doorCancel' in ds) { state.door = null; save(); render(); return; }

  if (ds.sos === 'wave') return sosWave();
  if (ds.sos === 'mini') return sosMini();
  if (ds.sos === 'door') { closeModal(); state.tab = 'focus'; state.door = { start: Date.now() }; save(); render(); toast('Иди! Телефон подождёт 🚪'); return; }
  if (ds.sos === 'scroll') return sosScroll();
  if ('scrollCancel' in ds) { state.scroll = null; save(); closeModal(); toast('Отличный выбор 💚'); return; }

  if (ds.buy) {
    const r = state.rewards.find(x => x.id === ds.buy);
    if (totals().coins < r.cost) return;
    state.purchases.push({ id: uid(), rewardId: r.id, name: r.name, emoji: r.emoji, cost: r.cost, at: Date.now() });
    commit(`${r.emoji} Наслаждайся — ты заслужила!`);
    return;
  }
  if (ds.editReward) return editReward(ds.editReward);
  if ('addReward' in ds) return editReward(null);
  if (ds.delReward) { state.rewards = state.rewards.filter(x => x.id !== ds.delReward); closeModal(); commit('Удалено'); return; }

  if ('export' in ds) {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `rostok-${today()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    return;
  }
  if ('import' in ds) { $('#importFile').click(); return; }
  if ('about' in ds) return showAbout(false);
  if ('onbDone' in ds) {
    const n = $('#onbName')?.value.trim();
    if (n) state.name = n;
    state.onboarded = true; save(); closeModal(); render(); return;
  }
  if ('reset' in ds) {
    if (confirm('Точно удалить все данные и начать заново? Это нельзя отменить.')) { state = defaultState(); lastXP = 0; save(); render(); showAbout(true); }
    return;
  }
});

document.addEventListener('submit', e => {
  if (e.target.id === 'winForm') {
    e.preventDefault();
    const v = $('#winInput').value.trim();
    if (!v) return;
    day().wins.push(v);
    commit('🎉 Победа записана · +3 XP');
  }
});
document.addEventListener('change', e => {
  if (e.target.id === 'nameInput') { state.name = e.target.value.trim(); save(); toast('Запомнила 💚'); }
  if (e.target.id === 'importFile') {
    const file = e.target.files[0];
    if (!file) return;
    file.text().then(txt => {
      const data = JSON.parse(txt);
      if (!data || typeof data !== 'object' || !data.log || !Array.isArray(data.habits)) throw new Error('bad');
      state = { ...defaultState(), ...data }; lastXP = totals().xp; save(); render(); toast('Данные загружены ✅');
    }).catch(() => toast('Не получилось прочитать файл'));
  }
});

// ---------- старт ----------
render();
if (!state.onboarded) showAbout(true);
else if (state.scroll) returnFromScroll();
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
