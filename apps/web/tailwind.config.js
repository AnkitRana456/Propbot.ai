/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563eb',
          hover: '#1d4ed8',
          light: '#eff6ff',
          border: '#bfdbfe',
        },
        slate: {
          50: 'rgb(var(--color-slate-50) / <alpha-value>)',
          100: 'rgb(var(--color-slate-100) / <alpha-value>)',
          200: 'rgb(var(--color-slate-200) / <alpha-value>)',
          300: 'rgb(var(--color-slate-300) / <alpha-value>)',
          400: 'rgb(var(--color-slate-400) / <alpha-value>)',
          500: 'rgb(var(--color-slate-500) / <alpha-value>)',
          600: 'rgb(var(--color-slate-600) / <alpha-value>)',
          700: 'rgb(var(--color-slate-700) / <alpha-value>)',
          800: 'rgb(var(--color-slate-800) / <alpha-value>)',
          900: 'rgb(var(--color-slate-900) / <alpha-value>)',
          950: 'rgb(var(--color-slate-950) / <alpha-value>)',
        },
        cue: {
          bg: '#141414',
          sidebar: '#1a1a1a',
          card: '#1c1c1c',
          border: '#2a2a2a',
          edge: '#262626',
          pill: '#1f1f1f',
          active: '#292929',
          hover: '#222222',
          text: '#e6e6e6',
          label: '#a3a3a3',
          muted: '#8a8a8a',
          green: '#4ade80',
          red: '#f87171',
          blue: '#4a8fe7',
          prevBlue: '#2f5f9e',
          barBlue: '#0b74e5',
        },
        surface: {
          DEFAULT: '#ffffff',
          dark: 'rgb(var(--color-slate-900) / <alpha-value>)',
          card: '#ffffff',
          cardDark: 'rgb(var(--color-slate-900) / <alpha-value>)',
        },
        border: {
          light: '#e2e8f0',
          dark: 'rgb(var(--color-slate-800) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        xl: '0.75rem',
      },
    },
  },
  plugins: [],
};
