import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi, getApiErrorMessage } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('performa_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState(true);

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
    persistUser(null);
  }, [persistUser]);

  const refreshUser = useCallback(async () => {
    const userData = await authApi.getCurrentUser();
    persistUser(userData);
    return userData;
  }, [persistUser]);

  // Listen to 401 unauthorized events dispatched by api.js
  useEffect(() => {
    const handleUnauthorized = () => persistUser(null);
    window.addEventListener('performa:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('performa:unauthorized', handleUnauthorized);
  }, [persistUser]);

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

  const login = async (email, password) => {
    setIsLoading(true);
    try {
      await authApi.login(email, password);
      const userData = await authApi.getCurrentUser();
      persistUser(userData);
      return { success: true, user: userData };
    } catch (err) {
      persistUser(null);
      const message = getApiErrorMessage(err, 'Failed to sign in. Please verify your credentials.');
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
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
