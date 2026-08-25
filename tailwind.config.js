/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Pretendard',
          '"Apple SD Gothic Neo"',
          '"Noto Sans KR"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      fontSize: {
        'xxs': ['10px', '1.2'],
        '2xs': ['10.5px', '1.3'],
      },
      colors: {
        kb: {
          yellow: '#FFD200',
          'yellow-dark': '#E5BD00',
          'yellow-tint': '#FFF7CC',
          'yellow-bg': '#FFFBEE',
        },
        ink: {
          DEFAULT: '#1A1A1A',
          dark: '#333333',
          mid: '#666666',
          light: '#999999',
        },
        line: {
          DEFAULT: '#D9D9D9',
          soft: '#EDEDED',
        },
        surface: {
          DEFAULT: '#F7F7F8',
          soft: '#FAFAFA',
        },
        ok: {
          DEFAULT: '#1B8A4D',
          bg: '#E8F5EE',
          border: '#B8DCC6',
        },
        warn: {
          DEFAULT: '#C9760F',
          bg: '#FFF6E5',
          border: '#F4D89F',
        },
        bad: {
          DEFAULT: '#D8313D',
          bg: '#FCE9EC',
          border: '#F4C8D0',
        },
        info: {
          DEFAULT: '#1F5BB8',
          bg: '#E8F0FF',
          border: '#C5D6F6',
        },
        accent: {
          purple: '#6E3BBD',
          'purple-bg': '#F4ECFF',
          'purple-border': '#D9C4F2',
          brown: '#6B4F2A',
          'brown-bg': '#F4ECDB',
          'brown-border': '#DCC9A6',
        },
      },
    },
  },
  plugins: [],
};
