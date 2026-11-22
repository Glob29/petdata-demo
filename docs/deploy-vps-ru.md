# PetData на VPS в Docker

Схема разделения:

- **GitHub** — только код: API, UI, скрипты, схема, документация. Ни базы, ни кэша.
- **VPS** — контейнер с кодом и **том `./data`** с файлом базы. Данные живут на сервере, а не в git.
- **База** переносится одним файлом `petdata.db` и монтируется в контейнер как `/data/petdata.db`.

```
VPS
└── /opt/petdata
    ├── (код из GitHub)
    ├── docker-compose.yml
    └── data/
        └── petdata.db   ← том, единственное место с данными
```

---

## 1. Что нужно на VPS

- Ubuntu 22.04/24.04 или Debian 12, root или sudo;
- Docker и плагин compose;
- открытый порт (по умолчанию 8790 для UI, 8787 для API).

```bash
curl -fsSL https://get.docker.com | sh
docker --version && docker compose version
```

---

## 2. Забрать код

```bash
mkdir -p /opt/petdata && cd /opt/petdata
git clone https://github.com/Glob29/petdata-demo.git .
```

Если репозиторий станет приватным, используйте deploy key или
`https://<token>@github.com/Glob29/petdata-demo.git`.

---

## 3. Перенести базу

На локальной машине подготовить файл (схлопывает WAL):

```powershell
node scripts/export-db.js
# data/petdata.db
```

Загрузить на сервер:

```powershell
scp data/petdata.db root@ВАШ_IP:/opt/petdata/data/petdata.db
```

Если базы нет, контейнер соберёт демо из seed (7 SKU) сам — но полные 499 SKU
и цены придут только с этим файлом.

---

## 4. Запустить

```bash
cd /opt/petdata
docker compose up -d --build
docker compose ps
docker compose logs -f petdata
```

Проверка:

```bash
curl -s http://127.0.0.1:8790/ | head -c 200
curl -s http://127.0.0.1:8787/v1/health
```

Открыть в браузере: `http://ВАШ_IP:8790/`.

---

## 5. Домен и HTTPS (по желанию)

Если DNS-имя уже указывает на VPS, раскомментируйте сервис `caddy` в
`docker-compose.yml` и создайте `deploy/Caddyfile`:

```caddy
korma.example.com {
    reverse_proxy petdata:8790
}
```

`docker compose up -d` — Caddy сам получит сертификат Let's Encrypt.
Порт 80 и 443 должны быть открыты, 8790 можно закрыть снаружи.

---

## 6. Пароль на вход

По умолчанию авторизации нет: кто знает адрес — видит базу. Минимальная защита
без правки кода — Basic Auth в Caddy:

```bash
docker run --rm caddy:2-alpine caddy hash-password --plaintext 'ваш-пароль'
```

```caddy
korma.example.com {
    basic_auth {
        tester $2a$14$ЗАМЕНИТЕ_НА_ХЕШ
    }
    reverse_proxy petdata:8790
}
```

---

## 7. Обновление и бэкап

```bash
# обновить код
cd /opt/petdata && git pull && docker compose up -d --build

# бэкап базы (остановить, скопировать, поднять)
docker compose stop petdata
tar czf /root/petdata-backup-$(date +%F).tar.gz data/
docker compose start petdata
```

Раз в сутки удобно повесить в cron:

```cron
0 3 * * * cd /opt/petdata && docker compose stop petdata && tar czf /root/petdata-$(date +\%F).tar.gz data/ && docker compose start petdata
```

---

## 8. Ограничения

- Контейнер содержит UI и API; база — SQLite в томе, один экземпляр. Для нагрузки
  больше нескольких тестировщиков нужен переход на Postgres (`db/schema.postgres.sql`).
- Цена за грамм и прочие производные поля считаются скриптами (`db/compute-prices.js`)
  при обновлении данных, а не в момент запроса.
- Туннель cloudflared для VPS не нужен: у сервера есть публичный IP. Он остаётся
  удобным только для локальной машины.
