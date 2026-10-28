import Head from 'next/head';
import { isAuthenticated } from '../../lib/delivery/auth';
import DeliveryApp from '../../components/delivery/DeliveryApp';

// Private delivery workspace (Samuel only). Never indexed, never in the sitemap.
// The server checks the session BEFORE any page is rendered; the data itself is
// fetched from /api/delivery/*, which checks the session again on every request.
export async function getServerSideProps({ req, res, params }) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const slug = (params && params.slug) || [];
  const signedIn = isAuthenticated(req);
  if (!signedIn && slug[0] !== 'login') return { redirect: { destination: '/delivery/login', permanent: false } };
  if (signedIn && slug[0] === 'login') return { redirect: { destination: '/delivery', permanent: false } };
  if (slug.length > 1) return { notFound: true };
  return { props: { slug } };
}

export default function DeliveryPage({ slug }) {
  return (
    <>
      <Head>
        <title>Delivery workspace | Asovix</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <DeliveryApp slug={slug} />
    </>
  );
}
