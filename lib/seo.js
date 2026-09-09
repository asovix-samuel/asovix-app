// ── Asovix SEO helpers ──
// One place for site-wide identity, canonical URLs and structured data.
//
// CANONICAL DOMAIN: https://www.asovix.com
// asovix.com issues a 308 redirect to www, so www is the canonical host. Every
// canonical, Open Graph URL and sitemap entry must use it, or we split signals
// across two hostnames.
//
// MARKET: Ireland. Locale is en-IE and areaServed is Ireland. Cork is where the
// business is based; Ireland is the market it serves — the schema says both.

import Head from 'next/head';

export const SITE = {
  url: 'https://www.asovix.com',
  name: 'Asovix',
  legalName: 'Asovix',
  tagline: 'Career positioning for job seekers in Ireland',
  locale: 'en_IE',
  lang: 'en-IE',
  city: 'Cork',
  region: 'County Cork',
  country: 'IE',
  email: 'info@asovix.com',
  phone: '+353834284320',
  linkedin: 'https://www.linkedin.com/company/asovix/',
  founder: 'Samuel Adu',
  // Wide, real photograph — a genuine picture of the business, not a stock graphic.
  ogImage: '/founder-research.jpg',
  ogImageW: 1600,
  ogImageH: 1067,
};

export const canonical = (path = '/') => SITE.url + (path === '/' ? '' : path);

/**
 * Per-page head. Every page must pass a unique title, description and path.
 * `robots` defaults to indexable; pass 'noindex,nofollow' for pages that should
 * never appear in search (payment confirmations, retired flows).
 */
export function Seo({
  title,
  description,
  path = '/',
  robots = 'index,follow,max-image-preview:large',
  image = SITE.ogImage,
  type = 'website',
  jsonLd,
}) {
  const url = canonical(path);
  const img = image.startsWith('http') ? image : SITE.url + image;
  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={robots} />
      <link rel="canonical" href={url} />

      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE.name} />
      <meta property="og:locale" content={SITE.locale} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={img} />
      <meta property="og:image:width" content={String(SITE.ogImageW)} />
      <meta property="og:image:height" content={String(SITE.ogImageH)} />
      <meta property="og:image:alt" content="Samuel Adu, founder of Asovix, with printed candidate results and the Asovix site" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={img} />

      {jsonLd && jsonLd.map((node, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(node) }}
        />
      ))}
    </Head>
  );
}

/* ──────────────────────────────────────────────────────────────
   STRUCTURED DATA
   Only describes things actually visible on the site. No ratings,
   no reviews, no awards, no invented statistics.
   ────────────────────────────────────────────────────────────── */

export const organizationLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': SITE.url + '/#organization',
  name: SITE.name,
  url: SITE.url,
  logo: SITE.url + '/logo.svg',
  image: SITE.url + SITE.ogImage,
  email: SITE.email,
  telephone: SITE.phone,
  description:
    'Asovix helps job seekers in Ireland understand why employers are not responding, and positions their existing experience for the roles they are actually targeting.',
  founder: { '@type': 'Person', name: SITE.founder },
  address: {
    '@type': 'PostalAddress',
    addressLocality: SITE.city,
    addressRegion: SITE.region,
    addressCountry: SITE.country,
  },
  areaServed: { '@type': 'Country', name: 'Ireland' },
  sameAs: [SITE.linkedin],
});

export const websiteLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': SITE.url + '/#website',
  url: SITE.url,
  name: SITE.name,
  inLanguage: SITE.lang,
  publisher: { '@id': SITE.url + '/#organization' },
});

/** Real services at real prices — taken from lib/offers.js, the single source. */
export const serviceLd = (offers) => ({
  '@context': 'https://schema.org',
  '@type': 'Service',
  '@id': SITE.url + '/#service',
  name: 'Career positioning',
  serviceType: 'Career positioning and CV, LinkedIn and interview preparation',
  provider: { '@id': SITE.url + '/#organization' },
  areaServed: { '@type': 'Country', name: 'Ireland' },
  audience: { '@type': 'Audience', audienceType: 'Job seekers, graduates and career changers in Ireland' },
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Asovix career positioning services',
    itemListElement: Object.values(offers).map((o) => ({
      '@type': 'Offer',
      name: o.name,
      description: o.short,
      price: String(o.price),
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
    })),
  },
});

export const breadcrumbLd = (crumbs) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: crumbs.map((c, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: c.name,
    item: canonical(c.path),
  })),
});
