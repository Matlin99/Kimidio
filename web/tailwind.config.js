/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          dark: '#0F0B0E',
          darker: '#1A1216',
          light: '#FFFFFF',
          cream: '#F4EEF0',
          pink: '#E8D7DB',
          rose: '#B0666D',
        },
        gradient: {
          yellow: '#FFD89B',
          pink: '#FFA7A7',
          blue: '#A7C4FF',
          gray: '#C7D6E0',
        },
        neutral: {
          600: '#6B6B6B',
          400: '#A0A0A0',
          200: '#CFCFCF',
          100: '#EEEEEE',
        },
      },
      fontFamily: {
        sans: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['VT323', 'Share Tech Mono', 'monospace'],
        display: ['VT323', 'monospace'],
        artistic: ['Playfair Display', 'serif'],
        grotesk: ['Space Grotesk', 'sans-serif'],
      },
      fontSize: {
        'display': ['48px', { lineHeight: '1', fontWeight: '700' }],
        'title': ['24px', { lineHeight: '1.2', fontWeight: '700' }],
        'subtitle': ['14px', { lineHeight: '1.4', fontWeight: '500' }],
        'body': ['12px', { lineHeight: '1.6', fontWeight: '400' }],
        'caption': ['11px', { lineHeight: '1.4', fontWeight: '400' }],
        'label': ['11px', { lineHeight: '1.4', fontWeight: '400' }],
      },
      spacing: {
        '8': '8px',
        '12': '12px',
        '16': '16px',
        '24': '24px',
        '32': '32px',
      },
      borderRadius: {
        'card': '24px',
        'button': '8px',
        'small': '4px',
        'widget': '16px',
      },
      boxShadow: {
        'card': '0 20px 40px rgba(0,0,0,0.08)',
        'glow': '0 0 8px 2px rgba(255,255,255,0.8), 0 0 16px 4px rgba(255,255,255,0.4)',
        'glow-dark': '0 0 8px 2px rgba(176,102,109,0.6), 0 0 16px 4px rgba(176,102,109,0.3)',
      },
      width: {
        'card': '520px',
        'widget-sm': '120px',
        'widget-lg': '160px',
        'widget-mini': '90px',
      },
      height: {
        'card': '740px',
        'widget-sm': '120px',
        'widget-lg': '160px',
        'widget-mini': '36px',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      transitionDuration: {
        '400': '400ms',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'float-delayed': 'float 6s ease-in-out 2s infinite',
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
        'wave': 'wave 1.2s ease-in-out infinite',
        'wave-bar': 'waveBar 0.8s ease-in-out infinite alternate',
        'loading-pulse': 'loadingPulse 2s ease-in-out infinite',
        'fade-in': 'fadeIn 0.5s ease-out-expo forwards',
        'slide-up': 'slideUp 0.5s ease-out-expo forwards',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.4', transform: 'scale(0.7)' },
        },
        wave: {
          '0%, 100%': { transform: 'scaleY(0.5)' },
          '50%': { transform: 'scaleY(1)' },
        },
        waveBar: {
          '0%': { transform: 'scaleY(0.3)' },
          '100%': { transform: 'scaleY(1)' },
        },
        loadingPulse: {
          '0%, 100%': { opacity: '0.4', transform: 'scale(0.95)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px) scale(0.97)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
    },
  },
  plugins: [],
}
