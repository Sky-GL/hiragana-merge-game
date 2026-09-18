/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        round: ['"Zen Maru Gothic"', '"M PLUS Rounded 1c"', 'sans-serif'],
      },
      keyframes: {
        swing: { '0%,100%': { transform: 'translateX(-38px) rotate(-8deg)' }, '50%': { transform: 'translateX(38px) rotate(8deg)' } },
        pop:   { '0%': { transform: 'scale(0.6)', opacity: '0' }, '60%': { transform: 'scale(1.08)', opacity: '1' }, '100%': { transform: 'scale(1)' } },
        floaty:{ '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
      },
      animation: {
        swing: 'swing 1.6s ease-in-out infinite',
        pop: 'pop 0.45s cubic-bezier(0.34,1.56,0.64,1) both',
        floaty: 'floaty 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
