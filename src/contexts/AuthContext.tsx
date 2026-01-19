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

  const checkAdminRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();
      
      if (error) {
        // Ignore abort errors
        if (error.message?.includes('AbortError') || error.code === '') {
          console.log('Admin check request was aborted (likely due to navigation)');
          return null; // Return null to indicate we couldn't check
        }
        console.error('Error checking admin role:', error);
        return false;
      }
      return !!data;
    } catch (error: any) {
      // Ignore abort errors
      if (error?.name === 'AbortError' || error?.message?.includes('AbortError')) {
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
        // Skip admin check if we just logged in (it's already done in login function)
        if (justLoggedIn.current) {
          console.log('Skipping admin check - already done during login');
          justLoggedIn.current = false;
          setLoading(false);
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
    supabase.auth.getSession().then(async ({ data: { session } }) => {
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
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      // Check if user is admin using the session's access token
      if (data.user && data.session) {
        // Use the new session directly to make the authenticated request
        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', data.user.id)
          .eq('role', 'admin')
          .maybeSingle();
        
        if (roleError) {
          console.error('Error checking admin role:', roleError);
          await supabase.auth.signOut();
          return { success: false, error: 'Failed to verify admin access. Please try again.' };
        }
        
        if (!roleData) {
          // Sign out non-admin users trying to access admin portal
          await supabase.auth.signOut();
          return { success: false, error: 'You do not have admin access. Please use the Employee Portal.' };
        }
        
        // Mark that we just logged in so onAuthStateChange skips redundant admin check
        justLoggedIn.current = true;
        setIsAdmin(true);
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const signup = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
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
