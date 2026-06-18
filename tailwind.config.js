/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f5f7ff',
          100: '#ebf0ff',
          200: '#d6e0ff',
          300: '#a3b8ff',
          400: '#6690ff',
          500: '#007AFF',
          600: '#0066D6',
          700: '#0055B3',
          800: '#004499',
          900: '#003380',
          950: '#002266',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"SF Pro Text"',
          '"Helvetica Neue"', 'Arial', '"Noto Sans SC"', 'system-ui', 'sans-serif',
        ],
        mono: [
          '"SF Mono"', '"SFMono-Regular"', '"JetBrains Mono"', '"Fira Code"',
          'Menlo', 'Monaco', 'Consolas', 'monospace',
        ],
      },
      boxShadow: {
        'mac-sm': '0 1px 2px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.04)',
        'mac-md': '0 4px 12px rgba(0,0,0,0.06), 0 0 0 0.5px rgba(0,0,0,0.04)',
        'mac-lg': '0 8px 24px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(0,0,0,0.04)',
        'mac-xl': '0 16px 48px rgba(0,0,0,0.1), 0 0 0 0.5px rgba(0,0,0,0.04)',
      },
      borderRadius: {
        'mac': '8px',
        'mac-lg': '12px',
      },
    },
  },
  plugins: [],
};
