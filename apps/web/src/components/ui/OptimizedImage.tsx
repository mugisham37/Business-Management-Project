import Image from 'next/image';
import React, { useEffect, useRef, useState } from 'react';
import { useLazyLoading } from '../../hooks/usePerformance';
import { getOptimizedImageProps, OptimizedImageProps } from '../../lib/performance';

interface OptimizedImageComponentProps extends OptimizedImageProps {
  className?: string;
  lazy?: boolean;
  onLoad?: () => void;
  onError?: () => void;
}

export const OptimizedImage: React.FC<OptimizedImageComponentProps> = React.memo(
  ({
    src,
    alt,
    width,
    height,
    priority = false,
    placeholder = 'empty',
    blurDataURL,
    sizes,
    quality = 85,
    className = '',
    lazy = true,
    onLoad,
    onError,
  }) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);
    const { elementRef, isVisible } = useLazyLoading(0.1);
    const imageRef = useRef<HTMLImageElement>(null);

    // Combine refs
    const combinedRef = (node: HTMLImageElement) => {
      imageRef.current = node;
      if (elementRef) {
        (elementRef as any).current = node;
      }
    };

    const optimizedProps = getOptimizedImageProps({
      src,
      alt,
      width,
      height,
      priority,
      placeholder,
      blurDataURL,
      sizes,
      quality,
    });

    const handleLoad = () => {
      setIsLoaded(true);
      onLoad?.();
    };

    const handleError = () => {
      setHasError(true);
      onError?.();
    };

    // Don't render image until it's visible (if lazy loading is enabled)
    if (lazy && !isVisible && !priority) {
      return (
        <div
          ref={combinedRef}
          className={`bg-gray-200 animate-pulse ${className}`}
          style={{ width, height }}
          aria-label={`Loading ${alt}`}
        />
      );
    }

    // Error state
    if (hasError) {
      return (
        <div
          className={`bg-gray-200 flex items-center justify-center ${className}`}
          style={{ width, height }}
          aria-label={`Failed to load ${alt}`}
        >
          <svg
            className="w-8 h-8 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      );
    }

    return (
      <div className={`relative overflow-hidden ${className}`}>
        <Image
          ref={combinedRef}
          {...optimizedProps}
          className={`transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={handleLoad}
          onError={handleError}
        />

        {/* Loading placeholder */}
        {!isLoaded && (
          <div className="absolute inset-0 bg-gray-200 animate-pulse" aria-hidden="true" />
        )}
      </div>
    );
  }
);

OptimizedImage.displayName = 'OptimizedImage';

// Progressive image loading component
export const ProgressiveImage: React.FC<
  OptimizedImageComponentProps & {
    lowQualitySrc?: string;
  }
> = React.memo(({ src, lowQualitySrc, alt, className = '', ...props }) => {
  const [currentSrc, setCurrentSrc] = useState(lowQualitySrc || src);
  const [isHighQualityLoaded, setIsHighQualityLoaded] = useState(false);

  useEffect(() => {
    if (lowQualitySrc && src !== lowQualitySrc) {
      // Preload high quality image
      const img = new window.Image();
      img.onload = () => {
        setCurrentSrc(src);
        setIsHighQualityLoaded(true);
      };
      img.src = src;
    }
  }, [src, lowQualitySrc]);

  return (
    <OptimizedImage
      {...props}
      src={currentSrc}
      alt={alt}
      className={`${className} ${
        !isHighQualityLoaded && lowQualitySrc ? 'filter blur-sm' : ''
      } transition-all duration-300`}
    />
  );
});

ProgressiveImage.displayName = 'ProgressiveImage';

// Avatar component with optimized loading
export const OptimizedAvatar: React.FC<{
  src?: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  fallback?: string;
  className?: string;
}> = React.memo(({ src, alt, size = 'md', fallback, className = '' }) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
  };

  const sizePixels = {
    sm: 32,
    md: 48,
    lg: 64,
    xl: 96,
  };

  if (!src) {
    return (
      <div
        className={`${sizeClasses[size]} rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-medium ${className}`}
      >
        {fallback || alt.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <OptimizedImage
      src={src}
      alt={alt}
      width={sizePixels[size]}
      height={sizePixels[size]}
      className={`${sizeClasses[size]} rounded-full object-cover ${className}`}
      priority={size === 'xl'} // Prioritize larger avatars
      quality={90} // Higher quality for avatars
    />
  );
});

OptimizedAvatar.displayName = 'OptimizedAvatar';
