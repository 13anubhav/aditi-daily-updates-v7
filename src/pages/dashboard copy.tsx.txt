import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/router';

interface DashboardUser {
  userName: string;
  userEmail: string;
  teamName: string;
  isManager: boolean;
}

export default function Dashboard() {
  const router = useRouter();
  
  // Mock user data - in a real app, this would come from authentication
  const [userData, setUserData] = useState<DashboardUser>({
    userName: '',
    userEmail: '',
    teamName: '',
    isManager: false
  });

  const [isLoading, setIsLoading] = useState(true);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'recent' | 'blockers'>('all');
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [teams, setTeams] = useState<string[]>([]);
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
  const [pageSize, setPageSize] = useState(10);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // Simulate fetching user data
  useEffect(() => {
    const getAuthenticatedUser = async () => {
      try {
        // In a real app, this would check auth session or get data from auth context
        // For demo purposes, we're using hardcoded data
        const mockUserData = {
          userName: 'John Doe',
          userEmail: 'john.doe@example.com',
          teamName: 'Development',
          isManager: true
        };
        
        setUserData(mockUserData);
        
        // If not a manager, redirect to main page
        if (!mockUserData.isManager) {
          toast.error('You do not have permission to access the dashboard');
          router.push('/');
        } else {
          // Fetch team data as soon as we have the user context
          await fetchTeams();
          await fetchData(mockUserData.teamName);
          setLastRefreshed(new Date());
        }
      } catch (error) {
        console.error('Error getting user data:', error);
        toast.error('Error loading user data');
      }
    };
    
    getAuthenticatedUser();
  }, [router]);

  // Function to fetch data from Supabase with pagination
  const fetchData = async (teamFilter: string = '') => {
    setIsLoading(true);
    try {
      // Create pagination options
      const start = (currentPage - 1) * pageSize;
      const end = start + pageSize - 1;
      
      let query = supabase
        .from('daily_updates')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });
      
      // Apply date range filter to the query directly
      if (dateRange.start) {
        query = query.gte('created_at', `${dateRange.start}T00:00:00`);
      }
      
      if (dateRange.end) {
        query = query.lte('created_at', `${dateRange.end}T23:59:59`);
      }
      
      // Filter by team if team name is provided
      if (teamFilter) {
        query = query.eq('team', teamFilter);
      }

      // Apply tab-specific filters
      if (activeTab === 'recent') {
        const fiveDaysAgo = new Date();
        fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
        query = query.gte('created_at', fiveDaysAgo.toISOString());
      } else if (activeTab === 'blockers') {
        query = query.not('blockers', 'is', null);
      }
      
      // Get total count first
      const { count } = await query;
      const totalCount = count || 0;
      const calculatedTotalPages = Math.max(1, Math.ceil(totalCount / pageSize));
      setTotalPages(calculatedTotalPages);
      
      // Then get paginated data
      const { data, error } = await query.range(start, end);
      
      if (error) {
        console.error('Supabase query error:', error);
        throw new Error(`Failed to fetch data: ${error.message}`);
      }
      
      console.log(`Fetched ${data?.length || 0} records out of ${totalCount} total (page ${currentPage}/${calculatedTotalPages})`);
      
      // Extract unique team names
      const uniqueTeams = Array.from(new Set((data || []).map(item => item.team))).filter(Boolean) as string[];
      setTeams(uniqueTeams);
      
      // Set data
      setHistoricalData(data || []);
      setFilteredData(data || []);
      
      // Calculate stats
      calculateStats(data || []);
      
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  // Function to fetch all teams from Supabase
  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('daily_updates')
        .select('team')
        .not('team', 'is', null);
      
      if (error) {
        throw error;
      }
      
      // Extract unique team names
      const uniqueTeams = Array.from(new Set(data.map(item => item.team))).filter(Boolean) as string[];
      setTeams(uniqueTeams);
      
    } catch (error) {
      console.error('Error fetching teams:', error);
      // Don't show toast for this non-critical operation
    }
  };

  // Function to calculate statistics
  const calculateStats = (data: any[]) => {
    const stats = {
      totalUpdates: data.length,
      totalBlockers: data.filter(item => item.blockers && item.blockers !== 'null').length,
      completedTasks: data.filter(item => item.status === 'completed').length,
      inProgressTasks: data.filter(item => item.status === 'in-progress').length,
      stuckTasks: data.filter(item => item.status === 'stuck').length
    };
    
    setStats(stats);
  };

  // Update the useEffect for filters
  useEffect(() => {
    if (userData.isManager) {
      setCurrentPage(1); // Reset to first page when filters change
      fetchData(selectedTeam);
    }
  }, [activeTab, selectedTeam, dateRange, userData.isManager]);

  // Toggle row expansion
  const toggleRowExpansion = (id: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Export filtered data to CSV
  const exportToCSV = () => {
    if (!filteredData.length) return;
    
    const headers = Object.keys(filteredData[0]).join(',');
    const csvRows = [headers];
    
    for (const row of filteredData) {
      const values = Object.values(row).map(value => {
        const stringValue = String(value).replace(/"/g, '""');
        return `"${stringValue}"`;
      });
      csvRows.push(values.join(','));
    }
    
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `team_updates_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Data exported successfully!');
  };

  // Format blockers from JSON string
  const formatBlockers = (blockersJson: string) => {
    if (!blockersJson || blockersJson === 'null') return [];
    
    try {
      const parsed = JSON.parse(blockersJson);
      
      // Handle different formats of blockers data
      if (Array.isArray(parsed)) {
        return parsed.map(blocker => {
          // Ensure each blocker has required fields
          return {
            id: blocker.id || String(Math.random()),
            type: blocker.type || 'Issue',
            description: blocker.description || 'No description',
            resolutionDate: blocker.resolutionDate || new Date().toISOString().split('T')[0]
          };
        });
      } else if (typeof parsed === 'object' && parsed !== null) {
        // Handle case where a single blocker object is stored
        return [{
          id: parsed.id || String(Math.random()),
          type: parsed.type || 'Issue',
          description: parsed.description || 'No description',
          resolutionDate: parsed.resolutionDate || new Date().toISOString().split('T')[0]
        }];
      }
      
      return [];
    } catch (e) {
      console.error('Error parsing blockers:', e);
      
      // If parsing failed but we have string content, create a default blocker
      if (typeof blockersJson === 'string' && blockersJson.trim() !== '') {
        return [{
          id: String(Math.random()),
          type: 'Issue',
          description: blockersJson.trim(),
          resolutionDate: new Date().toISOString().split('T')[0]
        }];
      }
      
      return [];
    }
  };

  // Refresh data function
  const refreshData = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      await fetchData(selectedTeam);
      setLastRefreshed(new Date());
      toast.success('Data refreshed successfully');
    } catch (error) {
      console.error('Error refreshing data:', error);
      toast.error('Failed to refresh data');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Function to handle page change
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Function to render pagination controls
  const renderPagination = () => {
    const maxVisiblePages = 5;
    const pages = [];
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    // Add first page
    if (startPage > 1) {
      pages.push(
        <button
          key={1}
          onClick={() => handlePageChange(1)}
          className="px-3 py-1 bg-[#262d40] text-gray-300 rounded-md text-sm hover:bg-[#2a3347] transition-colors duration-200"
        >
          1
        </button>
      );
      if (startPage > 2) {
        pages.push(
          <span key="ellipsis1" className="px-2 text-gray-400">
            ...
          </span>
        );
      }
    }

    // Add visible pages
    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <button
          key={i}
          onClick={() => handlePageChange(i)}
          className={`px-3 py-1 rounded-md text-sm transition-colors duration-200 ${
            currentPage === i
              ? 'bg-purple-600 text-white'
              : 'bg-[#262d40] text-gray-300 hover:bg-[#2a3347]'
          }`}
        >
          {i}
        </button>
      );
    }

    // Add last page
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        pages.push(
          <span key="ellipsis2" className="px-2 text-gray-400">
            ...
          </span>
        );
      }
      pages.push(
        <button
          key={totalPages}
          onClick={() => handlePageChange(totalPages)}
          className="px-3 py-1 bg-[#262d40] text-gray-300 rounded-md text-sm hover:bg-[#2a3347] transition-colors duration-200"
        >
          {totalPages}
        </button>
      );
    }

    return (
      <div className="flex items-center justify-center space-x-2 mt-4">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1 bg-[#262d40] text-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#2a3347] transition-colors duration-200"
        >
          Previous
        </button>
        {pages}
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-1 bg-[#262d40] text-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#2a3347] transition-colors duration-200"
        >
          Next
        </button>
      </div>
    );
  };

  return (
    <>
      <Head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Manager Dashboard | Aditi Daily Updates</title>
        <meta name="description" content="Dashboard for managers to view and analyze team daily updates" />
      </Head>
      
      <div className="min-h-screen bg-[#1a1f2e] text-white">
        {/* Navbar */}
        <nav className="bg-[#1e2538] shadow-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
                  Aditi Manager Dashboard
                </h1>
              </div>
              <div className="flex items-center">
                <span className="mr-4 text-sm text-gray-300">
                  {userData.userName ? `Welcome, ${userData.userName}` : 'Loading...'}
                </span>
                <button
                  onClick={() => router.push('/')}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm transition-colors duration-300"
                >
                  Daily Update Form
                </button>
              </div>
            </div>
          </div>
        </nav>
        
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
            </div>
          ) : (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                <div className="bg-[#262d40] p-4 rounded-lg shadow-lg hover:shadow-custom-purple transition-shadow duration-300">
                  <h3 className="text-gray-400 text-sm">Total Updates</h3>
                  <p className="text-2xl font-bold text-white">{stats.totalUpdates}</p>
                </div>
                <div className="bg-[#262d40] p-4 rounded-lg shadow-lg hover:shadow-custom-purple transition-shadow duration-300">
                  <h3 className="text-gray-400 text-sm">Issues/Blockers</h3>
                  <p className="text-2xl font-bold text-white">{stats.totalBlockers}</p>
                </div>
                <div className="bg-[#262d40] p-4 rounded-lg shadow-lg hover:shadow-custom-purple transition-shadow duration-300">
                  <h3 className="text-gray-400 text-sm">Completed Tasks</h3>
                  <p className="text-2xl font-bold text-green-400">{stats.completedTasks}</p>
                </div>
                <div className="bg-[#262d40] p-4 rounded-lg shadow-lg hover:shadow-custom-purple transition-shadow duration-300">
                  <h3 className="text-gray-400 text-sm">In Progress</h3>
                  <p className="text-2xl font-bold text-blue-400">{stats.inProgressTasks}</p>
                </div>
                <div className="bg-[#262d40] p-4 rounded-lg shadow-lg hover:shadow-custom-purple transition-shadow duration-300">
                  <h3 className="text-gray-400 text-sm">Stuck</h3>
                  <p className="text-2xl font-bold text-red-400">{stats.stuckTasks}</p>
                </div>
              </div>
              
              {/* Filters */}
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
                          <option key={index} value={team}>{team}</option>
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
                      onClick={exportToCSV}
                      disabled={!filteredData.length || isRefreshing}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Export CSV
                    </button>
                  </div>
                </div>
                {lastRefreshed && (
                  <div className="mt-3 text-xs text-gray-400 text-right">
                    Last updated: {lastRefreshed.toLocaleString()}
                  </div>
                )}
              </div>
              
              {/* Tabs */}
              <div className="mb-6">
                <div className="border-b border-gray-700">
                  <nav className="flex -mb-px">
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
                  </nav>
                </div>
              </div>
              
              {/* Data Table */}
              {filteredData.length > 0 ? (
                <div className="bg-[#1e2538] rounded-lg shadow-lg overflow-hidden">
                  <div className="table-responsive">
                    <table className="min-w-full divide-y divide-gray-700">
                      <thead className="bg-[#262d40]">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                            Date
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                            Employee
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                            Team
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                            Status
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                            Blockers
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                            <span className="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700">
                        {filteredData.map((item, index) => {
                          const formattedBlockers = formatBlockers(item.blockers);
                          const hasBlockers = formattedBlockers.length > 0;
                          const rowId = `row-${index}`;
                          const isExpanded = expandedRows[rowId] || false;
                          
                          return (
                            <React.Fragment key={index}>
                              <tr className={`hover:bg-[#2a3347] transition-colors duration-200 ${isExpanded ? 'bg-[#2a3347]' : ''}`}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                  {new Date(item.created_at).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                  <div className="flex items-center">
                                    <span className="font-medium text-white">{item.employee_name}</span>
                                    {item.email && (
                                      <span className="ml-2 text-xs text-gray-400">{item.email}</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                                  {item.team || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium
                                    ${item.status === 'completed' ? 'bg-green-500/20 text-green-400' : 
                                      item.status === 'in-progress' ? 'bg-blue-500/20 text-blue-400' : 
                                      'bg-red-500/20 text-red-400'}`}>
                                    {item.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                  {hasBlockers ? (
                                    <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded-full text-xs">
                                      {formattedBlockers.length} {formattedBlockers.length === 1 ? 'blocker' : 'blockers'}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">None</span>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                  <button
                                    onClick={() => toggleRowExpansion(rowId)}
                                    className="text-purple-400 hover:text-purple-300 focus:outline-none"
                                  >
                                    {isExpanded ? (
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
                                      </svg>
                                    ) : (
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                                      </svg>
                                    )}
                                  </button>
                                </td>
                              </tr>
                              
                              {/* Expanded row details */}
                              {isExpanded && (
                                <tr className="bg-[#2a3347]">
                                  <td colSpan={6} className="px-6 py-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
                                      <div>
                                        <h4 className="text-sm font-medium text-gray-300 mb-2">Tasks Completed</h4>
                                        <p className="text-sm text-white whitespace-pre-wrap bg-[#1e2538] p-3 rounded-md">
                                          {item.tasks_completed || 'No tasks recorded'}
                                        </p>
                                        
                                        {item.notes && (
                                          <>
                                            <h4 className="text-sm font-medium text-gray-300 mb-2 mt-4">Additional Notes</h4>
                                            <p className="text-sm text-white whitespace-pre-wrap bg-[#1e2538] p-3 rounded-md">
                                              {item.notes}
                                            </p>
                                          </>
                                        )}
                                      </div>
                                      
                                      <div>
                                        {item.help_needed && (
                                          <>
                                            <h4 className="text-sm font-medium text-gray-300 mb-2">Help Needed</h4>
                                            <p className="text-sm text-white whitespace-pre-wrap bg-[#1e2538] p-3 rounded-md mb-4">
                                              {item.help_needed}
                                            </p>
                                          </>
                                        )}
                                        
                                        {hasBlockers && (
                                          <>
                                            <h4 className="text-sm font-medium text-gray-300 mb-2">Blockers / Risks / Dependencies</h4>
                                            <div className="space-y-2">
                                              {formattedBlockers.map((blocker: any, blockerIndex: number) => (
                                                <div key={blockerIndex} className="bg-[#1e2538] p-3 rounded-md">
                                                  <div className="flex items-center space-x-2 mb-1">
                                                    <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                                                      blocker.type === 'Risk' ? 'bg-yellow-500/20 text-yellow-400' :
                                                      blocker.type === 'Issue' ? 'bg-red-500/20 text-red-400' :
                                                      blocker.type === 'Dependency' ? 'bg-blue-500/20 text-blue-400' :
                                                      'bg-orange-500/20 text-orange-400'
                                                    }`}>
                                                      {blocker.type}
                                                    </span>
                                                    <span className="text-xs text-gray-400">
                                                      Resolution: {new Date(blocker.resolutionDate).toLocaleDateString()}
                                                    </span>
                                                  </div>
                                                  <p className="text-sm text-white whitespace-pre-wrap">{blocker.description}</p>
                                                </div>
                                              ))}
                                            </div>
                                          </>
                                        )}
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
              
              {/* Pagination Controls */}
              {filteredData.length > 0 && totalPages > 1 && (
                <div className="flex justify-between items-center mt-6 bg-[#1e2538] rounded-lg p-3">
                  <div className="text-sm text-gray-400">
                    Showing {filteredData.length} of {historicalData.length} entries
                  </div>
                  {renderPagination()}
                </div>
              )}
            </>
          )}
        </main>
        
        {/* Footer */}
        <footer className="bg-[#1e2538] py-4 mt-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-center text-gray-400 text-sm">
              © {new Date().getFullYear()} Aditi Updates. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
} 