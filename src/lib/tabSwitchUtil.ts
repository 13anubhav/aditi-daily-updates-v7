/**
 * Tab Switch Utility (Simplified Version)
 * 
 * This is a simplified version that only provides basic tab switching detection
 * without any caching functionality.
 */

// Set a key for tab state tracking
const TAB_ID_KEY = 'aditi_tab_id';

/**
 * Generates a unique tab ID if one doesn't exist already
 */
export const getTabId = (): string => {
  if (typeof window === 'undefined') return '';
  
  // Get existing tab ID or create a new one
  let tabId = sessionStorage.getItem(TAB_ID_KEY);
  if (!tabId) {
    tabId = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    sessionStorage.setItem(TAB_ID_KEY, tabId);
  }
  
  return tabId;
};

/**
 * Checks if the current view state is due to returning from a tab switch
 * This is a simplified version that always returns false to skip tab switch detection
 */
export const isReturningFromTabSwitch = (): boolean => {
  // Always return false since we don't want to cache data anymore
  return false;
};

/**
 * Checks if we should allow filter operations
 * This is a simplified version that always returns true
 */
export const shouldAllowFilterOperations = (): boolean => {
  // Always allow operations
  return true;
};

/**
 * Sets flags to prevent refresh on the next tab switch return
 * This is a simplified version that does nothing
 */
export const preventNextTabSwitchRefresh = (): void => {
  // No operation needed since we're not using caching
  return;
};

/**
 * Handles tab switch complete event
 * This implementation triggers a custom event for components to listen to
 */
export const handleTabSwitchComplete = (): void => {
  if (typeof window !== 'undefined') {
    // Dispatch a custom event that components can listen for
    window.dispatchEvent(new CustomEvent('tabSwitchComplete'));
    console.log('Tab switch complete event dispatched');
  }
}; 