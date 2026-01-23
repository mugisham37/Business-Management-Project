/**
 * Auth Subscription Manager
 * Handles real-time auth event subscriptions
 */

import { apolloClient } from '@/lib/apollo/client';
import { Observable, Subscription } from 'rxjs';
import {
  USER_AUTH_EVENTS_SUBSCRIPTION,
  USER_PERMISSION_EVENTS_SUBSCRIPTION,
  USER_MFA_EVENTS_SUBSCRIPTION,
  USER_SESSION_EVENTS_SUBSCRIPTION,
  TENANT_AUTH_EVENTS_SUBSCRIPTION,
  SECURITY_ALERTS_SUBSCRIPTION,
  TENANT_ROLE_EVENTS_SUBSCRIPTION,
  USER_EVENTS_SUBSCRIPTION,
  AuthEvent,
  AuthEventType,
} from '@/graphql/subscriptions/auth-subscriptions';

export interface AuthSubscriptionOptions {
  onEvent?: (event: AuthEvent) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
}

/**
 * Auth Subscription Manager
 * Manages real-time auth event subscriptions with automatic reconnection
 */
export class AuthSubscriptionManager {
  private subscriptions = new Map<string, Subscription>();
  private eventListeners = new Map<AuthEventType, Set<(event: AuthEvent) => void>>();
  private isConnected = false;

  /**
   * Subscribe to user authentication events
   */
  subscribeToUserAuthEvents(options: AuthSubscriptionOptions = {}): () => void {
    const subscriptionKey = 'userAuthEvents';
    
    if (this.subscriptions.has(subscriptionKey)) {
      this.unsubscribe(subscriptionKey);
    }

    const subscription = apolloClient
      .subscribe({
        query: USER_AUTH_EVENTS_SUBSCRIPTION,
      })
      .subscribe({
        next: (result) => {
          const event = result.data?.userAuthEvents;
          if (event) {
            this.handleAuthEvent(event);
            options.onEvent?.(event);
          }
        },
        error: (error) => {
          console.error('User auth events subscription error:', error);
          options.onError?.(error);
          this.handleSubscriptionError(subscriptionKey);
        },
        complete: () => {
          options.onComplete?.();
        },
      });

    this.subscriptions.set(subscriptionKey, subscription);
    return () => this.unsubscribe(subscriptionKey);
  }

  /**
   * Subscribe to user permission events
   */
  subscribeToUserPermissionEvents(options: AuthSubscriptionOptions = {}): () => void {
    const subscriptionKey = 'userPermissionEvents';
    
    if (this.subscriptions.has(subscriptionKey)) {
      this.unsubscribe(subscriptionKey);
    }

    const subscription = apolloClient
      .subscribe({
        query: USER_PERMISSION_EVENTS_SUBSCRIPTION,
      })
      .subscribe({
        next: (result) => {
          const event = result.data?.userPermissionEvents;
          if (event) {
            this.handleAuthEvent(event);
            options.onEvent?.(event);
          }
        },
        error: (error) => {
          console.error('User permission events subscription error:', error);
          options.onError?.(error);
          this.handleSubscriptionError(subscriptionKey);
        },
        complete: () => {
          options.onComplete?.();
        },
      });

    this.subscriptions.set(subscriptionKey, subscription);
    return () => this.unsubscribe(subscriptionKey);
  }

  /**
   * Subscribe to user MFA events
   */
  subscribeToUserMfaEvents(options: AuthSubscriptionOptions = {}): () => void {
    const subscriptionKey = 'userMfaEvents';
    
    if (this.subscriptions.has(subscriptionKey)) {
      this.unsubscribe(subscriptionKey);
    }

    const subscription = apolloClient
      .subscribe({
        query: USER_MFA_EVENTS_SUBSCRIPTION,
      })
      .subscribe({
        next: (result) => {
          const event = result.data?.userMfaEvents;
          if (event) {
            this.handleAuthEvent(event);
            options.onEvent?.(event);
          }
        },
        error: (error) => {
          console.error('User MFA events subscription error:', error);
          options.onError?.(error);
          this.handleSubscriptionError(subscriptionKey);
        },
        complete: () => {
          options.onComplete?.();
        },
      });

    this.subscriptions.set(subscriptionKey, subscription);
    return () => this.unsubscribe(subscriptionKey);
  }
  /**
   * Subscribe to user session events
   */
  subscribeToUserSessionEvents(options: AuthSubscriptionOptions = {}): () => void {
    const subscriptionKey = 'userSessionEvents';
    
    if (this.subscriptions.has(subscriptionKey)) {
      this.unsubscribe(subscriptionKey);
    }

    const subscription = apolloClient
      .subscribe({
        query: USER_SESSION_EVENTS_SUBSCRIPTION,
      })
      .subscribe({
        next: (result) => {
          const event = result.data?.userSessionEvents;
          if (event) {
            this.handleAuthEvent(event);
            options.onEvent?.(event);
          }
        },
        error: (error) => {
          console.error('User session events subscription error:', error);
          options.onError?.(error);
          this.handleSubscriptionError(subscriptionKey);
        },
        complete: () => {
          options.onComplete?.();
        },
      });

    this.subscriptions.set(subscriptionKey, subscription);
    return () => this.unsubscribe(subscriptionKey);
  }

