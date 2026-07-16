/** @type {import('next').NextConfig} */
const securityHeaders = [
  // Force HTTPS for a year, incl. subdomains
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  // Never let the site be iframed (clickjacking)
  { key: 'X-Frame-Options', value: 'DENY' },
  // No MIME sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Don't leak full URLs to third parties
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // We don't use these browser features
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse', 'mammoth', 'docx'],
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

module.exports = nextConfig;
