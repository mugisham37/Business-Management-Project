# Authentication System

A comprehensive authentication and authorization system for the Next.js GraphQL foundation, providing secure JWT token management, multi-factor authentication, and permission-based rendering.

## Features

### 🔐 JWT Token Management
- **Secure Storage**: XSS-protected token storage with encryption
- **Automatic Refresh**: Tokens refresh automatically before expiration
- **Cross-Tab Sync**: Authentication state synchronized across browser tabs
- **Retry Logic**: Exponential backoff for failed refresh attempts

### 🛡️ Multi-Factor Authentication (MFA)
- **TOTP Support**: Time-based one-time passwords (Google Authenticator, Authy)
- **SMS Support**: SMS-based verification codes
- **Backup Codes**: Recovery codes for account access
- **Setup Flow**: Guided MFA setup with QR codes

### 🎯 Permission Engine
- **Role-Based Access**: Fine-grained permission checking
- **UI Rendering**: Components render based on user permissions
- **Conditional Logic**: Permission-based conditional rendering
- **Caching**: Efficient permission evaluation with caching

### ⚛️ React Integration
- **Hooks**: Custom hooks for authentication state
- **Components**: Pre-built authentication components
- **Providers**: Context providers for global state
- **Guards**: Route and component protection

## Quick Start

### 1. Setup Authentication Provider

```tsx
import { AuthProvider } from '@/components/auth';

function App() {
  return (
    <AuthProvider>
      <YourApp />
    </AuthProvider>
  );
}
```

### 2. Use Authentication Hook

```tsx
import { useAuth } from '@/hooks/useAuth';

function LoginPage() {
  const { login, isLoading, isAuthenticated } = useAuth();

  const handleLogin = async () => {
    const result = await login({
      email: 'user@example.com',
      password: 'password123'
    });
    
    if (result.success) {
      // Login successful
    }
  };

  return (
    <div>
      {isAuthenticated ? (
        <p>Welcome back!</p>
      ) : (
        <button onClick={handleLogin} disabled={isLoading}>
          {isLoading ? 'Logging in...' : 'Login'}
        </button>
      )}
    </div>
  );
}
```

### 3. Protect Routes

```tsx
import { ProtectedRoute } from '@/components/auth';

function AdminPage() {
  return (
    <ProtectedRoute permissions={['admin.access']}>
      <AdminDashboard />
    </ProtectedRoute>
  );
}
```

### 4. Permission-Based Rendering

```tsx
import { ConditionalRender } from '@/components/auth';

function UserActions() {
  return (
    <div>
      <ConditionalRender permission="users.read">
        <ViewUsersButton />
      </ConditionalRender>
      
      <ConditionalRender permission="users.create">
        <CreateUserButton />
      </ConditionalRender>
      
      <ConditionalRender permission={['admin.access', 'users.manage']} requireAll>
        <AdminUserActions />
      </ConditionalRender>
    </div>
  );
}
```

## API Reference

### Hooks

#### `useAuth()`
Main authentication hook providing complete auth state and actions.

```tsx
const {
  // State
  user,
  tokens,
  permissions,
  isAuthenticated,
  isLoading,
  mfaRequired,
  
  // Actions
  login,
  logout,
  refreshTokens,
  
  // Permission checks
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  
  // Token access
  getAccessToken,
} = useAuth();
```

#### `useMFA()`
Multi-factor authentication hook.

```tsx
const {
  // State
  isEnabled,
  method,
  isSetupInProgress,
  isVerificationRequired,
  
  // Actions
  setupMFA,
  verifyMFA,
  disableMFA,
  
  // Utilities
  generateTOTPCode,
  isValidTOTPCode,
  isValidSMSCode,
} = useMFA();
```

#### `usePermission(permission)`
Simple permission checking hook.

```tsx
const canEditUsers = usePermission('users.edit');
const hasAnyAdminAccess = usePermission(['admin.access', 'super.admin']);
```

### Components

#### `<ProtectedRoute>`
Protects routes based on authentication and permissions.

```tsx
<ProtectedRoute 
  permissions={['users.read']}
  requireAll={false}
  fallback={<AccessDenied />}
  redirectTo="/login"
>
  <UsersList />
</ProtectedRoute>
```

#### `<ConditionalRender>`
Conditionally renders content based on permissions.

```tsx
<ConditionalRender 
  permission="users.create"
  fallback={<p>No access</p>}
>
  <CreateUserForm />
</ConditionalRender>
```

#### `<PermissionGuard>`
Low-level permission guard component.

```tsx
<PermissionGuard
  permissions={[{ resource: 'users', action: 'read', conditions: { tenantId: 'abc' } }]}
  requireAll={true}
  permissionContext={permissionContext}
  fallback={<AccessDenied />}
>
  <SensitiveContent />
</PermissionGuard>
```

### Core Classes

#### `AuthManager`
Central authentication management.

