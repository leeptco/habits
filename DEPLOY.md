# Как выложить Росток на свой VPS

Сервер Ростка (папка `server/`) делает три вещи:
- **раздаёт само приложение**;
- **хранит аккаунт**: заходишь под одним логином с телефона и компьютера, и отметки везде одинаковые;
- **присылает уведомления** «Как успехи? Продолжаешь?» каждые 30 минут, пока идёт таймер.

Ему нужны **Node.js 18+**, **HTTPS** (без него iPhone не включит уведомления) и около 50 МБ места. База данных не нужна: всё хранится в JSON-файлах.

Ниже `1.2.3.4` — IP твоего сервера. Если своего домена нет, используй бесплатный адрес `rostok.1-2-3-4.sslip.io` (точки в IP заменены на дефисы). Он сам указывает на твой сервер.

---

## 1. Подключиться к серверу

```bash
ssh root@1.2.3.4
```

Дальше все команды выполняются на сервере.

## 2. Установить Node.js и git

```bash
apt update && apt install -y git nodejs npm
```

```bash
node --version
```

Нужна версия 18 или новее. Если меньше, поставь свежую (официальный репозиторий NodeSource):

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt install -y nodejs
```

## 3. Скачать код

```bash
git clone -b claude/beautiful-knuth-3f3l4u https://github.com/leeptco/habits.git /opt/rostok
```

Если ветку уже слили в `main`, убери `-b claude/beautiful-knuth-3f3l4u`.

**Если репозиторий приватный**, дай серверу ключ только для чтения:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/rostok -N ""
```

```bash
cat ~/.ssh/rostok.pub
```

Эту строку добавь на GitHub: репозиторий → **Settings → Deploy keys → Add deploy key** (галочку «Allow write access» не ставь). Потом:

```bash
GIT_SSH_COMMAND="ssh -i ~/.ssh/rostok" git clone -b claude/beautiful-knuth-3f3l4u git@github.com:leeptco/habits.git /opt/rostok
```

```bash
git -C /opt/rostok config core.sshCommand "ssh -i ~/.ssh/rostok"
```

## 4. Установить зависимости сервера

```bash
cd /opt/rostok/server && npm install --omit=dev
```

## 5. Запустить как службу (сам поднимается после перезагрузки)

Отдельный пользователь и папка для данных:

```bash
useradd --system --create-home --home-dir /var/lib/rostok --shell /usr/sbin/nologin rostok
```

Файл службы:

```bash
nano /etc/systemd/system/rostok.service
```

Вставь (почту в `VAPID_SUBJECT` замени на свою: сервисы уведомлений Apple и Google требуют контакт):

```
[Unit]
Description=Rostok
After=network.target

[Service]
User=rostok
WorkingDirectory=/opt/rostok/server
ExecStart=/usr/bin/env node server.js
Environment=PORT=8787
Environment=DATA_DIR=/var/lib/rostok
Environment=VAPID_SUBJECT=mailto:твоя-почта@example.com
Restart=always

[Install]
WantedBy=multi-user.target
```

Сохрани: `Ctrl+O`, `Enter`, `Ctrl+X`. Запусти:

```bash
systemctl daemon-reload && systemctl enable --now rostok
```

```bash
curl -s 127.0.0.1:8787/api/health
```

Должно ответить `{"ok":true,"push":true}`.

## 6. HTTPS и адрес

### Вариант A — Caddy (если веб-сервера ещё нет)

Если бот работает через long polling, веб-сервера у тебя скорее всего нет. Тогда этот вариант.

```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
```

```bash
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
```

```bash
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
```

```bash
apt update && apt install -y caddy
```

```bash
nano /etc/caddy/Caddyfile
```

Удали всё и вставь (адрес замени на свой):

```
rostok.1-2-3-4.sslip.io {
    encode gzip
    reverse_proxy 127.0.0.1:8787
}
```

```bash
systemctl reload caddy
```

### Вариант B — уже стоит nginx

```bash
nano /etc/nginx/sites-available/rostok
```

```
server {
    listen 80;
    server_name rostok.1-2-3-4.sslip.io;
    client_max_body_size 10m;
    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/rostok /etc/nginx/sites-enabled/ && nginx -t && systemctl reload nginx
```

```bash
apt install -y certbot python3-certbot-nginx && certbot --nginx -d rostok.1-2-3-4.sslip.io
```

### Порты

```bash
ufw allow 80 && ufw allow 443
```

Если `ufw` пишет «inactive», ничего делать не нужно. Ещё проверь в панели хостинга, что порты 80 и 443 открыты.

Открой `https://rostok.1-2-3-4.sslip.io`: должен появиться Росток.

---

## 7. На iPhone

1. Открой адрес в **Safari** → **Поделиться → На экран «Домой»**. Если есть переключатель **«Открывать как веб-приложение»**, включи его.
2. Открой Росток **с экрана «Домой»** → меню ☰ → **Аккаунт** → **Создать аккаунт**.
3. Там же нажми **«Включить уведомления»** и разреши их. Потом **«Прислать тестовое»**: уведомление должно прийти за пару секунд.
4. На компьютере и других устройствах просто войди под тем же логином.

**Перенос старых данных с GitHub Pages:**
1. На старом адресе: **Настройки → Сохранить копию данных**.
2. На новом: **Настройки → Загрузить копию**. Если ты уже вошла в аккаунт, данные сразу уйдут на сервер.

**Команды iPhone.** Замени адрес на новый:
- в команде «Росток» (действие **URL**): `https://новый-адрес/#sync=`;
- в автоматизации Instagram: `https://новый-адрес/?from=insta`.

Эти команды открывают Safari, а у Safari и у иконки на экране «Домой» отдельные хранилища. Поэтому **один раз войди в аккаунт и в Safari**. После этого напоминания, пришедшие через Safari, сами доедут до приложения через сервер.

**Закрыть регистрацию.** Когда твой аккаунт создан, запрети регистрацию посторонним. В файл службы добавь строку `Environment=ALLOW_SIGNUP=0` и перезапусти:

```bash
systemctl daemon-reload && systemctl restart rostok
```

---

## 8. Обновления

```bash
cd /opt/rostok && git pull && cd server && npm install --omit=dev && systemctl restart rostok
```

## 9. Резервная копия

Все аккаунты и данные лежат в `/var/lib/rostok`. Копия на свой компьютер (команду выполняй **на компьютере**):

```bash
scp -r root@1.2.3.4:/var/lib/rostok ./rostok-backup
```

## Если что-то не работает

- `systemctl status rostok` — запущен ли сервер Ростка.
- `journalctl -u rostok -n 50` — его ошибки.
- `journalctl -u caddy -n 50` — ошибки HTTPS. Чаще всего это закрытый порт 80 или адрес, который не совпадает с IP сервера.
- **Уведомления не приходят.** Росток должен быть открыт с экрана «Домой», а не в Safari. Проверь: Settings → Notifications → Росток. В Ростке нажми «Прислать тестовое».
