/**
 * 데모 세계관의 '오늘' — 모든 mock 이 같은 날짜축을 쓰게 하는 단일 출처.
 *
 * 왜 상수로 박는가 —
 *   시연은 **2026-09-09**에 하고 리허설은 그 며칠 전에 한다. mock 안에서
 *   `new Date()` 를 부르면 리허설 날과 본 시연 날의 화면이 달라지고, 옆 카드는
 *   고정 문자열이라 같은 화면 안에서 날짜가 두 갈래로 갈린다. **리허설에서는
 *   절대 안 잡히는 유형**이라 아예 실시간 시계를 mock 에서 걷어냈다.
 *
 * 왜 2026-06-03 인가 —
 *   관리자 통합 대시보드(`mockAdminDashboard.DASHBOARD_TODAY`)가 이 날짜로 30일
 *   시계열 X축을 만들고, 통합 감사 원장(`mockSecurityGovernance`)의 최신 행도
 *   같은 날이다. 시연 정거장 10·13(관리자 대시보드)이 데모에서 가장 넓은 면적을
 *   차지하는 '오늘'이므로 그 쪽에 나머지를 맞췄다.
 *
 * ⚠️ **`DASHBOARD_TODAY` 와 항상 같은 값이어야 한다.** 한쪽만 고치면 정거장 13
 *    (가드레일 이력) → 14(거버넌스 기준일) 사이에서 기준일이 점프한다.
 *    여기서 import 하지 않는 이유는 `mockAdminDashboard` 가 카탈로그·과제 원장을
 *    끌어오는 무거운 모듈이라 순환 참조를 만들기 쉬워서다.
 */

/** 데모 세계관의 '오늘' (YYYY-MM-DD). */
export const DEMO_TODAY = '2026-06-03';

/** 화면 라벨용 — "2026년 6월 3일". */
export const DEMO_TODAY_LABEL = '2026년 6월 3일';

/** 'YYYY-MM-DD' 를 UTC 자정 Date 로. 시간대 흔들림을 막으려고 UTC 로 고정한다. */
function parseIso(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 기준일에서 days 만큼 이동한 날짜. 시연 데이터 생성 보조용. */
export function shiftIso(iso: string, days: number): string {
  const d = parseIso(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}

/** DEMO_TODAY 기준 남은 일수. 음수면 이미 경과. */
export function dDayFrom(iso: string): number {
  const MS = 86_400_000;
  return Math.round((parseIso(iso).getTime() - parseIso(DEMO_TODAY).getTime()) / MS);
}

/** DEMO_TODAY 기준으로 offset 일 떨어진 날짜. 음수면 과거. */
export function fromToday(days: number): string {
  return shiftIso(DEMO_TODAY, days);
}