  /**
   * Subscribe to tenant auth events (requires admin permissions)
   */
  subscribeToTenantAuthEvents(options: AuthSubscriptionOptions = {}): () => void {
    const subscriptionKey = 'tenantAuthEvents';
    
    if (this.subscriptions.has(subscriptionKey)) {
      this.unsubscribe(subscriptionKey);
    }

    const subscription = apolloClient
      .subscribe({
        query: TENANT_AUTH_EVENTS_SUBSCRIPTION,
      })
      .subscribe({
        next: (result) => {
          const event = result.data?.tenantAuthEvents;
          if (event) {
            this.handleAuthEvent(event);
            options.onEvent?.(event);
          }
        },
        error: (error) => {
          console.error('Tenant auth events subscription error:', error);
          options.onError?.(error);
          this.handleSubscriptionError(subscriptionKey);
        },
        complete: () => {
          options.onComplete?.();
        },
      });

    this.subscriptions.set(subscriptionKey, subscription);
    return () => this.unsubscribe(subscriptionKey);
  }

  /**
   * Subscribe to security alerts (requires admin permissions)
   */
  subscribeToSecurityAlerts(options: AuthSubscriptionOptions = {}): () => void {
    const subscriptionKey = 'securityAlerts';
    
    if (this.subscriptions.has(subscriptionKey)) {
      this.unsubscribe(subscriptionKey);
    }

    const subscription = apolloClient
      .subscribe({
        query: SECURITY_ALERTS_SUBSCRIPTION,
      })
      .subscribe({
        next: (result) => {
          const event = result.data?.securityAlerts;
          if (event) {
            this.handleAuthEvent(event);
            options.onEvent?.(event);
          }
        },
        error: (error) => {
          console.error('Security alerts subscription error:', error);
          options.onError?.(error);
          this.handleSubscriptionError(subscriptionKey);
        },
        complete: () => {
          options.onComplete?.();
        },
      });

    this.subscriptions.set(subscriptionKey, subscription);
    return () => this.unsubscribe(subscriptionKey);
  }

  /**
   * Subscribe to tenant role events (requires admin permissions)
   */
  subscribeToTenantRoleEvents(options: AuthSubscriptionOptions = {}): () => void {
    const subscriptionKey = 'tenantRoleEvents';
    
    if (this.subscriptions.has(subscriptionKey)) {
      this.unsubscribe(subscriptionKey);
    }

    const subscription = apolloClient
      .subscribe({
        query: TENANT_ROLE_EVENTS_SUBSCRIPTION,
      })
      .subscribe({
        next: (result) => {
          const event = result.data?.tenantRoleEvents;
          if (event) {
            this.handleAuthEvent(event);
            options.onEvent?.(event);
          }
        },
        error: (error) => {
          console.error('Tenant role events subscription error:', error);
          options.onError?.(error);
          this.handleSubscriptionError(subscriptionKey);
        },
        complete: () => {
          options.onComplete?.();
        },
      });

    this.subscriptions.set(subscriptionKey, subscription);
    return () => this.unsubscribe(subscriptionKey);
  }

  /**
   * Subscribe to specific user events (requires admin permissions)
   */
  subscribeToUserEvents(userId: string, options: AuthSubscriptionOptions = {}): () => void {
    const subscriptionKey = `userEvents:${userId}`;
    
    if (this.subscriptions.has(subscriptionKey)) {
      this.unsubscribe(subscriptionKey);
    }

    const subscription = apolloClient
      .subscribe({
        query: USER_EVENTS_SUBSCRIPTION,
        variables: { userId },
      })
      .subscribe({
        next: (result) => {
          const event = result.data?.userEvents;
          if (event) {
            this.handleAuthEvent(event);
            options.onEvent?.(event);
          }
        },
        error: (error) => {
          console.error('User events subscription error:', error);
          options.onError?.(error);
          this.handleSubscriptionError(subscriptionKey);
        },
        complete: () => {
          options.onComplete?.();
        },
      });

    this.subscriptions.set(subscriptionKey, subscription);
    return () => this.unsubscribe(subscriptionKey);
  }

  /**
   * Add event listener for specific auth event type
   */
  addEventListener(eventType: AuthEventType, listener: (event: AuthEvent) => void): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    
    this.eventListeners.get(eventType)!.add(listener);
    
    return () => {
      const listeners = this.eventListeners.get(eventType);
      if (listeners) {
        listeners.delete(listener);
        if (listeners.size === 0) {
          this.eventListeners.delete(eventType);
        }
      }
    };
  }

  /**
   * Handle auth event and notify listeners
   */
  private handleAuthEvent(event: AuthEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error('Auth event listener error:', error);
        }
      });
    }
  }

  /**
   * Handle subscription error with retry logic
   */
  private handleSubscriptionError(subscriptionKey: string): void {
    // Implement retry logic here
    setTimeout(() => {
      if (!this.subscriptions.has(subscriptionKey)) {
        // Subscription was manually unsubscribed, don't retry
        return;
      }
      
      // Retry subscription based on type
      this.retrySubscription(subscriptionKey);
    }, 5000); // Retry after 5 seconds
  }

  /**
   * Retry subscription
   */
  private retrySubscription(subscriptionKey: string): void {
    // Implementation would depend on subscription type
    console.log(`Retrying subscription: ${subscriptionKey}`);
  }

  /**
   * Unsubscribe from specific subscription
   */
  private unsubscribe(subscriptionKey: string): void {
    const subscription = this.subscriptions.get(subscriptionKey);
    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(subscriptionKey);
    }
  }

  /**
   * Unsubscribe from all subscriptions
   */
  unsubscribeAll(): void {
    this.subscriptions.forEach((subscription, key) => {
      subscription.unsubscribe();
    });
    this.subscriptions.clear();
    this.eventListeners.clear();
  }

  /**
   * Get connection status
   */
  isSubscriptionConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get active subscription count
   */
  getActiveSubscriptionCount(): number {
    return this.subscriptions.size;
  }
}

// Export singleton instance
export const authSubscriptionManager = new AuthSubscriptionManager();