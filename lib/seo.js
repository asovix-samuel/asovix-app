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
  founderLinkedin: 'https://www.linkedin.com/in/samuel-adu1/',
  founder: 'Samuel Adu',
  // Wide, real photograph — a genuine picture of the business, not a stock graphic.
  ogImage: '/founder-research.jpg',
  ogImageW: 1600,
  ogImageH: 1067,
};

export const canonical = (path = '/') => SITE.url + (path === '/' ? '' : path);

// Stable entity ids. Everything references these rather than repeating a
// definition, so there is exactly one Organization and one Person on the site.
export const ORG_ID = SITE.url + '/#organization';
export const PERSON_ID = SITE.url + '/samuel-adu#person';

// Independent third-party coverage. Both articles feature Samuel and Asovix in
// the Student Inc. 2026 showcase photo caption rather than the article body —
// described on the site as being "pictured/featured", never as an endorsement.
export const MEDIA = [
  {
    publisher: 'Business Plus',
    title: 'Next-gen entrepreneurs showcase 50 emerging business ideas',
    url: 'https://businessplus.ie/enterprise/next-gen-entrepreneurs-business-ideas/',
    date: '2026-08-21',
  },
  {
    publisher: 'The Avondhu',
    title: 'Student entrepreneurs put new business ideas to the test through Student Inc. 2026',
    url: 'https://avondhupress.ie/student-entrepreneurs-put-new-business-ideas-to-the-test-through-student-inc-2026/',
    date: '2026-08-28',
  },
];

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
  '@id': ORG_ID,
  name: SITE.name,
  url: SITE.url,
  logo: SITE.url + '/logo.svg',
  image: SITE.url + SITE.ogImage,
  email: SITE.email,
  telephone: SITE.phone,
  description:
    'Asovix helps job seekers in Ireland understand why employers are not responding, and positions their existing experience for the roles they are actually targeting.',
  founder: { '@id': PERSON_ID },
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
  publisher: { '@id': ORG_ID },
});

/** Real services at real prices — taken from lib/offers.js, the single source. */
export const serviceLd = (offers) => ({
  '@context': 'https://schema.org',
  '@type': 'Service',
  '@id': SITE.url + '/#service',
  name: 'Career positioning',
  serviceType: 'Career positioning and CV, LinkedIn and interview preparation',
  provider: { '@id': ORG_ID },
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

/**
 * Samuel Adu. Every field here is supported by the site itself or by the two
 * verified press articles in MEDIA — nothing inferred, nothing embellished.
 *
 * `subjectOf` (not `sameAs`) carries the media coverage: sameAs is for other
 * profiles OF the same person, whereas these are articles ABOUT him. His home
 * area is deliberately omitted; locality is Cork, the city, only.
 */
export const personLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'Person',
  '@id': PERSON_ID,
  name: 'Samuel Adu',
  url: canonical('/samuel-adu'),
  jobTitle: 'Founder',
  description:
    'Samuel Adu is the founder of Asovix, a career positioning practice based in Cork, Ireland, working with job seekers on how their experience is communicated to employers.',
  worksFor: { '@id': ORG_ID },
  founderOf: { '@id': ORG_ID },
  // sameAs = other profiles of this same person. The media articles are ABOUT
  // him, so they stay in subjectOf below rather than being lumped in here.
  sameAs: [SITE.founderLinkedin],
  knowsAbout: [
    'Career positioning',
    'Employability',
    'CV positioning',
    'LinkedIn positioning',
    'Interview preparation',
    'Graduate recruitment in Ireland',
  ],
  address: {
    '@type': 'PostalAddress',
    addressLocality: SITE.city,
    addressRegion: SITE.region,
    addressCountry: SITE.country,
  },
  affiliation: {
    '@type': 'CollegeOrUniversity',
    name: 'Munster Technological University',
    sameAs: 'https://www.mtu.ie/',
  },
  subjectOf: MEDIA.map((m) => ({
    '@type': 'NewsArticle',
    headline: m.title,
    url: m.url,
    datePublished: m.date,
    publisher: { '@type': 'Organization', name: m.publisher },
  })),
});
