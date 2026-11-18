'use strict';
/*
 * Сервер Ростка: раздаёт само приложение, хранит аккаунты и данные,
 * присылает push-уведомления, пока идёт таймер.
 *
 * Запуск:  cd server && npm install && node server.js
 * Порт:    PORT (по умолчанию 8080)
 * Данные:  DATA_DIR (по умолчанию server/data)
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let webpush = null;
try { webpush = require('web-push'); } catch (e) { console.warn('web-push не установлен — уведомления отключены (npm install)'); }

const PORT = +process.env.PORT || 8080;
const HOST = process.env.HOST || '127.0.0.1';
const ROOT = path.resolve(__dirname, '..');
const DATA = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const MAX_BODY = 8 * 1024 * 1024;
const TIMER_MAX_MS = 6 * 3600 * 1000;    // спрашиваем не дольше 6 часов

fs.mkdirSync(DATA, { recursive: true, mode: 0o700 });

// ---------- хранилище (JSON-файлы, атомарная запись) ----------
function readJSON(name, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8')); } catch (e) { return fallback; }
}
function writeJSON(name, obj) {
  const file = path.join(DATA, name);
  const tmp = file + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj), { mode: 0o600 });
  fs.renameSync(tmp, file);
}
const users = readJSON('users.json', {});     // login -> {id, salt, hash, created}
const tokens = readJSON('tokens.json', {});   // sha256(token) -> {uid, created, used}
const stateFile = uid => `state-${uid}.json`;
const pushFile = uid => `push-${uid}.json`;
const states = {};                            // uid -> {rev, data, updated}
for (const u of Object.values(users)) states[u.id] = readJSON(stateFile(u.id), { rev: 0, data: null, updated: 0 });

// ---------- VAPID-ключи для push ----------
let vapid = readJSON('vapid.json', null);
if (webpush) {
  if (!vapid) { vapid = webpush.generateVAPIDKeys(); writeJSON('vapid.json', vapid); }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:rostok@example.invalid', vapid.publicKey, vapid.privateKey);
}

// ---------- пароли и токены ----------
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const hashPassword = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString('hex');
function checkPassword(pw, user) {
  const a = Buffer.from(hashPassword(pw, user.salt), 'hex');
  const b = Buffer.from(user.hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function issueToken(uid) {
  const token = crypto.randomBytes(32).toString('hex');
  tokens[sha(token)] = { uid, created: Date.now(), used: Date.now() };
  writeJSON('tokens.json', tokens);
  return token;
}
function auth(req) {
  const m = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization || '');
  if (!m) return null;
  const t = tokens[sha(m[1])];
  if (!t) return null;
  if (Date.now() - t.used > 3600e3) { t.used = Date.now(); writeJSON('tokens.json', tokens); }
  return t.uid;
}
// простая защита от подбора пароля: не больше 10 попыток за 15 минут с одного адреса
const attempts = new Map();
function tooMany(ip) {
  const now = Date.now();
  const list = (attempts.get(ip) || []).filter(t => now - t < 15 * 60e3);
  attempts.set(ip, list);
  return list.length >= 10;
}
const noteAttempt = ip => attempts.get(ip).push(Date.now());

// ---------- push ----------
async function sendPush(uid, payload) {
  if (!webpush) return { sent: 0 };
  const subs = readJSON(pushFile(uid), []);
  let sent = 0;
  const alive = [];
  for (const sub of subs) {
    try { await webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 600 }); sent++; alive.push(sub); }
    catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) continue; // подписка больше не действует
      alive.push(sub);
      console.warn('push error', e.statusCode || e.message);
    }
  }
  if (alive.length !== subs.length) writeJSON(pushFile(uid), alive);
  return { sent };
}
const fmtMin = m => { const h = Math.floor(m / 60), r = m % 60; return h ? (r ? `${h} ч ${r} мин` : `${h} ч`) : `${r} мин`; };
const notified = new Map(); // `${uid}:${start}` -> сколько раз уже спросили
setInterval(() => {
  const now = Date.now();
  for (const [uid, st] of Object.entries(states)) {
    const timer = st.data && st.data.timer;
    if (!timer || !timer.start) continue;
    // интервал задаётся в «Настройках» Ростка: 2 (проверка), 15, 30 или 60 минут
    const every = Math.min(240, Math.max(2, +st.data.timerEvery || 30)) * 60 * 1000;
    const key = `${uid}:${timer.start}:${every}`;
    const marks = Math.floor((now - timer.start) / every);
    if (marks < 1 || marks * every > TIMER_MAX_MS || marks <= (notified.get(key) || 0)) continue;
    notified.set(key, marks);
    const act = (st.data.acts || []).find(a => a.id === timer.aid);
    const name = act ? act.name : 'занятием';
    sendPush(uid, {
      title: 'Росток',
      body: `Прошло ${fmtMin(Math.round((now - timer.start) / 60000))}. Как успехи с «${name}»? Продолжаешь?`,
      tag: 'rostok-timer',
    });
  }
}, 20 * 1000).unref();

// ---------- HTTP ----------
function send(res, code, obj, headers = {}) {
  const body = obj === undefined ? '' : JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > MAX_BODY) { reject(Object.assign(new Error('too large'), { code: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { reject(Object.assign(new Error('bad json'), { code: 400 })); }
    });
    req.on('error', reject);
  });
}
const clientIp = req => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;
const LOGIN_RE = /^[a-zA-Z0-9._-]{3,32}$/;

async function api(req, res, url) {
  const p = url.pathname;
  if (p === '/api/health') return send(res, 200, { ok: true, push: !!webpush });

  if (req.method === 'POST' && (p === '/api/register' || p === '/api/login')) {
    const ip = clientIp(req);
    if (tooMany(ip)) return send(res, 429, { error: 'Слишком много попыток. Попробуй через 15 минут.' });
    const { login, password } = await readBody(req);
    const lg = String(login || '').trim().toLowerCase();
    const pw = String(password || '');
    if (!LOGIN_RE.test(lg)) return send(res, 400, { error: 'Логин: 3–32 латинские буквы, цифры, точка, дефис или подчёркивание.' });
    if (pw.length < 8) return send(res, 400, { error: 'Пароль — минимум 8 символов.' });
    if (p === '/api/register') {
      if (process.env.ALLOW_SIGNUP === '0' && Object.keys(users).length > 0) return send(res, 403, { error: 'Регистрация закрыта.' });
      if (users[lg]) { noteAttempt(ip); return send(res, 409, { error: 'Такой логин уже занят.' }); }
      const salt = crypto.randomBytes(16).toString('hex');
      const id = crypto.randomBytes(8).toString('hex');
      users[lg] = { id, salt, hash: hashPassword(pw, salt), created: Date.now() };
      writeJSON('users.json', users);
      states[id] = { rev: 0, data: null, updated: 0 };
      return send(res, 200, { token: issueToken(id), login: lg });
    }
    const user = users[lg];
    if (!user || !checkPassword(pw, user)) { noteAttempt(ip); return send(res, 401, { error: 'Неверный логин или пароль.' }); }
    return send(res, 200, { token: issueToken(user.id), login: lg });
  }

  const uid = auth(req);
  if (!uid) return send(res, 401, { error: 'Нужно войти.' });

  if (p === '/api/logout' && req.method === 'POST') {
    delete tokens[sha(req.headers.authorization.slice(7))];
    writeJSON('tokens.json', tokens);
    return send(res, 200, { ok: true });
  }
  if (p === '/api/state' && req.method === 'GET') {
    const st = states[uid] || { rev: 0, data: null };
    return send(res, 200, { rev: st.rev, data: st.data });
  }
  if (p === '/api/state' && req.method === 'PUT') {
    const { rev, data } = await readBody(req);
    const st = states[uid] || (states[uid] = { rev: 0, data: null, updated: 0 });
    if (rev !== st.rev) return send(res, 409, { rev: st.rev, data: st.data }); // кто-то успел раньше — слей и повтори
    if (!data || typeof data !== 'object') return send(res, 400, { error: 'bad data' });
    st.rev += 1; st.data = data; st.updated = Date.now();
    writeJSON(stateFile(uid), st);
    return send(res, 200, { rev: st.rev });
  }
  if (p === '/api/push/key' && req.method === 'GET') {
    return send(res, 200, { key: webpush ? vapid.publicKey : null });
  }
  if (p === '/api/push/subscribe' && req.method === 'POST') {
    const { subscription } = await readBody(req);
    if (!subscription || typeof subscription.endpoint !== 'string' || !/^https:\/\//.test(subscription.endpoint)) return send(res, 400, { error: 'bad subscription' });
    const subs = readJSON(pushFile(uid), []).filter(s => s.endpoint !== subscription.endpoint);
    subs.push(subscription);
    writeJSON(pushFile(uid), subs.slice(-10));
    return send(res, 200, { ok: true, devices: Math.min(subs.length, 10) });
  }
  if (p === '/api/push/test' && req.method === 'POST') {
    const r = await sendPush(uid, { title: 'Росток', body: 'Уведомления работают. Так я буду спрашивать, как успехи, пока идёт таймер.', tag: 'rostok-test' });
    return send(res, 200, r);
  }
  return send(res, 404, { error: 'not found' });
}

// ---------- статические файлы приложения ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const PUBLIC = new Set(['/index.html', '/app.js', '/style.css', '/sw.js', '/manifest.webmanifest']);
function serveStatic(req, res, url) {
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  if (!PUBLIC.has(p) && !/^\/icons\/[a-z0-9-]+\.(png|svg)$/.test(p)) { res.writeHead(404); return res.end('Not found'); }
  const file = path.join(ROOT, p);
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': p === '/sw.js' || p === '/index.html' ? 'no-cache' : 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    return serveStatic(req, res, url);
  } catch (e) {
    send(res, e.code === 413 ? 413 : e.code === 400 ? 400 : 500, { error: e.code ? e.message : 'server error' });
    if (!e.code) console.error(e);
  }
});
server.listen(PORT, HOST, () => console.log(`Росток: http://${HOST}:${PORT}  (данные: ${DATA})`));
