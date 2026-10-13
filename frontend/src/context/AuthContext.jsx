import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi, getApiErrorMessage } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();

  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('performa_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState(true);

  // True only when a 401 ended a *live* session (not a cold-start 401 with no
  // session). The login page uses it to explain why the user is back here.
  const [sessionExpired, setSessionExpired] = useState(false);
  const wasAuthenticated = useRef(false);
  useEffect(() => {
    wasAuthenticated.current = !!user;
  }, [user]);

  const persistUser = useCallback((userData) => {
    setUser(userData);
    try {
      if (userData) {
        localStorage.setItem('performa_user', JSON.stringify(userData));
      } else {
        localStorage.removeItem('performa_user');
      }
    } catch {}
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {}
    try {
      localStorage.removeItem('performa_token');
    } catch {}
    queryClient.clear();
    persistUser(null);
  }, [persistUser, queryClient]);

  const refreshUser = useCallback(async () => {
    const userData = await authApi.getCurrentUser();
    persistUser(userData);
    return userData;
  }, [persistUser]);

  // Listen to 401 unauthorized events dispatched by api.js
  useEffect(() => {
    const handleUnauthorized = () => {
      queryClient.clear();
      persistUser(null);
      setSessionExpired(wasAuthenticated.current);
    };
    window.addEventListener('performa:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('performa:unauthorized', handleUnauthorized);
  }, [persistUser, queryClient]);

  // Validate the httpOnly auth cookie on mount and hydrate the user.
  useEffect(() => {
    let isMounted = true;

    async function checkAuth() {
      try {
        const userData = await authApi.getCurrentUser();
        if (isMounted) persistUser(userData);
      } catch {
        if (isMounted) persistUser(null);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    checkAuth();
    return () => {
      isMounted = false;
    };
  }, [persistUser]);

  const login = useCallback(async (email, password) => {
    setIsLoading(true);
    try {
      const tokenData = await authApi.login(email, password);
      try {
        if (tokenData?.access_token) {
          localStorage.setItem('performa_token', tokenData.access_token);
        }
      } catch {}
      const userData = await authApi.getCurrentUser();
      persistUser(userData);
      setSessionExpired(false);
      return { success: true, user: userData };
    } catch (err) {
      persistUser(null);
      const message = getApiErrorMessage(err, 'Failed to sign in. Please verify your credentials.');
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, [persistUser]);

  const register = useCallback(async ({ fullName, email, organizationName, password }) => {
    setIsLoading(true);
    try {
      const tokenData = await authApi.register({ fullName, email, organizationName, password });
      try {
        if (tokenData?.access_token) {
          localStorage.setItem('performa_token', tokenData.access_token);
        }
      } catch {}
      const userData = await authApi.getCurrentUser();
      persistUser(userData);
      return { success: true, user: userData };
    } catch (err) {
      persistUser(null);
      const message = getApiErrorMessage(err, 'Failed to create your account.');
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, [persistUser]);

  const resetPassword = useCallback(async (token, newPassword) => {
    setIsLoading(true);
    try {
      const tokenData = await authApi.resetPassword(token, newPassword);
      try {
        if (tokenData?.access_token) {
          localStorage.setItem('performa_token', tokenData.access_token);
        }
      } catch {}
      const userData = await authApi.getCurrentUser();
      persistUser(userData);
      return { success: true, user: userData };
    } catch (err) {
      const message = getApiErrorMessage(err, 'This reset link is invalid or has expired.');
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, [persistUser]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      sessionExpired,
      login,
      register,
      resetPassword,
      logout,
      refreshUser,
    }),
    [user, isLoading, sessionExpired, login, register, resetPassword, logout, refreshUser]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
