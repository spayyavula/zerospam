/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // CSS-variable colors so a single `data-theme` switch on <html>
  // re-themes the entire app without touching markup.
  theme: {
    extend: {
      colors: {
        zsbg: 'rgb(var(--zsbg) / <alpha-value>)',
        zspanel: 'rgb(var(--zspanel) / <alpha-value>)',
        zsborder: 'rgb(var(--zsborder) / <alpha-value>)',
        zsmuted: 'rgb(var(--zsmuted) / <alpha-value>)',
        zstext: 'rgb(var(--zstext) / <alpha-value>)',
        zsaccent: 'rgb(var(--zsaccent) / <alpha-value>)',
        zsdanger: 'rgb(var(--zsdanger) / <alpha-value>)',
        zsok: 'rgb(var(--zsok) / <alpha-value>)',
      },
    },
  },
  plugins: [],
};
