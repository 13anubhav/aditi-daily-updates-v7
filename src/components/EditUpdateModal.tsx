import { useState, useEffect } from 'react';
import { DailyUpdate, supabase, Team } from '../lib/supabaseClient';
import { toast } from 'react-hot-toast';
import { useAuth } from '../lib/authContext';

interface EditUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  update: DailyUpdate | null;
  onSuccess: () => void;
}

export default function EditUpdateModal({ isOpen, onClose, update, onSuccess }: EditUpdateModalProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState<Partial<DailyUpdate>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [originalStatus, setOriginalStatus] = useState<string>('');

  // Determine if the user can edit this update
  const canEditUpdate = user?.role === 'admin' || user?.role === 'manager' || 
    (update?.status === 'to-do' || update?.status === 'in-progress');

  // Determine if specific fields can be edited
  const isFieldEditable = (fieldName: string) => {
    // Admins and managers can edit all fields
    if (user?.role === 'admin' || user?.role === 'manager') {
      return true;
    }
    
    // For regular users, only allow editing if status is to-do or in-progress
    if (update?.status === 'to-do' || update?.status === 'in-progress') {
      return true;
    }
    
    return false;
  };

  useEffect(() => {
    if (update) {
      setFormData({
        employee_name: update.employee_name,
        employee_email: update.employee_email,
        team_id: update.team_id,
        tasks_completed: update.tasks_completed,
        status: update.status,
        priority: update.priority || 'Medium',
        blocker_type: update.blocker_type,
        blocker_description: update.blocker_description,
        expected_resolution_date: update.expected_resolution_date,
        additional_notes: update.additional_notes,
        start_date: update.start_date,
        end_date: update.end_date,
        story_points: update.story_points,
      });
      setOriginalStatus(update.status);
    }
    fetchTeams();
  }, [update]);

  const fetchTeams = async () => {
    try {
      setLoadingTeams(true);
      const { data, error } = await supabase
        .from('aditi_teams')
        .select('*')
        .order('team_name', { ascending: true });

      if (error) throw error;
      setTeams(data || []);
    } catch (error) {
      console.error('Error fetching teams:', error);
      toast.error('Failed to load teams');
    } finally {
      setLoadingTeams(false);
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

  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!formData.employee_name?.trim()) {
      errors.employee_name = "Employee name is required";
    }
    
    if (!formData.employee_email?.trim()) {
      errors.employee_email = "Email address is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.employee_email)) {
      errors.employee_email = "Email address is invalid";
    }
    
    if (!formData.team_id) {
      errors.team_id = "Team selection is required";
    }
    
    if (!formData.tasks_completed?.trim()) {
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
    
    if (!validateForm()) {
      toast.error('Please fill all required fields correctly');
      return;
    }

    if (!update?.id) {
      toast.error('Invalid update data');
      return;
    }

    setIsSubmitting(true);
    try {
      // Handle special status transitions
      let updatedFormData = { ...formData };
      
      // If reopening a task, change status to in-progress and clear end date
      if (formData.status === 'reopen') {
        updatedFormData = {
          ...updatedFormData,
          status: 'in-progress',
          end_date: null
        };
      }
      
      const payload = {
        employee_name: updatedFormData.employee_name,
        employee_email: updatedFormData.employee_email,
        team_id: updatedFormData.team_id,
        tasks_completed: updatedFormData.tasks_completed,
        status: updatedFormData.status,
        priority: updatedFormData.priority,
        blocker_type: updatedFormData.blocker_type || null,
        blocker_description: updatedFormData.blocker_description || null,
        expected_resolution_date: updatedFormData.expected_resolution_date || null,
        additional_notes: updatedFormData.additional_notes || null,
        start_date: updatedFormData.start_date,
        end_date: updatedFormData.end_date,
        story_points: updatedFormData.story_points ? Number(updatedFormData.story_points) : null,
      };
      
      const { error } = await supabase
        .from('aditi_daily_updates')
        .update(payload)
        .eq('id', update.id);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      toast.success('Daily update edited successfully!');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error updating daily update:', error);
      toast.error(error.message || 'Failed to update daily update');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1e2538] rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white py-4 px-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Edit Daily Update</h2>
          <button 
            onClick={onClose}
            className="text-white hover:text-gray-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          {/* Visual indicator for edit permissions */}
          {user?.role !== 'admin' && user?.role !== 'manager' && (
            <div className={`mb-6 p-4 rounded-md ${canEditUpdate ? 'bg-blue-900/30 border border-blue-700' : 'bg-red-900/30 border border-red-700'}`}>
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  {canEditUpdate ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-gray-200">
                    {canEditUpdate ? 'You can edit this update' : 'This update is not editable'}
                  </h3>
                  <div className="mt-2 text-sm text-gray-300">
                    <p>
                      {canEditUpdate 
                        ? 'Tasks with "To Do" or "In Progress" status can be edited.' 
                        : 'Tasks with "Completed" or "Blocked" status cannot be edited by regular users. Please contact your manager or admin for assistance.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

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
                value={formData.employee_name || ''}
                onChange={handleChange}
                className={`shadow-sm block w-full sm:text-sm rounded-md border bg-[#262d40] text-white ${
                  formErrors.employee_name ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-600 focus:ring-purple-500 focus:border-purple-500'
                } p-2`}
                placeholder="Employee name"
                disabled={!isFieldEditable('employee_name')}
              />
              {formErrors.employee_name && (
                <p className="mt-1 text-sm text-red-400">{formErrors.employee_name}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="employee_email" className="block text-sm font-medium text-gray-200 mb-1">
                Email Address*
              </label>
              <input
                type="email"
                id="employee_email"
                name="employee_email"
                value={formData.employee_email || ''}
                onChange={handleChange}
                className={`shadow-sm block w-full sm:text-sm rounded-md border bg-[#262d40] text-white ${
                  formErrors.employee_email ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-600 focus:ring-purple-500 focus:border-purple-500'
                } p-2`}
                placeholder="Email address"
                disabled={!isFieldEditable('employee_email')}
              />
              {formErrors.employee_email && (
                <p className="mt-1 text-sm text-red-400">{formErrors.employee_email}</p>
              )}
            </div>

            {/* Team */}
            <div>
              <label htmlFor="team_id" className="block text-sm font-medium text-gray-200 mb-1">
                Team*
              </label>
              <select
                id="team_id"
                name="team_id"
                value={formData.team_id || ''}
                onChange={handleChange}
                className={`shadow-sm block w-full sm:text-sm rounded-md border bg-[#262d40] text-white ${
                  formErrors.team_id ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-600 focus:ring-purple-500 focus:border-purple-500'
                } p-2`}
                disabled={loadingTeams || !isFieldEditable('team_id')}
              >
                <option value="" disabled>Select team</option>
                {teams.map(team => (
                  <option key={team.id} value={team.id}>
                    {team.team_name}
                  </option>
                ))}
              </select>
              {formErrors.team_id && (
                <p className="mt-1 text-sm text-red-400">{formErrors.team_id}</p>
              )}
            </div>

            {/* Status */}
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-200 mb-1">
                Status*
              </label>
              <select
                id="status"
                name="status"
                value={formData.status || 'in-progress'}
                onChange={handleChange}
                className="shadow-sm block w-full sm:text-sm rounded-md border border-gray-600 bg-[#262d40] text-white focus:ring-purple-500 focus:border-purple-500 p-2"
                disabled={!isFieldEditable('status')}
              >
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="blocked">Blocked</option>
                <option value="to-do">To Do</option>
                {(user?.role === 'admin' || user?.role === 'manager') && 
                  <option value="reopen">Reopen</option>
                }
              </select>
            </div>

            {/* Priority */}
            <div>
              <label htmlFor="priority" className="block text-sm font-medium text-gray-200 mb-1">
                Priority*
              </label>
              <select
                id="priority"
                name="priority"
                value={formData.priority || 'Medium'}
                onChange={handleChange}
                className={`shadow-sm block w-full sm:text-sm rounded-md border bg-[#262d40] text-white ${
                  formErrors.priority ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-600 focus:ring-purple-500 focus:border-purple-500'
                } p-2`}
                disabled={!isFieldEditable('priority')}
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
              {formErrors.priority && (
                <p className="mt-1 text-sm text-red-400">{formErrors.priority}</p>
              )}
            </div>

            {/* Story Points */}
            <div>
              <label htmlFor="story_points" className="block text-sm font-medium text-gray-200 mb-1">
                Story Points
              </label>
              <input
                type="number"
                id="story_points"
                name="story_points"
                value={formData.story_points?.toString() || ''}
                onChange={handleChange}
                className={`shadow-sm block w-full sm:text-sm rounded-md border bg-[#262d40] text-white ${
                  formErrors.story_points ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-600 focus:ring-purple-500 focus:border-purple-500'
                } p-2`}
                placeholder="Effort estimation"
                step="0.5"
                min="0"
                disabled={!isFieldEditable('story_points')}
              />
              {formErrors.story_points && (
                <p className="mt-1 text-sm text-red-400">{formErrors.story_points}</p>
              )}
            </div>

            {/* Date Range */}
            <div>
              <label htmlFor="start_date" className="block text-sm font-medium text-gray-200 mb-1">
                Start Date*
              </label>
              <input
                type="date"
                id="start_date"
                name="start_date"
                value={formData.start_date || ''}
                onChange={handleChange}
                className={`shadow-sm block w-full sm:text-sm rounded-md border bg-[#262d40] text-white ${
                  formErrors.start_date ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-600 focus:ring-purple-500 focus:border-purple-500'
                } p-2`}
                disabled={!isFieldEditable('start_date')}
              />
              {formErrors.start_date && (
                <p className="mt-1 text-sm text-red-400">{formErrors.start_date}</p>
              )}
            </div>

            <div>
              <label htmlFor="end_date" className="block text-sm font-medium text-gray-200 mb-1">
                End Date*
              </label>
              <input
                type="date"
                id="end_date"
                name="end_date"
                value={formData.end_date || ''}
                onChange={handleChange}
                className={`shadow-sm block w-full sm:text-sm rounded-md border bg-[#262d40] text-white ${
                  formErrors.end_date ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-600 focus:ring-purple-500 focus:border-purple-500'
                } p-2`}
                disabled={!isFieldEditable('end_date')}
              />
              {formErrors.end_date && (
                <p className="mt-1 text-sm text-red-400">{formErrors.end_date}</p>
              )}
            </div>
          </div>

          {/* Tasks Completed */}
          <div className="mt-6">
            <label htmlFor="tasks_completed" className="block text-sm font-medium text-gray-200 mb-1">
              Tasks Completed*
            </label>
            <textarea
              id="tasks_completed"
              name="tasks_completed"
              rows={4}
              value={formData.tasks_completed || ''}
              onChange={handleChange}
              className={`shadow-sm block w-full sm:text-sm rounded-md border bg-[#262d40] text-white ${
                formErrors.tasks_completed ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-600 focus:ring-purple-500 focus:border-purple-500'
              } p-2`}
              placeholder="List the tasks completed"
              disabled={!isFieldEditable('tasks_completed')}
            />
            {formErrors.tasks_completed && (
              <p className="mt-1 text-sm text-red-400">{formErrors.tasks_completed}</p>
            )}
          </div>

          {/* Blocker Information */}
          <div className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label htmlFor="blocker_type" className="block text-sm font-medium text-gray-200 mb-1">
                  Blocker Type
                </label>
                <select
                  id="blocker_type"
                  name="blocker_type"
                  value={formData.blocker_type || ''}
                  onChange={handleChange}
                  className="shadow-sm block w-full sm:text-sm rounded-md border border-gray-600 bg-[#262d40] text-white focus:ring-purple-500 focus:border-purple-500 p-2"
                >
                  <option value="">None</option>
                  <option value="Blockers">Blocker</option>
                  <option value="Risks">Risk</option>
                  <option value="Dependencies">Dependency</option>
                </select>
              </div>

              {formData.blocker_type && (
                <>
                  <div>
                    <label htmlFor="expected_resolution_date" className="block text-sm font-medium text-gray-200 mb-1">
                      Expected Resolution Date
                    </label>
                    <input
                      type="date"
                      id="expected_resolution_date"
                      name="expected_resolution_date"
                      value={formData.expected_resolution_date || ''}
                      onChange={handleChange}
                      className="shadow-sm block w-full sm:text-sm rounded-md border border-gray-600 bg-[#262d40] text-white focus:ring-purple-500 focus:border-purple-500 p-2"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label htmlFor="blocker_description" className="block text-sm font-medium text-gray-200 mb-1">
                      Blocker Description
                    </label>
                    <textarea
                      id="blocker_description"
                      name="blocker_description"
                      rows={3}
                      value={formData.blocker_description || ''}
                      onChange={handleChange}
                      className="shadow-sm block w-full sm:text-sm rounded-md border border-gray-600 bg-[#262d40] text-white focus:ring-purple-500 focus:border-purple-500 p-2"
                      placeholder="Describe the blocker/risk/dependency"
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Additional Notes */}
          <div className="mt-6">
            <label htmlFor="additional_notes" className="block text-sm font-medium text-gray-200 mb-1">
              Additional Notes
            </label>
            <textarea
              id="additional_notes"
              name="additional_notes"
              rows={3}
              value={formData.additional_notes || ''}
              onChange={handleChange}
              className="shadow-sm block w-full sm:text-sm rounded-md border border-gray-600 bg-[#262d40] text-white focus:ring-purple-500 focus:border-purple-500 p-2"
              placeholder="Any additional comments or notes"
              disabled={!isFieldEditable('additional_notes')}
            />
          </div>

          {/* Submit Button */}
          <div className="mt-8 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="mr-3 px-4 py-2 border border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-200 bg-[#262d40] hover:bg-[#2a3349] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !canEditUpdate}
              className={`inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                isSubmitting || !canEditUpdate ? 'bg-purple-500 opacity-70 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500'
              }`}
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Updating...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 