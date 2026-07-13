// Diagnostic endpoint: shows WHICH env vars are set (never their values).
// Visit https://your-app.vercel.app/api/health after deploying.
export default function handler(req, res) {
  const vars = [
    'ANTHROPIC_API_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASS',
    'OWNER_EMAIL',
    'NEXT_PUBLIC_APP_URL',
  ];
  const status = {};
  for (const v of vars) {
    status[v] = process.env[v] ? 'SET' : 'MISSING';
  }
  status.stripeMode = (process.env.STRIPE_SECRET_KEY || '').startsWith('sk_live')
    ? 'LIVE'
    : (process.env.STRIPE_SECRET_KEY || '').startsWith('sk_test')
      ? 'TEST'
      : 'UNKNOWN';
  res.status(200).json(status);
}
