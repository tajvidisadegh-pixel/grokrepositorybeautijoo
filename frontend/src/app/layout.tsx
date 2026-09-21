import type { Metadata } from 'next';
import { AuthProvider } from '@/contexts/auth-context';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import './globals.css';

const appName = process.env.NEXT_PUBLIC_APP_NAME || 'Beautijoo';
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: `${appName} | رزرو آنلاین خدمات زیبایی`,
    template: `%s | ${appName}`,
  },
  description:
    'رزرو آنلاین خدمات زیبایی با زیباگران حرفه‌ای — آرایش، ناخن، پوست و بیشتر در سراسر ایران.',
  robots: { index: true, follow: true },
  alternates: { canonical: appUrl },
  openGraph: {
    type: 'website',
    locale: 'fa_IR',
    siteName: appName,
    title: `${appName} | رزرو آنلاین خدمات زیبایی`,
    description:
      'رزرو آنلاین خدمات زیبایی با زیباگران حرفه‌ای — آرایش، ناخن، پوست و بیشتر در سراسر ایران.',
    url: appUrl,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${appName} | رزرو آنلاین خدمات زیبایی`,
    description:
      'رزرو آنلاین خدمات زیبایی با زیباگران حرفه‌ای در سراسر ایران.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen flex flex-col antialiased">
        <AuthProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
