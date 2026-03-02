/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'brand-orange': '#FF6A00',
        'brand-black': '#0A0A0A',
        charcoal: '#1A1A1A',
        'warm-gray': '#2A2A2A',
        amber: '#FFB366',
        'off-white': '#F5F0EB',
        stone: '#8C8279',
      },
    },
  },
  plugins: [],
}
