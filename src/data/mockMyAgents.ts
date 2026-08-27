/**
 * My Agent · 최근 이용서비스 mock.
 *
 * RFP 2-1 사용자 포털: "사용자별 My Agent, 즐겨찾기, 최근 이용서비스 등 개인화 기능 제공"
 * 전부 가상 창작물이다(CLAUDE.md 절대 규칙).
 */

export interface MyAgentItem {
  id: string;
  name: string;
  desc: string;
  lastUsedAt: string;
  /** 클릭 시 이동할 경로 — 개인화 카드는 표시용이 아니라 실행 진입점이다. */
  href: string;
}

export const MY_AGENTS: MyAgentItem[] = [
  { id: 'AGT-301', name: '보이스피싱 1차 분류 에이전트', desc: '통화 내용 위험도 점수 산출', lastUsedAt: '오늘 09:12', href: '/catalog' },
  { id: 'AGT-204', name: 'PB 자산진단 어시스턴트', desc: '자산 위험도·분산도 분석', lastUsedAt: '어제 16:40', href: '/chat' },
];

export interface RecentServiceItem {
  id: string;
  name: string;
  kind: '에이전트' | 'MCP' | '워크플로우';
  usedAt: string;
  href: string;
}

export const RECENT_SERVICES: RecentServiceItem[] = [
  { id: 'AGT-301', name: '보이스피싱 1차 분류 에이전트', kind: '에이전트', usedAt: '오늘 09:12', href: '/catalog' },
  { id: 'MCP-011', name: 'authority.lookup', kind: 'MCP', usedAt: '오늘 08:40', href: '/catalog' },
  { id: 'WKF-501', name: '여신 상담 워크플로우', kind: '워크플로우', usedAt: '어제 17:02', href: '/studio/workflow' },
  { id: 'AGT-204', name: 'PB 자산진단 어시스턴트', kind: '에이전트', usedAt: '어제 16:40', href: '/chat' },
];
