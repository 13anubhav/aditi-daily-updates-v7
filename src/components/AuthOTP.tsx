import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'react-hot-toast';

export default function AuthOTP() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
          shouldCreateUser: true,
          data: {
            session_expiry: 604800
          }
        },
      });
      
      if (error) throw error;
      
      setOtpSent(true);
      toast.success('OTP sent to your email. Please check your inbox.');
    } catch (error: any) {
      console.error('OTP error:', error);
      toast.error(error.message || 'Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1a1f2e] px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-[#1e2538] p-8 rounded-xl shadow-2xl">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            {otpSent ? 'Check your email' : 'Sign in to your account'}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-300">
            {otpSent 
              ? 'We\'ve sent a magic link to your email. Click the link to sign in.' 
              : 'Enter your email to receive a one-time password'}
          </p>
        </div>
        
        {!otpSent ? (
          <form className="mt-8 space-y-6" onSubmit={handleSendOTP}>
            <div className="rounded-md -space-y-px">
              <div>
                <label htmlFor="email-address" className="sr-only">Email address</label>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="appearance-none rounded-lg relative block w-full px-3 py-3 border border-gray-600 placeholder-gray-400 text-white bg-[#262d40] focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-70 disabled:cursor-not-allowed transition-colors duration-200"
              >
                {isLoading ? 'Sending...' : 'Send Magic Link'}
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-8 text-center">
            <div className="rounded-full mx-auto w-20 h-20 bg-purple-900 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="mt-4 text-sm text-gray-300">
              The magic link will expire in 10 minutes. If you don't see the email, please check your spam folder.
            </p>
            <button
              onClick={() => setOtpSent(false)}
              className="mt-6 text-purple-400 hover:text-purple-300 text-sm font-medium transition-colors duration-200"
            >
              Try again with a different email
            </button>
          </div>
        )}

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-[#1e2538] text-gray-400">
                Secure login powered by Supabase
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 