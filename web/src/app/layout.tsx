import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '青果 発注・振分',
  description: 'キリン堂 青果 自動発注・店舗振分',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="text-slate-900 antialiased">{children}</body>
    </html>
  );
}
