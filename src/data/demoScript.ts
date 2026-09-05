/**
 * 시연 대본 — 프리젠터 내비게이션이 따라 이동하는 정거장 목록.
 *
 * **두 개의 트랙**을 담는다.
 *
 *   ① 요건 트랙 (핸드오프 §2 · 3막 14화면)
 *      RFP 기술요건 62개 중 상세제안 16개를 화면으로 증명하는 순회다.
 *      제안서 조견표 상호 참조가 이 배열을 기준으로 검증된다.
 *
 *   ② 외환 트랙 (외환업무 도우미 13화면)
 *      한 직원의 개선 의견이 그룹 공동 자산이 되어 다른 계열사로 확산되는
 *      하나의 이야기다. 요건을 나열하는 대신 **한 자산의 생애**를 따라간다.
 *
 * 왜 둘을 함께 두는가 — 발표 상황이 다르기 때문이다. 요건 트랙은 "요구한 것을
 * 다 하는가" 에 답하고, 외환 트랙은 "그래서 무엇이 좋아지는가" 에 답한다.
 * 화면은 대부분 공유하므로 대본만 갈라 두면 된다.
 *
 * ⚠️ 요건 트랙의 화면 번호·대응 요건은 **핸드오프 §2 표와 1:1로 맞춰 둔다.**
 *    여기서 어긋나면 제안서 조견표 상호 참조(가이드 §5 DoD)가 깨진다.
 */
import type { PersonaId } from '@/data/mockPersonas';

export type Act = 1 | 2 | 3;

export interface DemoStop {
  /** 대본상의 화면 번호 표기. */
  screen: string;
  act: Act;
  title: string;
  /** 도착 경로. 쿼리스트링이 붙어도 위치 비교는 경로 부분만 본다. */
  path: string;
  /** 이 막을 진행하는 페르소나 — 이동 시 자동 전환한다(계열사도 함께 바뀐다). */
  persona: PersonaId;
  /** 발표자가 이 화면에서 할 동작. HUD 에 그대로 뜬다. */
  cue: string;
  /** 대응 RFP 요건. */
  reqs: string[];
}

/** 트랙 하나 — 정거장 목록과 막 라벨을 함께 들고 다닌다. */
export interface DemoTrack {
  id: string;
  /** HUD 좌상단에 뜨는 트랙 이름. */
  label: string;
  /** 한 줄 성격 — 트랙을 바꿀 때 무엇으로 바뀌는지 알려 준다. */
  hint: string;
  stops: DemoStop[];
  actLabel: Record<Act, string>;
}

/* ═══════════════════════ ① 요건 트랙 ═══════════════════════ */

export const ACT_LABEL: Record<Act, string> = {
  1: '1막 · 일반 사용자',
  2: '2막 · 개발자 / 승인권자',
  3: '3막 · 운영자 / 거버넌스',
};

/*
 * 화면 2·3 은 같은 화면이다(포털 Chat 에서 규정·책무를 질의한다). 스펙이 그렇게
 * 쓰여 있어 한 정거장으로 합쳤고, 화면 5(PII 차단)도 같은 라우트지만 시연 동작이
 * 달라 별도 정거장으로 뒀다.
 */
