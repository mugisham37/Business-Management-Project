/**
 * User Sessions Hook
 * Custom hook for managing user sessions
 */

import { useState, useEffect } from 'react';

export interface UserSession {
  id: string;
  userId: string;
  userEmail: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  lastActivity: string;
  isActive: boolean;
}

export function useUserSessions() {
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setLoading(true);
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 800));
        
        setSessions([
          {
            id: '1',
            userId: 'user1',
            userEmail: 'john.doe@example.com',
            ipAddress: '192.168.1.100',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            lastActivity: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            isActive: true,
          },
          {
            id: '2',
            userId: 'user2',
            userEmail: 'jane.smith@example.com',
            ipAddress: '192.168.1.101',
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
            lastActivity: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
            isActive: true,
          },
        ]);
      } catch (err) {
        setError('Failed to fetch user sessions');
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, []);

  return {
    sessions,
    loading,
    error,
    refetch: () => {
      setLoading(true);
      setError(null);
      // Re-fetch logic would go here
    },
  };
}