import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Script from 'next/script';
import { GA_ID } from '../lib/analytics';

// ── GA4 + Google Consent Mode v2 ──
// Consent defaults to DENIED for EEA compliance. The small banner below lets
// visitors accept or decline analytics cookies; the choice is remembered in
// localStorage. When consent is granted, GA4 sets its cookies and full
// measurement (including UTM/campaign attribution) works normally.
// When denied, gtag only sends cookieless pings and sets no cookies.

const CONSENT_KEY = 'asovix_consent_v1';

function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let choice = null;
    try { choice = window.localStorage.getItem(CONSENT_KEY); } catch (e) {}
    if (choice === 'granted') {
      applyConsent(true);
    } else if (choice !== 'denied') {
      setVisible(true);
    }
  }, []);

  function applyConsent(granted) {
    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        analytics_storage: granted ? 'granted' : 'denied',
      });
    }
  }

  function choose(granted) {
    try { window.localStorage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied'); } catch (e) {}
    applyConsent(granted);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 16, left: 16, right: 16, zIndex: 9999,
      maxWidth: 420, margin: '0 auto',
      background: 'rgba(10,17,32,0.97)', border: '1px solid rgba(77,141,255,0.3)',
      borderRadius: 14, padding: '16px 18px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{ fontSize: 13, color: '#C7D4E8', lineHeight: 1.6, marginBottom: 12 }}>
        We use Google Analytics to understand how visitors find and use Asovix.
        No personal details are sent — see our{' '}
        <a href="/privacy" style={{ color: '#7FA8F5' }}>privacy policy</a>.
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={() => choose(true)}
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(180deg, #3B7DF0, #2557C7)', color: '#fff',
            fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Accept analytics
        </button>
        <button
          onClick={() => choose(false)}
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.16)',
            color: '#9FB0C8', fontSize: 13, fontWeight: 500, fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Decline
        </button>
      </div>
    </div>
  );
}

export default function App({ Component, pageProps }) {
  const router = useRouter();

  // GA4 fires page_view automatically on first load; this covers
  // client-side route changes (Next.js SPA navigation).
  useEffect(() => {
    const onRouteChange = (url) => {
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'page_view', { page_path: url });
      }
    };
    router.events.on('routeChangeComplete', onRouteChange);
    return () => router.events.off('routeChangeComplete', onRouteChange);
  }, [router.events]);

  return (
    <>
      {/* Consent Mode v2 defaults MUST be set before the GA library loads */}
      <Script id="ga-consent-default" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('consent', 'default', {
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
            analytics_storage: 'denied',
            wait_for_update: 500
          });
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
      <Script
        id="ga-gtag"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Component {...pageProps} />
      <ConsentBanner />
    </>
  );
}
