import { Html, Head, Main, NextScript } from 'next/document';
import { DocumentHead } from '../src/components/DocumentHead';

export default function Document() {
  return (
    <Html>
      <Head>
        <DocumentHead />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
