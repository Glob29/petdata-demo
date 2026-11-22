'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const CACHE_DIR = path.join(__dirname, '..', 'cache');
const USER_AGENT = 'PetDataBot/0.1 (+https://example.local/petdata; contact: data@example.local)';
const DELAY_MS = 350;

fs.mkdirSync(CACHE_DIR, { recursive: true });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cachePath(url) {
  const hash = crypto.createHash('sha1').update(url).digest('hex');
  return path.join(CACHE_DIR, `${hash}.html`);
}

async function fetchText(url, { timeoutMs = 20000, retries = 2, useCache = true } = {}) {
  const file = cachePath(url);
  if (useCache && fs.existsSync(file)) {
    const stat = fs.statSync(file);
    if (Date.now() - stat.mtimeMs < 12 * 60 * 60 * 1000) {
      return { html: fs.readFileSync(file, 'utf8'), status: 200, cached: true, cachePath: file };
    }
  }

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(url, {
        headers: {
          'user-agent': USER_AGENT,
          'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'ru-RU,ru;q=0.9,en;q=0.8'
        },
        signal: controller.signal,
        redirect: 'follow'
      });
      clearTimeout(timer);
      const html = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      fs.writeFileSync(file, html, 'utf8');
      await sleep(DELAY_MS);
      return { html, status: response.status, cached: false, cachePath: file };
    } catch (error) {
      lastError = error;
      await sleep(500 * (attempt + 1));
    }
  }
  throw lastError;
}

module.exports = { fetchText, sleep, CACHE_DIR };
