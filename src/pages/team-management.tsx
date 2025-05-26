import { useState, useEffect } from 'react';
import { supabase, Team, TeamMember } from '../lib/supabaseClient';
import { toast } from 'react-hot-toast';
import Head from 'next/head';
import Link from 'next/link';
import { USER_CACHE_KEY, useAuth } from '../lib/authContext';

interface TeamMemberFormData {
  team_id: string;
  employee_email: string;
  employee_id: string;
  manager_name: string;
  team_member_name: string;
}

interface TeamFormData {
  team_name: string;
  manager_email: string;
}

export default function TeamManagement() {
  const { user, refreshUser } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTeamMember, setNewTeamMember] = useState<TeamMemberFormData>({
    team_id: '',
    employee_email: '',
    employee_id: '',
    manager_name: '',
    team_member_name: ''
  });
  const [newTeam, setNewTeam] = useState<TeamFormData>({
    team_name: '',
    manager_email: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingTeam, setIsSubmittingTeam] = useState(false);
  const [error, setError] = useState('');
  const [teamError, setTeamError] = useState('');
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Improved data fetching with retry logic
  useEffect(() => {
    // Only fetch data when component is mounted on client-side
    if (typeof window !== 'undefined') {
      fetchTeams();
      fetchTeamMembers();
    }
  }, []);

  const fetchTeams = async (retryCount = 0) => {
    try {
      setLoading(true);
      console.log('Fetching teams...');
      
      // Ensure we have a valid session before fetching
      if (retryCount === 0) {
        await refreshUser();
      }
      
      const { data, error } = await supabase
        .from('aditi_teams')
        .select('*')
        .order('team_name', { ascending: true });

      if (error) {
        console.error('Error fetching teams:', error);
        
        // Handle session errors with retry
        if ((error.code === '401' || error.code === '406') && retryCount < 2) {
          console.log(`Retrying teams fetch (attempt ${retryCount + 1})...`);
          await refreshUser();
          return fetchTeams(retryCount + 1);
        }
        
        throw error;
      }
      
      setTeams(data || []);
      console.log('Teams loaded:', data?.length || 0);
      
      // Cache teams data for resilience
      if (typeof window !== 'undefined' && data) {
        try {
          localStorage.setItem('aditi_teams_cache', JSON.stringify(data));
        } catch (e) {
          console.error('Error caching teams data:', e);
        }
      }
    } catch (error) {
      console.error('Teams fetch error:', error);
      
      // Try to load from cache if available
      if (typeof window !== 'undefined') {
        try {
          const cachedTeams = localStorage.getItem('aditi_teams_cache');
          if (cachedTeams) {
            console.log('Using cached teams data');
            setTeams(JSON.parse(cachedTeams));
          }
        } catch (e) {
          console.error('Error loading cached teams:', e);
        }
      }
      
      toast.error('Failed to load teams. Please try refreshing the page.');
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamMembers = async (retryCount = 0) => {
    try {
      setLoading(true);
      console.log('Fetching team members...');
      
      // Set a hard timeout to prevent the loader from getting stuck forever
      const timeout = setTimeout(() => {
        console.log('Team members fetch timeout reached');
        setLoading(false);
      }, 15000); // 15 seconds max loading time
      
      if (loadingTimeout) clearTimeout(loadingTimeout);
      setLoadingTimeout(timeout);
      
      // Ensure we have a valid session before fetching
      if (retryCount === 0) {
        await refreshUser();
      }
      
      const { data, error } = await supabase
        .from('aditi_team_members')
        .select(`
          *,
          aditi_teams(*)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching team members:', error);
        
        // Handle session errors with retry
        if ((error.code === '401' || error.code === '406') && retryCount < 2) {
          console.log(`Retrying team members fetch (attempt ${retryCount + 1})...`);
          await refreshUser();
          return fetchTeamMembers(retryCount + 1);
        }
        
        throw error;
      }
      
      setTeamMembers(data || []);
      console.log('Team members loaded:', data?.length || 0);
      setLastFetched(new Date());
      setDataLoaded(true);
      
      // Cache team members data for resilience
      if (typeof window !== 'undefined' && data) {
        try {
          localStorage.setItem('aditi_team_members_cache', JSON.stringify(data));
        } catch (e) {
          console.error('Error caching team members data:', e);
        }
      }
    } catch (error) {
      console.error('Team members fetch error:', error);
      
      // Try to load from cache if available
      if (typeof window !== 'undefined') {
        try {
          const cachedMembers = localStorage.getItem('aditi_team_members_cache');
          if (cachedMembers) {
            console.log('Using cached team members data');
            setTeamMembers(JSON.parse(cachedMembers));
            setDataLoaded(true);
          }
        } catch (e) {
          console.error('Error loading cached team members:', e);
        }
      }
      
      toast.error('Failed to load team members. Please try refreshing the page.');
      setTeamMembers([]);
    } finally {
      if (loadingTimeout) clearTimeout(loadingTimeout);
      setLoading(false);
    }
  };

  const handleSubmitTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingTeam(true);
    setTeamError('');

    try {
      // Simplified validation
      if (!newTeam.team_name.trim()) throw new Error('Team name is required');
      if (!newTeam.manager_email.trim()) throw new Error('Manager email is required');

      // Ensure we have a valid session before submitting
      await refreshUser();
      
      console.log('Creating new team:', newTeam);
      
      // Insert the new team directly
      const { data, error } = await supabase
        .from('aditi_teams')
        .insert([{
          team_name: newTeam.team_name.trim(),
          manager_email: newTeam.manager_email.trim()
        }])
        .select();

      if (error) {
        console.error('Error creating team:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      // Success
      toast.success('Team created successfully!');
      setNewTeam({
        team_name: '',
        manager_email: ''
      });
      setShowTeamForm(false);
      
      // Refresh teams data
      await fetchTeams();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create team';
      console.error('Team creation error:', error);
      setTeamError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmittingTeam(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      // Validate input data
      const validationErrors = [];
      if (!newTeamMember.team_id) validationErrors.push('Team is required');
      if (!newTeamMember.employee_email.trim()) validationErrors.push('Employee email is required');
      if (!newTeamMember.employee_id.trim()) validationErrors.push('Employee ID is required');
      if (!newTeamMember.manager_name.trim()) validationErrors.push('Manager name is required');
      if (!newTeamMember.team_member_name.trim()) validationErrors.push('Team member name is required');

      // Validate format
      if (!/^[A-Za-z0-9-]+$/.test(newTeamMember.employee_id)) {
        validationErrors.push('Employee ID can only contain letters, numbers, and hyphens');
      }
      if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(newTeamMember.employee_email)) {
        validationErrors.push('Please enter a valid email address');
      }

      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join('\n'));
      }

      // Ensure we have a valid session before submitting
      await refreshUser();
      
      console.log('Adding new team member:', newTeamMember);

      // Check for duplicate entry
      const { data: existingEntry, error: checkError } = await supabase
        .from('aditi_team_members')
        .select('id')
        .eq('team_id', newTeamMember.team_id)
        .eq('employee_email', newTeamMember.employee_email);

      if (checkError) {
        console.error('Error checking for existing team member:', checkError);
        throw new Error(`Database error checking team member: ${checkError.message}`);
      }

      if (existingEntry && existingEntry.length > 0) {
        throw new Error('This employee is already a member of this team');
      }

      // Insert the new team member
      const { data, error } = await supabase
        .from('aditi_team_members')
        .insert([{
          team_id: newTeamMember.team_id,
          employee_email: newTeamMember.employee_email.trim(),
          employee_id: newTeamMember.employee_id.trim(),
          manager_name: newTeamMember.manager_name.trim(),
          team_member_name: newTeamMember.team_member_name.trim()
        }])
        .select();

      if (error) {
        throw new Error(error.message);
      }

      // Success
      toast.success('Team member added successfully!');
      setNewTeamMember({
        team_id: '',
        employee_email: '',
        employee_id: '',
        manager_name: '',
        team_member_name: ''
      });
      
      // Refresh team members data
      await fetchTeamMembers();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add team member';
      console.error('Team member addition error:', error);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewTeamMember(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleTeamChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewTeam(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <>
      <Head>
        <title>Team Management | Aditi Daily Updates</title>
        <meta name="description" content="Manage your team members and create new teams" />
      </Head>

      <div className="min-h-screen bg-[#1a1f2e] text-white flex flex-col">
        <div className="flex-grow max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-[#1e2538] rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
                Team Management
              </h1>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowTeamForm(!showTeamForm)}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm transition-colors duration-300"
                >
                  {showTeamForm ? 'Hide Team Form' : 'Create New Team'}
                </button>
                <Link 
                  href="/dashboard"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm transition-colors duration-300"
                >
                  Back to Dashboard
                </Link>
              </div>
            </div>

            {/* Create New Team Form */}
            {showTeamForm && (
              <form onSubmit={handleSubmitTeam} className="mb-8 bg-[#262d40] p-6 rounded-lg">
                <h2 className="text-xl font-semibold mb-4">Create New Team</h2>
                
                {teamError && (
                  <div className="mb-4 p-3 bg-red-500/20 text-red-400 rounded-md">
                    <p className="font-medium">Error:</p>
                    <p>{teamError}</p>
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
                      onChange={handleTeamChange}
                      required
                      className="w-full bg-[#1e2538] border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Enter team name"
                    />
                  </div>
                  <div>
                    <label htmlFor="manager_email" className="block text-sm font-medium text-gray-300 mb-1">
                      Manager Email
                    </label>
                    <input
                      type="email"
                      id="manager_email"
                      name="manager_email"
                      value={newTeam.manager_email}
                      onChange={handleTeamChange}
                      required
                      className="w-full bg-[#1e2538] border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Enter manager email"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <button
                    type="submit"
                    disabled={isSubmittingTeam}
                    className={`bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-md text-sm font-medium transition-colors duration-300 flex items-center ${
                      isSubmittingTeam ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {isSubmittingTeam ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Creating...
                      </>
                    ) : (
                      'Create Team'
                    )}
                  </button>
                </div>
              </form>
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
                  <label htmlFor="team_id" className="block text-sm font-medium text-gray-300 mb-1">
                    Team
                  </label>
                  <select
                    id="team_id"
                    name="team_id"
                    value={newTeamMember.team_id}
                    onChange={handleChange}
                    required
                    className="w-full bg-[#1e2538] border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Select a team</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.team_name}
                      </option>
                    ))}
                  </select>
                  {teams.length === 0 && !loading && (
                    <p className="text-sm text-yellow-400 mt-1">
                      No teams available. Please create a team first.
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="employee_id" className="block text-sm font-medium text-gray-300 mb-1">
                    Employee ID
                  </label>
                  <input
                    type="text"
                    id="employee_id"
                    name="employee_id"
                    value={newTeamMember.employee_id}
                    onChange={handleChange}
                    required
                    className="w-full bg-[#1e2538] border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter employee ID"
                  />
                </div>
                <div>
                  <label htmlFor="employee_email" className="block text-sm font-medium text-gray-300 mb-1">
                    Employee Email
                  </label>
                  <input
                    type="email"
                    id="employee_email"
                    name="employee_email"
                    value={newTeamMember.employee_email}
                    onChange={handleChange}
                    required
                    className="w-full bg-[#1e2538] border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter employee email"
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
                    value={newTeamMember.manager_name}
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
                    value={newTeamMember.team_member_name}
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
                  disabled={isSubmitting || teams.length === 0}
                  className={`bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-md text-sm font-medium transition-colors duration-300 flex items-center ${
                    (isSubmitting || teams.length === 0) ? 'opacity-50 cursor-not-allowed' : ''
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
            <div className="bg-[#262d40] rounded-lg overflow-hidden mb-8">
              <h2 className="text-xl font-semibold p-4 border-b border-gray-700">Teams</h2>
              {loading ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
                </div>
              ) : teams.length > 0 ? (
                <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                  <div className="inline-block min-w-full align-middle">
                    <div className="overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-700 table-fixed">
                        <thead>
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-[200px]">Team Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-[250px]">Manager Email</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                          {teams.map((team, index) => (
                            <tr key={index} className="hover:bg-[#2a3347] transition-colors duration-200">
                              <td className="px-6 py-4 whitespace-nowrap text-sm">{team.team_name}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">{team.manager_email}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-center text-gray-400 py-4">No teams found. Create your first team above.</p>
              )}
            </div>

            {/* Team Members List */}
            <div className="bg-[#262d40] rounded-lg overflow-hidden">
              <h2 className="text-xl font-semibold p-4 border-b border-gray-700">Team Members</h2>
              {loading ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
                </div>
              ) : teamMembers.length > 0 ? (
                <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
                  <div className="inline-block min-w-full align-middle">
                    <div className="overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-700 table-fixed">
                        <thead>
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-[200px]">Team Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-[150px]">Employee ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-[250px]">Employee Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-[200px]">Manager Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-[200px]">Team Member Name</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                          {teamMembers.map((member, index) => (
                            <tr key={index} className="hover:bg-[#2a3347] transition-colors duration-200">
                              <td className="px-6 py-4 whitespace-nowrap text-sm">{member.aditi_teams?.team_name || 'Unknown'}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">{member.employee_id}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">{member.employee_email}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">{member.manager_name}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">{member.team_member_name}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-center text-gray-400 py-4">No team members found.</p>
              )}
            </div>
          </div>
        </div>
        
        <footer className="bg-[#1e2538] py-3">
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