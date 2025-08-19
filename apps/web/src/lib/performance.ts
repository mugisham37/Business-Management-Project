import { ComponentType, lazy, LazyExoticComponent } from 'react';

// Lazy loading utility with error boundary
export function lazyLoad<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  fallback?: ComponentType
): LazyExoticComponent<T> {
  const LazyComponent = lazy(importFunc);

  // Add display name for debugging
  LazyComponent.displayName = `LazyLoaded(${importFunc.name || 'Component'})`;

  return LazyComponent;
}

// Code splitting utility for route-based splitting
export function createAsyncRoute<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>
) {
  return lazyLoad(importFunc);
}

// Preload utility for critical resources
export function preloadRoute(routeImport: () => Promise<any>) {
  // Preload the route component
  const componentImport = routeImport();

  // Return a function to cancel preloading if needed
  return () => {
    // In a real implementation, you might want to cancel the import
    // For now, we just let it complete
  };
}

// Image optimization utility
export interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  priority?: boolean;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
  sizes?: string;
  quality?: number;
}

export function getOptimizedImageProps(props: OptimizedImageProps): OptimizedImageProps {
  return {
    ...props,
    quality: props.quality || 85,
    placeholder: props.placeholder || 'empty',
    sizes: props.sizes || '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
  };
}

// Resource hints utility
export function addResourceHints() {
  if (typeof window === 'undefined') return;

  // Preconnect to external domains
  const preconnectDomains = ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'];

  preconnectDomains.forEach(domain => {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = domain;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  });
}

// Performance budget checker
export interface PerformanceBudget {
  javascript: number; // KB
  css: number; // KB
  images: number; // KB
  fonts: number; // KB
  total: number; // KB
}

export function checkPerformanceBudget(budget: PerformanceBudget) {
  if (typeof window === 'undefined') return;

  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

  const sizes = {
    javascript: 0,
    css: 0,
    images: 0,
    fonts: 0,
    total: 0,
  };

  resources.forEach(resource => {
    const size = resource.transferSize || 0;
    sizes.total += size;

    if (resource.name.includes('.js')) {
      sizes.javascript += size;
    } else if (resource.name.includes('.css')) {
      sizes.css += size;
    } else if (resource.name.match(/\.(jpg|jpeg|png|gif|webp|avif|svg)$/)) {
      sizes.images += size;
    } else if (resource.name.match(/\.(woff|woff2|ttf|otf)$/)) {
      sizes.fonts += size;
    }
  });

  // Convert to KB
  Object.keys(sizes).forEach(key => {
    sizes[key as keyof typeof sizes] = Math.round(sizes[key as keyof typeof sizes] / 1024);
  });

  // Check against budget
  const violations = [];
  if (sizes.javascript > budget.javascript) {
    violations.push(`JavaScript: ${sizes.javascript}KB > ${budget.javascript}KB`);
  }
  if (sizes.css > budget.css) {
    violations.push(`CSS: ${sizes.css}KB > ${budget.css}KB`);
  }
  if (sizes.images > budget.images) {
    violations.push(`Images: ${sizes.images}KB > ${budget.images}KB`);
  }
  if (sizes.fonts > budget.fonts) {
    violations.push(`Fonts: ${sizes.fonts}KB > ${budget.fonts}KB`);
  }
  if (sizes.total > budget.total) {
    violations.push(`Total: ${sizes.total}KB > ${budget.total}KB`);
  }

  if (violations.length > 0) {
    console.warn('Performance budget violations:', violations);
  }

  return { sizes, violations };
}

// Critical CSS utility
export function inlineCriticalCSS(css: string) {
  if (typeof window === 'undefined') return;

  const style = document.createElement('style');
  style.textContent = css;
  style.setAttribute('data-critical', 'true');
  document.head.appendChild(style);
}

// Service Worker registration for caching
export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(registration => {
        console.log('SW registered: ', registration);
      })
      .catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

// Intersection Observer utility for lazy loading
export function createIntersectionObserver(
  callback: IntersectionObserverCallback,
  options?: IntersectionObserverInit
) {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
    return null;
  }

  return new IntersectionObserver(callback, {
    rootMargin: '50px',
    threshold: 0.1,
    ...options,
  });
}

// Font loading optimization
export function optimizeFontLoading() {
  if (typeof window === 'undefined') return;

  // Preload critical fonts
  const criticalFonts = ['/fonts/inter-var.woff2'];

  criticalFonts.forEach(fontUrl => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = fontUrl;
    link.as = 'font';
    link.type = 'font/woff2';
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  });

  // Use font-display: swap for web fonts
  const style = document.createElement('style');
  style.textContent = `
    @font-face {
      font-family: 'Inter';
      font-style: normal;
      font-weight: 100 900;
      font-display: swap;
      src: url('/fonts/inter-var.woff2') format('woff2');
    }
  `;
  document.head.appendChild(style);
}
