# PetData: API + UI в одном образе.
# Код копируется в образ, база монтируется томом в /data — данные не живут в git.
FROM node:24-slim

WORKDIR /app

# Только код: без базы, кэша страниц и сгенерированного отчёта (см. .dockerignore).
COPY . .

RUN chmod +x /app/docker/start.sh \
 && mkdir -p /data \
 && chown -R node:node /data

USER node

ENV NODE_ENV=production \
    PETDATA_DB=/data/petdata.db \
    PETDATA_API_HOST=0.0.0.0 \
    PETDATA_API_PORT=8787 \
    PETDATA_PORT=8787 \
    PETDATA_UI_HOST=0.0.0.0 \
    PETDATA_UI_PORT=8790 \
    PETDATA_MDNS=off

EXPOSE 8787 8790

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8790/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["sh", "/app/docker/start.sh"]
