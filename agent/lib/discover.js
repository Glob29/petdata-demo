'use strict';

const { fetchText } = require('./http');

function extractLocs(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].replace(/&amp;/g, '&'));
}

function extractLinks(html, baseUrl) {
  const links = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((match) => {
    try {
      const parsed = new URL(match[1], baseUrl);
      parsed.hash = '';
      parsed.search = '';
      return parsed.href;
    } catch {
      return null;
    }
  });
  return [...new Set(links.filter(Boolean))];
}

function segmentCount(url) {
  try {
    return new URL(url).pathname.split('/').filter(Boolean).length;
  } catch {
    return 0;
  }
}

function isProductUrl(url, config) {
  const pathname = new URL(url).pathname;
  if (!config.pattern || !new RegExp(config.pattern, 'i').test(pathname)) return false;
  if (config.include && !new RegExp(config.include, 'i').test(url)) return false;
  if (config.exclude && new RegExp(config.exclude, 'i').test(url)) return false;
  if (config.min_segments && segmentCount(url) < config.min_segments) return false;
  if (/\.(css|js|png|jpe?g|webp|svg|pdf)$/i.test(pathname)) return false;
  return true;
}

async function discover(config) {
  const discovery = config.discovery || {};
  const urls = new Set();

  if (discovery.type === 'sitemap') {
    const response = await fetchText(discovery.url);
    for (const loc of extractLocs(response.html)) {
      if (isProductUrl(loc, discovery)) urls.add(loc);
    }
  }

  if (discovery.type === 'links') {
    for (const page of discovery.urls || []) {
      try {
        const response = await fetchText(page);
        for (const link of extractLinks(response.html, page)) {
          if (isProductUrl(link, discovery)) urls.add(link);
        }
      } catch (error) {
        console.error(`  discovery skip ${page}: ${error.message}`);
      }
    }
  }

  return [...urls].slice(0, config.max_products || 20);
}

module.exports = { discover, isProductUrl, extractLocs };
