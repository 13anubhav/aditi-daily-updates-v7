"use client";

import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { supabase, DailyUpdate, TeamMember } from '../lib/supabaseClient';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '../lib/authContext';
import ProtectedRoute from '../components/ProtectedRoute';
import EditUpdateModal from '../components/EditUpdateModal';
import { isReturningFromTabSwitch, handleTabSwitchComplete } from '../lib/tabSwitchUtil';

interface DashboardUser {
  userName: string;
  userEmail: string;
  teamName: string;
  isManager: boolean;
}

export default function Dashboard() {
  const router = useRouter();
  const { user, signOut, refreshUser } = useAuth();
  
  const [isLoading, setIsLoading] = useState(false);
  const [loadingFailed, setLoadingFailed] = useState(false);
  const [historicalData, setHistoricalData] = useState<DailyUpdate[]>([]);
  const [filteredData, setFilteredData] = useState<DailyUpdate[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'recent' | 'blockers' | 'completed' | 'in-progress' | 'blocked'>('all');
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [teams, setTeams] = useState<TeamMember[]>([]);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [stats, setStats] = useState({
    totalUpdates: 0,
    totalBlockers: 0,
    completedTasks: 0,
    inProgressTasks: 0,
    stuckTasks: 0
  });

  // Additional state for data loading and pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [loadingTimeout, setLoadingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [sessionRecoveryAttempted, setSessionRecoveryAttempted] = useState(false);
  const [recoveryInProgress, setRecoveryInProgress] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState<DailyUpdate | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Add data loading effect that calls fetchData directly
  useEffect(() => {
    if (user && !isLoading) {
      // Always fetch fresh data when component mounts or user changes
      fetchData(selectedTeam);
    }
  }, [user]);

  // Add effect to fetch data when filters change
  useEffect(() => {
    if (user && !isLoading && dataLoaded) {
      // Apply filters to the current data
      applyFilters();
    }
  }, [dateRange, selectedTeam, activeTab]);

  useEffect(() => {
    // Safety timeout to prevent infinite loading
    const safetyTimeout = setTimeout(() => {
      if (isLoading) {
        console.log('Dashboard safety timeout reached');
        setIsLoading(false);
        setLoadingFailed(true);
        
        // Try to recover data from localStorage even if loading failed
        tryRecoverFromLocalStorage();
      }
    }, 10000);
    
    if (user) {
      // Only fetch teams data if we don't already have it
      if (!dataLoaded || teams.length === 0) {
        fetchTeamsBasedOnRole();
      }
    } else if (!isLoading && !recoveryInProgress) {
      // If no user and not loading, attempt recovery once
      if (!sessionRecoveryAttempted) {
        console.log('No user detected, attempting session recovery');
        setSessionRecoveryAttempted(true);
        setRecoveryInProgress(true);
        
        // Try to refresh the user session
        refreshUser().then(() => {
          console.log('User session refreshed');
          setRecoveryInProgress(false);
        }).catch(error => {
          console.error('Failed to refresh user session:', error);
          setRecoveryInProgress(false);
          // Try to recover data from localStorage
          tryRecoverFromLocalStorage();
        });
      }
    }
    
    return () => clearTimeout(safetyTimeout);
  }, [user, dataLoaded, teams.length, sessionRecoveryAttempted, recoveryInProgress]);

  // Add function to try recovering data from localStorage without authentication
  const tryRecoverFromLocalStorage = () => {
    console.log('Attempting to recover data from localStorage');
    
    try {
      // Get cached email from localStorage
      let userEmail = null;
      
      // Try to get the user email from various sources
      const cachedUser = localStorage.getItem('aditi_user_cache');
      if (cachedUser) {
        try {
          const parsedUser = JSON.parse(cachedUser);
          userEmail = parsedUser.email;
        } catch (e) {
          console.error('Error parsing cached user:', e);
        }
      }
      
      if (!userEmail) {
        // Look for dashboard keys to determine the email
        const keys = Object.keys(localStorage);
        const dashboardKey = keys.find(key => key.startsWith('dashboard_') && key.includes('@'));
        if (dashboardKey) {
          userEmail = dashboardKey.split('dashboard_')[1].split('_')[0];
        }
      }
      
      if (userEmail) {
        console.log('Recovered user email:', userEmail);
        
        // Check for chunked data first
        const chunkCountStr = localStorage.getItem(`dashboard_historicalData_chunkCount_${userEmail}`);
        
        if (chunkCountStr) {
          // We have chunked data, load all chunks and combine them
          const chunkCount = parseInt(chunkCountStr);
          let combinedData: DailyUpdate[] = [];
          
          // Load each chunk
          for (let i = 0; i < chunkCount; i++) {
            const chunkData = localStorage.getItem(`dashboard_historicalData_chunk_${i}_${userEmail}`);
            if (chunkData) {
              const parsedChunk = JSON.parse(chunkData) as DailyUpdate[];
              combinedData = [...combinedData, ...parsedChunk];
            }
          }
          
          // Use the combined data if we have any
          if (combinedData.length > 0) {
            console.log('Recovered data from localStorage chunks:', combinedData.length);
            setHistoricalData(combinedData);
            setFilteredData(combinedData);
            calculateStats(combinedData);
            setDataLoaded(true);
            setLoadingFailed(false);
            return true;
          }
        }
        
        // Try the old approach as fallback
        const oldDataStr = localStorage.getItem(`dashboard_historicalData_${userEmail}`);
        if (oldDataStr) {
          try {
            const parsedData = JSON.parse(oldDataStr);
            console.log('Recovered data from localStorage (old format):', parsedData.length);
            setHistoricalData(parsedData);
            setFilteredData(parsedData);
            calculateStats(parsedData);
            setDataLoaded(true);
            setLoadingFailed(false);
            return true;
          } catch (e) {
            console.error('Error parsing old format data:', e);
          }
        }
        
        // If we get here, recovery failed
        console.log('Data recovery failed - no valid data found');
        return false;
      } else {
        console.log('Could not determine user email for recovery');
        return false;
      }
    } catch (error) {
      console.error('Error during data recovery:', error);
      return false;
    }
  };

  // Add a new effect to handle visibility changes (tab switching)
  useEffect(() => {
    // Track the last visibility change timestamp
    let lastVisibilityChange = Date.now();
    
    // Function to handle visibility change
    const handleVisibilityChange = () => {
      // Set a class on the body to indicate recent tab visibility change
      if (document.visibilityState === 'visible') {
        console.log('Tab became visible, preventing unnecessary refreshes');
        
        // Store the timestamp when we came back to the tab
        const now = Date.now();
        const timeSinceLastChange = now - lastVisibilityChange;
        lastVisibilityChange = now;
        
        // If we switched tabs recently (within last 10 seconds),
        // prevent refresh by setting a flag
        if (timeSinceLastChange < 10000) {
          console.log('Recent tab switch detected, preventing refresh');
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('returning_from_tab_switch', 'true');
            
            // Clear the flag after 3 seconds to allow future refreshes
            setTimeout(() => {
              sessionStorage.removeItem('returning_from_tab_switch');
            }, 3000);
          }
        }
        
        // Check if the global prevention mechanism is active
        const preventRefresh = typeof sessionStorage !== 'undefined' && 
          (sessionStorage.getItem('returning_from_tab_switch') || 
           sessionStorage.getItem('prevent_auto_refresh'));
        
        if (preventRefresh) {
          console.log('Global tab switch prevention active');
          return; // Defer to the global handler in _app.tsx
        }
        
        // Set a flag directly on the document
        document.body.classList.add('dashboard-tab-active');
        
        // Remove the class after a while
        setTimeout(() => {
          document.body.classList.remove('dashboard-tab-active');
        }, 2000);
      } else if (document.visibilityState === 'hidden') {
        // Track when we leave the tab
        lastVisibilityChange = Date.now();
      }
    };
    
    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Clean up the event listener
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Also save teams data to localStorage
  useEffect(() => {
    if (user?.email && teams.length > 0) {
      try {
        localStorage.setItem(`dashboard_teams_${user.email}`, JSON.stringify(teams));
      } catch (error) {
        console.error('Error saving teams data to localStorage:', error);
      }
    }
  }, [teams, user]);

  const fetchTeamsBasedOnRole = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      console.log('Fetching teams based on role:', user.role);
      
      // Admin can see all teams
      if (user.role === 'admin') {
        const { data, error } = await supabase
          .from('aditi_teams')
          .select('*')
          .order('team_name', { ascending: true });
          
        if (error) throw error;
        console.log('Admin teams loaded:', data?.length || 0);
        setTeams(data || []);
        await fetchData(''); // Begin data fetch immediately after teams are loaded
      } 
      // Manager can only see their teams
      else if (user.role === 'manager') {
        const { data, error } = await supabase
          .from('aditi_teams')
          .select('*')
          .eq('manager_email', user.email)
          .order('team_name', { ascending: true });
          
        if (error) throw error;
        console.log('Manager teams loaded:', data?.length || 0);
        setTeams(data || []);
        
        // If manager has exactly one team, auto-select it
        if (data && data.length === 1) {
          setSelectedTeam(data[0].id);
          await fetchData(data[0].id); // Begin data fetch with the selected team
        } else {
          await fetchData(''); // Fetch all teams' data if multiple teams
        }
      }
      // Regular users shouldn't reach this dashboard, but just in case
      else {
        // If it's a regular user who somehow accessed this page, 
        // redirect them to the user dashboard
        router.replace('/user-dashboard');
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
      toast.error('Failed to load teams');
      setIsLoading(false);
      setLoadingFailed(true);
    }
  };

  useEffect(() => {
    applyFilters();
  }, [activeTab, selectedTeam, dateRange, historicalData]);

  // Add better debugging to fetchData
  const fetchData = async (teamFilter: string = '') => {
    if (!user) return;
    
    setIsLoading(true);
    setLoadingFailed(false);
    
    try {
      // Fetch teams first
      await fetchTeamsBasedOnRole();
      
      // Set up timeouts for better UX
      if (loadingTimeout) clearTimeout(loadingTimeout);
      
      const newTimeout = setTimeout(() => {
        setLoadingFailed(true);
        setIsLoading(false);
        toast.error('Data fetch timed out. Please try again.');
      }, 20000); // 20 second timeout
      
      setLoadingTimeout(newTimeout);
      
      console.log('Fetching updates with team filter:', teamFilter);
      
      // Create the base query
      let query = supabase
        .from('aditi_daily_updates')
        .select(`
          *,
          aditi_teams (
            id,
            team_name
          )
        `)
        .gte('created_at', `${dateRange.start}T00:00:00Z`)
        .lte('created_at', `${dateRange.end}T23:59:59Z`);
      
      // Add team filter if specified
      if (teamFilter) {
        query = query.eq('team_id', teamFilter);
      }
      
      // Add role-based filters
      if (user.role === 'user') {
        // Regular users can only see their own updates
        query = query.eq('employee_email', user.email);
      } else if (user.role === 'manager') {
        // Managers can see updates for their teams
        // Teams are already filtered in fetchTeamsBasedOnRole
      }
      
      // Execute the query
      const { data, error } = await query;
      
      if (error) {
        throw error;
      }
      
      // Process the data
      if (data) {
        console.log(`Fetched ${data.length} updates`);
        
        // Clean up data
        const cleanedData = data.map(item => ({
          ...item,
          team_name: item.aditi_teams?.team_name || 'Unknown Team'
        }));
        
        // Update state
        setHistoricalData(cleanedData);
        applyFiltersToData(cleanedData);
        setLastRefreshed(new Date());
        setDataLoaded(true);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load data. Please try again.');
      setLoadingFailed(true);
    } finally {
      setIsLoading(false);
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
        setLoadingTimeout(null);
      }
    }
  };

  // Helper function to apply filters to a given data array
  const applyFiltersToData = (data: DailyUpdate[]) => {
    console.log('Applying filters to data array of length:', data.length);
    
    if (!data.length) {
      return [];
    }
    
    let filtered = [...data];

    // Apply date range filter
    filtered = filtered.filter(update => {
      const updateDate = new Date(update.created_at).toISOString().split('T')[0];
      return updateDate >= dateRange.start && updateDate <= dateRange.end;
    });

    // Apply team filter
    if (selectedTeam) {
      filtered = filtered.filter(update => update.team_id === selectedTeam);
    }

    // Apply tab filter
    switch (activeTab) {
      case 'recent':
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        filtered = filtered.filter(update => 
          new Date(update.created_at) >= sevenDaysAgo
        );
        break;
      case 'blockers':
        filtered = filtered.filter(update => update.blocker_type);
        break;
      case 'completed':
        filtered = filtered.filter(update => update.status === 'completed');
        break;
      case 'in-progress':
        filtered = filtered.filter(update => update.status === 'in-progress');
        break;
      case 'blocked':
        filtered = filtered.filter(update => update.status === 'blocked');
        break;
    }

    console.log('Filtered data count:', filtered.length);
    return filtered;
  };

  const calculateStats = (data: DailyUpdate[]) => {
    const stats = {
      totalUpdates: data.length,
      totalBlockers: data.filter(update => update.blocker_type).length,
      completedTasks: data.filter(update => update.status === 'completed').length,
      inProgressTasks: data.filter(update => update.status === 'in-progress').length,
      stuckTasks: data.filter(update => update.status === 'blocked').length
    };
    setStats(stats);
  };

  const applyFilters = () => {
    forceApplyFilters();
  };

  // Add function to filter data by card type
  const filterByCardType = (filterType: string) => {
    // First clear any team filter if it exists
    if (selectedTeam) {
      setSelectedTeam('');
    }
    
    // Set the active tab based on the card clicked
    switch (filterType) {
      case 'total':
        setActiveTab('all');
        break;
      case 'completed':
        setActiveTab('completed');
        break;
      case 'in-progress':
        setActiveTab('in-progress');
        break;
      case 'blocked':
        setActiveTab('blocked');
        break;
      default:
        setActiveTab('all');
    }
    
    // Apply the filters immediately
    setTimeout(() => {
      applyFilters();
    }, 100);
    
    // Provide visual feedback
    toast.success(`Filtered by ${filterType === 'total' ? 'all updates' : filterType} status`);
  };

  useEffect(() => {
    if (user) {
      fetchData(selectedTeam);
    }
  }, [selectedTeam, user]);

  const toggleRowExpansion = (id: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const exportToCSV = () => {
    const headers = [
      'Date',
      'Start Date',
      'End Date',
      'Story Points',
      'Team',
      'Employee',
      'Tasks Completed',
      'Status',
      'Priority',
      'Additional Notes'
    ];

    const csvContent = [
      headers.join(','),
      ...filteredData.map(update => [
        new Date(update.created_at).toLocaleDateString(),
        update.start_date ? new Date(update.start_date).toLocaleDateString() : '',
        update.end_date ? new Date(update.end_date).toLocaleDateString() : '',
        update.story_points !== null ? update.story_points : '',
        update.aditi_teams?.team_name || team_name_from_teams(update) || '',
        update.employee_email,
        update.tasks_completed,
        update.status,
        update.priority,
        update.additional_notes || ''
      ].join(','))
    ].join('\n');

    // Helper function to get team name from teams array if aditi_teams is not present
    function team_name_from_teams(update: DailyUpdate) {
      if (update.team_id) {
        const team = teams.find(t => t.id === update.team_id);
        return team?.team_name || '';
      }
      return '';
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `daily-updates-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Add function to handle successful edit
  const handleEditSuccess = () => {
    // Clear all caches when an edit occurs to ensure data consistency
    clearCacheAndRefresh();
  };

  // Enhanced cache clearing function that handles edits properly
  const clearCacheAndRefresh = () => {
    // No localStorage operations needed anymore
    
    // Reset data states
    setHistoricalData([]);
    setFilteredData([]);
    setDataLoaded(false);
    
    // Fetch fresh data
    fetchData(selectedTeam);
    
    toast.success('Data refreshed');
  };

  // Modified refresh data function to be more explicit about cache clearing
  const refreshData = async () => {
    setIsRefreshing(true);
    
    try {
      await fetchData(selectedTeam);
      toast.success('Data refreshed successfully');
    } catch (error) {
      console.error('Error refreshing data:', error);
      toast.error('Failed to refresh data');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Modify the Clear Cache button click handler
  const clearCache = () => {
    // No localStorage operations needed anymore
    
    // Reset data states
    setHistoricalData([]);
    setFilteredData([]);
    setDataLoaded(false);
    
    // Fetch fresh data
    fetchData(selectedTeam);
    
    toast.success('Fetching fresh data...');
  };

  // Add a periodic refresh mechanism
  useEffect(() => {
    // If we have data loaded, set up a periodic refresh
    if (dataLoaded && user) {
      const refreshInterval = 5 * 60 * 1000; // 5 minutes
      let lastRefreshTime = Date.now();
      
      const intervalId = setInterval(() => {
        // Check if the tab is active before refreshing
        if (document.visibilityState === 'visible') {
          // Check if we've recently returned from a tab switch
          if (isReturningFromTabSwitch()) {
            console.log('Skipping refresh due to recent tab switch');
            return;
          }
          
          // Only refresh if enough time has passed
          const timeSinceLastRefresh = Date.now() - lastRefreshTime;
          if (timeSinceLastRefresh >= refreshInterval) {
            console.log('Running periodic silent data refresh');
            fetchDataSilently(selectedTeam);
            lastRefreshTime = Date.now();
          }
        }
      }, 30000); // Check every 30 seconds instead of waiting full 5 minutes
      
      return () => clearInterval(intervalId);
    }
  }, [dataLoaded, user, selectedTeam]);

  // Add a silent data fetching function (no loading state, for background refresh)
  const fetchDataSilently = async (teamFilter: string = '') => {
    try {
      console.log('Silent fetch triggered');
      
      let query = supabase
        .from('aditi_daily_updates')
        .select(`
          *,
          aditi_teams (
            id,
            team_name
          )
        `)
        .gte('created_at', `${dateRange.start}T00:00:00Z`)
        .lte('created_at', `${dateRange.end}T23:59:59Z`);
      
      if (teamFilter) {
        query = query.eq('team_id', teamFilter);
      }
      
      if (user?.role === 'user') {
        query = query.eq('employee_email', user.email);
      }
      
      const { data, error } = await query;
      
      if (error) {
        throw error;
      }
      
      if (data) {
        console.log(`Silent fetch: Got ${data.length} updates`);
        
        const cleanedData = data.map(item => ({
          ...item,
          team_name: item.aditi_teams?.team_name || 'Unknown Team'
        }));
        
        setHistoricalData(cleanedData);
        applyFiltersToData(cleanedData);
        setLastRefreshed(new Date());
        
        // No more localStorage caching
        // if (user?.email) {
        //   storeHistoricalDataInChunks(user.email, cleanedData);
        // }
      }
    } catch (error) {
      console.error('Silent fetch error:', error);
    }
  };

  // Add a function to handle edit button click
  const handleEditClick = (e: React.MouseEvent, update: DailyUpdate) => {
    e.stopPropagation(); // Prevent row expansion when clicking edit
    setEditingUpdate(update);
    setShowEditModal(true);
  };

  // Update the existing effect for tab switch completion
  useEffect(() => {
    const onTabSwitchComplete = () => {
      console.log('Tab switch complete event received, applying filters');
      // Apply filters with a small delay to ensure all state is loaded
      setTimeout(() => {
        applyFilters();
      }, 100);
    };
    
    // Listen for the tab switch complete event
    window.addEventListener('tabSwitchComplete', onTabSwitchComplete);
    
    // Remove event listener on cleanup
    return () => {
      window.removeEventListener('tabSwitchComplete', onTabSwitchComplete);
    };
  }, [historicalData, selectedTeam, dateRange, activeTab]);

  // Add effect to handle filter changes - this will work even during tab switches
  useEffect(() => {
    console.log('Filter dependencies changed, applying filters');
    applyFilters();
  }, [activeTab, selectedTeam, dateRange, historicalData]);

  // Add a more robust filter application that works regardless of tab switch state
  const forceApplyFilters = () => {
    console.log('Force applying filters to historical data:', historicalData.length);
    console.log('Current filters - dateRange:', dateRange, 'selectedTeam:', selectedTeam, 'activeTab:', activeTab);
    
    if (!historicalData.length) {
      console.log('No historical data to filter');
      setFilteredData([]);
      calculateStats([]);
      return;
    }
    
    let filtered = [...historicalData];

    // Apply date range filter
    filtered = filtered.filter(update => {
      const updateDate = new Date(update.created_at).toISOString().split('T')[0];
      return updateDate >= dateRange.start && updateDate <= dateRange.end;
    });

    // Apply team filter
    if (selectedTeam) {
      filtered = filtered.filter(update => update.team_id === selectedTeam);
    }

    // Apply tab filter
    switch (activeTab) {
      case 'recent':
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        filtered = filtered.filter(update => 
          new Date(update.created_at) >= sevenDaysAgo
        );
        break;
      case 'blockers':
        filtered = filtered.filter(update => update.blocker_type);
        break;
      case 'completed':
        filtered = filtered.filter(update => update.status === 'completed');
        break;
      case 'in-progress':
        filtered = filtered.filter(update => update.status === 'in-progress');
        break;
      case 'blocked':
        filtered = filtered.filter(update => update.status === 'blocked');
        break;
    }

    console.log('Filtered data count after applying filters:', filtered.length);
    setFilteredData(filtered);
    calculateStats(filtered);
  };

  return (
    <ProtectedRoute allowedRoles={['admin', 'manager']}>
      <Head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Dashboard | Aditi Daily Updates</title>
        <meta name="description" content="Manager dashboard for Aditi daily updates tracking" />
        <style>{`
          .hover-shadow-custom-purple:hover {
            box-shadow: 0 0 15px rgba(139, 92, 246, 0.5);
          }
        `}</style>
      </Head>
      
      <div className="min-h-screen bg-gray-100">
        <div className="fixed top-4 right-4 z-10">
          <button 
            onClick={() => signOut()}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-300 shadow-md hover:shadow-lg flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
        
        <div className="bg-indigo-900 text-white">
          <div className="max-w-7xl mx-auto py-3 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <div className="flex-1 flex items-center">
                <span className="flex p-2 rounded-lg bg-indigo-800">
                  <svg className="h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </span>
                <p className="ml-3 font-medium truncate">
                  <span className="md:hidden">
                    {user?.role === 'admin' ? 'Admin Dashboard' : 'Manager Dashboard'}
                  </span>
                  <span className="hidden md:inline">
                    {user?.role === 'admin' 
                      ? 'Admin Dashboard - Full Access' 
                      : `Manager Dashboard - ${user?.name} (${user?.email})`}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="min-h-screen bg-[#1a1f2e] text-white flex flex-col">
          <nav className="bg-[#1e2538] shadow-md">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex items-center">
                  <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
                    Aditi Manager Dashboard
                  </h1>
                  {dataLoaded && !isLoading && (
                    <span className="ml-3 text-xs text-gray-400 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      State preserved
                    </span>
                  )}
                </div>
                <div className="flex items-center">
                  <span className="mr-4 text-sm text-gray-300">
                    {user ? `Welcome, ${user.name}` : 'Loading...'}
                  </span>
                  <button
                    onClick={() => router.push('/team-management')}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm transition-colors duration-300"
                  >
                    Team Management
                  </button>
                </div>
              </div>
            </div>
          </nav>
          
          <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {isLoading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
              </div>
            ) : loadingFailed ? (
              <div className="bg-[#1e2538] rounded-lg shadow-lg p-6 text-center">
                <h2 className="text-xl font-semibold text-red-400 mb-4">There was an issue loading the dashboard</h2>
                <p className="mb-4">We encountered an error while loading your data. Please try again.</p>
                <div className="flex justify-center space-x-4">
                  <button 
                    onClick={() => {
                      setLoadingFailed(false);
                      fetchTeamsBasedOnRole();
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                  >
                    Retry
                  </button>
                  <button 
                    onClick={clearCache}
                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                  >
                    Clear Cache
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                  <div 
                    className="bg-[#262d40] p-4 rounded-lg shadow-lg hover-shadow-custom-purple transition-shadow duration-300 cursor-pointer hover:bg-[#2a3349] relative group"
                    onClick={() => filterByCardType('total')}
                    title="Click to view all updates"
                  >
                    <div className="absolute top-2 right-2 text-gray-500 group-hover:text-gray-300">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </div>
                    <h3 className="text-gray-400 text-sm">Total Updates</h3>
                    <p className="text-2xl font-bold text-white">{stats.totalUpdates}</p>
                  </div>
                   
                  <div 
                    className="bg-[#262d40] p-4 rounded-lg shadow-lg hover-shadow-custom-purple transition-shadow duration-300 cursor-pointer hover:bg-[#2a3349] relative group"
                    onClick={() => filterByCardType('completed')}
                    title="Click to view completed tasks"
                  >
                    <div className="absolute top-2 right-2 text-gray-500 group-hover:text-gray-300">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                  </div>
                    <h3 className="text-gray-400 text-sm">Completed Tasks</h3>
                    <p className="text-2xl font-bold text-green-400">{stats.completedTasks}</p>
                  </div>
                  <div 
                    className="bg-[#262d40] p-4 rounded-lg shadow-lg hover-shadow-custom-purple transition-shadow duration-300 cursor-pointer hover:bg-[#2a3349] relative group"
                    onClick={() => filterByCardType('in-progress')}
                    title="Click to view in-progress tasks"
                  >
                    <div className="absolute top-2 right-2 text-gray-500 group-hover:text-gray-300">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </div>
                    <h3 className="text-gray-400 text-sm">In Progress</h3>
                    <p className="text-2xl font-bold text-blue-400">{stats.inProgressTasks}</p>
                  </div>
                  <div 
                    className="bg-[#262d40] p-4 rounded-lg shadow-lg hover-shadow-custom-purple transition-shadow duration-300 cursor-pointer hover:bg-[#2a3349] relative group"
                    onClick={() => filterByCardType('blocked')}
                    title="Click to view blocked tasks"
                  >
                    <div className="absolute top-2 right-2 text-gray-500 group-hover:text-gray-300">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </div>
                    <h3 className="text-gray-400 text-sm">Stuck (Blockers)</h3>
                    <p className="text-2xl font-bold text-red-400">{stats.stuckTasks}</p>
                  </div>
                </div>
                
                <div className="bg-[#1e2538] rounded-lg shadow-lg p-4 mb-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4 md:mb-0">
                      <div>
                        <label htmlFor="team-filter" className="block text-sm text-gray-400 mb-1">Team</label>
                        <select
                          id="team-filter"
                          value={selectedTeam}
                          onChange={(e) => setSelectedTeam(e.target.value)}
                          className="bg-[#262d40] border border-gray-600 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="">All Teams</option>
                          {teams.map((team, index) => (
                            <option key={index} value={team.id}>{team.team_name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="date-start" className="block text-sm text-gray-400 mb-1">Start Date</label>
                        <input
                          type="date"
                          id="date-start"
                          value={dateRange.start}
                          onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                          className="bg-[#262d40] border border-gray-600 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <div>
                        <label htmlFor="date-end" className="block text-sm text-gray-400 mb-1">End Date</label>
                        <input
                          type="date"
                          id="date-end"
                          value={dateRange.end}
                          onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                          className="bg-[#262d40] border border-gray-600 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        onClick={refreshData}
                        disabled={isRefreshing}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-300 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isRefreshing ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Refreshing...
                          </>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Refresh Data
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          console.log('Manual filter refresh triggered');
                          console.log('Current state - Historical:', historicalData.length, 'Filtered:', filteredData.length);
                          console.log('Active filters:', { activeTab, selectedTeam, dateRange });
                          forceApplyFilters();
                          toast.success('Filters refreshed');
                        }}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-300"
                      >
                        Refresh Filters
                      </button>
                      <button
                        onClick={exportToCSV}
                        disabled={!filteredData.length || isRefreshing}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Export CSV
                      </button>
                      <button
                        onClick={clearCache}
                        className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-300"
                      >  
                        Clear Cache
                      </button>
                    </div>
                  </div>
                  {lastRefreshed && (
                    <div className="mt-3 text-xs text-gray-400 text-right">
                      Last updated: {lastRefreshed.toLocaleString()} 
                      {dataLoaded && !isLoading && (
                        <span className="ml-2 text-green-400">• Data preserved across tabs</span>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="mb-6">
                  <div className="border-b border-gray-700">
                    <nav className="flex flex-wrap -mb-px">
                      <button
                        onClick={() => setActiveTab('all')}
                        className={`py-2 px-4 border-b-2 font-medium text-sm transition-colors duration-300 ${
                          activeTab === 'all'
                            ? 'border-purple-500 text-purple-400'
                            : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-400'
                        }`}
                      >
                        All Updates
                      </button>
                      <button
                        onClick={() => setActiveTab('recent')}
                        className={`py-2 px-4 border-b-2 font-medium text-sm transition-colors duration-300 ${
                          activeTab === 'recent'
                            ? 'border-purple-500 text-purple-400'
                            : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-400'
                        }`}
                      >
                        Recent (5 Days)
                      </button>
                      <button
                        onClick={() => setActiveTab('blockers')}
                        className={`py-2 px-4 border-b-2 font-medium text-sm transition-colors duration-300 ${
                          activeTab === 'blockers'
                            ? 'border-purple-500 text-purple-400'
                            : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-400'
                        }`}
                      >
                        Blockers Only
                      </button>
                      <button
                        onClick={() => setActiveTab('completed')}
                        className={`py-2 px-4 border-b-2 font-medium text-sm transition-colors duration-300 ${
                          activeTab === 'completed'
                            ? 'border-purple-500 text-purple-400'
                            : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-400'
                        }`}
                      >
                        Completed
                      </button>
                      <button
                        onClick={() => setActiveTab('in-progress')}
                        className={`py-2 px-4 border-b-2 font-medium text-sm transition-colors duration-300 ${
                          activeTab === 'in-progress'
                            ? 'border-purple-500 text-purple-400'
                            : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-400'
                        }`}
                      >
                        In Progress
                      </button>
                      <button
                        onClick={() => setActiveTab('blocked')}
                        className={`py-2 px-4 border-b-2 font-medium text-sm transition-colors duration-300 ${
                          activeTab === 'blocked'
                            ? 'border-purple-500 text-purple-400'
                            : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-400'
                        }`}
                      >
                        Blocked
                      </button>
                    </nav>
                  </div>
                </div>
                
                {filteredData.length > 0 ? (
                  <div className="bg-[#1e2538] rounded-lg shadow-lg overflow-hidden">
                    <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch', maxWidth: '100%' }}>
                      <div className="inline-block align-middle" style={{ maxWidth: '100%' }}>
                        <div className="overflow-hidden">
                          <table className="w-full divide-y divide-gray-700 table-fixed">
                            <thead className="bg-[#262d40]">
                              <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-[90px]">
                                  Created
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-[120px]">
                                  Team
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-[150px]">
                                  Employee
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-[250px]">
                                  Tasks
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-[60px]">
                                  Points
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-[80px]">
                                  Priority
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-[100px]">
                                  Status
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-[100px]">
                                  Start Date
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-[100px]">
                                  End Date
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-[120px]">
                                  Additional Notes
                                </th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-[60px]">
                                  Actions
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                              {filteredData.map((item, index) => {
                                const rowId = `row-${index}`;
                                const isExpanded = expandedRows[rowId] || false;
                                const team = teams.find(t => t.id === item.team_id);

                                return (
                                  <React.Fragment key={rowId}>
                                    <tr 
                                      className="hover:bg-[#2a3347] transition-colors duration-200 cursor-pointer"
                                      onClick={() => toggleRowExpansion(rowId)}
                                    >
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                        {new Date(item.created_at).toLocaleDateString()}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                        {team?.team_name || '-'}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="text-sm text-gray-300 block max-w-[140px] truncate" title={item.employee_name}>
                                          {item.employee_name}
                                        </span>
                                      </td>
                                      <td className="px-6 py-4 text-sm">
                                        <span className="text-gray-300 block max-w-[230px] truncate" title={item.tasks_completed}>
                                          {item.tasks_completed}
                                        </span>
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                        {item.story_points !== null ? (
                                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-indigo-900 text-indigo-200">
                                            {item.story_points}
                                          </span>
                                        ) : (
                                          '-'
                                        )}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                          item.priority === 'High' ? 'bg-red-500/20 text-red-400' :
                                          item.priority === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                          'bg-green-500/20 text-green-400'
                                        }`}>
                                          {item.priority}
                                        </span>
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                          item.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                          item.status === 'in-progress' ? 'bg-blue-500/20 text-blue-400' :
                                          'bg-red-500/20 text-red-400'
                                        }`}>
                                          {item.status}
                                        </span>
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                        {item.start_date ? new Date(item.start_date).toLocaleDateString() : '-'}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                        {item.end_date ? new Date(item.end_date).toLocaleDateString() : '-'}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                        {item.additional_notes ? (
                                          <span className="block max-w-[100px] truncate" title={item.additional_notes}>
                                            {item.additional_notes}
                                          </span>
                                        ) : '-'}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                        <button
                                          onClick={(e) => handleEditClick(e, item)}
                                          className="text-blue-400 hover:text-blue-300 transition-colors duration-150 focus:outline-none"
                                        >

                                            {/* Uncomment this to get the Edit Function */}
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                          </svg>
                                          {/* Uncomment this to get the Edit Function */}


                                        </button>
                                      </td>
                                    </tr>
                                    {isExpanded && (
                                      <tr>
                                        <td colSpan={11} className="px-6 py-4 bg-[#1e2538]">
                                          <div className="w-full">
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                              {/* Left Column - Current Tasks */}
                                              <div>
                                                <h4 className="text-sm font-medium text-gray-300 mb-3">Current Tasks</h4>
                                                <div className="bg-[#262d40] p-4 rounded-md">
                                                  <p className="text-sm text-white whitespace-pre-wrap break-words leading-relaxed">{item.tasks_completed}</p>
                                              </div>
                                              
                                                {item.additional_notes && (
                                                  <div className="mt-4">
                                                    <h4 className="text-sm font-medium text-gray-300 mb-3">Additional Notes</h4>
                                                    <div className="bg-[#262d40] p-4 rounded-md">
                                                      <p className="text-sm text-white whitespace-pre-wrap break-words leading-relaxed">{item.additional_notes}</p>
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                              
                                              {/* Right Column - Task Details */}
                                              <div>
                                                <h4 className="text-sm font-medium text-gray-300 mb-3">Task Details</h4>
                                                <div className="bg-[#262d40] p-4 rounded-md">
                                                  <div className="grid grid-cols-[120px_1fr] md:grid-cols-[150px_1fr] gap-y-4">
                                                    <div className="text-sm text-gray-400">Start Date:</div>
                                                    <div className="text-sm text-white font-medium">
                                                      {item.start_date ? new Date(item.start_date).toLocaleDateString() : '-'}
                                                    </div>
                                                    
                                                    <div className="text-sm text-gray-400">End Date:</div>
                                                    <div className="text-sm text-white font-medium">
                                                      {item.end_date ? new Date(item.end_date).toLocaleDateString() : '-'}
                                                    </div>
                                                    
                                                    <div className="text-sm text-gray-400">Story Points:</div>
                                                    <div className="text-sm text-white font-medium">
                                                      {item.story_points !== null ? item.story_points : 'Not specified'}
                                                    </div>
                                                    
                                                    <div className="text-sm text-gray-400">Status:</div>
                                                    <div className={`text-sm font-medium ${
                                                      item.status === 'completed' ? 'text-green-400' :
                                                      item.status === 'in-progress' ? 'text-blue-400' :
                                                      'text-red-400'
                                                    }`}>
                                                      {item.status}
                                                    </div>
                                                    
                                                    <div className="text-sm text-gray-400">Priority:</div>
                                                    <div className="text-sm font-medium">
                                                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                        item.priority === 'High' ? 'bg-red-500/20 text-red-400' :
                                                        item.priority === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                                        'bg-green-500/20 text-green-400'
                                                      }`}>
                                                        {item.priority || 'Medium'}
                                                    </span>
                                                    </div>
                                                    
                                                    <div className="text-sm text-gray-400">Actions:</div>
                                                    <div>
                                                      <button
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          handleEditClick(e, item);
                                                        }}
                                                        className="inline-flex items-center text-blue-400 hover:text-blue-300 text-sm transition-colors duration-150 focus:outline-none bg-[#1e2538] px-3 py-1.5 rounded"
                                                      >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                        </svg>
                                                        Edit Task
                                                      </button>
                                                    </div>
                                                </div>
                                              </div>
                                              
                                              {item.blocker_type && (
                                                  <div className="mt-4">
                                                    <h4 className="text-sm font-medium text-gray-300 mb-3">Blockers / Risks / Dependencies</h4>
                                                    <div className="bg-[#262d40] p-4 rounded-md">
                                                      <div className="flex items-center space-x-2 mb-3">
                                                        <span className={`inline-block px-2.5 py-1 text-xs rounded-full ${
                                                          item.blocker_type === 'Risks' ? 'bg-yellow-500/20 text-yellow-400' :
                                                          item.blocker_type === 'Blockers' ? 'bg-red-500/20 text-red-400' :
                                                          'bg-blue-500/20 text-blue-400'
                                                        }`}>
                                                          {item.blocker_type}
                                                        </span>
                                                        <span className="text-sm text-gray-400">
                                                          Resolution Date: {item.expected_resolution_date ? new Date(item.expected_resolution_date).toLocaleDateString() : 'Not set'}
                                                        </span>
                                                      </div>
                                                      <p className="text-sm text-white whitespace-pre-wrap break-words leading-relaxed">{item.blocker_description}</p>
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                              </div>
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#1e2538] rounded-lg shadow-lg p-8 text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 14h.01M12 17h.01M12 20a8 8 0 100-16 8 8 0 000 16z" />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-300 mb-1">No data found</h3>
                    <p className="text-gray-400">
                      {activeTab === 'blockers' 
                        ? 'No blockers reported for the selected filters.' 
                        : 'No updates available for the selected filters.'}
                    </p>
                  </div>
                )}
                
                {filteredData.length > 0 && totalPages > 1 && (
                  <div className="flex justify-between items-center mt-6 bg-[#1e2538] rounded-lg p-3">
                    <div className="text-sm text-gray-400">
                      Showing {filteredData.length} of {historicalData.length} entries
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 bg-[#262d40] text-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#2a3347] transition-colors duration-200"
                      >
                        Previous
                      </button>
                      <div className="flex items-center space-x-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum: number;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          
                          return (
                            <button
                              key={i}
                              onClick={() => setCurrentPage(pageNum)}
                              className={`w-8 h-8 flex items-center justify-center rounded-md text-sm
                                ${pageNum === currentPage 
                                  ? 'bg-purple-600 text-white' 
                                  : 'bg-[#262d40] text-gray-300 hover:bg-[#2a3347]'} 
                                transition-colors duration-200`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 bg-[#262d40] text-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#2a3347] transition-colors duration-200"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </main>
          
          <footer className="bg-[#1e2538] py-3 mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <p className="text-center text-gray-400 text-sm">
                © {new Date().getFullYear()} Aditi Updates. All rights reserved.
              </p>
            </div>
          </footer>
        </div>
      </div>
      
      {/* Edit Modal */}
      <EditUpdateModal 
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        update={editingUpdate}
        onSuccess={handleEditSuccess}
      />
    </ProtectedRoute>
  );
} 