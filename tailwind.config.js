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
      // 레퍼런스는 모서리를 거의 굴리지 않는다. 스케일만 재정의해
      // rounded-* 클래스를 한 줄도 고치지 않고 전 화면 마감을 각지게 만든다.
      borderRadius: {
        sm: '1px',
        DEFAULT: '2px',
        md: '2px',
        lg: '3px',
        xl: '4px',
      },
      colors: {
        // 브랜드 팔레트 — BNK 부산은행 웹 실측 (docs/design.md §1).
        // ⚠️ brand·brand-dark 위에는 반드시 text-white.
        //    원본 mockup은 밝은 배경+어두운 텍스트 구조였으나 레드로 전환하며
        //    해당 조합 180여 곳의 텍스트를 흰색으로 반전했다.
        brand: {
          DEFAULT: '#CB2C10',
          dark: '#A82410',
          strong: '#FF3312',
          tint: '#FBE9E6',
          bg: '#FDF6F4',
        },
        ink: {
          DEFAULT: '#212121',
          dark: '#333333',
          mid: '#666666',
          light: '#999999',
        },
        line: {
          DEFAULT: '#E0E0E1',
          soft: '#EFEFEF',
          warm: '#D3D3D0',
          strong: '#212121',
        },
        surface: {
          DEFAULT: '#F6F6F6',
          soft: '#FBF9FA',
        },
        // 배너·강조 블록에 쓰는 웜 그레이 (레퍼런스 #EFEEEB)
        warm: '#EFEEEB',
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
          bg: '#E8F0FB',
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
