// Writes dist/sitemap.xml and points robots.txt at it. Needs SITE_URL (e.g. https://www.example.com) at build time;
// without it the step is skipped, because a sitemap must use absolute URLs.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import console from 'node:console';

const site = (process.env.SITE_URL || '').replace(/\/+$/, '');
if (!site) {
  console.warn('sitemap: SITE_URL is not set, skipping sitemap.xml');
  process.exit(0);
}
const pages = ['/', '/login', '/register', '/status', '/changelog'];
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(p => `  <url><loc>${site}${p}</loc></url>`).join('\n')}\n</urlset>\n`;
writeFileSync('dist/sitemap.xml', xml);
if (existsSync('dist/robots.txt')) {
  const robots = readFileSync('dist/robots.txt', 'utf8').trimEnd();
  writeFileSync('dist/robots.txt', `${robots}\nSitemap: ${site}/sitemap.xml\n`);
}
console.info(`sitemap: wrote ${pages.length} URLs for ${site}`);
