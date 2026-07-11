'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import api, { setAccessToken, getAccessToken } from '../lib/api';
import { SignupInput, LoginInput } from '@klypup/shared';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'ANALYST';
  orgId: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (credentials: LoginInput) => Promise<void>;
  signup: (credentials: SignupInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on application load (mount)
  useEffect(() => {
    const restoreSession = async () => {
      try {
        // Attempt to fetch user context
        // If the access token is empty, the Axios response interceptor will silently
        // run /auth/refresh first and then retry this request successfully.
        const res = await api.get('/auth/me');
        setUser(res.data.user);
      } catch (error) {
        // Session could not be restored (no cookie or expired)
        setAccessToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  // Listen for background logout events (e.g., if a refresh request gets a 401/403)
  useEffect(() => {
    const handleAuthLogout = () => {
      setUser(null);
      setAccessToken(null);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('auth-logout', handleAuthLogout);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('auth-logout', handleAuthLogout);
      }
    };
  }, []);

  const login = async (credentials: LoginInput) => {
    try {
      const res = await api.post('/auth/login', credentials);
      const { accessToken, user: userData } = res.data;
      setAccessToken(accessToken);
      setUser(userData);
    } catch (error: any) {
      throw error.response?.data || error;
    }
  };

  const signup = async (credentials: SignupInput) => {
    try {
      const res = await api.post('/auth/signup', credentials);
      const { accessToken, user: userData } = res.data;
      setAccessToken(accessToken);
      setUser(userData);
    } catch (error: any) {
      throw error.response?.data || error;
    }
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
