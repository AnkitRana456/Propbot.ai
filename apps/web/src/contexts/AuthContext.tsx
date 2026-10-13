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
  login: (token: string, user: AuthUser, company: AuthCompany) => void;
  logout: () => void;
  switchRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Initial default session for development and demo
const DEFAULT_DEMO_USER: AuthUser = {
  id: 'b561c28c-9892-4f9e-bc43-b1d5c7f8a123',
  name: 'Ankit Sharma',
  email: 'admin@prestigegroup.com',
  role: 'company_admin',
  status: 'active',
  companyId: 'd712e49c-1234-4a5b-9c8d-e1f2a3b4c5d6',
};

const DEFAULT_DEMO_COMPANY: AuthCompany = {
  id: 'd712e49c-1234-4a5b-9c8d-e1f2a3b4c5d6',
  name: 'Prestige Estates',
  slug: 'prestige-estates',
  plan: 'growth',
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const cached = localStorage.getItem('propbot_user');
    return cached ? (JSON.parse(cached) as AuthUser) : DEFAULT_DEMO_USER;
  });

  const [company, setCompany] = useState<AuthCompany | null>(() => {
    const cached = localStorage.getItem('propbot_company');
    return cached ? (JSON.parse(cached) as AuthCompany) : DEFAULT_DEMO_COMPANY;
  });

  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('propbot_access_token');
  });

  useEffect(() => {
    const existingToken = localStorage.getItem('propbot_access_token');
    const API_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000';

    if (!existingToken) {
      // Auto-connect to local backend with seeded admin credentials
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
        .catch(() => { });
    } else {
      // Validate existing token
      apiRequest<{ user: AuthUser; tenant: { companyId: string } }>('/api/auth/me')
        .then(res => {
          if (res?.user) {
            setUser(res.user);
          }
        })
        .catch(() => { });
    }
  }, []);

  const login = (newToken: string, newUser: AuthUser, newCompany: AuthCompany) => {
    setToken(newToken);
    setUser(newUser);
    setCompany(newCompany);
    localStorage.setItem('propbot_access_token', newToken);
    localStorage.setItem('propbot_user', JSON.stringify(newUser));
    localStorage.setItem('propbot_company', JSON.stringify(newCompany));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setCompany(null);
    localStorage.removeItem('propbot_access_token');
    localStorage.removeItem('propbot_user');
    localStorage.removeItem('propbot_company');
  };

  const switchRole = (newRole: UserRole) => {
    if (user) {
      const updatedUser = { ...user, role: newRole };
      setUser(updatedUser);
      localStorage.setItem('propbot_user', JSON.stringify(updatedUser));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        company,
        token,
        isAuthenticated: !!user,
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
