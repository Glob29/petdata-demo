#!/bin/sh
# Запуск API и UI в одном контейнере.
# База лежит в /data (том), код — в /app (только чтение).
set -e

if [ ! -f "$PETDATA_DB" ]; then
  echo "[start] База $PETDATA_DB не найдена — собираю демо из seed"
  node /app/db/import.js
  echo "[start] Готово. Для полной базы смонтируйте файл в /data/petdata.db"
fi

node /app/api/server.js &
API_PID=$!
trap 'kill "$API_PID" 2>/dev/null || true' TERM INT

node /app/ui/server.js &
UI_PID=$!

# Если UI упал — гасим контейнер и API.
wait "$UI_PID"
