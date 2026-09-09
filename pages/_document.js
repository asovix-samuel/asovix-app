import { Html, Head, Main, NextScript } from 'next/document';
import { SITE } from '../lib/seo';

// Site-wide document shell.
//
// Two things live here rather than per page:
//  - lang="en-IE": the site had no lang attribute at all, which hurts both
//    screen readers and Google's understanding of the target market.
//  - The Google Fonts stylesheet: Next warns when a stylesheet is added through
//    next/head on a page, and loading it once here avoids repeating it per page.
export default function Document() {
  return (
    <Html lang={SITE.lang}>
      <Head>
        <meta charSet="utf-8" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="theme-color" content="#060B16" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Serif+Display:ital@0;1&display=swap"
          rel="stylesheet"
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
