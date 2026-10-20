/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ocean: {
          950: '#060d17',
          900: '#0a192f',
          800: '#0f2744',
          700: '#173b64',
          600: '#1e4e85',
        },
        behemoth: {
          hull: '#3b82f6',
          metal: '#1e293b',
          glow: '#60a5fa',
        },
        danger: {
          ram: '#ef4444',
          tilt: '#f97316',
        }
      }
    },
  },
  plugins: [],
}
