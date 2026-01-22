/**
 * Asset Optimizer - Image and asset optimization utilities
 * Implements automatic image optimization, lazy loading, and asset management
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export interface ImageOptimizationConfig {
  quality?: number;
  format?: 'webp' | 'avif' | 'auto';
  sizes?: string;
  priority?: boolean;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
}

export interface AssetMetrics {
  totalImages: number;
  optimizedImages: number;
  totalSize: number;
  savedSize: number;
  loadTime: number;
}

/**
 * Optimized Image Component with lazy loading and format selection
 */
export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className,
  priority = false,
  quality = 75,
  sizes,
  onLoad,
  onError,
  ...props
}: {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  quality?: number;
  sizes?: string;
  onLoad?: () => void;
  onError?: () => void;
  [key: string]: any;
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const imgRef = useRef<HTMLImageElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority || isInView) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '50px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [priority, isInView]);

  // Generate optimized image URL
  const getOptimizedSrc = useCallback((originalSrc: string) => {
    // In a real implementation, this would integrate with Next.js Image optimization
    // or a CDN service like Cloudinary, ImageKit, etc.
    
    // For now, we'll simulate optimization parameters
    const url = new URL(originalSrc, window.location.origin);
    url.searchParams.set('q', quality.toString());
    url.searchParams.set('f', 'auto'); // Auto format selection
    
    if (width) url.searchParams.set('w', width.toString());
    if (height) url.searchParams.set('h', height.toString());
    
    return url.toString();
  }, [quality, width, height]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  // Don't render image until it's in view (unless priority)
  if (!isInView) {
    return (
      <div
        ref={imgRef}
        className={`bg-gray-200 dark:bg-gray-700 ${className}`}
        style={{ width, height }}
        {...props}
      />
    );
  }

  if (hasError) {
    return (
      <div
        className={`bg-gray-200 dark:bg-gray-700 flex items-center justify-center ${className}`}
        style={{ width, height }}
        {...props}
      >
        <span className="text-gray-500 text-sm">Failed to load image</span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      {/* Loading placeholder */}
      {!isLoaded && (
        <div
          className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse"
          style={{ width, height }}
        />
      )}
      
      {/* Actual image */}
      <img
        ref={imgRef}
        src={getOptimizedSrc(src)}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={handleLoad}
        onError={handleError}
        className={`transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        {...props}
      />
    </div>
  );
}

/**
 * Asset preloader for critical resources
 */
class AssetPreloader {
  private preloadedAssets = new Set<string>();
  private preloadPromises = new Map<string, Promise<void>>();

  /**
   * Preload critical images
   */
  async preloadImage(src: string, priority: 'high' | 'low' = 'low'): Promise<void> {
    if (this.preloadedAssets.has(src)) {
      return;
    }

    const existingPromise = this.preloadPromises.get(src);
    if (existingPromise) {
      return existingPromise;
    }

    const preloadPromise = new Promise<void>((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        this.preloadedAssets.add(src);
        this.preloadPromises.delete(src);
        resolve();
      };
      
      img.onerror = () => {
        this.preloadPromises.delete(src);
        reject(new Error(`Failed to preload image: ${src}`));
      };

      // Set fetchpriority for modern browsers
      if ('fetchPriority' in img) {
        (img as any).fetchPriority = priority;
      }
      
      img.src = src;
    });

    this.preloadPromises.set(src, preloadPromise);
    return preloadPromise;
  }

  /**
   * Preload critical CSS
   */
  preloadCSS(href: string): void {
    if (document.querySelector(`link[href="${href}"]`)) {
      return;
    }

    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'style';
    link.href = href;
    link.onload = () => {
      link.rel = 'stylesheet';
    };
    
    document.head.appendChild(link);
  }

  /**
   * Preload JavaScript modules
   */
  preloadModule(src: string): void {
    if (document.querySelector(`link[href="${src}"]`)) {
      return;
    }

    const link = document.createElement('link');
    link.rel = 'modulepreload';
    link.href = src;
    
    document.head.appendChild(link);
  }

  /**
   * Get preload statistics
   */
  getStats() {
    return {
      preloadedAssets: this.preloadedAssets.size,
      pendingPreloads: this.preloadPromises.size,
    };
  }
}

/**
 * Asset metrics collector
 */
class AssetMetricsCollector {
  private metrics: AssetMetrics = {
    totalImages: 0,
    optimizedImages: 0,
    totalSize: 0,
    savedSize: 0,
    loadTime: 0,
  };

  /**
   * Collect asset metrics from performance API
   */
  collectMetrics(): AssetMetrics {
    if (typeof window === 'undefined' || !('performance' in window)) {
      return this.metrics;
    }

    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    
    // Filter image resources
    const imageResources = resources.filter(resource => {
      const url = new URL(resource.name);
      const extension = url.pathname.split('.').pop()?.toLowerCase();
      return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg'].includes(extension || '');
    });

    // Calculate metrics
    this.metrics.totalImages = imageResources.length;
    this.metrics.totalSize = imageResources.reduce(
      (total, resource) => total + (resource.transferSize || 0), 
      0
    );
    this.metrics.loadTime = imageResources.reduce(
      (total, resource) => total + (resource.duration || 0), 
      0
    ) / imageResources.length;

    // Count optimized images (those with query parameters indicating optimization)
    this.metrics.optimizedImages = imageResources.filter(resource => {
      const url = new URL(resource.name);
      return url.searchParams.has('q') || url.searchParams.has('f') || url.searchParams.has('w');
    }).length;

    // Estimate size savings (rough calculation)
    this.metrics.savedSize = this.metrics.totalSize * 0.3; // Assume 30% savings from optimization

    return this.metrics;
  }

  /**
   * Get optimization recommendations
   */
  getRecommendations(): string[] {
    const recommendations: string[] = [];
    
    if (this.metrics.optimizedImages / this.metrics.totalImages < 0.8) {
      recommendations.push('Consider optimizing more images with modern formats (WebP, AVIF)');
    }
    
    if (this.metrics.totalSize > 5 * 1024 * 1024) { // 5MB
      recommendations.push('Total image size is large, consider lazy loading and compression');
    }
    
    if (this.metrics.loadTime > 2000) { // 2 seconds
      recommendations.push('Image load times are slow, consider using a CDN or image optimization service');
    }

    return recommendations;
  }
}

// Export singleton instances
export const assetPreloader = new AssetPreloader();
export const assetMetricsCollector = new AssetMetricsCollector();

/**
 * Hook for asset optimization
 */
export function useAssetOptimization() {
  const [metrics, setMetrics] = useState<AssetMetrics | null>(null);
  const [recommendations, setRecommendations] = useState<string[]>([]);

  const collectMetrics = useCallback(() => {
    const newMetrics = assetMetricsCollector.collectMetrics();
    const newRecommendations = assetMetricsCollector.getRecommendations();
    
    setMetrics(newMetrics);
    setRecommendations(newRecommendations);
    
    return newMetrics;
  }, []);

  const preloadImage = useCallback((src: string, priority: 'high' | 'low' = 'low') => {
    return assetPreloader.preloadImage(src, priority);
  }, []);

  const preloadCSS = useCallback((href: string) => {
    assetPreloader.preloadCSS(href);
  }, []);

  const preloadModule = useCallback((src: string) => {
    assetPreloader.preloadModule(src);
  }, []);

  useEffect(() => {
    // Collect initial metrics
    collectMetrics();
    
    // Set up periodic collection
    const interval = setInterval(collectMetrics, 30000); // Every 30 seconds
    
    return () => clearInterval(interval);
  }, [collectMetrics]);

  return {
    metrics,
    recommendations,
    collectMetrics,
    preloadImage,
    preloadCSS,
    preloadModule,
    preloaderStats: assetPreloader.getStats(),
  };
}