export const DEMO_STOPS: DemoStop[] = [
  {
    screen: '1', act: 1, title: '공통 포털 랜딩', path: '/portal', persona: 'service_user',
    cue: '일반 사용자에게 포털 카드가 1장뿐인 것을 짚고(2-1), 11 Namespace 구조를 보여준 뒤 업무 AI 포털로 입장한다',
    reqs: ['Ⅱ.3.나(3)', '2-1', 'SEC-001'],
  },
  {
    screen: '2·3', act: 1, title: '포털 Chat · 규정/책무 질의', path: '/chat', persona: 'service_user',
    cue: '추천 질의를 눌러 답변 → 확정 사실 → 근거 경로 → 규정 원문 순으로 짚는다',
    reqs: ['LSM-002', 'RAG-007', 'AGB-006①'],
  },
  {
    screen: '4', act: 1, title: 'Graph RAG 근거 그래프 ★', path: '/knowledge/ontology',
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
    screen: '7', act: 2, title: '노코드 워크플로우 빌더', path: '/studio/workflow',
    persona: 'project_owner',
    cue: '노드를 끌어 옮기고 ▶ 실행 — 조건 분기가 갈려 LLM 노드가 미실행으로 남는다',
    reqs: ['AGB-002', 'AGB-005', 'AGB-008'],
  },
  {
    screen: '8', act: 2, title: 'MCP Tool 자동 등록', path: '/studio/tools',
    persona: 'project_owner',
    cue: '샘플 스펙 붙여넣기 → 변환. 쓰기 도구 1건이 결재 대기로 남는 것을 짚는다',
    reqs: ['AGB-004'],
  },
  {
    screen: '9', act: 2, title: '승인 기반 DB 동적 라우팅 ★', path: '/knowledge/routing',
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
    screen: '14', act: 3, title: 'AI 거버넌스 포탈 ★', path: '/governance', persona: 'governance_admin',
    cue: '라이프사이클 단계를 눌러 관문·결재선을 펴고, 기일 경과 건으로 마무리한다',
    reqs: ['2-3 AI거버넌스 포탈'],
  },
];

/* ═══════════════════════ ② 외환 트랙 ═══════════════════════ */

export const FX_ACT_LABEL: Record<Act, string> = {
  1: '1막 · 부산은행 직원의 업무',
  2: '2막 · 승인과 그룹 확산',
  3: '3막 · 활용과 그룹 운영',
};

/**
 * 외환업무 도우미 13화면 — 하나의 자산이 만들어지고, 승인되고, 퍼지고, 운영된다.
 *
 * 화면 01~06 은 **같은 경로**다(대화 화면 하나에서 카드가 이어진다). 정거장을
 * 나눠 둔 이유는 발표자가 각 단계에서 무엇을 짚어야 하는지가 다르기 때문이다.
 * 경로가 같으므로 → 를 눌러도 대화는 초기화되지 않고 그대로 이어진다.
 *
 * 페르소나가 바뀌면 계열사도 함께 바뀐다(`setStoredPersona`). 부산은행 →
 * 경남은행으로 넘어가는 08 시점에 대화 화면의 이전 대화가 정리되는데, 이는
 * "대화는 계열사 Namespace 안에서만 보관된다" 는 SEC-001 서사와 같은 동작이다.
 */