```tsx
import { AuthManager } from '@/lib/auth';

const authManager = new AuthManager({
  onAuthStateChange: (state) => console.log('Auth state:', state),
  onTokenRefresh: (tokens) => console.log('Tokens refreshed'),
  onAuthError: (error) => console.error('Auth error:', error),
});

// Login
const result = await authManager.login({
  email: 'user@example.com',
  password: 'password123'
});

// Check permissions
const canEdit = authManager.hasPermission('users.edit');

// Get valid token
const token = await authManager.getAccessToken();
```

#### `TokenManager`
JWT token lifecycle management.

```tsx
import { TokenManager, SecureTokenStorage } from '@/lib/auth';

const tokenManager = new TokenManager(
  {
    refreshThreshold: 5, // Refresh 5 minutes before expiry
    maxRetries: 3,
    storage: new SecureTokenStorage(),
  },
  async (refreshToken) => {
    // Your token refresh implementation
    return await refreshTokens(refreshToken);
  }
);

// Get valid tokens
const tokens = await tokenManager.getValidTokens();

// Listen for token changes
const unsubscribe = tokenManager.onTokenChange((tokens) => {
  console.log('Tokens updated:', tokens);
});
```

#### `PermissionEngine`
Permission evaluation and caching.

```tsx
import { PermissionEngine } from '@/lib/auth';

const engine = new PermissionEngine({
  user: currentUser,
  permissions: ['users.read', 'users.write'],
  tenantId: 'tenant-123',
  businessTier: 'ENTERPRISE',
});

// Simple permission check
const canRead = engine.hasPermission('users.read');

// Complex permission check with conditions
const canEditOwnData = engine.can('edit', 'users', { userId: currentUser.id });

// Multiple permissions
const hasAnyAccess = engine.hasAnyPermission(['users.read', 'admin.access']);
const hasAllAccess = engine.hasAllPermissions(['users.read', 'users.write']);
```

## Security Features

### XSS Protection
- Tokens are encrypted before localStorage storage
- Session-specific encryption keys
- Automatic token cleanup on authentication errors

### CSRF Protection
- Automatic CSRF token handling in GraphQL requests
- Secure token transmission
- Request validation

### Token Security
- Automatic token rotation
- Secure token storage
- Cross-tab session management
- Automatic cleanup on security events

## Configuration

### Environment Variables

```env
# GraphQL endpoints
NEXT_PUBLIC_GRAPHQL_URI=http://localhost:4000/graphql
NEXT_PUBLIC_GRAPHQL_WS_URI=ws://localhost:4000/graphql

# Authentication settings
AUTH_TOKEN_REFRESH_THRESHOLD=5  # Minutes before expiry
AUTH_MAX_RETRY_ATTEMPTS=3
AUTH_ENABLE_MFA=true
```

### Apollo Client Integration

The authentication system automatically integrates with Apollo Client:

- **Authorization Headers**: Automatically added to all requests
- **Token Refresh**: Seamless token refresh on expiration
- **Error Handling**: Automatic logout on authentication errors
- **WebSocket Auth**: Subscription authentication

## Testing

The authentication system includes comprehensive property-based tests:

```bash
# Run authentication tests
npm test -- --testPathPattern=auth

# Run property-based tests
npm test -- --testPathPattern=property

# Run with coverage
npm test -- --coverage --testPathPattern=auth
```

## Migration Guide

### From Basic Auth

1. Replace direct localStorage usage with `useAuth` hook
2. Update permission checks to use `hasPermission`
3. Wrap protected routes with `<ProtectedRoute>`
4. Replace manual token refresh with automatic system

### From Other Auth Libraries

1. Map existing user/permission structure to our interfaces
2. Implement custom `TokenStorage` if needed
3. Update GraphQL client configuration
4. Migrate permission checking logic

## Best Practices

### Security
- Always use HTTPS in production
- Implement proper CSRF protection
- Use secure token storage
- Regular security audits

### Performance
- Use permission caching
- Implement proper loading states
- Optimize re-renders with React.memo
- Cache GraphQL queries appropriately

### UX
- Provide clear error messages
- Implement proper loading states
- Handle offline scenarios
- Smooth MFA setup flow

## Troubleshooting

### Common Issues

**Token Refresh Loops**
- Check token expiration times
- Verify refresh token validity
- Check network connectivity

**Permission Denied Errors**
- Verify user permissions in database
- Check permission string formatting
- Validate tenant context

**MFA Setup Issues**
- Verify TOTP secret generation
- Check time synchronization
- Validate QR code generation

### Debug Mode

Enable debug logging in development:

```tsx
// Enable auth debugging
localStorage.setItem('auth:debug', 'true');

// View auth state
console.log(authManager.getAuthState());

// View permission cache
console.log(permissionEngine.getCacheStats());
```

## Contributing

1. Follow TypeScript strict mode
2. Add comprehensive tests for new features
3. Update documentation for API changes
4. Follow security best practices
5. Test cross-browser compatibility

## License

This authentication system is part of the Next.js GraphQL Foundation project.