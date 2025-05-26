import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth, UserRole } from '../lib/authContext';
import LoadingSpinner from './LoadingSpinner';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

export default function ProtectedRoute({ children, allowedRoles = ['user', 'manager', 'admin'] }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [timeoutReached, setTimeoutReached] = useState(false);
  const [bypassProtection, setBypassProtection] = useState(false);

  useEffect(() => {
    // Set a safety timeout to prevent infinite loading
    const safetyTimeout = setTimeout(() => {
      if (isLoading) {
        console.log('Protected route timeout reached, showing fallback UI');
        setTimeoutReached(true);
        
        // For dashboard routes, we'll allow rendering the children anyway
        // This helps admins and managers see the dashboard even with auth issues
        if (router.pathname === '/dashboard' || 
            router.pathname.includes('/team-management') || 
            router.pathname.includes('/admin')) {
          console.log('Bypassing protection for admin/manager route');
          setBypassProtection(true);
        }
      }
    }, 5000);

    // If authentication is done loading and there's no user, redirect to login
    if (!isLoading && !user) {
      router.replace('/');
    }
    
    // Restrict managers from accessing the daily update form
    if (!isLoading && user && user.role === 'manager' && router.pathname === '/daily-update-form') {
      console.log('Manager attempting to access daily update form, redirecting to dashboard');
      router.replace('/dashboard');
      return;
    }
    
    // If user exists but doesn't have required role, redirect to appropriate page
    if (!isLoading && user && !allowedRoles.includes(user.role)) {
      // Redirect based on role
      switch(user.role) {
        case 'admin':
          router.replace('/dashboard');
          break;
        case 'manager':
          router.replace('/dashboard');
          break;
        case 'user':
          router.replace('/user-dashboard');
          break;
        default:
          router.replace('/');
      }
    }

    return () => clearTimeout(safetyTimeout);
  }, [isLoading, user, router, allowedRoles]);

  // If we've been loading too long and it's not an admin/manager route, redirect to login
  if (timeoutReached && !bypassProtection) {
    console.log('Timeout reached on protected route, redirecting to login');
    router.replace('/');
    return <LoadingSpinner message="Redirecting to login..." />;
  }

  // If loading but we're bypassing protection for admin/manager routes, show the children
  if (isLoading && bypassProtection) {
    // If it's a dashboard route, allow rendering children anyway despite loading state
    console.log('Bypassing loading state for admin/manager route');
    return <>{children}</>;
  }

  // Still loading and not yet timed out, show spinner
  if (isLoading) {
    return <LoadingSpinner message="Checking permissions..." />;
  }

  // If not logged in or not authorized, and not bypassing, don't render children
  if ((!user || !allowedRoles.includes(user.role)) && !bypassProtection) {
    return <LoadingSpinner message="Redirecting..." />;
  }
  
  // User is authenticated and authorized (or we're bypassing)
  return <>{children}</>;
} 