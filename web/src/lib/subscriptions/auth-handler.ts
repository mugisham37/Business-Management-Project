import { BehaviorSubject, fromEvent, merge, timer } from 'rxjs';
import { filter, switchMap, tap, catchError } from 'rxjs/operators';
import { subscriptionManager } from './subscription-manager';

export interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  expiresAt: Date | null;
  tenantId: string | null;
}

/**
 * Handles authentication for WebSocket subscriptions with automatic re-authentication
 */
export class SubscriptionAuthHandler {
  private authState$ = new BehaviorSubject<AuthState>({
    isAuthenticated: false,
    token: null,
    expiresAt: null,
    tenantId: null
  });

  private tokenRefreshTimer: NodeJS.Timeout | null = null;
  private reconnectOnAuthChange = true;

  constructor() {
    this.initializeAuthMonitoring();
  }

  /**
   * Set authentication state and trigger reconnection if needed
   */
  setAuthState(authState: Partial<AuthState>): void {
    const currentState = this.authState$.value;
    const newState = { ...currentState, ...authState };
    
    this.authState$.next(newState);
    
    // Schedule token refresh if we have an expiration time
    if (newState.expiresAt && newState.token) {
      this.scheduleTokenRefresh(newState.expiresAt);
    }
    
    // Reconnect subscriptions if authentication changed
    if (this.reconnectOnAuthChange && (
      currentState.token !== newState.token ||
      currentState.tenantId !== newState.tenantId
    )) {
      this.reconnectSubscriptions();
    }
  }

  /**
   * Get current authentication state
   */
  getAuthState(): AuthState {
    return this.authState$.value;
  }

  /**
   * Get authentication state as observable
   */
  getAuthState$() {
    return this.authState$.asObservable();
  }

  /**
   * Handle authentication failure
   */
  handleAuthFailure(error: unknown): void {
    console.error('Subscription authentication failed:', error);
    
    this.setAuthState({
      isAuthenticated: false,
      token: null,
      expiresAt: null
    });
    
    // Attempt to refresh token
    this.attemptTokenRefresh();
  }

  /**
   * Handle tenant switch
   */
  handleTenantSwitch(newTenantId: string): void {
    const currentState = this.authState$.value;
    
    if (currentState.tenantId !== newTenantId) {
      this.setAuthState({
        tenantId: newTenantId
      });
    }
  }

  /**
   * Manually trigger token refresh
   */
  async refreshToken(): Promise<boolean> {
    try {
      const { authManager } = await import('@/lib/auth');
      const newToken = await authManager.refreshToken();
      
      if (newToken) {
        const tokenData = this.parseJWT(newToken);
        
        this.setAuthState({
          isAuthenticated: true,
          token: newToken,
          expiresAt: new Date(tokenData.exp * 1000)
        });
        
        return true;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.handleAuthFailure(error);
    }
    
    return false;
  }

  /**
   * Enable or disable automatic reconnection on auth changes
   */
  setReconnectOnAuthChange(enabled: boolean): void {
    this.reconnectOnAuthChange = enabled;
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
    }
    this.authState$.complete();
  }

  private initializeAuthMonitoring(): void {
    // Monitor authentication state changes from auth manager
    if (typeof window !== 'undefined') {
      // Listen for storage events (cross-tab auth changes)
      const storageEvents$ = fromEvent(window, 'storage').pipe(
        filter((event: unknown) => {
          const storageEvent = event as StorageEvent;
          return storageEvent.key === 'accessToken' || 
                 storageEvent.key === 'currentTenantId';
        }),
        tap(() => this.syncAuthStateFromStorage())
      );

      // Listen for focus events to check auth state
      const focusEvents$ = fromEvent(window, 'focus').pipe(
        tap(() => this.syncAuthStateFromStorage())
      );

      // Periodic auth state check
      const periodicCheck$ = timer(0, 60000).pipe( // Check every minute
        tap(() => this.syncAuthStateFromStorage())
      );

      // Combine all auth monitoring streams
      merge(storageEvents$, focusEvents$, periodicCheck$).subscribe();
    }
  }

  private async syncAuthStateFromStorage(): Promise<void> {
    try {
      const { authManager } = await import('@/lib/auth');
      const token = await authManager.getAccessToken();
      const tenantId = localStorage.getItem('currentTenantId');
      
      if (token) {
        const tokenData = this.parseJWT(token);
        const expiresAt = new Date(tokenData.exp * 1000);
        const isExpired = expiresAt <= new Date();
        
        if (isExpired) {
          // Token is expired, try to refresh
          await this.refreshToken();
        } else {
          this.setAuthState({
            isAuthenticated: true,
            token,
            expiresAt,
            tenantId
          });
        }
      } else {
        this.setAuthState({
          isAuthenticated: false,
          token: null,
          expiresAt: null,
          tenantId
        });
      }
    } catch (error) {
      console.error('Failed to sync auth state:', error);
      this.handleAuthFailure(error);
    }
  }

  private scheduleTokenRefresh(expiresAt: Date): void {
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
    }
    
    // Refresh token 5 minutes before expiration
    const refreshTime = expiresAt.getTime() - Date.now() - (5 * 60 * 1000);
    
    if (refreshTime > 0) {
      this.tokenRefreshTimer = setTimeout(() => {
        this.attemptTokenRefresh();
      }, refreshTime);
    } else {
      // Token is already expired or expires very soon
      this.attemptTokenRefresh();
    }
  }

  private async attemptTokenRefresh(): Promise<void> {
    const success = await this.refreshToken();
    
    if (!success) {
      // Refresh failed, user needs to re-authenticate
      this.handleAuthenticationRequired();
    }
  }

  private handleAuthenticationRequired(): void {
    // Clear auth state
    this.setAuthState({
      isAuthenticated: false,
      token: null,
      expiresAt: null
    });
    
    // Redirect to login if in browser
    if (typeof window !== 'undefined') {
      // Don't redirect immediately, let the app handle it
      window.dispatchEvent(new CustomEvent('auth:required'));
    }
  }

  private async reconnectSubscriptions(): Promise<void> {
    try {
      await subscriptionManager.reconnect();
    } catch (error) {
      console.error('Failed to reconnect subscriptions:', error);
    }
  }

  private parseJWT(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Failed to parse JWT:', error);
      return {};
    }
  }
}

// Singleton instance
export const subscriptionAuthHandler = new SubscriptionAuthHandler();

// Initialize auth monitoring when module loads
if (typeof window !== 'undefined') {
  // Listen for auth events from the auth manager
  window.addEventListener('auth:login', (event: Event) => {
    const customEvent = event as CustomEvent<{ token: string; expiresAt: Date; tenantId: string }>;
    subscriptionAuthHandler.setAuthState({
      isAuthenticated: true,
      token: customEvent.detail.token,
      expiresAt: customEvent.detail.expiresAt,
      tenantId: customEvent.detail.tenantId
    });
  });

  window.addEventListener('auth:logout', () => {
    subscriptionAuthHandler.setAuthState({
      isAuthenticated: false,
      token: null,
      expiresAt: null,
      tenantId: null
    });
  });

  window.addEventListener('tenant:switch', (event: Event) => {
    const customEvent = event as CustomEvent<{ tenantId: string }>;
    subscriptionAuthHandler.handleTenantSwitch(customEvent.detail.tenantId);
  });

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    subscriptionAuthHandler.cleanup();
  });
}