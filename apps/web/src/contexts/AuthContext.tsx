import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { UserRole, UserStatus } from '@propbot/shared';
import { apiRequest } from '../services/api-client.js';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  companyId: string;
}

export interface AuthCompany {
  id: string;
  name: string;
  slug: string;
  plan: string;
}

export interface AuthContextValue {
  user: AuthUser | null;
  company: AuthCompany | null;
  token: string | null;
  isAuthenticated: boolean;
  /** True once the stored session has been checked with the server. */
  isInitialized: boolean;
  login: (token: string, user: AuthUser, company: AuthCompany) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const KEYS = { token: 'propbot_access_token', user: 'propbot_user', company: 'propbot_company' } as const;

const read = <T,>(key: string): T | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

/**
 * Holds the signed-in user. A stored session is checked with the server on load; nobody is ever signed in
 * automatically, and an expired or rejected session simply signs the visitor out.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => (typeof window !== 'undefined' ? localStorage.getItem(KEYS.token) : null));
  const [user, setUser] = useState<AuthUser | null>(() => (token ? read<AuthUser>(KEYS.user) : null));
  const [company, setCompany] = useState<AuthCompany | null>(() => (token ? read<AuthCompany>(KEYS.company) : null));
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  const login = useCallback((newToken: string, newUser: AuthUser, newCompany: AuthCompany) => {
    setToken(newToken);
    setUser(newUser);
    setCompany(newCompany);
    setIsInitialized(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem(KEYS.token, newToken);
      localStorage.setItem(KEYS.user, JSON.stringify(newUser));
      localStorage.setItem(KEYS.company, JSON.stringify(newCompany));
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    setCompany(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(KEYS.token);
      localStorage.removeItem(KEYS.user);
      localStorage.removeItem(KEYS.company);
    }
  }, []);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(KEYS.token) : null;
    if (!stored) {
      setIsInitialized(true);
    } else {
      apiRequest<{ user: AuthUser; tenant: { companyId: string } }>('/api/auth/me')
        .then(res => {
          if (res?.user) {
            setUser(res.user);
            localStorage.setItem(KEYS.user, JSON.stringify(res.user));
          }
        })
        .catch(() => logout())
        .finally(() => setIsInitialized(true));
    }

    const handleUnauthorized = () => logout();
    window.addEventListener('propbot:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('propbot:unauthorized', handleUnauthorized);
  }, [logout]);

  return (
    <AuthContext.Provider value={{ user, company, token, isAuthenticated: Boolean(token && user), isInitialized, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
