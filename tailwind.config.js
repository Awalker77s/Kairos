/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FAF7F2',
        'cream-dark': '#F0EAE0',
        gold: '#C9A84C',
        'gold-light': '#D4AF6A',
        'gold-dark': '#B8953F',
        cognac: '#6B3F2A',
        'cognac-light': '#8B5E3C',
        'warm-black': '#1C1410',
        'warm-white': '#FFFDF9',
        'warm-stone': '#9C8E82',
        'warm-border': '#E8E0D4',
      },
      fontFamily: {
        serif: ['Playfair Display', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
