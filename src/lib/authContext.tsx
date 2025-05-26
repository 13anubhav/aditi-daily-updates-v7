import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from './supabaseClient';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';
import { isReturningFromTabSwitch } from './tabSwitchUtil';

// User cache key for localStorage
export const USER_CACHE_KEY = 'aditi_user_cache';

export type UserRole = 'user' | 'manager' | 'admin';

interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  teamId?: string;
  teamName?: string;
  lastChecked?: number;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  checkUserRole: () => Promise<UserRole>;
  refreshUser: () => Promise<void>;
}

// Create context with default values
const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  signOut: async () => {},
  checkUserRole: async () => 'user',
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Attempt to restore user from cache on initial load
  useEffect(() => {
    // Attempt to get cached user first for immediate UI display
    const cachedUser = localStorage.getItem(USER_CACHE_KEY);
    if (cachedUser) {
      try {
        setUser(JSON.parse(cachedUser));
      } catch (err) {
        console.error('Error parsing cached user:', err);
      }
    } 
    
    // Check session in the background without showing loading state
    checkSessionQuietly();
    
    // Always force clear loading state after 3 seconds no matter what
    const safetyTimer = setTimeout(() => {
      if (isLoading) {
        console.log('SAFETY: Force clearing loading state');
        setIsLoading(false);
      }
    }, 3000);
    
    return () => clearTimeout(safetyTimer);
  }, []);

  // Handle tab visibility changes to prevent session loss
  useEffect(() => {
    // Define handler to maintain session when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Check if we have a cached user but not a current user state
        const cachedUser = localStorage.getItem(USER_CACHE_KEY);
        if (cachedUser && !user) {
          console.log('Tab visible - restoring user from cache');
          try {
            setUser(JSON.parse(cachedUser));
            // No need to trigger a full session check if restored from cache
            return;
          } catch (err) {
            console.error('Error parsing cached user:', err);
          }
        }
        
        // Only check session if not returning from a tab switch
        if (!isReturningFromTabSwitch()) {
          // Use delayed check to prevent unnecessary API calls during quick tab switches
          const tabSwitchDelay = setTimeout(() => {
            checkSessionQuietly();
          }, 500);
          
          return () => clearTimeout(tabSwitchDelay);
        }
      }
    };
    
    // Add visibility change listener
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Clean up listener
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  // Set up auth state listener
  useEffect(() => {
    // Skip listener setup if returning from tab switch
    if (isReturningFromTabSwitch()) {
      console.log('Skipping auth listener setup due to tab switch');
      return;
    }
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        try {
          await updateUserData(session.user);
        } catch (error) {
          console.error('Error updating user data on sign in:', error);
          setIsLoading(false);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        localStorage.removeItem(USER_CACHE_KEY);
        
        if (router.pathname !== '/') {
          router.push('/');
        }
      }
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, [router.pathname]);
  
  // Quiet session check without loading spinner
  const checkSessionQuietly = async () => {
    // Skip session check if returning from tab switch
    if (isReturningFromTabSwitch()) {
      console.log('Skipping quiet session check due to tab switch');
      
      // If we have a cached user, use that instead of calling API
      const cachedUser = localStorage.getItem(USER_CACHE_KEY);
      if (cachedUser && !user) {
        try {
          const parsedUser = JSON.parse(cachedUser);
          // Check if the cached user was saved recently (last 2 hours)
          const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
          if (parsedUser.lastChecked && parsedUser.lastChecked > twoHoursAgo) {
            console.log('Using recent cached user during tab switch');
            setUser(parsedUser);
            return;
          }
        } catch (err) {
          console.error('Error parsing cached user:', err);
        }
      }
      return;
    }
    
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Session check error:', error);
        setUser(null);
        localStorage.removeItem(USER_CACHE_KEY);
        return;
      }
      
      if (session && session.user) {
        updateUserData(session.user, false);
      } else if (!session && user) {
        // Only clear user if we have one set
        // But check if we might be returning from a tab switch first
        const cachedUser = localStorage.getItem(USER_CACHE_KEY);
        if (!cachedUser) {
          setUser(null);
          localStorage.removeItem(USER_CACHE_KEY);
        } else if (document.visibilityState !== 'visible') {
          // Don't clear user during tab visibility changes
          console.log('Preserving user during tab switch');
        }
      }
    } catch (error) {
      console.error('Error checking session:', error);
    }
  };

  // Update user data from Supabase user
  const updateUserData = async (authUser: any, showLoading = true) => {
    if (showLoading) {
      setIsLoading(true);
    }
    
    try {
      if (!authUser?.email) {
        setUser(null);
        return;
      }
      
      // Get user role
      let role: UserRole = 'user';
      
      try {
        // Check if admin
        const { data: adminData } = await supabase
          .from('aditi_admins')
          .select('*')
          .eq('email', authUser.email)
          .single();
        
        if (adminData) {
          role = 'admin';
        } else {
          // Check if manager
          const { data: managerData } = await supabase
            .from('aditi_teams')
            .select('*')
            .eq('manager_email', authUser.email);
          
          if (managerData && managerData.length > 0) {
            role = 'manager';
          }
        }
      } catch (error) {
        console.error('Error checking user role:', error);
      }
      
      // Get team info
      let teamId = undefined;
      let teamName = undefined;
      
      try {
        const { data: userData } = await supabase
          .from('aditi_team_members')
          .select('*, aditi_teams(*)')
          .eq('employee_email', authUser.email)
          .single();
        
        if (userData) {
          teamId = userData.team_id;
          teamName = userData.aditi_teams?.team_name;
        }
      } catch (error) {
        console.error('Error getting user team info:', error);
      }
      
      // Create user object
      const updatedUser = {
        id: authUser.id,
        email: authUser.email,
        name: authUser.user_metadata?.name || authUser.email.split('@')[0] || 'User',
        role,
        teamId,
        teamName,
        lastChecked: Date.now()
      };
      
      // Update state and cache
      setUser(updatedUser);
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(updatedUser));
      
    } catch (error) {
      console.error('Error updating user data:', error);
      setUser(null);
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  };

  const refreshUser = async () => {
    // Skip refresh if returning from tab switch
    if (isReturningFromTabSwitch()) {
      console.log('Skipping user refresh due to tab switch');
      
      // If we have a cached user, use that instead of calling API
      const cachedUser = localStorage.getItem(USER_CACHE_KEY);
      if (cachedUser) {
        try {
          setUser(JSON.parse(cachedUser));
          return;
        } catch (err) {
          console.error('Error parsing cached user:', err);
        }
      }
      return;
    }
    
    try {
      setIsLoading(true);
      
      const { data: { user: authUser }, error } = await supabase.auth.getUser();
      
      if (error) {
        console.error('Error getting user:', error);
        setUser(null);
        return;
      }
      
      if (authUser) {
        await updateUserData(authUser);
      } else {
        setUser(null);
        localStorage.removeItem(USER_CACHE_KEY);
      }
    } catch (error) {
      console.error('Error refreshing user:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const checkUserRole = async (): Promise<UserRole> => {
    // First try to get from current user
    if (user?.role) {
      return user.role;
    }
    
    // Skip check if returning from tab switch
    if (isReturningFromTabSwitch()) {
      console.log('Skipping user role check due to tab switch');
      // Return a default role
      return 'user';
    }
    
    // Try to refresh the user first
    try {
      await refreshUser();
      if (user?.role) {
        return user.role;
      }
    } catch (error) {
      console.error('Error during refresh for role check:', error);
    }
    
    // Default to user role if we can't determine
    return 'user';
  };

  const signOut = async () => {
    try {
      setIsLoading(true);
      // Clear local storage first
      localStorage.removeItem(USER_CACHE_KEY);
      
      // Then sign out from supabase
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        throw error;
      }
      
      // Clear user manually
      setUser(null);
      
      // Redirect to home
      if (router.pathname !== '/') {
        router.push('/');
      }
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Failed to sign out');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider 
      value={{
        user,
        isLoading,
        signOut,
        checkUserRole,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
} 