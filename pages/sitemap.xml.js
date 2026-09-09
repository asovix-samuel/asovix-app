import { SITE } from '../lib/seo';

// XML sitemap, generated rather than hand-maintained so it cannot drift.
//
// Only indexable, public pages belong here. Deliberately excluded:
//   /success  — payment confirmation, noindex
//   /start    — retired flow, redirects to /#pricing
//   /api/*    — not pages
//
// When the Irish content clusters land (/cv/, /graduate-careers/, /interviews/,
// /linkedin/, /job-search/, /career-change/), add them to PAGES below and the
// sitemap picks them up automatically.
const PAGES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/diagnosis', changefreq: 'monthly', priority: '0.9' },
  { path: '/organisations', changefreq: 'monthly', priority: '0.7' },
  { path: '/privacy', changefreq: 'yearly', priority: '0.2' },
  { path: '/terms', changefreq: 'yearly', priority: '0.2' },
];

function buildSitemap() {
  const today = new Date().toISOString().split('T')[0];
  const urls = PAGES.map(
    (p) => `  <url>
    <loc>${SITE.url}${p.path === '/' ? '/' : p.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`
  ).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

export async function getServerSideProps({ res }) {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate');
  res.write(buildSitemap());
  res.end();
  return { props: {} };
}

export default function Sitemap() {
  return null;
}
