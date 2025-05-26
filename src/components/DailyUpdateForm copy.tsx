import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import emailjs from '@emailjs/browser';
import { toast } from 'react-hot-toast';

interface DailyUpdateFormProps {
  reportingManager: string;
}

// Google Sheets script URL
const scriptURL = 'https://script.google.com/macros/s/AKfycbytq0TwNxcUvJaz27SzNMDkJ-y0jcLlTafBc_-8NmuHO5pqWqwAnXVfXeixFqJlINyQ/exec';

// EmailJS configuration
const EMAILJS_SERVICE_ID = "service_onw3pqt";
const EMAILJS_TEMPLATE_ID = "template_grybyji";
const EMAILJS_PUBLIC_KEY = "Ou9px6VxPtRsafPka";
//const MANAGER_EMAIL = "workpurpose139@gmail.com";
const MANAGER_EMAIL = "anubhav.chaudhary@aditiconsulting.com";

export default function DailyUpdateForm({ reportingManager }: DailyUpdateFormProps) {
  // Initialize EmailJS
  useEffect(() => {
    emailjs.init(EMAILJS_PUBLIC_KEY);
  }, []);

  const [currentDate, setCurrentDate] = useState('');
  const [formData, setFormData] = useState({
    time: new Date().toISOString(),
    employeeName: '',
    task: '',
    blockers: '',
    status: '',
    help: '',
    notes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  // Add animation state
  const [showAnimation, setShowAnimation] = useState(false);

  // Add email state
  const [email, setEmail] = useState('');

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

  const sendEmail = async (formData: any) => {
    try {
      const templateParams = {
        to_name: formData.employeeName,
        from_name: formData.employeeName,
        to_email: MANAGER_EMAIL,
        from_email: email,
        employee_name: formData.employeeName,
        tasks_completed: formData.task,
        blockers: formData.blockers || 'None',
        status: formData.status,
        help_needed: formData.help || 'None',
        notes: formData.notes || 'None',
        date: currentDate,
        reply_to: email,
        message: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; background-color: #f9f9f9;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
    <!-- Header -->
    <div style="background-color: #1a1f2e; padding: 20px; border-radius: 8px 8px 0 0; margin-bottom: 20px;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Daily Update</h1>
      <p style="color: #e0e0e0; margin: 5px 0 0 0; font-size: 14px;">From ${formData.employeeName} - ${currentDate}</p>
    </div>
    
    <!-- Content -->
    <div style="padding: 0 20px;">
      <p style="font-size: 16px; line-height: 1.5;">Dear Manager,</p>
      <p style="font-size: 16px; line-height: 1.5;">A new daily update has been submitted by ${formData.employeeName}:</p>
      
      <!-- Employee Info -->
      <div style="background-color: #f5f7fa; padding: 15px; border-radius: 6px; margin: 20px 0;">
        <p style="margin: 0 0 10px 0; font-weight: 600;">Employee: <span style="font-weight: normal;">${formData.employeeName}</span></p>
        <p style="margin: 0 0 10px 0; font-weight: 600;">Date: <span style="font-weight: normal;">${currentDate}</span></p>
      </div>
      
      <!-- Tasks Section -->
      <div style="margin: 25px 0;">
        <h2 style="font-size: 18px; color: #1a1f2e; border-bottom: 2px solid #1a1f2e; padding-bottom: 8px; margin-bottom: 15px;">Tasks Completed</h2>
        <p style="margin: 0; padding: 0 0 0 15px; line-height: 1.6; white-space: pre-line;">${formData.task}</p>
      </div>
      
      <!-- Status Section -->
      <div style="margin: 25px 0;">
        <h2 style="font-size: 18px; color: #1a1f2e; border-bottom: 2px solid #1a1f2e; padding-bottom: 8px; margin-bottom: 15px;">Status</h2>
        <p style="margin: 0; padding: 0 0 0 15px; font-weight: 600;">
          <span style="display: inline-block; padding: 5px 10px; border-radius: 4px; background-color: ${
            formData.status === 'Completed' ? '#d4edda' : 
            formData.status === 'In Progress' ? '#fff3cd' : 
            formData.status === 'Blocked' ? '#f8d7da' : '#e2e3e5'
          }; color: ${
            formData.status === 'Completed' ? '#155724' : 
            formData.status === 'In Progress' ? '#856404' : 
            formData.status === 'Blocked' ? '#721c24' : '#383d41'
          };">${formData.status}</span>
        </p>
      </div>
      
      <!-- Blockers Section -->
      <div style="margin: 25px 0;">
        <h2 style="font-size: 18px; color: #1a1f2e; border-bottom: 2px solid #1a1f2e; padding-bottom: 8px; margin-bottom: 15px;">Blockers</h2>
        <p style="margin: 0; padding: 0 0 0 15px; line-height: 1.6; white-space: pre-line;">${formData.blockers || 'None'}</p>
      </div>
      
      <!-- Help Needed Section -->
      <div style="margin: 25px 0;">
        <h2 style="font-size: 18px; color: #1a1f2e; border-bottom: 2px solid #1a1f2e; padding-bottom: 8px; margin-bottom: 15px;">Help Needed</h2>
        <p style="margin: 0; padding: 0 0 0 15px; line-height: 1.6; white-space: pre-line;">${formData.help || 'None'}</p>
      </div>
      
      <!-- Additional Notes Section -->
      <div style="margin: 25px 0;">
        <h2 style="font-size: 18px; color: #1a1f2e; border-bottom: 2px solid #1a1f2e; padding-bottom: 8px; margin-bottom: 15px;">Additional Notes</h2>
        <p style="margin: 0; padding: 0 0 0 15px; line-height: 1.6; white-space: pre-line;">${formData.notes || 'None'}</p>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="margin-top: 30px; padding: 20px; background-color: #f5f7fa; border-radius: 0 0 8px 8px; border-top: 1px solid #e9ecef; font-size: 14px; color: #6c757d; text-align: center;">
      <p style="margin: 0 0 10px 0;">Best regards,</p>
      <p style="margin: 0;">Daily Updates System</p>
      <p style="margin: 15px 0 0 0; font-size: 12px;">This email was sent automatically. Please do not reply directly to this email.</p>
    </div>
  </div>
</body>
</html>
      `
      };

      console.log('Starting email send with updated params...');
      console.log('Service ID:', EMAILJS_SERVICE_ID);
      console.log('Template ID:', EMAILJS_TEMPLATE_ID);
      console.log('Template params:', JSON.stringify(templateParams, null, 2));

      const response = await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        templateParams
      );

      console.log('Email sent successfully. Response:', response);
      toast.success('Email sent successfully to manager!');
      return true;
    } catch (error) {
      console.error('Email sending failed. Full error:', error);
      console.error('Error details:', {
        serviceId: EMAILJS_SERVICE_ID,
        templateId: EMAILJS_TEMPLATE_ID,
        hasPublicKey: !!EMAILJS_PUBLIC_KEY,
        recipientEmail: MANAGER_EMAIL,
        senderEmail: email
      });
      toast.error(`Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);
    setShowAnimation(false);

    try {
      const form = e.target as HTMLFormElement;
      
      // Prepare data for Supabase
      const supabaseData = {
        employee_name: formData.employeeName,
        tasks_completed: formData.task,
        blockers: formData.blockers || null,
        status: formData.status,
        help_needed: formData.help || null,
        notes: formData.notes || null,
        created_at: new Date().toISOString(),
        email: email // Add email to Supabase data
      };

      console.log('Sending data to Supabase:', supabaseData);

      // Save to Supabase database
      const { data: supabaseResponse, error: supabaseError } = await supabase
        .from('daily_updates')
        .insert([supabaseData])
        .select();

      if (supabaseError) {
        console.error('Supabase Error:', supabaseError);
        throw new Error('Failed to save to database: ' + supabaseError.message);
      }

      // Send email notification
      await sendEmail(formData);

      console.log('Successfully saved to Supabase:', supabaseResponse);

      // Also save to Google Sheets if needed
      const formDataToSend = new FormData(form);
      formDataToSend.append('time', new Date().toISOString());
      formDataToSend.append('email', email);

      const sheetResponse = await fetch(scriptURL, {
        method: 'POST',
        body: formDataToSend
      });

      if (!sheetResponse.ok) {
        throw new Error('Google Sheets Error: ' + sheetResponse.statusText);
      }

      setSubmitStatus({
        type: 'success',
        message: 'Update submitted successfully! Email notification sent.'
      });
      
      // Trigger animation
      setShowAnimation(true);
      
      // Clear form after successful submission
      setFormData({
        time: new Date().toISOString(),
        employeeName: '',
        task: '',
        blockers: '',
        status: '',
        help: '',
        notes: '',
      });
      setEmail('');

      // Hide animation after 5 seconds
      setTimeout(() => {
        setShowAnimation(false);
      }, 5000);

    } catch (error) {
      console.error('Error:', error);
      setSubmitStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to submit update. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="min-h-screen bg-[#1a1f2e] text-white p-4 sm:p-6 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-[#1e2538] rounded-lg p-6 shadow-lg relative hover:shadow-2xl transition-shadow duration-300">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-block bg-[#1b1f2e] px-4 py-2 rounded-full mb-4 hover:bg-[#232838] transition-colors duration-300 hover:scale-105 transform">
              <p className="text-sm text-gray-300">• {currentDate} •</p>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent hover:from-purple-500 hover:to-purple-700 transition-all duration-300">
              Daily Employee Updates
            </h1>
            <div className="text-gray-400 hover:text-gray-300 transition-colors duration-300">
              <span className="mr-2">Reporting Manager:</span>
              <span className="font-medium">{reportingManager}</span>
            </div>
          </div>

          {/* Status Message */}
          {submitStatus && (
            <div className={`mb-6 p-4 rounded-md ${
              submitStatus.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
            }`}>
              {submitStatus.message}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Employee Name */}
            <div className="group">
              <label htmlFor="employeeName" className="block text-sm font-medium text-gray-300 mb-2 group-hover:text-purple-400 transition-colors duration-300">
                Employee Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="employeeName"
                name="employeeName"
                value={formData.employeeName}
                onChange={handleChange}
                placeholder="Enter your full name"
                className="w-full bg-[#262d40] border border-gray-600 rounded-md px-4 py-3 text-white placeholder-gray-400 
                focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent 
                transition-all duration-300 ease-in-out
                hover:bg-[#2a3347] hover:border-purple-500 hover:shadow-lg
                transform hover:-translate-y-0.5"
                required
                autoComplete="name"
              />
            </div>

            {/* Email Input */}
            <div className="group">
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2 group-hover:text-purple-400 transition-colors duration-300">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                className="w-full bg-[#262d40] border border-gray-600 rounded-md px-4 py-3 text-white placeholder-gray-400 
                focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent 
                transition-all duration-300 ease-in-out
                hover:bg-[#2a3347] hover:border-purple-500 hover:shadow-lg
                transform hover:-translate-y-0.5"
                required
              />
            </div>

            {/* Tasks Completed */}
            <div className="group">
              <label htmlFor="task" className="block text-sm font-medium text-gray-300 mb-2 group-hover:text-purple-400 transition-colors duration-300">
                Tasks Completed Today <span className="text-red-500">*</span>
              </label>
              <textarea
                id="task"
                name="task"
                value={formData.task}
                onChange={handleChange}
                placeholder="List the tasks you completed today"
                rows={4}
                className="w-full bg-[#262d40] border border-gray-600 rounded-md px-4 py-3 text-white placeholder-gray-400 
                focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent 
                transition-all duration-300 ease-in-out
                hover:bg-[#2a3347] hover:border-purple-500 hover:shadow-lg
                transform hover:-translate-y-0.5
                resize-none"
                required
              />
            </div>

            {/* Blockers */}
            <div className="group">
              <label htmlFor="blockers" className="block text-sm font-medium text-gray-300 mb-2 group-hover:text-purple-400 transition-colors duration-300">
                Blockers (if any)
              </label>
              <textarea
                id="blockers"
                name="blockers"
                value={formData.blockers}
                onChange={handleChange}
                placeholder="Describe any challenges or blockers you encountered"
                rows={4}
                className="w-full bg-[#262d40] border border-gray-600 rounded-md px-4 py-3 text-white placeholder-gray-400 
                focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent 
                transition-all duration-300 ease-in-out
                hover:bg-[#2a3347] hover:border-purple-500 hover:shadow-lg
                transform hover:-translate-y-0.5
                resize-none"
              />
            </div>

            {/* Task Status */}
            <div className="group">
              <label htmlFor="status" className="block text-sm font-medium text-gray-300 mb-2 group-hover:text-purple-400 transition-colors duration-300">
                Task Status <span className="text-red-500">*</span>
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
                <option value="">Select status</option>
                <option value="completed">Completed</option>
                <option value="in-progress">In Progress</option>
                <option value="stuck">Stuck</option>
              </select>
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Help Needed */}
            <div className="group">
              <label htmlFor="help" className="block text-sm font-medium text-gray-300 mb-2 group-hover:text-purple-400 transition-colors duration-300">
                Help Needed
              </label>
              <textarea
                id="help"
                name="help"
                value={formData.help}
                onChange={handleChange}
                placeholder="Describe what kind of help you need"
                rows={4}
                className="w-full bg-[#262d40] border border-gray-600 rounded-md px-4 py-3 text-white placeholder-gray-400 
                focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent 
                transition-all duration-300 ease-in-out
                hover:bg-[#2a3347] hover:border-purple-500 hover:shadow-lg
                transform hover:-translate-y-0.5
                resize-none"
              />
            </div>

            {/* Additional Notes */}
            <div className="group">
              <label htmlFor="notes" className="block text-sm font-medium text-gray-300 mb-2 group-hover:text-purple-400 transition-colors duration-300">
                Additional Notes
              </label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Any additional comments or notes"
                rows={4}
                className="w-full bg-[#262d40] border border-gray-600 rounded-md px-4 py-3 text-white placeholder-gray-400 
                focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent 
                transition-all duration-300 ease-in-out
                hover:bg-[#2a3347] hover:border-purple-500 hover:shadow-lg
                transform hover:-translate-y-0.5
                resize-none"
              />
            </div>

            {/* Submit Button */}
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
                  'Submit Update'
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