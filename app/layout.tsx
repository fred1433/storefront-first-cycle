import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mrs Wordsmith | Product highlights for review',
  description:
    'A first proposal batch of product highlights, prepared from public product pages. Nothing has been changed in the store.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
