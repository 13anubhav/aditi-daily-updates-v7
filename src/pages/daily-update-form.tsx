import { useState, useEffect } from 'react';
import Head from 'next/head';
import { supabase, DailyUpdate, Team, TaskStatus, PriorityLevel } from '../lib/supabaseClient';
import { useAuth } from '../lib/authContext';
import ProtectedRoute from '../components/ProtectedRoute';
import { useRouter } from 'next/router';
import { toast } from 'react-hot-toast';

interface Blocker {
  id: string;
  type: 'Blockers' | 'Risks' | 'Dependencies';
  description: string;
  expected_resolution_date: string;
}

export default function DailyUpdateFormPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  // Redirect managers and admins away from this page
  useEffect(() => {
    if (user && (user.role === 'manager' || user.role === 'admin')) {
      toast.error('Managers and admins cannot submit daily updates');
      router.replace('/dashboard');
    }
  }, [user, router]);
  
  const [teams, setTeams] = useState<Team[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [formData, setFormData] = useState({
    employee_name: '',
    employee_id: '',
    email_address: '',
    tasks_completed: '',
    status: 'in-progress',
    additional_notes: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    story_points: '',
    priority: 'Medium',
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
    if (user) {
      setFormData(prev => ({
        ...prev,
        employee_name: user.name || '',
        email_address: user.email || '',
      }));
      
      if (user.teamId) {
        setSelectedTeam(user.teamId);
      }
    }
    
    fetchUserTeams();
    
    const date = new Date();
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    setCurrentDate(date.toLocaleDateString('en-US', options));
  }, [user]);

  const fetchUserTeams = async () => {
    try {
      setLoadingTeams(true);
      
      // First try to get teams the user is a member of
      const { data: teamMemberships, error: membershipError } = await supabase
        .from('aditi_team_members')
        .select('team_id')
        .eq('employee_email', user?.email);

      if (membershipError) {
        console.error('Error fetching team memberships:', membershipError);
        setTeams([]); // Initialize as empty array on error
        return;
      }

      // If user has team memberships, get those teams
      if (teamMemberships && teamMemberships.length > 0) {
        const teamIds = teamMemberships.map(tm => tm.team_id);
        const { data: teamsData, error: teamsError } = await supabase
          .from('aditi_teams')
          .select('*')
          .in('id', teamIds);

        if (teamsError) {
          console.error('Error fetching specific teams:', teamsError);
          setTeams([]); // Initialize as empty array on error
          return;
        }
        setTeams(teamsData || []);
      } else {
        // If no memberships found, fetch all teams
        const { data: allTeams, error: allTeamsError } = await supabase
          .from('aditi_teams')
          .select('*')
          .order('team_name', { ascending: true });

        if (allTeamsError) {
          console.error('Error fetching all teams:', allTeamsError);
          setTeams([]); // Initialize as empty array on error
          return;
        }
        
        setTeams(allTeams || []);
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
      toast.error('Failed to load teams');
      setTeams([]); // Initialize as empty array on error
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
    
    if (!formData.start_date) {
      errors.start_date = "Start date is required";
    }
    
    if (!formData.end_date) {
      errors.end_date = "End date is required";
    }
    
    if (formData.start_date && formData.end_date && formData.start_date > formData.end_date) {
      errors.end_date = "End date cannot be before start date";
    }
    
    if (formData.story_points && isNaN(Number(formData.story_points))) {
      errors.story_points = "Story points must be a number";
    }

    if (!formData.priority) {
      errors.priority = "Priority is required";
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!validateForm()) {
      toast.error('Please fill all required fields correctly');
      return;
    }

    setIsSubmitting(true);
    try {
      // If there are no blockers, create a single update without blocker info
      if (blockers.length === 0) {
        const payload = {
          employee_name: formData.employee_name,
          employee_id: formData.employee_id,
          employee_email: formData.email_address,
          team_id: selectedTeam,
          tasks_completed: formData.tasks_completed,
          status: formData.status,
          additional_notes: formData.additional_notes,
          start_date: formData.start_date,
          end_date: formData.end_date,
          story_points: formData.story_points ? Number(formData.story_points) : null,
          priority: formData.priority
        };
        
        const { data, error } = await supabase
          .from('aditi_daily_updates')
          .insert([payload])
          .select();

        if (error) {
          throw new Error(`Database error: ${error.message}`);
        }
      } else {
        // Insert each blocker as a separate daily update
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
          start_date: formData.start_date,
          end_date: formData.end_date,
          story_points: formData.story_points ? Number(formData.story_points) : null,
          priority: formData.priority
        }));
        
        const { data, error } = await supabase
          .from('aditi_daily_updates')
          .insert(updates)
          .select();

        if (error) {
          throw new Error(`Database error: ${error.message}`);
        }
      }

      toast.success('Daily update submitted successfully!');
      setShowAnimation(true);
      
      setTimeout(() => {
        setShowAnimation(false);
        // Clear form
        setFormData({
          employee_name: user?.name || '',
          employee_id: formData.employee_id, // Keep the employee ID
          email_address: user?.email || '',
          tasks_completed: '',
          status: 'in-progress',
          additional_notes: '',
          start_date: new Date().toISOString().split('T')[0],
          end_date: new Date().toISOString().split('T')[0],
          story_points: '',
          priority: 'Medium',
        });
        setBlockers([]);
        
        // Redirect to user dashboard
        router.push('/user-dashboard');
      }, 2000);
      
    } catch (error: any) {
      console.error('Error submitting daily update:', error);
      toast.error(error.message || 'Failed to submit daily update');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // If status is changed to completed, set end date to today
    if (name === 'status' && value === 'completed') {
      setFormData(prev => ({
        ...prev,
        [name]: value,
        end_date: new Date().toISOString().split('T')[0]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
    
    // Clear errors when field is updated
    if (formErrors[name]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleBlockerChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCurrentBlocker(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleTeamChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedTeam(e.target.value);
    
    if (formErrors.team) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.team;
        return newErrors;
      });
    }
  };

  return (
    <ProtectedRoute allowedRoles={['user']}>
      <div className="min-h-screen bg-[#1a1f2e] text-white">
        <Head>
          <title>Daily Update Form | Aditi Daily Updates</title>
          <meta name="description" content="Submit your daily updates and status reports" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>

        <main className="py-4 sm:py-8 md:py-12">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-[#1e2538] shadow-xl rounded-lg overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white py-6 px-6 md:px-8">
                <h1 className="text-xl md:text-2xl font-bold mb-2">Daily Update Form</h1>
                <p className="text-purple-100">{currentDate}</p>
              </div>

              <form onSubmit={handleSubmit} className="p-6 md:p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Employee Name */}
                  <div>
                    <label htmlFor="employee_name" className="block text-sm font-medium text-gray-200 mb-1">
                      Employee Name*
                    </label>
                    <input
                      type="text"
                      id="employee_name"
                      name="employee_name"
                      value={formData.employee_name}
                      onChange={handleChange}
                      className={`shadow-sm block w-full sm:text-sm rounded-md border bg-[#262d40] text-white ${
                        formErrors.employee_name ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-600 focus:ring-purple-500 focus:border-purple-500'
                      } p-2`}
                      placeholder="Your full name"
                    />
                    {formErrors.employee_name && (
                      <p className="mt-1 text-sm text-red-400">{formErrors.employee_name}</p>
                    )}
                  </div>

                  {/* Employee ID */}
                  <div>
                    <label htmlFor="employee_id" className="block text-sm font-medium text-gray-200 mb-1">
                      Employee ID*
                    </label>
                    <input
                      type="text"
                      id="employee_id"
                      name="employee_id"
                      value={formData.employee_id}
                      onChange={handleChange}
                      className={`shadow-sm block w-full sm:text-sm rounded-md border bg-[#262d40] text-white ${
                        formErrors.employee_id ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-600 focus:ring-purple-500 focus:border-purple-500'
                      } p-2`}
                      placeholder="Your employee ID"
                    />
                    {formErrors.employee_id && (
                      <p className="mt-1 text-sm text-red-400">{formErrors.employee_id}</p>
                    )}
                  </div>

                  {/* Email Address */}
                  <div>
                    <label htmlFor="email_address" className="block text-sm font-medium text-gray-200 mb-1">
                      Email Address*
                    </label>
                    <input
                      type="email"
                      id="email_address"
                      name="email_address"
                      value={formData.email_address}
                      onChange={handleChange}
                      className={`shadow-sm block w-full sm:text-sm rounded-md border bg-[#262d40] text-white ${
                        formErrors.email_address ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-600 focus:ring-purple-500 focus:border-purple-500'
                      } p-2`}
                      placeholder="Your email address"
                      disabled={!!user}
                    />
                    {formErrors.email_address && (
                      <p className="mt-1 text-sm text-red-400">{formErrors.email_address}</p>
                    )}
                  </div>

                  {/* Team Selection */}
                  <div>
                    <label htmlFor="team" className="block text-sm font-medium text-gray-200 mb-1">
                      Team*
                    </label>
                    <select
                      id="team"
                      name="team"
                      value={selectedTeam}
                      onChange={handleTeamChange}
                      className={`shadow-sm block w-full sm:text-sm rounded-md border bg-[#262d40] text-white ${
                        formErrors.team ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-600 focus:ring-purple-500 focus:border-purple-500'
                      } p-2`}
                      disabled={loadingTeams}
                    >
                      <option value="" disabled>Select your team</option>
                      {Array.isArray(teams) && teams.map(team => (
                        <option key={team.id} value={team.id}>
                          {team.team_name}
                        </option>
                      ))}
                    </select>
                    {formErrors.team && (
                      <p className="mt-1 text-sm text-red-400">{formErrors.team}</p>
                    )}
                  </div>
                </div>

                {/* Tasks Completed */}
                <div className="mt-6">
                  <label htmlFor="tasks_completed" className="block text-sm font-medium text-gray-200 mb-1">
                    Tasks Completed Today*
                  </label>
                  <textarea
                    id="tasks_completed"
                    name="tasks_completed"
                    rows={4}
                    value={formData.tasks_completed}
                    onChange={handleChange}
                    className={`shadow-sm block w-full sm:text-sm rounded-md border bg-[#262d40] text-white ${
                      formErrors.tasks_completed ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-600 focus:ring-purple-500 focus:border-purple-500'
                    } p-2`}
                    placeholder="List the tasks you completed today"
                  />
                  {formErrors.tasks_completed && (
                    <p className="mt-1 text-sm text-red-400">{formErrors.tasks_completed}</p>
                  )}
                </div>

                {/* Start and End Date */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                  {/* Start Date */}
                  <div>
                    <label htmlFor="start_date" className="block text-sm font-medium text-gray-200 mb-1">
                      Start Date*
                    </label>
                    <input
                      type="date"
                      id="start_date"
                      name="start_date"
                      min={new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                      value={formData.start_date}
                      onChange={handleChange}
                      className={`shadow-sm block w-full sm:text-sm rounded-md border bg-[#262d40] text-white ${
                        formErrors.start_date ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-600 focus:ring-purple-500 focus:border-purple-500'
                      } p-2`}
                    />
                    {formErrors.start_date && (
                      <p className="mt-1 text-sm text-red-400">{formErrors.start_date}</p>
                    )}
                  </div>

                  {/* End Date */}
                  <div>
                    <label htmlFor="end_date" className="block text-sm font-medium text-gray-200 mb-1">
                      End Date*
                    </label>
                    <input
                      type="date"
                      id="end_date"
                      name="end_date"
                      value={formData.end_date}
                      onChange={handleChange}
                      className={`shadow-sm block w-full sm:text-sm rounded-md border bg-[#262d40] text-white ${
                        formErrors.end_date ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-600 focus:ring-purple-500 focus:border-purple-500'
                      } p-2`}
                    />
                    {formErrors.end_date && (
                      <p className="mt-1 text-sm text-red-400">{formErrors.end_date}</p>
                    )}
                  </div>
                </div>

                {/* Story Points */}
                <div className="mt-6">
                  <label htmlFor="story_points" className="block text-sm font-medium text-gray-200 mb-1">
                    Story Points
                  </label>
                  <div className="relative rounded-md shadow-sm">
                    <input
                      type="number"
                      id="story_points"
                      name="story_points"
                      min="0"
                      max="8"
                      step="0.5"
                      value={formData.story_points}
                      onChange={handleChange}
                      className={`shadow-sm block w-full sm:text-sm rounded-md border bg-[#262d40] text-white ${
                        formErrors.story_points ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-600 focus:ring-purple-500 focus:border-purple-500'
                      } p-2`}
                      placeholder="Effort estimation in story points"
                    />
                  </div>
                  {formErrors.story_points && (
                    <p className="mt-1 text-sm text-red-400">{formErrors.story_points}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-400">Optional: Enter the estimated effort for completed tasks</p>
                </div>

                {/* Status */}
                <div className="mt-6">
                  <label htmlFor="status" className="block text-sm font-medium text-gray-200 mb-1">
                    Status*
                  </label>
                  <select
                    id="status"
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className={`shadow-sm block w-full sm:text-sm rounded-md border bg-[#262d40] text-white ${
                      formErrors.status ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-600 focus:ring-purple-500 focus:border-purple-500'
                    } p-2`}
                  >
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="blocked">Blocked</option>
                    <option value="to-do">To Do</option>
                  </select>
                  {formErrors.status && (
                    <p className="mt-1 text-sm text-red-400">{formErrors.status}</p>
                  )}
                </div>

                {/* Priority */}
                <div className="mt-6">
                  <label htmlFor="priority" className="block text-sm font-medium text-gray-200 mb-1">
                    Priority*
                  </label>
                  <select
                    id="priority"
                    name="priority"
                    value={formData.priority}
                    onChange={handleChange}
                    className={`shadow-sm block w-full sm:text-sm rounded-md border bg-[#262d40] text-white ${
                      formErrors.priority ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-600 focus:ring-purple-500 focus:border-purple-500'
                    } p-2`}
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                  {formErrors.priority && (
                    <p className="mt-1 text-sm text-red-400">{formErrors.priority}</p>
                  )}
                </div>

                {/* Additional Notes */}
                <div className="mt-6">
                  <label htmlFor="additional_notes" className="block text-sm font-medium text-gray-200 mb-1">
                    Additional Comments (Blockers, Risks, Dependencies)
                  </label>
                  <textarea
                    id="additional_notes"
                    name="additional_notes"
                    rows={3}
                    value={formData.additional_notes}
                    onChange={handleChange}
                    className="shadow-sm focus:ring-purple-500 focus:border-purple-500 block w-full sm:text-sm border-gray-600 bg-[#262d40] text-white rounded-md p-2"
                    placeholder="Any additional comments or notes"
                  />
                </div>

                {/* Blockers Section */}
                

                {/* Form Actions */}
                <div className="mt-8 pt-5 border-t border-gray-700 flex justify-between items-center">
                  <button
                    type="button"
                    onClick={() => router.push('/user-dashboard')}
                    className="px-4 py-2 border border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-200 bg-[#262d40] hover:bg-[#2a3349] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={`inline-flex items-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white ${
                      isSubmitting ? 'bg-purple-500 opacity-70 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500'
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Submitting...
                      </>
                    ) : (
                      'Submit Daily Update'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </main>

        {/* Success animation overlay */}
        {showAnimation && (
          <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75 z-50">
            <div className="text-center p-8 bg-[#1e2538] rounded-lg shadow-xl">
              <div className="w-24 h-24 rounded-full bg-purple-900 flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Update Submitted!</h2>
              <p className="text-gray-300">Your daily update has been submitted successfully.</p>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
} 