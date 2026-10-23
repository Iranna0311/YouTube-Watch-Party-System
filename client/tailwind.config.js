/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      keyframes: {
        float: {
          '0%': { transform: 'translateY(0) scale(0.8)', opacity: '1' },
          '100%': { transform: 'translateY(-260px) scale(1.4)', opacity: '0' },
        },
      },
      animation: {
        float: 'float 2.5s ease-out forwards',
      },
    },
  },
  plugins: [],
}
