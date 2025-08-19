// Simple performance monitoring without TypeScript issues
export function initializePerformanceMonitoring() {
  if (typeof window === 'undefined') return;

  // Track Core Web Vitals
  import('web-vitals')
    .then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
      getCLS(console.log);
      getFID(console.log);
      getFCP(console.log);
      getLCP(console.log);
      getTTFB(console.log);
    })
    .catch(console.warn);

  // Track page load performance
  window.addEventListener('load', () => {
    setTimeout(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      if (navigation) {
        console.log('Page load metrics:', {
          domContentLoaded:
            navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
          firstByte: navigation.responseStart - navigation.requestStart,
        });
      }
    }, 0);
  });

  // Track resource loading
  const observer = new PerformanceObserver(list => {
    for (const entry of list.getEntries()) {
      if (entry.duration > 1000) {
        console.warn('Slow resource:', entry.name, entry.duration + 'ms');
      }
    }
  });

  observer.observe({ entryTypes: ['resource'] });
}

// Performance budget checker
export function checkPerformanceBudget() {
  if (typeof window === 'undefined') return;

  const resources = performance.getEntriesByType('resource');
  let totalSize = 0;
  let jsSize = 0;
  let cssSize = 0;
  let imageSize = 0;

  resources.forEach(resource => {
    const size = resource.transferSize || 0;
    totalSize += size;

    if (resource.name.includes('.js')) {
      jsSize += size;
    } else if (resource.name.includes('.css')) {
      cssSize += size;
    } else if (resource.name.match(/\.(jpg|jpeg|png|gif|webp|avif|svg)$/)) {
      imageSize += size;
    }
  });

  const budget = {
    total: 2000 * 1024, // 2MB
    javascript: 500 * 1024, // 500KB
    css: 100 * 1024, // 100KB
    images: 1000 * 1024, // 1MB
  };

  const violations = [];
  if (totalSize > budget.total)
    violations.push(`Total: ${Math.round(totalSize / 1024)}KB > ${budget.total / 1024}KB`);
  if (jsSize > budget.javascript)
    violations.push(`JS: ${Math.round(jsSize / 1024)}KB > ${budget.javascript / 1024}KB`);
  if (cssSize > budget.css)
    violations.push(`CSS: ${Math.round(cssSize / 1024)}KB > ${budget.css / 1024}KB`);
  if (imageSize > budget.images)
    violations.push(`Images: ${Math.round(imageSize / 1024)}KB > ${budget.images / 1024}KB`);

  if (violations.length > 0) {
    console.warn('Performance budget violations:', violations);
  }

  return { violations, sizes: { total: totalSize, js: jsSize, css: cssSize, images: imageSize } };
}
