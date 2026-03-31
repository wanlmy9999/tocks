/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0A0E1A',
          secondary: '#111827',
          card: '#141B2D',
          hover: '#1E2A45',
        },
        border: { DEFAULT: '#1E2D4A', light: '#2A3C5E' },
        accent: {
          blue: '#3B82F6',
          cyan: '#06B6D4',
          green: '#10B981',
          red: '#EF4444',
          purple: '#8B5CF6',
          amber: '#F59E0B',
        },
      },
      fontFamily: {
        sans: ['Noto Sans SC', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
        display: ['Syne', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      animation: {
        'fade-in': 'fadeInUp 0.4s ease forwards',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'shimmer': 'shimmer 1.5s infinite',
      },
    },
  },
  plugins: [],
};
