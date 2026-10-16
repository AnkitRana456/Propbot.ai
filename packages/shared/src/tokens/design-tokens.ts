/**
 * PropBot Pro — Aurora Estate Design Tokens
 * Single source of truth for color palettes, typography, spacing, border radii, shadows, and motion curves.
 * Shared between apps/web and packages/widget.
 */

export const auroraColors = {
  // Brand Core
  navy: {
    50: '#F0F4FA',
    100: '#D9E3F3',
    200: '#B3C8E7',
    300: '#83A6D6',
    400: '#4F7EC0',
    500: '#2558A5',
    600: '#1B4282',
    700: '#143061',
    800: '#102246',
    900: '#0B1B3A', // Primary Dark Brand Surface & Text
    950: '#060E1F', // Deepest Canvas Midnight
  },
  blue: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    200: '#BFDBFE',
    300: '#93C5FD',
    400: '#60A5FA',
    500: '#3B82F6',
    600: '#2563EB', // Primary Brand CTA & Focus
    700: '#1D4ED8',
    800: '#1E40AF',
    900: '#1E3A8A',
    950: '#172554',
  },
  mint: {
    50: '#F0FDFA',
    100: '#CCFBF1',
    200: '#99F6E4',
    300: '#5EEAD4',
    400: '#2DD4BF',
    500: '#14B8A6', // Success, Verified, RERA Registered
    600: '#0D9488',
    700: '#0F766E',
    800: '#115E59',
    900: '#134E4A',
    950: '#042F2E',
  },
  sand: {
    50: '#FAF8F5',
    100: '#F6F1E7', // Warm Sand Background
    200: '#EDE4D2',
    300: '#E1D3B8',
    400: '#CFBC98',
    500: '#BCA379',
    600: '#A4895F',
    700: '#836C4A',
    800: '#67553C',
    900: '#504332',
    950: '#2B2319',
  },
  gold: {
    50: '#FEFCE8',
    100: '#FEF9C3',
    200: '#FEF08A',
    300: '#FDE047',
    400: '#FACC15',
    500: '#F5B942', // Hot Lead, High Intent, VIP
    600: '#D97706',
    700: '#B45309',
    800: '#92400E',
    900: '#78350F',
    950: '#451A03',
  },
  rose: {
    50: '#FFF1F2',
    100: '#FFE4E6',
    200: '#FECDD3',
    300: '#FDA4AF',
    400: '#FB7185',
    500: '#F43F5E',
    600: '#E11D48', // Alerts, SLA Breach Warning, Kill Switch
    700: '#BE123C',
    800: '#9F1239',
    900: '#881337',
    950: '#4C0519',
  },
  // Neutrals for dark & light surfaces
  surfaces: {
    light: {
      canvas: '#F8FAFC',
      card: '#FFFFFF',
      subtle: '#F1F5F9',
      border: '#E2E8F0',
      textPrimary: '#0B1B3A',
      textSecondary: '#64748B',
      textMuted: '#94A3B8',
    },
    dark: {
      canvas: '#070F1E', // Dark Midnight Canvas
      card: '#0B1B3A',   // Navy Card Surface
      subtle: '#102246', // Elevated Sub-surface
      border: '#182F5D', // Thin Subtle Indigo-Navy Border
      textPrimary: '#F8FAFC',
      textSecondary: '#94A3B8',
      textMuted: '#64748B',
    },
  },
} as const;

export const auroraTypography = {
  fontSans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontDisplay: '"Plus Jakarta Sans", "Sora", Inter, sans-serif',
  fontMono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  scale: {
    xs: '0.75rem',   // 12px
    sm: '0.875rem',  // 14px
    base: '1rem',    // 16px
    lg: '1.25rem',   // 20px
    xl: '1.75rem',   // 28px
    '2xl': '2.5rem', // 40px
  },
} as const;

export const auroraRadii = {
  sm: '0.375rem', // 6px
  md: '0.5rem',   // 8px
  lg: '0.75rem',  // 12px (Standard card/input)
  xl: '1rem',     // 16px
  '2xl': '1.25rem', // 20px (Hero/feature panels)
  full: '9999px',
} as const;

export const auroraShadows = {
  sm: '0 1px 2px 0 rgba(11, 27, 58, 0.05)',
  md: '0 4px 6px -1px rgba(11, 27, 58, 0.08), 0 2px 4px -2px rgba(11, 27, 58, 0.05)',
  lg: '0 10px 15px -3px rgba(11, 27, 58, 0.08), 0 4px 6px -4px rgba(11, 27, 58, 0.04)',
  glowBlue: '0 0 20px -3px rgba(37, 99, 235, 0.35)',
  glowGold: '0 0 20px -3px rgba(245, 185, 66, 0.40)',
  glowMint: '0 0 20px -3px rgba(20, 184, 166, 0.35)',
} as const;

export const auroraTransitions = {
  default: '150ms cubic-bezier(0.16, 1, 0.3, 1)',
  smooth: '250ms cubic-bezier(0.16, 1, 0.3, 1)',
} as const;
