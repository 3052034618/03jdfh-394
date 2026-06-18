/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        horror: {
          bg: '#0d0d1a',
          surface: '#1a1a2e',
          panel: '#16213e',
          border: '#2a2a4a',
          text: '#e8e8e8',
          muted: '#8888aa',
          rust: '#c84b31',
          'rust-light': '#e05a3a',
          'rust-dark': '#8b3420',
          accent: '#4a9eff',
          success: '#2ecc71',
          warning: '#f39c12',
          danger: '#e74c3c',
        },
      },
      fontFamily: {
        creep: ['Creepster', 'cursive'],
        mono: ['JetBrains Mono', 'monospace'],
        sans: ['Noto Sans SC', 'sans-serif'],
      },
      animation: {
        'pulse-rust': 'pulseRust 2s ease-in-out infinite',
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'slide-in-up': 'slideInUp 0.3s ease-out',
        'typewriter': 'typewriter 0.05s steps(1) forwards',
        'shake': 'shake 0.3s ease-in-out',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        pulseRust: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(200, 75, 49, 0.4)' },
          '50%': { boxShadow: '0 0 0 12px rgba(200, 75, 49, 0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideInRight: {
          from: { transform: 'translateX(20px)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        slideInUp: {
          from: { transform: 'translateY(20px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-4px)' },
          '75%': { transform: 'translateX(4px)' },
        },
        glow: {
          from: { textShadow: '0 0 4px rgba(200,75,49,0.3)' },
          to: { textShadow: '0 0 12px rgba(200,75,49,0.6)' },
        },
      },
    },
  },
  plugins: [],
};
