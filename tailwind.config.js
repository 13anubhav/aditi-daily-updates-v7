/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#1a1f2e',
        foreground: '#ffffff',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-in-out forwards',
        'slide-up': 'slideUp 0.5s ease-out forwards',
        'pulse-custom': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
      boxShadow: {
        'custom-light': '0 0 15px rgba(255, 255, 255, 0.1)',
        'custom-purple': '0 0 15px rgba(139, 92, 246, 0.3)',
      },
      screens: {
        'xs': '480px',
      },
    },
  },
  plugins: [],
}; 