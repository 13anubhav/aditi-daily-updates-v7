import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import emailjs from '@emailjs/browser';
import { toast } from 'react-hot-toast';
import BlockerSection, { Blocker } from './BlockerSection';

interface DailyUpdateFormProps {
  reportingManager: string;
  userEmail?: string;
  userName?: string;
  teamName?: string;
  isManager?: boolean;
}

// Google Sheets script URL
const scriptURL = process.env.NEXT_PUBLIC_GOOGLE_SHEETS_SCRIPT_URL || '';

// EmailJS configuration
const EMAILJS_SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || '';
const EMAILJS_TEMPLATE_ID = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || '';
const EMAILJS_PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || '';
const MANAGER_EMAIL = process.env.NEXT_PUBLIC_MANAGER_EMAIL || '';

export default function DailyUpdateForm({ 
  reportingManager, 
  userEmail = '', 
  userName = '', 
  teamName = '',
  isManager = false 
}: DailyUpdateFormProps) {
  // Initialize EmailJS
  useEffect(() => {
    if (EMAILJS_PUBLIC_KEY) {
      emailjs.init(EMAILJS_PUBLIC_KEY);
    } else {
      console.error('EmailJS Public Key is missing. Email functionality will not work.');
    }
  }, []);

  const [currentDate, setCurrentDate] = useState('');
  const [formData, setFormData] = useState({
    time: new Date().toISOString(),
    employeeName: userName || '',
    task: '',
    status: '',
    help: '',
    notes: '',
    team: teamName || '',
  });

  // Add email state with pre-populated value if provided
  const [email, setEmail] = useState(userEmail || '');
  
  // Add blockers state
  const [blockers, setBlockers] = useState<Blocker[]>([]);
  
  // State for showing historical data
  const [showHistoricalData, setShowHistoricalData] = useState(false);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Add animation state
  const [showAnimation, setShowAnimation] = useState(false);

  useEffect(() => {
    // Format the current date
    const date = new Date();
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };
    setCurrentDate(date.toLocaleDateString('en-US', options));
  }, []);

  // Function to fetch historical data
  const fetchHistoricalData = async () => {
    setIsLoadingHistory(true);
    try {
      let query = supabase
        .from('daily_updates')
        .select('*')
        .order('created_at', { ascending: false });
      
      // If not manager, restrict to current user's data
      if (!isManager && email) {
        query = query.eq('email', email);
      } 
      // If manager and team name is provided, restrict to team data
      else if (isManager && teamName) {
        query = query.eq('team', teamName);
      }
      
      const { data, error } = await query;
      
      if (error) {
        throw error;
      }
      
      setHistoricalData(data || []);
    } catch (error) {
      console.error('Error fetching historical data:', error);
      toast.error('Failed to load historical data');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Function to export data to CSV for managers
  const exportToCSV = () => {
    if (!historicalData.length) return;
    
    const headers = Object.keys(historicalData[0]).join(',');
    const csvRows = [headers];
    
    for (const row of historicalData) {
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
  };

  const sendEmail = async (formData: any) => {
    try {
      // Format blockers for email
      const blockersText = blockers.length 
        ? blockers.map(b => `Type: ${b.type}\nDescription: ${b.description}\nResolution Date: ${b.resolutionDate}`).join('\n\n')
        : 'None';

      const templateParams = {
        to_name: reportingManager,
        from_name: formData.employeeName,
        to_email: MANAGER_EMAIL,
        from_email: email,
        employee_name: formData.employeeName,
        manager_email: reportingManager,
        tasks_completed: formData.task,
        blockers: blockersText,
        status: formData.status,
        help_needed: formData.help || 'None',
        notes: formData.notes || 'None',
        date: currentDate,
        reply_to: email,
        team: formData.team || 'Not specified',
        message: `
Dear ${reportingManager},

A new daily update has been submitted:

Employee: ${formData.employeeName}
Date: ${currentDate}
Team: ${formData.team || 'Not specified'}

Tasks Completed:
${formData.task}

Status: ${formData.status}

Blockers:
${blockersText}

Help Needed:
${formData.help || 'None'}

Additional Notes:
${formData.notes || 'None'}

Best regards,
Daily Updates System
      `
      };

      const response = await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        templateParams
      );

      toast.success('Email sent successfully to manager!');
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error('Failed to send email to manager');
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      // Prepare data for submission
      const submissionData = {
        ...formData,
        email,
        blockers: JSON.stringify(blockers),
        created_at: new Date().toISOString()
      };

      // Submit to Supabase
      const { error: supabaseError } = await supabase
        .from('daily_updates')
        .insert([submissionData]);

      if (supabaseError) {
        throw supabaseError;
      }

      // Send email to manager
      await sendEmail(submissionData);

      // Submit to Google Sheets
      const form = new FormData();
      Object.entries(submissionData).forEach(([key, value]) => {
        form.append(key, value as string);
      });

      const response = await fetch(scriptURL, {
        method: 'POST',
        body: form
      });

      if (!response.ok) {
        throw new Error('Failed to submit to Google Sheets');
      }

      // Show success message
      setSubmitStatus({
        type: 'success',
        message: 'Daily update submitted successfully!'
      });

      // Reset form
      setFormData(prev => ({
        ...prev,
        task: '',
        status: '',
        help: '',
        notes: ''
      }));
      setBlockers([]);

      // Show animation
      setShowAnimation(true);
      setTimeout(() => setShowAnimation(false), 2000);

      // Refresh historical data
      await fetchHistoricalData();

    } catch (error) {
      console.error('Error submitting form:', error);
      setSubmitStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to submit daily update'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="min-h-screen bg-[#1a1f2e] text-white py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#1e2538] rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
              Daily Update Form
            </h1>
            <div className="flex items-center space-x-4">
              {isManager && (
                <button
                  onClick={exportToCSV}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm transition-colors duration-300"
                >
                  Export CSV
                </button>
              )}
              <button
                onClick={() => {
                  setShowHistoricalData(!showHistoricalData);
                  if (!showHistoricalData) {
                    fetchHistoricalData();
                  }
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm transition-colors duration-300"
              >
                {showHistoricalData ? 'Hide History' : 'Show History'}
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Pre-populated User Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="employee-name" className="block text-sm font-medium text-gray-300 mb-1">
                  Employee Name
                </label>
                <input
                  type="text"
                  id="employee-name"
                  name="employeeName"
                  value={formData.employeeName}
                  readOnly
                  className="w-full bg-[#262d40] border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  readOnly
                  className="w-full bg-[#262d40] border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label htmlFor="team" className="block text-sm font-medium text-gray-300 mb-1">
                  Team
                </label>
                <input
                  type="text"
                  id="team"
                  name="team"
                  value={formData.team}
                  readOnly
                  className="w-full bg-[#262d40] border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-300 mb-1">
                  Date
                </label>
                <input
                  type="text"
                  id="date"
                  value={currentDate}
                  readOnly
                  className="w-full bg-[#262d40] border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* Tasks Completed */}
            <div>
              <label htmlFor="task" className="block text-sm font-medium text-gray-300 mb-1">
                Tasks Completed
              </label>
              <textarea
                id="task"
                name="task"
                value={formData.task}
                onChange={handleChange}
                rows={4}
                required
                className="w-full bg-[#262d40] border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="List your completed tasks..."
              />
            </div>

            {/* Status */}
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-300 mb-1">
                Status
              </label>
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                required
                className="w-full bg-[#262d40] border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Select Status</option>
                <option value="completed">Completed</option>
                <option value="in-progress">In Progress</option>
                <option value="stuck">Stuck</option>
              </select>
            </div>

            {/* Blocker Section */}
            <BlockerSection
              blockers={blockers}
              onBlockersChange={setBlockers}
            />

            {/* Help Needed */}
            <div>
              <label htmlFor="help" className="block text-sm font-medium text-gray-300 mb-1">
                Help Needed
              </label>
              <textarea
                id="help"
                name="help"
                value={formData.help}
                onChange={handleChange}
                rows={3}
                className="w-full bg-[#262d40] border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Describe any help or support needed..."
              />
            </div>

            {/* Additional Notes */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-300 mb-1">
                Additional Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                className="w-full bg-[#262d40] border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Any additional information..."
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-end">
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
                    Submitting...
                  </>
                ) : (
                  'Submit Update'
                )}
              </button>
            </div>
          </form>

          {/* Status Message */}
          {submitStatus && (
            <div className={`mt-4 p-4 rounded-md ${
              submitStatus.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}>
              {submitStatus.message}
            </div>
          )}

          {/* Historical Data Section */}
          {showHistoricalData && (
            <div className="mt-8 border-t border-gray-700 pt-6">
              <h2 className="text-xl font-semibold text-gray-200 mb-4">Historical Data</h2>
              {isLoadingHistory ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
                </div>
              ) : historicalData.length > 0 ? (
                <div className="space-y-4">
                  {historicalData.map((item, index) => (
                    <div key={index} className="bg-[#262d40] p-4 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="text-white font-medium">{item.employee_name}</h3>
                          <p className="text-sm text-gray-400">{new Date(item.created_at).toLocaleDateString()}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          item.status === 'completed' ? 'bg-green-500/20 text-green-400' : 
                          item.status === 'in-progress' ? 'bg-blue-500/20 text-blue-400' : 
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {item.status}
                        </span>
                      </div>
                      <p className="text-gray-300 text-sm mb-2">{item.task}</p>
                      {item.blockers && item.blockers !== 'null' && (
                        <div className="mt-2">
                          <h4 className="text-sm font-medium text-gray-300 mb-1">Blockers:</h4>
                          <p className="text-gray-400 text-sm">{item.blockers}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-center">No historical data available.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 