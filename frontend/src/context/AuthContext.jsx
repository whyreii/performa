import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi, getApiErrorMessage } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem('performa_token') || null;
    } catch {
      return null;
    }
  });

  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('performa_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem('performa_token');
      localStorage.removeItem('performa_user');
    } catch {}
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const userData = await authApi.getCurrentUser();
    setUser(userData);
    try {
      localStorage.setItem('performa_user', JSON.stringify(userData));
    } catch {}
    return userData;
  }, []);

  // Listen to 401 unauthorized events dispatched by api.js
  useEffect(() => {
    const handleUnauthorized = () => {
      logout();
    };
    window.addEventListener('performa:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('performa:unauthorized', handleUnauthorized);
  }, [logout]);

  // Load current user profile if token is present
  useEffect(() => {
    let isMounted = true;

    async function checkAuth() {
      if (!token) {
        if (isMounted) setIsLoading(false);
        return;
      }
      try {
        const userData = await authApi.getCurrentUser();
        if (isMounted) {
          setUser(userData);
          localStorage.setItem('performa_user', JSON.stringify(userData));
        }
      } catch (err) {
        if (isMounted) {
          logout();
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    checkAuth();
    return () => {
      isMounted = false;
    };
  }, [token, logout]);

  const login = async (email, password) => {
    setIsLoading(true);
    try {
      const data = await authApi.login(email, password);
      const accessToken = data.access_token;
      localStorage.setItem('performa_token', accessToken);
      setToken(accessToken);

      // Fetch user profile immediately
      const userData = await authApi.getCurrentUser();
      setUser(userData);
      localStorage.setItem('performa_user', JSON.stringify(userData));
      return { success: true, user: userData };
    } catch (err) {
      logout();
      const message = getApiErrorMessage(err, 'Failed to sign in. Please verify your credentials.');
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        logout,
        refreshUser,
      }}
    >
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
