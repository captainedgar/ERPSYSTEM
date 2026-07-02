'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  apiRequest,
  clearTokens,
  storeTokens,
  type AuthTokens,
} from '@/lib/api';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  companyId: string;
  role: { id: string; code: string; name: string };
  branch: { id: string; code: string; name: string } | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  setSession: (user: AuthUser, tokens: AuthTokens) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void apiRequest<AuthUser>('/auth/me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      setSession: (nextUser, tokens) => {
        storeTokens(tokens);
        setUser(nextUser);
        setLoading(false);
      },
      logout: async () => {
        try {
          await apiRequest('/auth/logout', { method: 'POST' }, false);
        } finally {
          clearTokens();
          setUser(null);
        }
      },
    }),
    [loading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
