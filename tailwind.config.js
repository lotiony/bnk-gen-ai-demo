/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Pretendard Variable',
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
        // 데모용 중립 브랜드 팔레트.
        // 원본의 *명도 구조*를 그대로 승계한다 —
        // DEFAULT·dark 모두 어두운 텍스트(text-ink)를 얹는 밝은 배경이다.
        // 색을 진하게 바꾸면 574개소의 대비가 한꺼번에 깨지므로 명도는 건드리지 말 것.
        brand: {
          DEFAULT: '#9FCFC8',
          dark: '#5FA69C',
          tint: '#E1F0ED',
          bg: '#F3F9F8',
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
