import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useTheme } from '../src/contexts/ThemeContext';

export default function App({ Component, pageProps }) {
  const { isDark } = useTheme();
  const router = useRouter();

  useEffect(() => {
    // Add favicon links to the head
    const faviconLinks = [
      { rel: 'icon', href: '/favicon.ico', sizes: 'any' },
      { rel: 'icon', type: 'image/png', sizes: '512x512', href: '/favicon-512x512.png' },
      { rel: 'apple-touch-icon', sizes: '180x180', href: '/favicon-512x512.png' },
      { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/favicon-512x512.png' },
      { rel: 'shortcut icon', href: '/favicon.ico' }
    ];

    // Add theme color
    const themeColor = document.createElement('meta');
    themeColor.name = 'theme-color';
    themeColor.content = isDark ? '#000000' : '#ffffff';
    document.head.appendChild(themeColor);

    // Add all favicon links
    const links = faviconLinks.map(linkProps => {
      const link = document.createElement('link');
      Object.entries(linkProps).forEach(([key, value]) => {
        link.setAttribute(key, value);
      });
      document.head.appendChild(link);
      return link;
    });

    // Cleanup
    return () => {
      document.head.removeChild(themeColor);
      links.forEach(link => {
        if (link.parentNode === document.head) {
          document.head.removeChild(link);
        }
      });
    };
  }, [isDark]);

  return (
    <>
      <Head>
        <title>Giga BhAI</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="manifest" href="/site.webmanifest" />
      </Head>
      <Component {...pageProps} key={router.asPath} />
    </>
  );
}
