/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cinema: {
          950: '#06070a',
          900: '#0c0e14',
          850: '#11141e',
          800: '#181c28',
          700: '#23293a',
          red: '#e50914',
          gold: '#f5c518',
          neon: '#00f2fe',
        }
      },
      keyframes: {
        float: {
          '0%': { transform: 'translateY(0) scale(0.8)', opacity: '1' },
          '100%': { transform: 'translateY(-260px) scale(1.4)', opacity: '0' },
        },
        'cinema-glow': {
          '0%, 100%': { opacity: '0.45', transform: 'scale(1)' },
          '50%': { opacity: '0.75', transform: 'scale(1.02)' },
        },
        'marquee': {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        }
      },
      animation: {
        float: 'float 2.5s ease-out forwards',
        'cinema-glow': 'cinema-glow 6s ease-in-out infinite',
        'marquee': 'marquee 25s linear infinite',
      },
      boxShadow: {
        'cinema': '0 0 50px -10px rgba(229, 9, 20, 0.35)',
        'screen': '0 20px 60px -15px rgba(0, 0, 0, 0.9), 0 0 40px -10px rgba(229, 9, 20, 0.25)',
        'neon': '0 0 20px rgba(0, 242, 254, 0.35)',
      }
    },
  },
  plugins: [],
}
