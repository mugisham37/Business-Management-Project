import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import React from "react";
import "./globals.css";
import "@/lib/error-handling/error-boundary.css";
import { ApolloProvider } from "@/lib/apollo";
import { PerformanceMetrics } from "@/components/performance/PerformanceMetrics";
import { setupErrorBoundaryHierarchy, initializeErrorHandling } from "@/lib/error-handling";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Next.js GraphQL Foundation",
  description: "Enterprise-grade Next.js foundation with GraphQL integration",
  keywords: ["Next.js", "GraphQL", "TypeScript", "Enterprise", "Multi-tenant"],
  authors: [{ name: "Next.js GraphQL Foundation" }],
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: "Next.js GraphQL Foundation",
    description: "Enterprise-grade Next.js foundation with GraphQL integration",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Next.js GraphQL Foundation",
    description: "Enterprise-grade Next.js foundation with GraphQL integration",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Initialize error handling system
  React.useEffect(() => {
    initializeErrorHandling({
      errorReporting: {
        enabled: process.env.NODE_ENV === 'production',
        environment: process.env.NODE_ENV as any,
        sampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      },
      networkRetry: {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 30000,
      },
      circuitBreaker: {
        failureThreshold: 5,
        resetTimeout: 60000,
      },
    });
  }, []);

  const ErrorBoundaries = setupErrorBoundaryHierarchy();

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ErrorBoundaries.App>
          <ApolloProvider>
            <ErrorBoundaries.Page>
              {children}
            </ErrorBoundaries.Page>
            <PerformanceMetrics />
          </ApolloProvider>
        </ErrorBoundaries.App>
      </body>
    </html>
  );
}
