# Advanced Caching System

A comprehensive multi-tier caching solution for the Next.js GraphQL foundation that provides intelligent invalidation, offline capabilities, and performance optimization.

## Overview

The Advanced Caching System implements a sophisticated three-tier caching architecture that respects backend Redis patterns while providing frontend-specific optimizations:

- **L1 Cache**: In-memory cache for fastest access
- **L2 Cache**: IndexedDB for persistent storage
- **L3 Cache**: Network requests as fallback

## Features

### 🚀 Multi-Tier Caching
- **Memory Cache (L1)**: Ultra-fast in-memory storage with LRU eviction
- **Persistent Cache (L2)**: IndexedDB-based storage that survives browser restarts
- **Network Cache (L3)**: Intelligent network request management
- **Automatic Promotion**: Data automatically moves between tiers for optimal performance

### 🧠 Intelligent Invalidation
- **Mutation-Based**: Automatically invalidates related cache entries based on GraphQL mutations
- **Dependency Tracking**: Understands relationships between different data types
- **Tenant Isolation**: Ensures tenant-specific data doesn't leak between tenants
- **Batch Processing**: Groups invalidations for better performance

### 📱 Offline Capabilities
- **Operation Queuing**: Stores mutations when offline for later synchronization
- **Automatic Sync**: Syncs queued operations when connection is restored
- **Network Monitoring**: Real-time network status detection
- **Cache-First Strategies**: Serves cached data when offline

### 📊 Performance Monitoring
- **Real-Time Metrics**: Hit rates, response times, memory usage
- **Cache Warming**: Preloads critical data for better user experience
- **Performance Thresholds**: Configurable alerts for performance issues
- **Debug Tools**: Development-mode cache inspection

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
├─────────────────────────────────────────────────────────────┤
│  Components  │  Hooks  │  Cache Strategy  │  Warming       │
├─────────────────────────────────────────────────────────────┤
│                 Unified Cache Manager                       │
├─────────────────────────────────────────────────────────────┤
│ Multi-Tier Cache │ Invalidation Engine │ Offline Manager   │
├─────────────────────────────────────────────────────────────┤
│   L1 (Memory)   │   L2 (IndexedDB)    │   L3 (Network)    │
├─────────────────────────────────────────────────────────────┤
│              Apollo Client Cache Integration                │
└─────────────────────────────────────────────────────────────┘
```

## Usage

### Basic Cache Operations

```typescript
import { useUnifiedCache } from '@/lib/cache';

function MyComponent() {
  const { get, set, invalidateFromMutation } = useUnifiedCache();

  // Get data with fallback
  const fetchUserData = async () => {
    const userData = await get('user-123', {
      tenantId: 'tenant-456',
      fallbackLoader: async () => {
        const response = await fetch('/api/users/123');
        return response.json();
      },
    });
    return userData;
  };

  // Invalidate after mutation
  const updateUser = async (userData) => {
    // Perform mutation...
    await invalidateFromMutation('updateUser', { id: '123' }, 'tenant-456');
  };
}
```

### Cache Warming

```typescript
import { useCriticalDataWarming } from '@/modules/cache/hooks/useCacheWarming';

function App() {
  const { warmHighPriority, warmNow } = useCriticalDataWarming('tenant-123');

  useEffect(() => {
    // Warm critical data on app start
    warmHighPriority();
  }, []);
}
```

### Offline Operations

```typescript
import { useOfflineCache } from '@/lib/cache';

function UserForm() {
  const { queueMutation, getMetrics } = useOfflineCache();

  const handleSubmit = (formData) => {
    queueMutation(CREATE_USER_MUTATION, {
      input: formData,
    }, {
      tenantId: 'tenant-123',
      maxRetries: 3,
    });
  };
}
```

### Metrics and Monitoring

```typescript
import { CacheMetricsDisplay, OfflineStatusIndicator } from '@/modules/cache';

function Dashboard() {
  return (
    <div>
      <CacheMetricsDisplay refreshInterval={5000} showDetails={true} />
      <OfflineStatusIndicator position="top-right" showDetails={true} />
    </div>
  );
}
```

## Configuration

### Cache Warming Configurations

```typescript
const warmingConfigs = [
  {
    key: 'currentUser',
    priority: 'high',
    schedule: {
      onMount: true,
      interval: 5 * 60 * 1000, // 5 minutes
    },
    loader: async () => {
      // Load user data
    },
  },
  {
    key: 'tenantSettings',
    priority: 'high',
    dependencies: ['currentUser'],
    schedule: {
      onTenantChange: true,
    },
  },
];
```

### Performance Thresholds

```typescript
const thresholds = {
  hitRate: {
    excellent: 90, // > 90%
    good: 75,      // 75-90%
    poor: 50,      // 50-75%
  },
  responseTime: {
    excellent: 50,  // < 50ms
    good: 100,      // 50-100ms
    poor: 200,      // 100-200ms
  },
};
```

## Components

### CacheMetricsDisplay
Real-time cache performance metrics with visual indicators.

**Props:**
- `refreshInterval?: number` - Metrics refresh rate (default: 5000ms)
- `showDetails?: boolean` - Show detailed metrics (default: false)

### OfflineStatusIndicator
Network status and offline operation queue indicator.

**Props:**
- `showDetails?: boolean` - Show detailed offline info
- `position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'`
- `className?: string` - Additional CSS classes

