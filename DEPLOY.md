# Как выложить Росток на свой VPS

Росток — это статический сайт: `index.html`, `style.css`, `app.js`, `sw.js`, `manifest.webmanifest` и папка `icons/`. Ни базы данных, ни Node.js, ни Python ему не нужно. Достаточно веб-сервера, который отдаёт эти файлы по **HTTPS**. Без HTTPS iPhone не включит офлайн-режим и копирование адресов.

Ниже два варианта:
- **A.** На сервере ещё нет веб-сервера. Ставим Caddy: он сам получает и продлевает HTTPS-сертификат.
- **B.** На сервере уже работает nginx, например для webhook телеграм-бота. Добавляем ему ещё один сайт.

Если бот работает через long polling (`bot.polling()`, `run_polling()`), веб-сервера у тебя скорее всего нет. Тогда выбирай вариант A.

---

## 0. Что понадобится

1. **IP-адрес сервера.** Он есть в панели хостинга, ниже обозначен как `1.2.3.4`.
2. **Адрес сайта.** Подойдёт любой твой домен. Если домена нет, используй бесплатный адрес из IP: `rostok.1-2-3-4.sslip.io`, где точки в IP заменены на дефисы. Такой адрес сам указывает на твой сервер, ничего настраивать не нужно.
3. Доступ к серверу по SSH, как при установке бота:

```bash
ssh root@1.2.3.4
```

Дальше все команды выполняются на сервере.

---

## 1. Скачать код на сервер

```bash
apt update && apt install -y git
```

```bash
git clone -b claude/beautiful-knuth-3f3l4u https://github.com/leeptco/habits.git /var/www/rostok
```

Если ветку уже слили в `main`, клонируй без `-b claude/beautiful-knuth-3f3l4u`.

**Если репозиторий приватный**, git попросит логин и пароль. Удобнее дать серверу ключ только для чтения:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/rostok -N ""
```

```bash
cat ~/.ssh/rostok.pub
```

Скопируй выведенную строку и добавь её на GitHub: репозиторий → **Settings → Deploy keys → Add deploy key**. Галочку «Allow write access» не ставь. Потом клонируй так:

```bash
GIT_SSH_COMMAND="ssh -i ~/.ssh/rostok" git clone -b claude/beautiful-knuth-3f3l4u git@github.com:leeptco/habits.git /var/www/rostok
```

```bash
cd /var/www/rostok && git config core.sshCommand "ssh -i ~/.ssh/rostok"
```

---

## 2A. Веб-сервер Caddy (если веб-сервера ещё нет)

Установка (официальный репозиторий Caddy для Ubuntu/Debian):

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

Открой файл настроек:

```bash
nano /etc/caddy/Caddyfile
```

Удали всё, что там есть, и вставь (адрес замени на свой):

```
rostok.1-2-3-4.sslip.io {
    root * /var/www/rostok
    file_server
    encode gzip
    @hidden path /.git* /DEPLOY.md /README.md
    respond @hidden 404
    header /sw.js Cache-Control "no-cache"
}
```

Сохрани: `Ctrl+O`, `Enter`, `Ctrl+X`. Перезапусти Caddy:

```bash
systemctl reload caddy
```

Через минуту открой `https://rostok.1-2-3-4.sslip.io` — должен открыться Росток с замочком в адресной строке.

## 2B. Если уже стоит nginx

```bash
nano /etc/nginx/sites-available/rostok
```

```
server {
    listen 80;
    server_name rostok.1-2-3-4.sslip.io;
    root /var/www/rostok;
    index index.html;
    location ~ /\.git { deny all; }
    location = /sw.js { add_header Cache-Control "no-cache"; }
}
```

```bash
ln -s /etc/nginx/sites-available/rostok /etc/nginx/sites-enabled/ && nginx -t && systemctl reload nginx
```

HTTPS-сертификат:

```bash
apt install -y certbot python3-certbot-nginx
```

```bash
certbot --nginx -d rostok.1-2-3-4.sslip.io
```

---

## 3. Открыть порты (если включён файрвол)

```bash
ufw allow 80 && ufw allow 443
```

Если `ufw` пишет «inactive», ничего делать не нужно. Также проверь в панели хостинга, что порты 80 и 443 не закрыты.

---

## 4. Обновлять сайт

После каждого нового изменения в репозитории:

```bash
cd /var/www/rostok && git pull
```

Перезапускать Caddy или nginx не нужно. Чтобы обновлялось само каждые 10 минут:

```bash
(crontab -l 2>/dev/null; echo "*/10 * * * * cd /var/www/rostok && git pull -q") | crontab -
```

---

## 5. Перенести данные и команды на новый адрес

Данные Ростка хранятся в телефоне отдельно для каждого адреса сайта. На новом адресе Росток откроется пустым, поэтому:

1. На **старом** адресе (GitHub Pages): **Ещё → Сохранить копию данных**. Файл сохранится в «Файлы».
2. На **новом** адресе: **Ещё → Загрузить копию** и выбери этот файл.
3. В «Командах» замени старый адрес на новый:
   - в команде **«Росток»**, в действии **URL** (`https://новый-адрес/#sync=`);
   - в автоматизации для **Instagram** (`https://новый-адрес/?from=insta`).
4. Ярлык Ростка на экране «Домой» добавь заново с нового адреса.

---

## Если не открывается

- `systemctl status caddy` или `systemctl status nginx` — работает ли веб-сервер.
- `journalctl -u caddy -n 50` — ошибки Caddy, например «не удалось получить сертификат». Чаще всего это значит, что закрыт порт 80 или адрес не совпадает с IP сервера.
- `ls /var/www/rostok` — на месте ли файлы, есть ли `index.html`.
