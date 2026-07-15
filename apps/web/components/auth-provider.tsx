'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';

import {
  apiRequest,
  clearTokens,
  getStoredAccessToken,
  SESSION_EXPIRED_EVENT,
  SESSION_EXPIRED_MESSAGE,
  storeTokens,
  type AuthTokens,
} from '@/lib/api';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  companyId: string;
  company: {
    id: string;
    name: string;
    status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  };
  role: { id: string; code: string; name: string };
  branch: { id: string; code: string; name: string } | null;
  permissions: string[];
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  sessionMessage: string | null;
  clearSessionMessage: () => void;
  setSession: (user: AuthUser, tokens: AuthTokens) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(() => Boolean(getStoredAccessToken()));
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  const clearSessionMessage = useCallback(() => setSessionMessage(null), []);

  useEffect(() => {
    const handleSessionExpired = () => {
      setUser(null);
      setLoading(false);
      setSessionMessage(SESSION_EXPIRED_MESSAGE);
      router.replace('/login');
    };

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () =>
      window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, [router]);

  useEffect(() => {
    if (!getStoredAccessToken()) return;

    void apiRequest<AuthUser>('/auth/me')
      .then(setUser)
      .catch(() => {
        clearTokens();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      sessionMessage,
      clearSessionMessage,
      setSession: (nextUser, tokens) => {
        storeTokens(tokens);
        setUser(nextUser);
        setLoading(false);
        setSessionMessage(null);
      },
      logout: async () => {
        try {
          await apiRequest('/auth/logout', { method: 'POST' }, false);
        } finally {
          clearTokens();
          setUser(null);
          setLoading(false);
          setSessionMessage(null);
        }
      },
    }),
    [clearSessionMessage, loading, sessionMessage, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
