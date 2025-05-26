/**
 * Form Persistence Store
 * 
 * This utility helps persist form data in browser storage to prevent data loss when:
 * - Switching between tabs
 * - Browser refreshes
 * - Network issues
 * 
 * It provides a unified API for storing and retrieving form data,
 * with automatic expiry of old data.
 */

// Set expiry for stored form data (24 hours)
const FORM_DATA_EXPIRY = 24 * 60 * 60 * 1000; 

// Create namespaced storage keys for different forms
export const createStorageKey = (formName: string, userId: string, subKey?: string): string => {
  const baseKey = `aditi_${formName}_${userId}`;
  return subKey ? `${baseKey}_${subKey}` : baseKey;
};

/**
 * Store form data in localStorage with expiry
 */
export const storeFormData = <T>(key: string, data: T): void => {
  try {
    const storageItem = {
      data,
      timestamp: Date.now(),
      expiry: Date.now() + FORM_DATA_EXPIRY
    };
    
    localStorage.setItem(key, JSON.stringify(storageItem));
  } catch (error) {
    console.error(`Failed to store form data for key: ${key}`, error);
  }
};

/**
 * Retrieve form data from localStorage, checking expiry
 */
export const retrieveFormData = <T>(key: string): T | null => {
  try {
    const storedItem = localStorage.getItem(key);
    
    if (!storedItem) return null;
    
    const parsedItem = JSON.parse(storedItem);
    
    // Check if data has expired
    if (parsedItem.expiry && parsedItem.expiry < Date.now()) {
      // Data expired, remove it
      localStorage.removeItem(key);
      return null;
    }
    
    return parsedItem.data as T;
  } catch (error) {
    console.error(`Failed to retrieve form data for key: ${key}`, error);
    return null;
  }
};

/**
 * Clear form data from localStorage
 */
export const clearFormData = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Failed to clear form data for key: ${key}`, error);
  }
};

/**
 * Update tab visibility state to prevent unwanted refreshes
 */
export const updateTabState = (formName: string): void => {
  try {
    const tabStateKey = `aditi_${formName}_tab_state`;
    localStorage.setItem(tabStateKey, Date.now().toString());
  } catch (error) {
    console.error('Error updating tab state:', error);
  }
};

/**
 * Check if visibility change should trigger a refresh
 */
export const shouldPreventRefresh = (formName: string): boolean => {
  try {
    const tabStateKey = `aditi_${formName}_tab_state`;
    const lastState = localStorage.getItem(tabStateKey);
    
    // If we have a saved state and this isn't an intentional navigation
    if (lastState && !sessionStorage.getItem('intentional_navigation')) {
      // Update the state to show we handled this visibility event
      localStorage.setItem(tabStateKey, Date.now().toString());
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking tab state:', error);
    return false;
  }
};

// Cleanup helper to remove expired form data
export const cleanupExpiredFormData = (): void => {
  try {
    const now = Date.now();
    
    // Look for all keys in localStorage that match our pattern
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      
      if (key && key.startsWith('aditi_')) {
        const item = localStorage.getItem(key);
        
        if (item) {
          try {
            const parsed = JSON.parse(item);
            
            // If the item has an expiry and it's in the past, remove it
            if (parsed.expiry && parsed.expiry < now) {
              localStorage.removeItem(key);
            }
          } catch {
            // Not a valid JSON item, skip it
          }
        }
      }
    }
  } catch (error) {
    console.error('Error during form data cleanup:', error);
  }
};

// Run cleanup periodically (once a day)
export const initializeFormPersistence = (): void => {
  // Clean up on initialization
  cleanupExpiredFormData();
  
  // Set up periodic cleanup 
  const oneDayInMs = 24 * 60 * 60 * 1000;
  setInterval(cleanupExpiredFormData, oneDayInMs);
  
  // Register visibility change handler at the application level
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      // We specifically DO NOT take any action when the tab becomes visible again
      // This prevents unwanted refreshes when users switch between tabs
      
      // We'll only clear the intentional navigation flag if it exists
      if (document.visibilityState === 'visible') {
        sessionStorage.removeItem('intentional_navigation');
      }
      
      // Deliberately not calling cleanupExpiredFormData() on visibility change
      // This prevents triggering operations that might cause UI refresh
    });
  }
}; 