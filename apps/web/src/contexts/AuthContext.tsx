import React, { createContext, useContext, useState, useEffect } from 'react';
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
  isInitialized: boolean;
  login: (token: string, user: AuthUser, company: AuthCompany) => void;
  logout: () => void;
  switchRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Initial default session for development and demo
const DEFAULT_DEMO_USER: AuthUser = {
  id: 'b561c28c-9892-4f9e-bc43-b1d5c7f8a123',
  name: 'Vikram Mehta',
  email: 'admin@prestige.com',
  role: 'company_admin',
  status: 'active',
  companyId: 'd712e49c-1234-4a5b-9c8d-e1f2a3b4c5d6',
};

const DEFAULT_DEMO_COMPANY: AuthCompany = {
  id: 'd712e49c-1234-4a5b-9c8d-e1f2a3b4c5d6',
  name: 'Prestige Realty Group',
  slug: 'prestige-realty',
  plan: 'enterprise',
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('propbot_access_token') : null;
  });

  const [user, setUser] = useState<AuthUser | null>(() => {
    const cached = typeof window !== 'undefined' ? localStorage.getItem('propbot_user') : null;
    return cached ? (JSON.parse(cached) as AuthUser) : (token ? DEFAULT_DEMO_USER : null);
  });

  const [company, setCompany] = useState<AuthCompany | null>(() => {
    const cached = typeof window !== 'undefined' ? localStorage.getItem('propbot_company') : null;
    return cached ? (JSON.parse(cached) as AuthCompany) : (token ? DEFAULT_DEMO_COMPANY : null);
  });

  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  const login = (newToken: string, newUser: AuthUser, newCompany: AuthCompany) => {
    setToken(newToken);
    setUser(newUser);
    setCompany(newCompany);
    if (typeof window !== 'undefined') {
      localStorage.setItem('propbot_access_token', newToken);
      localStorage.setItem('propbot_user', JSON.stringify(newUser));
      localStorage.setItem('propbot_company', JSON.stringify(newCompany));
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setCompany(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('propbot_access_token');
      localStorage.removeItem('propbot_user');
      localStorage.removeItem('propbot_company');
    }
  };

  const switchRole = (newRole: UserRole) => {
    if (user) {
      const updatedUser = { ...user, role: newRole };
      setUser(updatedUser);
      if (typeof window !== 'undefined') {
        localStorage.setItem('propbot_user', JSON.stringify(updatedUser));
      }
    }
  };

  useEffect(() => {
    const existingToken = typeof window !== 'undefined' ? localStorage.getItem('propbot_access_token') : null;
    const API_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000';

    const performAutoLogin = () => {
      fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@prestige.com', password: 'Password123!' }),
      })
        .then(res => res.json())
        .then(data => {
          if (data?.data?.tokens?.accessToken) {
            login(data.data.tokens.accessToken, data.data.user, data.data.company);
          }
        })
        .catch(() => { })
        .finally(() => setIsInitialized(true));
    };

    if (!existingToken) {
      performAutoLogin();
    } else {
      // Validate existing token
      apiRequest<{ user: AuthUser; tenant: { companyId: string } }>('/api/auth/me')
        .then(res => {
          if (res?.user) {
            setUser(res.user);
          }
          setIsInitialized(true);
        })
        .catch(() => {
          logout();
          performAutoLogin();
        });
    }

    const handleUnauthorized = () => {
      logout();
      performAutoLogin();
    };

    window.addEventListener('propbot:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('propbot:unauthorized', handleUnauthorized);
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        company,
        token,
        isAuthenticated: Boolean(token && user),
        isInitialized,
        login,
        logout,
        switchRole,
      }}
    >
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
