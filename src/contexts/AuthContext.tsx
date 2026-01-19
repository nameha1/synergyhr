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

  const isAbortLikeError = (err: any) => {
    const msg = String(err?.message ?? '').toLowerCase();
    return (
      err?.name === 'AbortError' ||
      msg.includes('aborterror') ||
      msg.includes('signal is aborted') ||
      msg.includes('aborted without reason') ||
      msg.includes('the operation was aborted')
    );
  };

  const checkAdminRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();

      if (error) {
        // Ignore abort errors (these can happen during navigation / route changes)
        if (isAbortLikeError(error) || error.code === '') {
          console.log('Admin check request was aborted (likely due to navigation)');
          return null; // Return null to indicate we couldn't check
        }
        console.error('Error checking admin role:', error);
        return false;
      }
      return !!data;
    } catch (error: any) {
      // Ignore abort errors
      if (isAbortLikeError(error)) {
        console.log('Admin check request was aborted (likely due to navigation)');
        return null;
      }
      console.error('Error checking admin role:', error);
      return false;
    }
  };

  useEffect(() => {
    // Set up auth state listener BEFORE checking session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.id);
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // Skip admin check while login() is verifying admin role; it will finalize loading/isAdmin.
        if (justLoggedIn.current) {
          console.log('Skipping admin check - login in progress');
          return;
        }

        // For other auth state changes (like page reload), check admin status
        const adminStatus = await checkAdminRole(session.user.id);
        if (adminStatus !== null) {
          setIsAdmin(adminStatus);
        }
      } else {
        setIsAdmin(false);
      }

      setLoading(false);
    });

    // Check initial session
    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        console.log('Initial session check:', session?.user?.id);
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          const adminStatus = await checkAdminRole(session.user.id);
          if (adminStatus !== null) {
            setIsAdmin(adminStatus);
          }
        }

        setLoading(false);
      })
      .catch((err) => {
        if (isAbortLikeError(err)) return;
        console.error('Initial session check failed:', err);
        setLoading(false);
      });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setLoading(true);
    justLoggedIn.current = true;

    const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
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

      // Ensure app state is updated immediately (avoid relying solely on onAuthStateChange)
      setSession(data.session ?? null);
      setUser(data.user ?? null);

      if (!data.user) {
        finish();
        return { success: false, error: 'Login succeeded but no user was returned.' };
      }

      // Role check (retry a few times in case the request gets aborted during navigation)
      let adminStatus = await checkAdminRole(data.user.id);
      for (let i = 0; i < 3 && adminStatus === null; i++) {
        await sleep(150 * (i + 1));
        adminStatus = await checkAdminRole(data.user.id);
      }

      if (adminStatus !== true) {
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setIsAdmin(false);
        finish();

        if (adminStatus === false) {
          return { success: false, error: 'You do not have admin access. Please use the Employee Portal.' };
        }

        return { success: false, error: 'Failed to verify admin access. Please try again.' };
      }

      setIsAdmin(true);
      finish();
      return { success: true };
    } catch (error: any) {
      finish();
      if (isAbortLikeError(error)) {
        return { success: false, error: 'Request was interrupted. Please try again.' };
      }
      return { success: false, error: error.message };
    }
  };

  const signup = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
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
