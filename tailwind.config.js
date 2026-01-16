/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './views/**/*.{ejs,html}',
    './public/**/*.{js,html}',
  ],
  theme: {
    colors: {
      inherit: 'inherit',
      current: 'currentColor',
      transparent: 'transparent',
      white: '#ffffff',
      black: '#000000',
      gray: {
        50: 'oklch(98.5% 0.002 247.839)',
        100: 'oklch(96.7% 0.003 264.542)',
        200: 'oklch(92.8% 0.006 264.531)',
        300: 'oklch(87.2% 0.01 258.338)',
        400: 'oklch(70.7% 0.022 261.325)',
        500: 'oklch(55.1% 0.027 264.364)',
        600: 'oklch(44.6% 0.03 256.802)',
        700: 'oklch(37.3% 0.034 259.733)',
        800: 'oklch(27.8% 0.033 256.848)',
        900: 'oklch(21% 0.034 264.665)',
        950: 'oklch(13% 0.028 261.692)',
      },
      'node-green': '#68A063',
      'node-dark': '#333333',
    },
    extend: {}
  },
  plugins: [],
  darkMode: 'class',
}
