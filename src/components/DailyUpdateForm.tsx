import { useState, useEffect } from 'react';
import { supabase, DailyUpdate, Team } from '../lib/supabaseClient';
import { toast } from 'react-hot-toast';

interface DailyUpdateFormProps {
  userEmail: string;
  userName: string;
  reportingManager: string;
  teamName: string;
  isManager: boolean;
}

interface Blocker {
  id: string;
  type: 'Blockers' | 'Risks' | 'Dependencies';
  description: string;
  expected_resolution_date: string;
}

export default function DailyUpdateForm({ 
  userEmail, 
  userName, 
  reportingManager,
  teamName,
  isManager 
}: DailyUpdateFormProps) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [formData, setFormData] = useState({
    employee_name: userName || '',
    employee_id: '',
    email_address: userEmail || '',
    tasks_completed: '',
    status: 'in-progress',
    additional_notes: '',
  });
  const [blockers, setBlockers] = useState<Blocker[]>([]);
  const [showBlockerForm, setShowBlockerForm] = useState(false);
  const [currentBlocker, setCurrentBlocker] = useState<Partial<Blocker>>({
    type: 'Blockers',
    description: '',
    expected_resolution_date: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAnimation, setShowAnimation] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchUserTeams();
    const date = new Date();
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    setCurrentDate(date.toLocaleDateString('en-US', options));
  }, [userEmail]);

  const fetchUserTeams = async () => {
    try {
      setLoadingTeams(true);
      console.log('Fetching teams for user email:', userEmail);
      
      // First try to get teams the user is a member of
      const { data: teamMemberships, error: membershipError } = await supabase
        .from('aditi_team_members')
        .select('team_id')
        .eq('employee_email', userEmail);

      if (membershipError) {
        console.error('Error fetching team memberships:', membershipError);
      }

      // If user has team memberships, get those teams
      if (teamMemberships && teamMemberships.length > 0) {
        console.log('User has team memberships:', teamMemberships);
        const teamIds = teamMemberships.map(tm => tm.team_id);
        const { data: teamsData, error: teamsError } = await supabase
          .from('aditi_teams')
          .select('*')
          .in('id', teamIds);

        if (teamsError) {
          console.error('Error fetching specific teams:', teamsError);
          throw teamsError;
        }
        setTeams(teamsData || []);
        console.log('Teams loaded from memberships:', teamsData);
      } else {
        // If no memberships found, fetch all teams
        console.log('No team memberships found, fetching all teams');
        const { data: allTeams, error: allTeamsError } = await supabase
          .from('aditi_teams')
          .select('*')
          .order('team_name', { ascending: true });

        if (allTeamsError) {
          console.error('Error fetching all teams:', allTeamsError);
          throw allTeamsError;
        }
        
        setTeams(allTeams || []);
        console.log('All teams loaded:', allTeams);
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
      toast.error('Failed to load teams');
    } finally {
      setLoadingTeams(false);
    }
  };

  const handleAddBlocker = () => {
    if (!currentBlocker.description || !currentBlocker.expected_resolution_date) {
      toast.error('Please fill in all blocker fields');
      return;
    }

    const newBlocker: Blocker = {
      id: Date.now().toString(),
      type: currentBlocker.type as 'Blockers' | 'Risks' | 'Dependencies',
      description: currentBlocker.description,
      expected_resolution_date: currentBlocker.expected_resolution_date
    };

    setBlockers([...blockers, newBlocker]);
    setCurrentBlocker({
      type: 'Blockers',
      description: '',
      expected_resolution_date: '',
    });
    setShowBlockerForm(false);
  };

  const handleRemoveBlocker = (id: string) => {
    setBlockers(blockers.filter(blocker => blocker.id !== id));
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!formData.employee_name.trim()) {
      errors.employee_name = "Employee name is required";
    }
    
    if (!formData.employee_id.trim()) {
      errors.employee_id = "Employee ID is required";
    }
    
    if (!formData.email_address.trim()) {
      errors.email_address = "Email address is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email_address)) {
      errors.email_address = "Email address is invalid";
    }
    
    if (!selectedTeam) {
      errors.team = "Team selection is required";
    }
    
    if (!formData.tasks_completed.trim()) {
      errors.tasks_completed = "Tasks completed is required";
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submission started');
    console.log('Form data:', formData);
    console.log('Selected team:', selectedTeam);
    console.log('Blockers:', blockers);
    
    // Validate form
    if (!validateForm()) {
      console.log('Form validation failed:', formErrors);
      toast.error('Please fill all required fields correctly');
      return;
    }

    setIsSubmitting(true);
    try {
      console.log('Submitting daily update:', {
        formData,
        selectedTeam,
        blockers,
      });
      
      // If there are no blockers, create a single update without blocker info
      if (blockers.length === 0) {
        console.log('Submitting single update without blockers');
        const payload = {
          employee_name: formData.employee_name,
          employee_id: formData.employee_id,
          employee_email: formData.email_address,
          team_id: selectedTeam,
          tasks_completed: formData.tasks_completed,
          status: formData.status,
          additional_notes: formData.additional_notes
        };
        console.log('Payload being sent to Supabase:', payload);
        
        const { data, error } = await supabase
          .from('aditi_daily_updates')
          .insert([payload])
          .select();

        if (error) {
          console.error('Error submitting daily update:', error);
          throw new Error(`Database error: ${error.message}`);
        }
        
        console.log('Daily update submitted successfully:', data);
      } else {
        // Insert each blocker as a separate daily update
        console.log(`Submitting ${blockers.length} updates with blockers`);
        const updates = blockers.map(blocker => ({
          employee_name: formData.employee_name,
          employee_id: formData.employee_id,
          employee_email: formData.email_address,
          team_id: selectedTeam,
          tasks_completed: formData.tasks_completed,
          status: formData.status,
          additional_notes: formData.additional_notes,
          blocker_type: blocker.type,
          blocker_description: blocker.description,
          expected_resolution_date: blocker.expected_resolution_date,
        }));
        
        console.log('Payload being sent to Supabase:', updates);
        
        const { data, error } = await supabase
          .from('aditi_daily_updates')
          .insert(updates)
          .select();

        if (error) {
          console.error('Error submitting daily updates with blockers:', error);
          console.error('Error details:', JSON.stringify(error));
          throw new Error(`Database error: ${error.message}`);
        }
        
        console.log('Daily updates with blockers submitted successfully:', data);
      }

      toast.success('Daily update submitted successfully!');
      setFormData({
        employee_name: userName || '',
        employee_id: '',
        email_address: userEmail || '',
        tasks_completed: '',
        status: 'in-progress',
        additional_notes: '',
      });
      setBlockers([]);
      
      setShowAnimation(true);
      setTimeout(() => setShowAnimation(false), 5000);
    } catch (error) {
      console.error('Error submitting update:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit update';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
      console.log('Form submission process completed');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear validation error for this field when value changes
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleBlockerChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCurrentBlocker(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Also update team selection to clear errors
  const handleTeamChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedTeam(e.target.value);
    
    // Clear team validation error when value changes
    if (formErrors.team) {
      setFormErrors(prev => ({
        ...prev,
        team: ''
      }));
    }
  };

  return (
    <div className="min-h-screen bg-[#1a1f2e] text-white p-4 sm:p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-[#1e2538] rounded-lg p-6 shadow-lg relative hover:shadow-2xl transition-shadow duration-300">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-block bg-[#1b1f2e] px-4 py-2 rounded-full mb-4 hover:bg-[#232838] transition-colors duration-300 hover:scale-105 transform">
              <p className="text-sm text-gray-300">
                <span className="text-green-500">•</span> {currentDate} <span className="text-green-500">•</span>
              </p>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent hover:from-purple-500 hover:to-purple-700 transition-all duration-300">
              Daily Employee Updates
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Employee Information Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="group">
                <label htmlFor="employee_name" className="block text-sm font-medium text-gray-300 mb-2 group-hover:text-purple-400 transition-colors duration-300">
                  Employee Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="employee_name"
                  name="employee_name"
                  value={formData.employee_name}
                  onChange={handleChange}
                  required
                  className={`w-full bg-[#262d40] border ${formErrors.employee_name ? 'border-red-500' : 'border-gray-600'} rounded-md px-4 py-3 text-white 
                  focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent 
                  transition-all duration-300 ease-in-out
                  hover:bg-[#2a3347] hover:border-purple-500 hover:shadow-lg
                  transform hover:-translate-y-0.5`}
                  placeholder="Enter your name"
                />
                {formErrors.employee_name && (
                  <p className="mt-1 text-sm text-red-500">{formErrors.employee_name}</p>
                )}
              </div>

              <div className="group">
                <label htmlFor="employee_id" className="block text-sm font-medium text-gray-300 mb-2 group-hover:text-purple-400 transition-colors duration-300">
                  Employee ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="employee_id"
                  name="employee_id"
                  value={formData.employee_id}
                  onChange={handleChange}
                  required
                  className={`w-full bg-[#262d40] border ${formErrors.employee_id ? 'border-red-500' : 'border-gray-600'} rounded-md px-4 py-3 text-white 
                  focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent 
                  transition-all duration-300 ease-in-out
                  hover:bg-[#2a3347] hover:border-purple-500 hover:shadow-lg
                  transform hover:-translate-y-0.5`}
                  placeholder="Enter your employee ID"
                />
                {formErrors.employee_id && (
                  <p className="mt-1 text-sm text-red-500">{formErrors.employee_id}</p>
                )}
              </div>

              <div className="group">
                <label htmlFor="email_address" className="block text-sm font-medium text-gray-300 mb-2 group-hover:text-purple-400 transition-colors duration-300">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  id="email_address"
                  name="email_address"
                  value={formData.email_address}
                  onChange={handleChange}
                  required
                  className={`w-full bg-[#262d40] border ${formErrors.email_address ? 'border-red-500' : 'border-gray-600'} rounded-md px-4 py-3 text-white 
                  focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent 
                  transition-all duration-300 ease-in-out
                  hover:bg-[#2a3347] hover:border-purple-500 hover:shadow-lg
                  transform hover:-translate-y-0.5`}
                  placeholder="Enter your email address"
                />
                {formErrors.email_address && (
                  <p className="mt-1 text-sm text-red-500">{formErrors.email_address}</p>
                )}
              </div>

              <div className="group">
                <label htmlFor="team" className="block text-sm font-medium text-gray-300 mb-2 group-hover:text-purple-400 transition-colors duration-300">
                  Team <span className="text-red-500">*</span>
                </label>
                {loadingTeams ? (
                  <div className="w-full bg-[#262d40] border border-gray-600 rounded-md px-4 py-3 text-white flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Loading teams...</span>
                  </div>
                ) : (
                  <>
                    <select
                      id="team"
                      name="team"
                      value={selectedTeam}
                      onChange={handleTeamChange}
                      className={`w-full bg-[#262d40] border ${formErrors.team ? 'border-red-500' : 'border-gray-600'} rounded-md px-4 py-3 text-white 
                      focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent 
                      transition-all duration-300 ease-in-out
                      hover:bg-[#2a3347] hover:border-purple-500 hover:shadow-lg
                      transform hover:-translate-y-0.5
                      appearance-none cursor-pointer`}
                      required
                    >
                      <option value="">Select your team</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.team_name}
                        </option>
                      ))}
                    </select>
                    {formErrors.team && (
                      <p className="mt-1 text-sm text-red-500">{formErrors.team}</p>
                    )}
                    {!loadingTeams && teams.length === 0 && (
                      <div className="mt-2 p-3 bg-yellow-500/20 text-yellow-400 rounded-md">
                        <p className="flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          No teams available. Please visit the Team Management page to create a team first.
                        </p>
                        <a href="/team-management" className="mt-2 inline-block text-white bg-purple-600 hover:bg-purple-700 transition-colors duration-300 rounded-md px-4 py-2 text-sm font-medium">
                          Go to Team Management
                        </a>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Tasks Completed Section */}
            <div className="group">
              <label htmlFor="tasks_completed" className="block text-sm font-medium text-gray-300 mb-2 group-hover:text-purple-400 transition-colors duration-300">
                Tasks Completed <span className="text-red-500">*</span>
              </label>
              <textarea
                id="tasks_completed"
                name="tasks_completed"
                value={formData.tasks_completed}
                onChange={handleChange}
                className={`w-full bg-[#262d40] border ${formErrors.tasks_completed ? 'border-red-500' : 'border-gray-600'} rounded-md px-4 py-3 text-white placeholder-gray-400 
                focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent 
                transition-all duration-300 ease-in-out
                hover:bg-[#2a3347] hover:border-purple-500 hover:shadow-lg
                transform hover:-translate-y-0.5
                resize-none`}
                rows={4}
                required
                placeholder="Describe the tasks you completed today"
              />
              {formErrors.tasks_completed && (
                <p className="mt-1 text-sm text-red-500">{formErrors.tasks_completed}</p>
              )}
            </div>

            {/* Blockers Section */}
            <div className="group">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-300 group-hover:text-purple-400 transition-colors duration-300">
                  Blockers/Risks/Dependencies
                </label>
                <button
                  type="button"
                  onClick={() => setShowBlockerForm(!showBlockerForm)}
                  className="inline-flex items-center justify-center p-1 rounded-full bg-purple-600 text-white hover:bg-purple-700 transition-colors duration-300"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    {showBlockerForm ? (
                      <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
                    ) : (
                      <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                    )}
                  </svg>
                </button>
              </div>

              {/* Display existing blockers */}
              {blockers.length > 0 && (
                <div className="mb-4 space-y-2">
                  {blockers.map(blocker => (
                    <div key={blocker.id} className="flex items-start justify-between bg-[#2a3347] p-3 rounded-md hover:bg-[#313c52] transition-colors duration-200">
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                            blocker.type === 'Risks' ? 'bg-yellow-500/20 text-yellow-400' :
                            blocker.type === 'Blockers' ? 'bg-red-500/20 text-red-400' :
                            'bg-blue-500/20 text-blue-400'
                          }`}>
                            {blocker.type}
                          </span>
                          <span className="text-xs text-gray-400">Resolution: {new Date(blocker.expected_resolution_date).toLocaleDateString()}</span>
                        </div>
                        <p className="text-sm text-gray-300">{blocker.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveBlocker(blocker.id)}
                        className="text-gray-400 hover:text-red-400 transition-colors duration-200"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Blocker form */}
              {showBlockerForm && (
                <div className="bg-[#262d40] border border-gray-600 rounded-md p-4 mb-4 animate-fadeIn">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label htmlFor="blockerType" className="block text-sm font-medium text-gray-300 mb-2">
                        Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="blockerType"
                        name="type"
                        value={currentBlocker.type}
                        onChange={handleBlockerChange}
                        className="w-full bg-[#2a3347] border border-gray-600 rounded-md px-4 py-2 text-white
                        focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent
                        appearance-none cursor-pointer"
                        required
                      >
                        <option value="Blockers">Blockers</option>
                        <option value="Risks">Risks</option>
                        <option value="Dependencies">Dependencies</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="resolutionDate" className="block text-sm font-medium text-gray-300 mb-2">
                        Expected Resolution Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        id="resolutionDate"
                        name="expected_resolution_date"
                        value={currentBlocker.expected_resolution_date}
                        onChange={handleBlockerChange}
                        className="w-full bg-[#2a3347] border border-gray-600 rounded-md px-4 py-2 text-white
                        focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        required
                      />
                    </div>
                  </div>
                  <div className="mb-4">
                    <label htmlFor="blockerDescription" className="block text-sm font-medium text-gray-300 mb-2">
                      Description <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      id="blockerDescription"
                      name="description"
                      value={currentBlocker.description}
                      onChange={handleBlockerChange}
                      placeholder="Describe the blocker in detail"
                      rows={3}
                      className="w-full bg-[#2a3347] border border-gray-600 rounded-md px-4 py-2 text-white placeholder-gray-400
                      focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent
                      resize-none"
                      required
                    />
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowBlockerForm(false)}
                      className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors duration-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAddBlocker}
                      className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors duration-300 flex items-center"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                      </svg>
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="group">
              <label htmlFor="status" className="block text-sm font-medium text-gray-300 mb-2 group-hover:text-purple-400 transition-colors duration-300">
                Status <span className="text-red-500">*</span>
              </label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full bg-[#262d40] border border-gray-600 rounded-md px-4 py-3 text-white 
                focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent 
                transition-all duration-300 ease-in-out
                hover:bg-[#2a3347] hover:border-purple-500 hover:shadow-lg
                transform hover:-translate-y-0.5
                appearance-none cursor-pointer"
                required
              >
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>

            <div className="group">
              <label htmlFor="additional_notes" className="block text-sm font-medium text-gray-300 mb-2 group-hover:text-purple-400 transition-colors duration-300">
                Additional Notes
              </label>
              <textarea
                id="additional_notes"
                name="additional_notes"
                value={formData.additional_notes}
                onChange={handleChange}
                className="w-full bg-[#262d40] border border-gray-600 rounded-md px-4 py-3 text-white placeholder-gray-400 
                focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent 
                transition-all duration-300 ease-in-out
                hover:bg-[#2a3347] hover:border-purple-500 hover:shadow-lg
                transform hover:-translate-y-0.5
                resize-none"
                rows={3}
              />
            </div>

            <div className="relative">
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full bg-purple-500 text-white font-medium py-3 px-4 rounded-md 
                transition-all duration-300 ease-in-out
                focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-[#1e2538]
                transform hover:-translate-y-1 hover:shadow-lg hover:bg-purple-600
                active:translate-y-0 active:shadow-md
                ${isSubmitting ? 'opacity-75 cursor-not-allowed' : 'hover:bg-purple-600'}`}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Submitting...
                  </span>
                ) : (
                  'Submit'
                )}
              </button>

              {/* Success Message Animation */}
              <div
                className={`fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-lg 
                shadow-lg flex items-center space-x-2 transition-all duration-500
                hover:bg-green-600 hover:shadow-xl hover:scale-105 
                ${showAnimation ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}
              >
                <svg
                  className="w-6 h-6 animate-bounce"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="font-medium text-lg">Update submitted successfully!</span>
              </div>
            </div>
          </form>

          {/* Footer */}
          <div className="mt-8 text-center text-sm text-gray-400 hover:text-gray-300 transition-colors duration-300">
            © {new Date().getFullYear()} Aditi Updates. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
} 