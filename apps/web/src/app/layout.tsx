import { Providers } from '@/components/providers';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap', // Optimize font loading
  preload: true,
});

export const metadata: Metadata = {
  title: 'Fullstack Monolith - Authentication Platform',
  description: 'Modern authentication platform with web and mobile support',
  keywords: ['authentication', 'security', 'MFA', 'OAuth', 'WebAuthn'],
  authors: [{ name: 'Fullstack Team' }],
  creator: 'Fullstack Team',
  publisher: 'Fullstack Team',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://fullstack-app.com',
    title: 'Fullstack Monolith - Authentication Platform',
    description: 'Modern authentication platform with web and mobile support',
    siteName: 'Fullstack Monolith',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Fullstack Monolith - Authentication Platform',
    description: 'Modern authentication platform with web and mobile support',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        {/* Preconnect to external domains */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* DNS prefetch for performance */}
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        <link rel="dns-prefetch" href="//fonts.gstatic.com" />

        {/* Manifest for PWA */}
        <link rel="manifest" href="/manifest.json" />

        {/* Theme color */}
        <meta name="theme-color" content="#3b82f6" />

        {/* Apple touch icon */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>

        {/* Service Worker Registration */}
        <Script
          id="sw-registration"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(registration) {
                      console.log('SW registered: ', registration);
                    })
                    .catch(function(registrationError) {
                      console.log('SW registration failed: ', registrationError);
                    });
                });
              }
            `,
          }}
        />

        {/* Performance monitoring initialization */}
        <Script
          id="performance-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              // Initialize performance monitoring
              if (typeof window !== 'undefined') {
                // Track page load performance
                window.addEventListener('load', function() {
                  setTimeout(function() {
                    const perfData = performance.getEntriesByType('navigation')[0];
                    if (perfData) {
                      console.log('Page load time:', perfData.loadEventEnd - perfData.loadEventStart);
                    }
                  }, 0);
                });
                
                // Track Core Web Vitals
                import('/src/lib/simple-performance.js').then(function(module) {
                  if (module.initializePerformanceMonitoring) {
                    module.initializePerformanceMonitoring();
                  }
                  if (module.checkPerformanceBudget) {
                    setTimeout(module.checkPerformanceBudget, 2000);
                  }
                }).catch(function(error) {
                  console.warn('Failed to load performance monitoring:', error);
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
