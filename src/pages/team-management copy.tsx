import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'react-hot-toast';
import Head from 'next/head';
import Link from 'next/link';

interface TeamMember {
  id?: number;
  team_name: string;
  employee_id: string;
  manager_name: string;
  team_member_name: string;
  created_at?: string;
}

export default function TeamManagement() {
  const [teams, setTeams] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTeam, setNewTeam] = useState({
    team_name: '',
    employee_id: '',
    manager_name: '',
    team_member_name: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [dbStatus, setDbStatus] = useState('Checking connection...');
  const [testResult, setTestResult] = useState<any>(null);
  const [creatingTable, setCreatingTable] = useState(false);

  // Check Supabase connection
  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const { data, error } = await supabase
        .from('Aditi_team_members')
        .select('count()')
        .limit(1);
          
      if (error) {
        console.error('Supabase connection error:', error);
        setDbStatus(`Connection error: ${error.message}`);
          
        // If table doesn't exist, show create table button
        if (error.message.includes('does not exist')) {
          setError('Table "Aditi_team_members" does not exist. Click Create Table to create it.');
        }
      } else {
        setDbStatus('Connected to database successfully');
      }
    } catch (err) {
      console.error('Failed to check database connection:', err);
      setDbStatus(`Connection failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  // Create Aditi_team_members table if it doesn't exist
  const createTable = async () => {
    try {
      setCreatingTable(true);
      setDbStatus('Creating table...');
      
      // Call our API endpoint instead of RPC
      const response = await fetch('/api/create-table', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const result = await response.json();
      
      if (!result.success) {
        console.error('Error creating table:', result.error);
        setError(`Failed to create table: ${result.error}. ${result.note || ''}`);
        setDbStatus('Table creation failed');
      } else {
        setDbStatus('Table created successfully');
        toast.success('Table created successfully');
        setError('');
        // Refresh connection status
        await checkConnection();
        // Fetch teams
        await fetchTeams();
      }
    } catch (err) {
      console.error('Error creating table:', err);
      setError(`Failed to create table: ${err instanceof Error ? err.message : String(err)}`);
      setDbStatus('Table creation failed');
    } finally {
      setCreatingTable(false);
    }
  };

  // Fetch existing teams
  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      console.log('Fetching teams from Supabase...');
      
      const { data, error } = await supabase
        .from('Aditi_team_members')
        .select('*')
        .order('team_name', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching teams:', error);
        
        if (error.message.includes('does not exist')) {
          setError('Table "Aditi_team_members" does not exist. Click Create Table to create it.');
        } else {
          toast.error(`Failed to load teams: ${error.message}`);
          setError(error.message);
        }
        
        throw error;
      }
      
      console.log('Teams fetched:', data);
      setTeams(data || []);
    } catch (error) {
      console.error('Error fetching teams:', error);
      if (error instanceof Error && !error.message.includes('does not exist')) {
        toast.error('Failed to load teams');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      // Validate input data
      const validationErrors = [];
      if (!newTeam.team_name.trim()) validationErrors.push('Team name is required');
      if (!newTeam.employee_id.trim()) validationErrors.push('Employee ID is required');
      if (!newTeam.manager_name.trim()) validationErrors.push('Manager name is required');
      if (!newTeam.team_member_name.trim()) validationErrors.push('Team member name is required');

      // Validate format
      if (!/^[A-Za-z0-9\s-]+$/.test(newTeam.team_name)) {
        validationErrors.push('Team name can only contain letters, numbers, spaces, and hyphens');
      }
      if (!/^[A-Za-z0-9-]+$/.test(newTeam.employee_id)) {
        validationErrors.push('Employee ID can only contain letters, numbers, and hyphens');
      }

      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join('\n'));
      }

      // Check for duplicate entry
      const { data: existingEntry, error: checkError } = await supabase
        .from('Aditi_team_members')
        .select('id')
        .eq('team_name', newTeam.team_name)
        .eq('employee_id', newTeam.employee_id)
        .single();

      if (existingEntry) {
        throw new Error('A team member with this Employee ID already exists in this team');
      }

      // Insert the new team member
      const { data, error } = await supabase
        .from('Aditi_team_members')
        .insert([{
          ...newTeam,
          team_name: newTeam.team_name.trim(),
          employee_id: newTeam.employee_id.trim(),
          manager_name: newTeam.manager_name.trim(),
          team_member_name: newTeam.team_member_name.trim()
        }])
        .select();

      if (error) {
        console.error('Error adding team member:', error);
        throw new Error(error.message);
      }

      // Success
      toast.success('Team member added successfully!');
      setNewTeam({
        team_name: '',
        employee_id: '',
        manager_name: '',
        team_member_name: ''
      });
      await fetchTeams();
    } catch (error) {
      console.error('Error adding team member:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to add team member';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewTeam(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const testSupabaseConnection = async () => {
    try {
      setDbStatus('Testing connection...');
      const response = await fetch('/api/test-supabase');
      
      // Check if the response is HTML (error page)
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        const htmlText = await response.text();
        console.error('Received HTML instead of JSON:', htmlText.substring(0, 100) + '...');
        setDbStatus('API Error: Received HTML instead of JSON');
        toast.error('API error - check browser console for details');
        return;
      }
      
      // Parse JSON response
      const result = await response.json();
      setTestResult(result);
      
      if (result.success) {
        setDbStatus('Connection tested successfully');
        toast.success('Supabase connection is working');
      } else {
        setDbStatus(`Connection error: ${result.error}`);
        toast.error(`Connection failed: ${result.error}`);
      }
    } catch (err) {
      console.error('Error testing connection:', err);
      setDbStatus(`Test failed: ${err instanceof Error ? err.message : String(err)}`);
      toast.error('Failed to test connection');
    }
  };

  return (
    <>
      <Head>
        <title>Team Management | Aditi Daily Updates</title>
        <meta name="description" content="Manage your team members and create new teams" />
      </Head>

      <div className="min-h-screen bg-[#1a1f2e] text-white py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-[#1e2538] rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
                Team Management
              </h1>
              <div className="flex space-x-3">
                <button
                  onClick={testSupabaseConnection}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm transition-colors duration-300 flex items-center"
                >
                  Test Connection
                </button>
                <Link 
                  href="/dashboard"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm transition-colors duration-300"
                >
                  Back to Dashboard
                </Link>
              </div>
            </div>

            {/* Database Status */}
            <div className={`mb-6 p-3 rounded-md text-sm ${
              dbStatus.includes('error') || dbStatus.includes('failed') 
                ? 'bg-red-500/20 text-red-400' 
                : dbStatus.includes('successfully') 
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-yellow-500/20 text-yellow-400'
            }`}>
              <p><strong>Database Status:</strong> {dbStatus}</p>
              
              {/* Show create table button if table doesn't exist */}
              {error && error.includes('does not exist') && (
                <div className="mt-2">
                  <p className="text-yellow-400 mb-2">
                    The table "Aditi_team_members" doesn't exist in your database. You need to create it first.
                  </p>
                  <details className="mb-3">
                    <summary className="cursor-pointer text-blue-400 hover:text-blue-300">SQL Script to create table</summary>
                    <pre className="mt-2 p-3 bg-[#1a1f2e] rounded text-xs overflow-auto">
{`-- Run this SQL in your Supabase SQL Editor
CREATE TABLE IF NOT EXISTS Aditi_team_members (
  id SERIAL PRIMARY KEY,
  team_name TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  manager_name TEXT NOT NULL,
  team_member_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add unique constraint to prevent duplicate entries
ALTER TABLE Aditi_team_members 
  ADD CONSTRAINT unique_employee_team 
  UNIQUE (team_name, employee_id);
  
-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_team_name ON Aditi_team_members (team_name);
CREATE INDEX IF NOT EXISTS idx_manager_name ON Aditi_team_members (manager_name);`}
                    </pre>
                  </details>
                  <div className="flex space-x-3">
                    <a 
                      href="https://supabase.com/dashboard" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-xs transition-colors duration-300"
                    >
                      Open Supabase Dashboard
                    </a>
                    <button
                      onClick={createTable}
                      disabled={creatingTable}
                      className={`bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-md text-xs transition-colors duration-300 flex items-center ${
                        creatingTable ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {creatingTable ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Creating...
                        </>
                      ) : (
                        'Create Table'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Test Results */}
            {testResult && (
              <div className="mb-6 p-3 rounded-md text-sm bg-blue-500/20 text-blue-400">
                <h3 className="font-medium mb-2">Test Results:</h3>
                <pre className="overflow-auto max-h-40 p-2 bg-[#1a1f2e] rounded">
                  {JSON.stringify(testResult, null, 2)}
                </pre>
              </div>
            )}

            {/* Add New Team Member Form */}
            <form onSubmit={handleSubmit} className="mb-8 bg-[#262d40] p-6 rounded-lg">
              <h2 className="text-xl font-semibold mb-4">Add New Team Member</h2>
              
              {error && (
                <div className="mb-4 p-3 bg-red-500/20 text-red-400 rounded-md">
                  <p className="font-medium">Error:</p>
                  <p>{error}</p>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="team_name" className="block text-sm font-medium text-gray-300 mb-1">
                    Team Name
                  </label>
                  <input
                    type="text"
                    id="team_name"
                    name="team_name"
                    value={newTeam.team_name}
                    onChange={handleChange}
                    required
                    className="w-full bg-[#1e2538] border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter team name"
                  />
                </div>
                <div>
                  <label htmlFor="employee_id" className="block text-sm font-medium text-gray-300 mb-1">
                    Employee ID
                  </label>
                  <input
                    type="text"
                    id="employee_id"
                    name="employee_id"
                    value={newTeam.employee_id}
                    onChange={handleChange}
                    required
                    className="w-full bg-[#1e2538] border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter employee ID"
                  />
                </div>
                <div>
                  <label htmlFor="manager_name" className="block text-sm font-medium text-gray-300 mb-1">
                    Manager Name
                  </label>
                  <input
                    type="text"
                    id="manager_name"
                    name="manager_name"
                    value={newTeam.manager_name}
                    onChange={handleChange}
                    required
                    className="w-full bg-[#1e2538] border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter manager name"
                  />
                </div>
                <div>
                  <label htmlFor="team_member_name" className="block text-sm font-medium text-gray-300 mb-1">
                    Team Member Name
                  </label>
                  <input
                    type="text"
                    id="team_member_name"
                    name="team_member_name"
                    value={newTeam.team_member_name}
                    onChange={handleChange}
                    required
                    className="w-full bg-[#1e2538] border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter team member name"
                  />
                </div>
              </div>
              <div className="mt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-md text-sm font-medium transition-colors duration-300 flex items-center ${
                    isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Adding...
                    </>
                  ) : (
                    'Add Team Member'
                  )}
                </button>
              </div>
            </form>

            {/* Teams List */}
            <div className="bg-[#262d40] rounded-lg overflow-hidden">
              <h2 className="text-xl font-semibold p-4 border-b border-gray-700">Team Members</h2>
              {loading ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
                </div>
              ) : teams.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-700">
                    <thead>
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Team Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Employee ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Manager Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Team Member Name</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {teams.map((team, index) => (
                        <tr key={index} className="hover:bg-[#2a3347] transition-colors duration-200">
                          <td className="px-6 py-4 whitespace-nowrap text-sm">{team.team_name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">{team.employee_id}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">{team.manager_name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">{team.team_member_name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-gray-400 py-4">No team members found.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 