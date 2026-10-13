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
        surface: {
          DEFAULT: '#ffffff',
          dark: '#0f172a',
          card: '#ffffff',
          cardDark: '#1e293b',
        },
        border: {
          light: '#e2e8f0',
          dark: '#334155',
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