export const FX_STOPS: DemoStop[] = [
  {
    screen: '01', act: 1, title: '업무 시작', path: '/chat?agent=GRP-009', persona: 'service_user',
    cue: '3개 업무 카드에서 외환업무가 선택된 상태를 짚고 「외환업무 시작」을 누른다',
    reqs: ['2-1 워크스페이스', 'AGB-006⑨'],
  },
  {
    screen: '02', act: 1, title: '고객 질문 접수', path: '/chat?agent=GRP-009', persona: 'service_user',
    cue: '고객의 말을 그대로 인용하고, 확인해야 할 세 가지로 분해되는 것을 보여준다',
    reqs: ['AGB-006⑨'],
  },
  {
    screen: '03', act: 1, title: '서류 검토 요청', path: '/chat?agent=GRP-009', persona: 'service_user',
    cue: '서류 4장을 한 번에 올린 것과 평문 지시를 짚고 「검토 요청」 — 반입 검사가 먼저 도는 것을 본다',
    reqs: ['2-1 파일 업로드', 'SEC-004', 'SEC-008'],
  },
  {
    screen: '04', act: 1, title: '검토 결과 — 품목별 차이 ★', path: '/chat?agent=GRP-009',
    persona: 'service_user',
    cue: '주장비(추가 서류 필요)와 예비부품(현 서류로 가능)을 나란히 짚는다 — 룰베이스로 덮이지 않는 지점',
    reqs: ['AGB-006⑨', 'RAG-002'],
  },
  {
    screen: '05', act: 1, title: '근거 확인 — 원문 인용 ★', path: '/chat?agent=GRP-009',
    persona: 'service_user',
    cue: '"For spare-parts kits only" 를 원문에서 짚고, 추가 질문에도 같은 서류로 답하는 것을 보여준다',
    reqs: ['RAG-002', 'AGB-009'],
  },
  {
    screen: '06', act: 1, title: '업무 마무리 · 개선 의견', path: '/chat?agent=GRP-009',
    persona: 'service_user',
    cue: '고객 안내 초안까지 이어지는 것을 짚고, 「개선 의견 남기기」로 결재를 만든다 (전환점 1)',
    reqs: ['LSM-012', 'AGB-006⑨'],
  },
  {
    screen: '07', act: 2, title: '개선 승인 · 공유 등록', path: '/approvals', persona: 'bs_admin',
    cue: '결재함에서 개선안을 열어 현장의 말 그대로를 보여주고, 운영 승인 후 「승인 후 공유 등록」 (전환점 2)',
    reqs: ['LSM-012', 'ONM-003', '1.3.2'],
  },
  {
    screen: '08', act: 2, title: '마켓에서 개선 버전 확인', path: '/catalog', persona: 'kn_admin',
    cue: '그룹 공동 사용 에이전트 ⑨ 카드를 열어 「개선 버전」을 확인하고 「당행 적용 준비」로 넘어간다',
    reqs: ['AGB-007', '1.3.2'],
  },
  {
    screen: '09', act: 2, title: '계열사 적용 확인', path: '/adopt/GRP-009', persona: 'kn_admin',
    cue: '공유되는 것(업무 흐름·결과 형식)과 남는 것(고객 자료)을 짚고, 4행을 확인한 뒤 운영 승인',
    reqs: ['SEC-001', 'ONM-003', '기타'],
  },
  {
    screen: '10', act: 3, title: '개선판 사용 (경남은행)', path: '/chat?agent=GRP-009',
    persona: 'kn_service_user',
    cue: '같은 문의를 올리면 결론·필요 서류·고객 안내가 한 번에 나오는 것을 보여준다 (전환점 3)',
    reqs: ['AGB-006⑨', 'LSM-012'],
  },
  {
    screen: '11', act: 3, title: '사용량과 비용 (경남은행)', path: '/admin/metering',
    persona: 'kn_ops_admin',
    cue: '계열사 관리자에게는 자기 Namespace 정산만 보이는 것을 짚는다',
    reqs: ['ONM-005', 'SEC-001'],
  },
  {
    screen: '12', act: 3, title: '그룹 운영 · 계열사별 정산', path: '/admin/metering',
    persona: 'platform_admin',
    cue: '계열사별 정산표를 훑고 「월간 정산표 생성」을 눌러 산출이 열리는 것을 보여준다',
    reqs: ['ONM-005', 'LSM-010'],
  },
  {
    screen: '13', act: 3, title: '운영 대응 이력', path: '/admin/anomaly', persona: 'operator',
    cue: '아래 운영 대응 이력에서 문제 확인 → 담당자 조치 → 복구 확인 3단계를 짚는다',
    reqs: ['SEC-009', 'ONM-002', 'AGB-009'],
  },
];

/* ═══════════════════════ 트랙 목록 ═══════════════════════ */

export const DEMO_TRACKS: DemoTrack[] = [
  {
    id: 'req',
    label: '요건 트랙',
    hint: '3막 14화면 · 상세제안 요건 증명',
    stops: DEMO_STOPS,
    actLabel: ACT_LABEL,
  },
  {
    id: 'fx',
    label: '외환 트랙',
    hint: '13화면 · 한 개선이 그룹으로 퍼지는 이야기',
    stops: FX_STOPS,
    actLabel: FX_ACT_LABEL,
  },
];

/** 각 막의 첫 정거장 index — 숫자 키 1·2·3 점프에 쓴다. */
export function actStart(stops: DemoStop[]): Record<Act, number> {
  return {
    1: Math.max(0, stops.findIndex((s) => s.act === 1)),
    2: Math.max(0, stops.findIndex((s) => s.act === 2)),
    3: Math.max(0, stops.findIndex((s) => s.act === 3)),
  };
}

/** 요건 트랙의 막 시작 index — 기존 참조 호환용. */
export const ACT_START: Record<Act, number> = actStart(DEMO_STOPS);
