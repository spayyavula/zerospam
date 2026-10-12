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
        // Reading Room v2 tokens
        paper: 'var(--paper)',
        'paper-deep': 'var(--paper-deep)',
        ink: 'var(--ink)',
        'ink-soft': 'var(--ink-soft)',
        quiet: 'var(--quiet)',
        rule: 'var(--rule)',
        'rule-strong': 'var(--rule-strong)',
        signal: 'var(--signal)',
        'signal-ink': 'var(--signal-ink)',
      },
      fontFamily: {
        // Quoted: Tailwind emits family names verbatim, and an unquoted name containing a
        // token that starts with a digit ("Source Serif 4") is invalid CSS, so the browser
        // would drop the whole font-family declaration and fall back to sans.
        display: ['"Source Serif 4 Variable"', '"Source Serif 4"', '"Iowan Old Style"', 'Georgia', 'serif'],
        body: ['Geist Variable', 'Geist', 'Helvetica Neue', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono Variable', 'JetBrains Mono', 'ui-monospace', 'SF Mono', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
