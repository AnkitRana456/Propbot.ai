/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Terracotta & Ink core token palette
        bg: 'rgb(var(--bg-rgb) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--surface-rgb) / <alpha-value>)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
        },
        border: {
          DEFAULT: 'rgb(var(--border-rgb) / <alpha-value>)',
          hairline: 'var(--border)',
          subtle: 'var(--border-subtle)',
        },
        text: {
          DEFAULT: 'rgb(var(--text-rgb) / <alpha-value>)',
          muted: 'var(--text-muted)',
          faint: 'var(--text-faint)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent-rgb) / <alpha-value>)',
          hover: 'var(--accent-hover)',
          soft: 'var(--accent-soft)',
          glow: 'var(--accent-glow)',
        },
        terracotta: {
          DEFAULT: 'rgb(var(--accent-rgb) / <alpha-value>)',
          hover: 'var(--accent-hover)',
          soft: 'var(--accent-soft)',
        },
        brass: {
          DEFAULT: 'rgb(var(--brass-rgb) / <alpha-value>)',
        },
        pine: {
          DEFAULT: 'rgb(var(--success-rgb) / <alpha-value>)',
        },
        'on-accent': 'var(--on-accent)',
        success: 'rgb(var(--success-rgb) / <alpha-value>)',
        warning: 'rgb(var(--warning-rgb) / <alpha-value>)',
        danger: 'rgb(var(--danger-rgb) / <alpha-value>)',

        // Slate mappings forwarded to architectural tones
        // Neutral scale aligned with the design tokens (light surfaces 50-200, dark surfaces 700-950)
        slate: {
          50: '#FAFAF7',
          100: '#F3F4F1',
          200: '#E6E7E2',
          300: '#D0D3CC',
          400: '#8A93A3',
          500: '#667085',
          600: '#4A5361',
          700: '#2A313B',
          800: '#1D232C',
          900: '#161B22',
          950: '#0E1116',
        },
        // The brand scale also answers to the legacy blue / orange class names used across older screens
        brand: {
          50: '#F0FDFA', 100: '#CCFBF1', 200: '#99F6E4', 300: '#5EEAD4', 400: '#2DD4BF',
          500: '#14B8A6', 600: '#0F766E', 700: '#0B5F58', 800: '#115E59', 900: '#134E4A', 950: '#042F2E',
        },
        blue: {
          50: '#F0FDFA', 100: '#CCFBF1', 200: '#99F6E4', 300: '#5EEAD4', 400: '#2DD4BF',
          500: '#14B8A6', 600: '#0F766E', 700: '#0B5F58', 800: '#115E59', 900: '#134E4A', 950: '#042F2E',
        },
        orange: {
          50: '#F0FDFA', 100: '#CCFBF1', 200: '#99F6E4', 300: '#5EEAD4', 400: '#2DD4BF',
          500: '#14B8A6', 600: '#0F766E', 700: '#0B5F58', 800: '#115E59', 900: '#134E4A', 950: '#042F2E',
        },
        primary: {
          DEFAULT: 'rgb(var(--accent-rgb) / <alpha-value>)',
          hover: 'var(--accent-hover)',
          light: 'var(--accent-soft)',
          border: 'var(--border)',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        serif: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        display: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"IBM Plex Mono"', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '8px',
        sm: '4px',
        md: '8px',
        lg: '12px',
        card: '12px',
        xl: '12px',
        '2xl': '16px',
        full: '9999px',
      },
      boxShadow: {
        'xs': 'var(--shadow-xs)',
        'sm': 'var(--shadow-sm)',
        'md': 'var(--shadow-md)',
        'lg': 'var(--shadow-lg)',
        'xl': 'var(--shadow-xl)',
        'float': 'var(--shadow-float)',
        'inner-glow': 'var(--shadow-inner-glow)',
        'accent-glow': 'var(--shadow-accent-glow)',
        hairline: '0 0 0 1px var(--border)',
        dropdown: 'var(--shadow-xl)',
        modal: 'var(--shadow-float)',
      },
      animation: {
        'fade-in-up': 'fadeInUp 500ms var(--ease-out-expo) both',
        'fade-in-down': 'fadeInDown 400ms var(--ease-out-expo) both',
        'fade-in-scale': 'fadeInScale 400ms var(--ease-out-expo) both',
        'slide-in-right': 'slideInRight 500ms var(--ease-out-expo) both',
        'float-soft': 'floatSoft 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'progress-fill': 'progressFill 800ms var(--ease-out-expo) both',
        'count-up': 'countUp 600ms var(--ease-out-expo) both',
      },
      keyframes: {
        fadeInUp: {
          from: { opacity: 0, transform: 'translateY(12px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        fadeInDown: {
          from: { opacity: 0, transform: 'translateY(-12px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        fadeInScale: {
          from: { opacity: 0, transform: 'scale(0.96)' },
          to: { opacity: 1, transform: 'scale(1)' },
        },
        slideInRight: {
          from: { opacity: 0, transform: 'translateX(20px)' },
          to: { opacity: 1, transform: 'translateX(0)' },
        },
        floatSoft: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 0 0 var(--accent-glow)' },
          '50%': { boxShadow: '0 0 0 8px transparent' },
        },
        progressFill: { from: { width: '0' } },
        countUp: {
          from: { opacity: 0, transform: 'translateY(8px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
      },
      transitionTimingFunction: {
        'out-expo': 'var(--ease-out-expo)',
        'spring': 'var(--ease-spring)',
        'smooth': 'var(--ease-smooth)',
      },
    },
  },
  plugins: [],
};
