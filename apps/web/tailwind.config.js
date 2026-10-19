/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Terracotta & Ink core token palette
        bg: 'var(--bg)',
        surface: {
          DEFAULT: 'var(--surface)',
          2: 'var(--surface-2)',
          3: 'var(--surface-3)',
        },
        border: {
          DEFAULT: 'var(--border)',
          hairline: 'var(--border)',
          subtle: 'var(--border-subtle)',
        },
        text: {
          DEFAULT: 'var(--text)',
          muted: 'var(--text-muted)',
          faint: 'var(--text-faint)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          soft: 'var(--accent-soft)',
          glow: 'var(--accent-glow)',
        },
        terracotta: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          soft: 'var(--accent-soft)',
        },
        brass: {
          DEFAULT: 'var(--brass)',
        },
        pine: {
          DEFAULT: 'var(--success)',
        },
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',

        // Slate mappings forwarded to architectural tones
        slate: {
          50: '#FBF8F2',
          100: '#F5F0E6',
          200: '#EFE8DA',
          300: '#DDD3BF',
          400: '#A39A88',
          500: '#6B6355',
          600: '#524B40',
          700: '#3A332B',
          800: '#26211B',
          900: '#1C1814',
          950: '#14110E',
        },
        primary: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
          light: 'var(--accent-soft)',
          border: 'var(--border)',
        },
      },
      fontFamily: {
        sans: ['"Instrument Sans"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        serif: ['Fraunces', 'Georgia', 'serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', '"IBM Plex Mono"', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '8px',
        sm: '4px',
        md: '8px',
        lg: '10px',
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
