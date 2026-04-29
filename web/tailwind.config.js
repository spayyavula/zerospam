/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        zsbg: '#0b0e14',
        zspanel: '#11151c',
        zsborder: '#1f2733',
        zsmuted: '#7c8aa0',
        zstext: '#dbe3ef',
        zsaccent: '#5cc8ff',
        zsdanger: '#ff6b81',
        zsok: '#7fe0a1',
      },
    },
  },
  plugins: [],
};