## Hooks

### useUnifiedCache()
Main hook for cache operations.

**Returns:**
- `get<T>(key, options)` - Retrieve data from cache
- `set<T>(key, data, options)` - Store data in cache
- `invalidateFromMutation(type, variables, tenantId)` - Smart invalidation
- `queueMutation(mutation, variables, options)` - Queue for offline sync
- `warmCache(configs)` - Warm cache with data
- `getMetrics()` - Get performance metrics

### useCacheWarming(configs, options)
Manage cache warming strategies.

**Returns:**
- `warmNow(keys?)` - Warm specific keys immediately
- `warmHighPriority()` - Warm high-priority data
- `warmTenantCaches(tenantId)` - Warm tenant-specific data
- `getWarmingStatus()` - Get warming status

### useOfflineCache()
Offline functionality management.

**Returns:**
- `get<T>(key, options)` - Offline-aware data retrieval
- `queueMutation(mutation, variables, options)` - Queue operations
- `syncOperations()` - Manual sync trigger
- `getMetrics()` - Offline metrics

## Integration with GraphQL

The caching system integrates seamlessly with Apollo Client:

```typescript
// Automatic cache updates after mutations
const [updateUser] = useMutation(UPDATE_USER_MUTATION, {
  onCompleted: async (data) => {
    // Intelligent invalidation happens automatically
    await invalidateFromMutation('updateUser', data.updateUser, tenantId);
  },
});

// Cache-first queries with multi-tier fallback
const { data, loading } = useQuery(GET_USERS_QUERY, {
  fetchPolicy: 'cache-first',
  // Multi-tier cache provides additional layers
});
```

## Performance Optimization

### Cache Warming Strategies
1. **Critical Data**: User info, permissions, tenant settings
2. **Business Data**: Frequently accessed business module data
3. **Predictive**: Data likely to be needed based on user behavior

### Memory Management
- Automatic LRU eviction in L1 cache
- Configurable size limits per cache tier
- Periodic cleanup of expired entries
- Memory usage monitoring and alerts

### Network Optimization
- Request deduplication
- Batch invalidation
- Intelligent retry logic
- Connection pooling for subscriptions

## Tenant Isolation

The caching system ensures complete tenant data isolation:

- **Cache Keys**: Prefixed with tenant ID
- **Invalidation**: Tenant-specific invalidation rules
- **Warming**: Tenant-aware cache warming
- **Offline**: Tenant context preserved in queued operations

## Development Tools

### Cache Inspector
```typescript
// Development mode only
const { inspectCache } = useCacheStrategy();

// Log cache contents and metrics
inspectCache();
```

### Performance Monitoring
```typescript
const metrics = getMetrics();
console.log('Cache Performance:', {
  hitRate: calculateHitRate(metrics.l1Hits, metrics.l1Misses),
  memoryUsage: metrics.memoryUsage,
  responseTime: metrics.averageResponseTime,
});
```

## Best Practices

1. **Cache Key Design**: Use consistent, hierarchical key naming
2. **TTL Strategy**: Set appropriate TTLs based on data volatility
3. **Warming Priority**: Prioritize user-critical data for warming
4. **Invalidation Rules**: Define clear invalidation dependencies
5. **Offline Handling**: Design for offline-first user experience
6. **Monitoring**: Set up alerts for performance thresholds
7. **Testing**: Test cache behavior in offline scenarios

## Testing

The caching system includes comprehensive property-based tests:

- **Property 36**: Multi-tier cache consistency
- **Property 37**: Mutation-based invalidation correctness
- **Property 40**: Tenant cache isolation verification

Run tests with:
```bash
npm test -- --testPathPattern=cache
```

## Troubleshooting

### Common Issues

1. **High Memory Usage**: Check cache size limits and eviction policies
2. **Low Hit Rates**: Review cache warming and TTL strategies
3. **Offline Sync Failures**: Check network connectivity and retry logic
4. **Tenant Data Leaks**: Verify tenant ID is passed to all cache operations

### Debug Mode

Enable debug logging:
```typescript
localStorage.setItem('cache-debug', 'true');
```

This will log detailed cache operations and performance metrics to the console.

## Migration Guide

When upgrading from basic Apollo Client caching:

1. Install the advanced caching system
2. Update cache strategy hooks to use `useUnifiedCache`
3. Add cache warming for critical data
4. Implement offline operation queuing
5. Add performance monitoring components
6. Configure tenant-specific invalidation rules

The system is designed to be backward compatible with existing Apollo Client usage patterns.