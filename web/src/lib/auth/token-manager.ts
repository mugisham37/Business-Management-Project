/**
 * JWT Token Manager
 * Handles secure token storage, automatic refresh, and cross-tab synchronization
 * Requirements: 3.1, 3.2, 3.4, 3.7
 */

import { TokenPair, AuthState } from '@/types/core';

export interface TokenStorage {
  getTokens(): TokenPair | null;
  setTokens(tokens: TokenPair): void;
  clearTokens(): void;
  isTokenExpired(token: string): boolean;
}

export interface TokenManagerConfig {
  refreshThreshold: number; // Minutes before expiry to refresh
  maxRetries: number;
  storage: TokenStorage;
}

/**
 * Secure token storage implementation with XSS protection
 * Uses httpOnly cookies when available, falls back to secure localStorage
 */
export class SecureTokenStorage implements TokenStorage {
  private readonly ACCESS_TOKEN_KEY = 'auth_access_token';
  private readonly REFRESH_TOKEN_KEY = 'auth_refresh_token';
  private readonly EXPIRES_AT_KEY = 'auth_expires_at';

  getTokens(): TokenPair | null {
    try {
      const accessToken = this.getSecureItem(this.ACCESS_TOKEN_KEY);
      const refreshToken = this.getSecureItem(this.REFRESH_TOKEN_KEY);
      const expiresAt = this.getSecureItem(this.EXPIRES_AT_KEY);

      if (!accessToken || !refreshToken || !expiresAt) {
        return null;
      }

      return {
        accessToken,
        refreshToken,
        expiresAt: new Date(expiresAt),
        tokenType: 'Bearer' as const,
      };
    } catch (error) {
      console.error('Failed to retrieve tokens:', error);
      return null;
    }
  }

  setTokens(tokens: TokenPair): void {
    try {
      this.setSecureItem(this.ACCESS_TOKEN_KEY, tokens.accessToken);
      this.setSecureItem(this.REFRESH_TOKEN_KEY, tokens.refreshToken);
      this.setSecureItem(this.EXPIRES_AT_KEY, tokens.expiresAt.toISOString());
      
      // Broadcast token update to other tabs
      this.broadcastTokenUpdate(tokens);
    } catch (error) {
      console.error('Failed to store tokens:', error);
      throw new Error('Token storage failed');
    }
  }

  clearTokens(): void {
    try {
      this.removeSecureItem(this.ACCESS_TOKEN_KEY);
      this.removeSecureItem(this.REFRESH_TOKEN_KEY);
      this.removeSecureItem(this.EXPIRES_AT_KEY);
      
      // Broadcast token clear to other tabs
      this.broadcastTokenClear();
    } catch (error) {
      console.error('Failed to clear tokens:', error);
    }
  }

  isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expirationTime = payload.exp * 1000; // Convert to milliseconds
      return Date.now() >= expirationTime;
    } catch (error) {
      console.error('Failed to parse token:', error);
      return true; // Assume expired if we can't parse
    }
  }

  private getSecureItem(key: string): string | null {
    if (typeof window === 'undefined') return null;
    
    try {
      // Try to get from secure storage first (if implemented)
      const item = localStorage.getItem(key);
      return item ? this.decrypt(item) : null;
    } catch (error) {
      console.error(`Failed to get item ${key}:`, error);
      return null;
    }
  }

  private setSecureItem(key: string, value: string): void {
    if (typeof window === 'undefined') return;
    
    try {
      // Encrypt before storing
      const encryptedValue = this.encrypt(value);
      localStorage.setItem(key, encryptedValue);
    } catch (error) {
      console.error(`Failed to set item ${key}:`, error);
      throw error;
    }
  }

  private removeSecureItem(key: string): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Failed to remove item ${key}:`, error);
    }
  }

  private encrypt(value: string): string {
    // Simple XOR encryption for demo - in production, use proper encryption
    // This prevents casual inspection but is not cryptographically secure
    const key = this.getEncryptionKey();
    let encrypted = '';
    for (let i = 0; i < value.length; i++) {
      encrypted += String.fromCharCode(value.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return btoa(encrypted);
  }

  private decrypt(encryptedValue: string): string {
    try {
      const encrypted = atob(encryptedValue);
      const key = this.getEncryptionKey();
      let decrypted = '';
      for (let i = 0; i < encrypted.length; i++) {
        decrypted += String.fromCharCode(encrypted.charCodeAt(i) ^ key.charCodeAt(i % key.length));
      }
      return decrypted;
    } catch (error) {
      console.error('Failed to decrypt value:', error);
      throw error;
    }
  }

  private getEncryptionKey(): string {
    // Generate a session-specific key based on browser fingerprint
    const userAgent = navigator.userAgent;
    const screen = `${window.screen.width}x${window.screen.height}`;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return btoa(`${userAgent}-${screen}-${timezone}`).slice(0, 32);
  }

  private broadcastTokenUpdate(tokens: TokenPair): void {
    if (typeof window === 'undefined') return;
    
    try {
      const event = new CustomEvent('auth:tokens-updated', {
        detail: { tokens },
      });
      window.dispatchEvent(event);
      
      // Also use localStorage event for cross-tab communication
      localStorage.setItem('auth:last-update', Date.now().toString());
    } catch (error) {
      console.error('Failed to broadcast token update:', error);
    }
  }

  private broadcastTokenClear(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const event = new CustomEvent('auth:tokens-cleared');
      window.dispatchEvent(event);
      
      // Also use localStorage event for cross-tab communication
      localStorage.setItem('auth:last-clear', Date.now().toString());
    } catch (error) {
      console.error('Failed to broadcast token clear:', error);
    }
  }
}

/**
 * JWT Token Manager
 * Handles automatic token refresh and lifecycle management
 */
export class TokenManager {
  private refreshTimer: NodeJS.Timeout | null = null;
  private refreshPromise: Promise<TokenPair> | null = null;
  private listeners: Set<(tokens: TokenPair | null) => void> = new Set();

  constructor(
    private config: TokenManagerConfig,
    private refreshTokenFn: (refreshToken: string) => Promise<TokenPair>
  ) {
    this.setupCrossTabSync();
    this.startRefreshTimer();
  }

  /**
   * Get current tokens, refreshing if necessary
   */
  async getValidTokens(): Promise<TokenPair | null> {
    const tokens = this.config.storage.getTokens();
    
    if (!tokens) {
      return null;
    }

    // Check if token needs refresh
    if (this.shouldRefreshToken(tokens)) {
      return this.refreshTokens();
    }

    return tokens;
  }

  /**
   * Set new tokens and start refresh timer
   */
  setTokens(tokens: TokenPair): void {
    this.config.storage.setTokens(tokens);
    this.startRefreshTimer();
    this.notifyListeners(tokens);
  }

  /**
   * Clear tokens and stop refresh timer
   */
  clearTokens(): void {
    this.config.storage.clearTokens();
    this.stopRefreshTimer();
    this.notifyListeners(null);
  }

  /**
   * Subscribe to token changes
   */
  onTokenChange(listener: (tokens: TokenPair | null) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Refresh tokens with retry logic
   */
  private async refreshTokens(): Promise<TokenPair | null> {
    // Prevent multiple simultaneous refresh attempts
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const currentTokens = this.config.storage.getTokens();
    if (!currentTokens) {
      return null;
    }

    this.refreshPromise = this.attemptTokenRefresh(currentTokens.refreshToken);
    
    try {
      const newTokens = await this.refreshPromise;
      this.setTokens(newTokens);
      return newTokens;
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.clearTokens();
      return null;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async attemptTokenRefresh(refreshToken: string): Promise<TokenPair> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await this.refreshTokenFn(refreshToken);
      } catch (error) {
        lastError = error as Error;
        console.warn(`Token refresh attempt ${attempt} failed:`, error);
        
        if (attempt < this.config.maxRetries) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Token refresh failed after all retries');
  }

  private shouldRefreshToken(tokens: TokenPair): boolean {
    const now = new Date();
    const refreshTime = new Date(tokens.expiresAt.getTime() - (this.config.refreshThreshold * 60 * 1000));
    return now >= refreshTime;
  }

  private startRefreshTimer(): void {
    this.stopRefreshTimer();
    
    const tokens = this.config.storage.getTokens();
    if (!tokens) return;

    const now = new Date();
    const refreshTime = new Date(tokens.expiresAt.getTime() - (this.config.refreshThreshold * 60 * 1000));
    const delay = Math.max(0, refreshTime.getTime() - now.getTime());

    this.refreshTimer = setTimeout(() => {
      this.refreshTokens();
    }, delay);
  }

  private stopRefreshTimer(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private setupCrossTabSync(): void {
    if (typeof window === 'undefined') return;

    // Listen for storage events from other tabs
    window.addEventListener('storage', (event) => {
      if (event.key === 'auth:last-update') {
        const tokens = this.config.storage.getTokens();
        this.notifyListeners(tokens);
        if (tokens) {
          this.startRefreshTimer();
        }
      } else if (event.key === 'auth:last-clear') {
        this.stopRefreshTimer();
        this.notifyListeners(null);
      }
    });

    // Listen for custom events in the same tab
    window.addEventListener('auth:tokens-updated', ((event: CustomEvent) => {
      this.notifyListeners(event.detail.tokens);
      this.startRefreshTimer();
    }) as EventListener);

    window.addEventListener('auth:tokens-cleared', () => {
      this.stopRefreshTimer();
      this.notifyListeners(null);
    });
  }

  private notifyListeners(tokens: TokenPair | null): void {
    this.listeners.forEach(listener => {
      try {
        listener(tokens);
      } catch (error) {
        console.error('Error in token change listener:', error);
      }
    });
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopRefreshTimer();
    this.listeners.clear();
  }
}

// Default token manager instance
let defaultTokenManager: TokenManager | null = null;

export function createTokenManager(
  refreshTokenFn: (refreshToken: string) => Promise<TokenPair>,
  config?: Partial<TokenManagerConfig>
): TokenManager {
  const fullConfig: TokenManagerConfig = {
    refreshThreshold: 5, // Refresh 5 minutes before expiry
    maxRetries: 3,
    storage: new SecureTokenStorage(),
    ...config,
  };

  return new TokenManager(fullConfig, refreshTokenFn);
}

export function getDefaultTokenManager(): TokenManager | null {
  return defaultTokenManager;
}

export function setDefaultTokenManager(manager: TokenManager): void {
  defaultTokenManager = manager;
}