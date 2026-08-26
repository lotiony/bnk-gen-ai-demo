/**
 * 시연 대본 — 핸드오프 §2 의 3막 14화면을 실제 라우트에 붙인 목록.
 *
 * 프리젠터 내비게이션(가이드 §3 M5-2)이 이 배열을 따라 이동한다.
 * **핸드오프 §2 표와 1:1로 맞춰 둔다.** 화면 번호·대응 요건이 여기서 어긋나면
 * 제안서 조견표 상호 참조(가이드 §5 DoD)가 깨진다.
 *
 * 화면 2·3 은 같은 화면이다(포털 Chat 에서 규정·책무를 질의한다). 스펙이 그렇게
 * 쓰여 있어 한 정거장으로 합쳤고, 화면 5(PII 차단)도 같은 라우트지만 시연 동작이
 * 달라 별도 정거장으로 뒀다.
 */
import type { PersonaId } from '@/data/mockPersonas';

export type Act = 1 | 2 | 3;

export interface DemoStop {
  /** 핸드오프 §2 의 화면 번호 표기. */
  screen: string;
  act: Act;
  title: string;
  path: string;
  /** 이 막을 진행하는 페르소나 — 이동 시 자동 전환한다. */
  persona: PersonaId;
  /** 발표자가 이 화면에서 할 동작. HUD 에 그대로 뜬다. */
  cue: string;
  /** 대응 RFP 요건. */
  reqs: string[];
}

export const ACT_LABEL: Record<Act, string> = {
  1: '1막 · 일반 사용자',
  2: '2막 · 개발자 / 승인권자',
  3: '3막 · 운영자 / 거버넌스',
};

const PID = 'PRJ-2025-PB-001';

export const DEMO_STOPS: DemoStop[] = [
  {
    screen: '1', act: 1, title: '그룹 공통 랜딩', path: '/tenants', persona: 'service_user',
    cue: '11개 Namespace 구조를 짚고, 부산은행 카드로 입장한다',
    reqs: ['Ⅱ.3.나(3)', 'SEC-001'],
  },
  {
    screen: '2·3', act: 1, title: '포털 Chat · 규정/책무 질의', path: '/chat', persona: 'service_user',
    cue: '추천 질의를 눌러 답변 → 확정 사실 → 근거 경로 → 규정 원문 순으로 짚는다',
    reqs: ['LSM-002', 'RAG-007', 'AGB-006①'],
  },
  {
    screen: '4', act: 1, title: 'Graph RAG 근거 그래프 ★', path: `/projects/${PID}/tasks/ontology`,
    persona: 'service_user',
    cue: 'Query 탭에서 순회 재생 — "확률적 추측이 아니라 규칙과 계산으로 확정"',
    reqs: ['RAG-007', 'RAG-008'],
  },
  {
    screen: '5', act: 1, title: 'PII 실시간 차단', path: '/chat', persona: 'service_user',
    cue: '⚠ PII 포함 프롬프트 칩을 눌러 입력 단계 차단·마스킹 미리보기를 보여준다',
    reqs: ['SEC-002', 'SEC-003'],
  },
  {
    screen: '6', act: 2, title: '마켓플레이스', path: '/catalog', persona: 'project_owner',
    cue: '종류·공유 범위 필터를 바꿔 보고, 타 계열사 자산의 그룹 공개 요청을 낸다',
    reqs: ['마켓플레이스'],
  },
  {
    screen: '7', act: 2, title: '노코드 워크플로우 빌더', path: `/projects/${PID}/tasks/workflow`,
    persona: 'project_owner',
    cue: '노드를 끌어 옮기고 ▶ 실행 — 조건 분기가 갈려 LLM 노드가 미실행으로 남는다',
    reqs: ['AGB-002', 'AGB-005', 'AGB-008'],
  },
  {
    screen: '8', act: 2, title: 'MCP Tool 자동 등록', path: `/projects/${PID}/tasks/mcp`,
    persona: 'project_owner',
    cue: '샘플 스펙 붙여넣기 → 변환. 쓰기 도구 1건이 결재 대기로 남는 것을 짚는다',
    reqs: ['AGB-004'],
  },
  {
    screen: '9', act: 2, title: '승인 기반 DB 동적 라우팅 ★', path: `/projects/${PID}/tasks/routing`,
    persona: 'project_owner',
    cue: '배포 승인만 먼저 눌러 1/2 상태를 보여주고, 그 다음 동의 권원 확인',
    reqs: ['LSM-009', 'EDA-005', 'SEC-006', 'SEC-007', 'ONM-003'],
  },
  {
    screen: '10', act: 3, title: '관리자 통합 대시보드', path: '/admin/dashboard', persona: 'platform_admin',
    cue: '개요 → 사용 현황 순으로 훑는다',
    reqs: ['관리자 포털'],
  },
  {
    screen: '11', act: 3, title: '계열사별 미터링 · Chargeback', path: '/admin/metering',
    persona: 'platform_admin',
    cue: '입력/출력 분리와 부서별 분해를 짚는다 (행을 눌러 계열사 전환)',
    reqs: ['LSM-010', 'ONM-005'],
  },
  {
    screen: '12', act: 3, title: 'GPU 자원 관리', path: '/admin/dashboard', persona: 'platform_admin',
    cue: 'GPU·인프라 탭으로 이동해 노드·쿼터를 보여준다',
    reqs: ['LSM-006', 'LSM-008'],
  },
  {
    screen: '13', act: 3, title: '가드레일 정책 · 탐지 이력', path: '/admin/dashboard',
    persona: 'platform_admin',
    cue: '안전·거버넌스 탭으로 이동해 PII 탐지·차단 이력을 보여준다',
    reqs: ['SEC-002', '관리자 포털'],
  },
  {
    screen: '14', act: 3, title: 'AI 거버넌스 포탈 ★', path: '/admin/governance', persona: 'governance_admin',
    cue: '라이프사이클 단계를 눌러 관문·결재선을 펴고, 기일 경과 건으로 마무리한다',
    reqs: ['2-3 AI거버넌스 포탈'],
  },
];

/** 각 막의 첫 정거장 index — 숫자 키 1·2·3 점프에 쓴다. */
export const ACT_START: Record<Act, number> = {
  1: DEMO_STOPS.findIndex((s) => s.act === 1),
  2: DEMO_STOPS.findIndex((s) => s.act === 2),
  3: DEMO_STOPS.findIndex((s) => s.act === 3),
};
