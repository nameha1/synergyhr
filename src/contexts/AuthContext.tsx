"use client";

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  isAuthenticated: boolean;
  isAdmin: boolean;
  user: User | null;
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Track if we just logged in (to skip redundant admin check in onAuthStateChange)
  const justLoggedIn = useRef(false);

  const isAbortLikeError = (err: unknown) => {
    const message = err instanceof Error ? err.message : String((err as { message?: string }).message ?? '');
    const msg = message.toLowerCase();
    const name = (err as { name?: string }).name;
    return (
      name === 'AbortError' ||
      msg.includes('aborterror') ||
      msg.includes('signal is aborted') ||
      msg.includes('aborted without reason') ||
      msg.includes('the operation was aborted')
    );
  };

  const getErrorCode = (err: unknown) => {
    if (typeof err === 'object' && err !== null && 'code' in err) {
      const code = (err as { code?: string | number }).code;
      return code !== undefined ? String(code) : undefined;
    }
    return undefined;
  };

  const getErrorMessage = (err: unknown) => {
    if (err instanceof Error) return err.message;
    return String((err as { message?: string }).message ?? 'Unknown error');
  };

  const withTimeout = async <T,>(
    promise: Promise<T>,
    ms: number,
    fallback: T
  ): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<T>((resolve) => {
      timeoutId = setTimeout(() => resolve(fallback), ms);
    });
    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };

  const safeCheckAdminRole = async (userId: string): Promise<boolean | null> => {
    try {
      const result = await withTimeout(checkAdminRole(userId), 8000, null);
      return result;
    } catch (error) {
      console.error('Admin check failed:', error);
      return null;
    }
  };

  const checkAdminRole = async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();

      if (error) {
        // Ignore abort errors (these can happen during navigation / route changes)
        if (isAbortLikeError(error) || getErrorCode(error) === '') {
          console.log('Admin check request was aborted (likely due to navigation)');
          return false;
        }
        console.error('Error checking admin role:', error);
        return false;
      }
      return !!data;
    } catch (error: unknown) {
      // Ignore abort errors
      if (isAbortLikeError(error)) {
        console.log('Admin check request was aborted (likely due to navigation)');
        return false;
      }
      console.error('Error checking admin role:', error);
      return false;
    }
  };

  useEffect(() => {
    let mounted = true;
    let initialCheckDone = false;

    // Check initial session first
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        console.log('Initial session check:', session?.user?.id);
        
        if (!mounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          const adminStatus = await safeCheckAdminRole(session.user.id);
          if (mounted && adminStatus !== null) {
            setIsAdmin(adminStatus);
          }
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        if (!isAbortLikeError(err)) {
          console.error('Initial session check failed:', err);
        }
      } finally {
        if (mounted) {
          initialCheckDone = true;
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.id);
      
      if (!mounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // Skip admin check while login() is verifying admin role
        if (justLoggedIn.current) {
          console.log('Skipping admin check - login in progress');
          return;
        }

        // Check admin status
        const adminStatus = await safeCheckAdminRole(session.user.id);
        if (mounted && adminStatus !== null) {
          setIsAdmin(adminStatus);
        }
      } else {
        setIsAdmin(false);
      }

      // Only update loading if initial check is done
      if (initialCheckDone && mounted) {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setLoading(true);
    justLoggedIn.current = true;

    const finish = () => {
      justLoggedIn.current = false;
      setLoading(false);
    };

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        finish();
        return { success: false, error: error.message };
      }

      // Ensure app state is updated immediately
      setSession(data.session ?? null);
      setUser(data.user ?? null);

      if (!data.user) {
        finish();
        return { success: false, error: 'Login succeeded but no user was returned.' };
      }

      // Role check - simple direct call with short timeout
      const adminStatus = await withTimeout(checkAdminRole(data.user.id), 8000, false);

      if (!adminStatus) {
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setIsAdmin(false);
        finish();
        return { success: false, error: 'You do not have admin access. Please use the Employee Portal.' };
      }

      setIsAdmin(true);
      finish();
      return { success: true };
    } catch (error: unknown) {
      finish();
      if (isAbortLikeError(error)) {
        return { success: false, error: 'Request was interrupted. Please try again.' };
      }
      return { success: false, error: getErrorMessage(error) };
    }
  };

  const signup = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/admin/login`,
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: getErrorMessage(error) };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ 
      isAuthenticated: !!session, 
      isAdmin,
      user, 
      session, 
      loading,
      login, 
      signup,
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
};
