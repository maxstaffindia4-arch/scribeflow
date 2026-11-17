/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Nunito Sans', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        canvas: {
          50: '#fbfaff',
          100: '#f0eef6',
          200: '#e2dfed',
          300: '#d5d1e2',
        },
        ink: {
          50: '#ffffff',
          100: '#faf9fd',
          200: '#f3f1f9',
          300: '#e3e0ed',
          400: '#c8c3d7',
          500: '#8f89a5',
          600: '#6b6483',
          700: '#51496f',
          800: '#35265f',
          900: '#28165f',
          950: '#1d104d',
        },
        brand: {
          50: '#f4efff',
          100: '#e8dcff',
          200: '#d1bcff',
          300: '#b493ff',
          400: '#9569f5',
          500: '#7444e8',
          600: '#6331d4',
          700: '#5223b5',
          800: '#411d8c',
          900: '#32176f',
        },
        accent: {
          50: '#e9fffc',
          100: '#c7fff8',
          200: '#8ff9eb',
          300: '#5cebdd',
          400: '#26d9cb',
          500: '#08c3b7',
          600: '#009e96',
        },
        warn: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        err: {
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
        },
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(116,68,232,0.22), 0 8px 30px -4px rgba(116,68,232,0.28)',
        card: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -8px rgba(15,23,42,0.10)',
        soft: '0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)',
        pop: '0 12px 40px -8px rgba(15,23,42,0.18), 0 4px 12px -4px rgba(15,23,42,0.08)',
        lift: '0 20px 50px -12px rgba(15,23,42,0.22)',
        innerGlow: 'inset 0 1px 0 0 rgba(255,255,255,0.6)',
      },
      keyframes: {
        pulseRing: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(116,68,232,0.30), 0 0 0 0 rgba(116,68,232,0.10)' },
          '50%': { boxShadow: '0 0 0 10px rgba(116,68,232,0.06), 0 0 0 4px rgba(116,68,232,0.12)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-120%)' },
          '100%': { transform: 'translateX(220%)' },
        },
        spinSlow: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInFast: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        spotlight: {
          '0%, 100%': { boxShadow: '0 0 0 3px rgba(116,68,232,0.55), 0 0 30px 8px rgba(116,68,232,0.30)' },
          '50%': { boxShadow: '0 0 0 5px rgba(116,68,232,0.75), 0 0 50px 16px rgba(116,68,232,0.45)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
      animation: {
        pulseRing: 'pulseRing 2.6s ease-in-out infinite',
        shimmer: 'shimmer 1.8s linear infinite',
        spinSlow: 'spinSlow 1.2s linear infinite',
        fadeIn: 'fadeIn 0.35s ease-out',
        fadeInFast: 'fadeInFast 0.2s ease-out',
        spotlight: 'spotlight 2.2s ease-in-out infinite',
        float: 'float 4s ease-in-out infinite',
        gradientShift: 'gradientShift 8s ease infinite',
      },
      backgroundImage: {
        'grid-faint':
          'linear-gradient(to right, rgba(15,23,42,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.04) 1px, transparent 1px)',
        'mesh': 'radial-gradient(at 0% 0%, rgba(116,68,232,0.13) 0px, transparent 50%), radial-gradient(at 100% 0%, rgba(8,195,183,0.10) 0px, transparent 50%), radial-gradient(at 50% 100%, rgba(149,105,245,0.08) 0px, transparent 50%)',
      },
    },
  },
  plugins: [],
};
