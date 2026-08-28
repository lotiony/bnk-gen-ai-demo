/**
 * 관리 콘솔 — 과제 원장(단일 원장) mock.
 *
 * RFP 2-1 관리자 포털:
 *   "**과제 관리 화면**: 계열사별 과제 등록·검토·결재·이행 모니터링, 과제별 자원·비용 현황"
 *
 * ⚠️ **이 파일이 관리 콘솔의 과제 정본이다.**
 *   RFP 관리자 포털 구축범위에 `프로젝트` 계층은 존재하지 않는다 — 계열사가 올리는
 *   사업 단위는 전부 **과제**다. 예산·자원이 배정되고 등록→검토→결재→이행을 거친다.
 *   관리자 대시보드(mockAdminDashboard)도 별도 프로젝트 목록을 갖지 않고 이 원장을
 *   그대로 읽는다. 두 화면이 같은 것을 다른 ID·다른 이름으로 부르면 발주처가
 *   "이 둘이 같은 겁니까"라고 물었을 때 답이 없다(RFP Ⅳ.4.1 — 제안서 = 계약서).
 *
 * ID 체계: `PRJ-<계열사 2자>-<일련>` — BS 부산은행 / KN 경남은행 / CP 캐피탈 /
 *   SC 투자증권 / SV 저축은행 / SY BNK시스템 / GC 그룹 공통.
 *
 * `agentIds` 가 과제와 산출물을 잇는다. 참조 대상은 **읽기 전용** 두 파일뿐이다 —
 *   `mockCatalogAgents.MOCK_CATALOG_AGENTS` (계열사 자산 13종)
 *   `mockGroupAgents.GROUP_AGENTS` (AGB-006 그룹 공통 Use Case 10종)
 * 합계 23종이 플랫폼 전체 에이전트 수이며, 대시보드 KPI·미터링·정산이 모두
 * 이 23종에서 파생된다. 여기에 손으로 적은 호출량·에이전트 수는 없다.
 *
 * 과제 stage 와 산출물 상태는 앞뒤가 맞아야 한다 — 등록·검토 단계 과제가 이미
 * '게시 중 v2.3' 짜리 에이전트를 달고 있으면 그 자체가 지적 대상이다.
 *   · `이행 중`·`완료` 과제만 운영 중 산출물을 갖는다.
 *   · `검토` 과제는 학습계 PoC(운영 호출 0)까지만 갖는다.
 *   · `등록`·`결재`·`반려` 과제는 산출물이 없다.
 *
 * 전부 가상 창작물이다(CLAUDE.md 절대 규칙).
 */
import type { Tenant } from './tenants';

export type AdminTaskStage = '등록' | '검토' | '결재' | '이행 중' | '완료' | '반려';

export interface AdminTaskApproval {
  seq: number;
  role: string;
  status: '완료' | '진행' | '대기';
}

export interface AdminTask {
  id: string;
  name: string;
  tenant: Tenant;
  dept: string;
  stage: AdminTaskStage;
  requestedBy: string;
  requestedAt: string;
  /** 배정 예산(원). */
  budget: number;
  /** 집행액(원). */
  spent: number;
  /**
   * 승인된 **월 플랫폼 이용 예산**(원). 사업 예산(`budget`)과 축이 다르다 —
   * 사업 예산은 구축비(인건비·컨설팅 포함) 총액이고, 이 값은 운영 단계에서
   * 매월 쓰기로 결재받은 인프라 한도다. 대시보드의 "예산 vs 실사용"이 이 값을
   * 쓴다. 실사용액은 계측에서 파생되지만 예산은 결재로 정해지는 정책값이므로
   * 여기 명시한다. 자원 미배정 과제는 0.
   */
  monthlyInfraBudget: number;
  /** GPU/CPU 자원 요약. 미배정 과제는 '미배정'. */
  resource: string;
  /** 배정된 GPU 장 수 — 자원 현황 집계의 단일 출처. 미배정이면 0. */
  gpuCards: number;
  approvals: AdminTaskApproval[];
  /**
   * 이 과제가 산출한 에이전트 ID.
   * MOCK_CATALOG_AGENTS(`AGT-*`) 또는 GROUP_AGENTS(`GRP-*`) 의 id 여야 한다.
   */
  agentIds: string[];
  /**
   * 아직 계측 대상이 아닌 산출물 — 게시 대기·테스트 중이거나 롤백·중지된 것.
   * `mockServiceRegistry` 의 등록부에는 있으나 운영 카탈로그에는 없으므로
   * 호출·토큰 집계에서 제외하고 '총 에이전트 수'에만 센다.
   */
  pendingAgentIds: string[];
  /**
   * 주력 모델 — 배정 GPU 가 어느 모델 서빙 풀에 들어가는지 결정한다.
   * 산출물이 있으면 호출량이 가장 큰 에이전트의 모델과 같아야 한다.
   */
  primaryModel: string;
  /** 이 과제가 쓰는 Namespace — tenants.ts 의 11개 중 하나. */
  namespace: string;
  summary: string;
}

export const ADMIN_TASKS: AdminTask[] = [
  /* ───────── 부산은행 ───────── */
  {
    id: 'PRJ-BS-042',
    name: '여신 디지털심사 과제',
    tenant: '부산은행',
    dept: '여신기획부',
    stage: '이행 중',
    requestedBy: '박서연',
    requestedAt: '2026-03-04',
    budget: 420_000_000,
    spent: 268_000_000,
    monthlyInfraBudget: 24_000_000,
    resource: 'GPU 4장 · onprem/gpt-oss-120b',
    gpuCards: 4,
    approvals: [
      { seq: 1, role: '부서장 검토', status: '완료' },
      { seq: 2, role: '사업 관리자 결재', status: '완료' },
      { seq: 3, role: 'AI거버넌스 승인', status: '완료' },
    ],
    agentIds: ['AGT-512', 'AGT-411', 'GRP-008'],
    pendingAgentIds: ['AGT-513'],
    primaryModel: 'onprem/gpt-oss-120b',
    namespace: 'ns-bank-bs',
    summary:
      '여신 서류 검증·심사 보조 에이전트 3종 구축 · 서빙계 배포 완료 (기표 오류 점검 봇 AGT-513 은 v0.4 에서 롤백·중지)',
  },
  {
    id: 'PRJ-BS-061',
    name: '고객상담 자동화 과제',
    tenant: '부산은행',
    dept: '고객만족부',
    stage: '이행 중',
    requestedBy: '이서준',
    requestedAt: '2026-02-11',
    budget: 380_000_000,
    spent: 352_000_000,
    monthlyInfraBudget: 72_000_000,
    resource: 'GPU 6장 · onprem/gpt-oss-120b',
    gpuCards: 6,
    approvals: [
      { seq: 1, role: '부서장 검토', status: '완료' },
      { seq: 2, role: '사업 관리자 결재', status: '완료' },
      { seq: 3, role: 'AI거버넌스 승인', status: '완료' },
    ],
    agentIds: ['AGT-301', 'AGT-318', 'AGT-072', 'GRP-005'],
    pendingAgentIds: [],
    primaryModel: 'onprem/gpt-oss-120b',
    namespace: 'ns-bank-bs',
    summary: '수신·외환 상담 초안, 보이스피싱 1차 분류, 민원 분류·회신 운영 중 · 예산 93% 집행',
  },
  {
    id: 'PRJ-BS-077',
    name: 'PB 자산관리 고도화 과제',
    tenant: '부산은행',
    dept: 'PB영업본부',
    stage: '이행 중',
    requestedBy: '이지현',
    requestedAt: '2026-01-20',
    budget: 210_000_000,
    spent: 138_000_000,
    monthlyInfraBudget: 12_000_000,
    resource: 'GPU 3장 · onprem/qwen3-32b',
    gpuCards: 3,
    approvals: [
      { seq: 1, role: '부서장 검토', status: '완료' },
      { seq: 2, role: '사업 관리자 결재', status: '완료' },
      { seq: 3, role: 'AI거버넌스 승인', status: '완료' },
    ],
    agentIds: ['AGT-204', 'AGT-205'],
    pendingAgentIds: [],
    primaryModel: 'onprem/qwen3-32b',
    namespace: 'ns-bank-bs',
    summary: '보유 자산 진단·시황 브리핑 에이전트 2종 서빙계 운영 중',
  },
  {
    id: 'PRJ-BS-088',
    name: '규정 · 문서 어시스턴트 과제',
    tenant: '부산은행',
    dept: '디지털혁신부',
    stage: '이행 중',
    requestedBy: '정오너',
    requestedAt: '2025-11-06',
    budget: 340_000_000,
    spent: 291_000_000,
    monthlyInfraBudget: 26_000_000,
    resource: 'GPU 5장 · onprem/gpt-oss-120b',
    gpuCards: 5,
    approvals: [
      { seq: 1, role: '부서장 검토', status: '완료' },
      { seq: 2, role: '사업 관리자 결재', status: '완료' },
      { seq: 3, role: 'AI거버넌스 승인', status: '완료' },
    ],
    agentIds: ['GRP-001', 'GRP-004'],
    pendingAgentIds: [],
    primaryModel: 'onprem/gpt-oss-120b',
    namespace: 'ns-bank-bs',
    summary: 'AGB-006 ①규정/책무 · ④문서작성 도우미 제작 주관 · 그룹 공통 운영영역 배포',
  },

  /* ───────── 경남은행 ───────── */
  {
    id: 'PRJ-KN-009',
    name: '외환업무 어시스턴트 구축 과제',
    tenant: '경남은행',
    dept: '외환사업부',
    stage: '완료',
    requestedBy: '설개발',
    requestedAt: '2025-10-14',
    budget: 160_000_000,
    spent: 158_400_000,
    monthlyInfraBudget: 6_000_000,
    resource: 'GPU 2장 · onprem/gpt-oss-120b',
    gpuCards: 2,
    approvals: [
      { seq: 1, role: '부서장 검토', status: '완료' },
      { seq: 2, role: '사업 관리자 결재', status: '완료' },
      { seq: 3, role: 'AI거버넌스 승인', status: '완료' },
    ],
    agentIds: ['GRP-009'],
    pendingAgentIds: [],
    primaryModel: 'onprem/gpt-oss-120b',
    namespace: 'ns-bank-kn',
    summary: 'AGB-006 ⑨외환업무 어시스턴트 구축 완료 · 그룹 공통 운영영역 이관',
  },
  {
    id: 'PRJ-KN-018',
    name: '외환 심사 자동화 2단계 과제',
    tenant: '경남은행',
    dept: '외환사업부',
    stage: '결재',
    requestedBy: '설개발',
    requestedAt: '2026-05-02',
    budget: 180_000_000,
    spent: 0,
    monthlyInfraBudget: 0,
    resource: '미배정',
    gpuCards: 0,
    approvals: [
      { seq: 1, role: '부서장 검토', status: '완료' },
      { seq: 2, role: '사업 관리자 결재', status: '진행' },
      { seq: 3, role: 'AI거버넌스 승인', status: '대기' },
    ],
    agentIds: [],
    pendingAgentIds: [],
    primaryModel: '—',
    namespace: 'ns-bank-kn',
    summary:
      '1단계(PRJ-KN-009) 산출 GRP-009 위에 신용장 자동심사를 얹는 확장 과제 — 결재 진행 중 · 산출물·자원 미배정',
  },
  {
    id: 'PRJ-KN-022',
    name: '카드 콜센터 응대 자동화 과제',
    tenant: '경남은행',
    dept: '디지털채널부',
    stage: '이행 중',
    requestedBy: '설개발',
    requestedAt: '2026-01-08',
    budget: 145_000_000,
    spent: 96_000_000,
    monthlyInfraBudget: 9_000_000,
    resource: 'GPU 2장 · google/gemma-4-31B-it-assistant',
    gpuCards: 2,
    approvals: [
      { seq: 1, role: '부서장 검토', status: '완료' },
      { seq: 2, role: '사업 관리자 결재', status: '완료' },
      { seq: 3, role: 'AI거버넌스 승인', status: '완료' },
    ],
    agentIds: ['AGT-602'],
    pendingAgentIds: [],
    primaryModel: 'google/gemma-4-31B-it-assistant',
    namespace: 'ns-bank-kn',
    summary: '카드 분실·재발급 1차 응대 봇 운영 중 · 본인 인증 통과 시 즉시 정지 처리',
  },
  {
    id: 'PRJ-KN-025',
    name: '상품 안내 자동화 과제',
    tenant: '경남은행',
    dept: '상품개발부',
    stage: '반려',
    requestedBy: '문전략',
    requestedAt: '2026-04-18',
    budget: 55_000_000,
    spent: 0,
    monthlyInfraBudget: 0,
    resource: '미배정',
    gpuCards: 0,
    approvals: [
      { seq: 1, role: '부서장 검토', status: '완료' },
      { seq: 2, role: '사업 관리자 결재', status: '완료' },
      { seq: 3, role: 'AI거버넌스 승인', status: '대기' },
    ],
    agentIds: [],
    pendingAgentIds: [],
    primaryModel: '—',
    namespace: 'ns-bank-kn',
    summary: '기존 지식/상품 어시스턴트(GRP-007 · PRJ-KN-031)와 범위 중복 — 반려, 흡수 권고',
  },
  {
    id: 'PRJ-KN-031',
    name: '지식 · 상품 어시스턴트 과제',
    tenant: '경남은행',
    dept: '상품개발부',
    stage: '이행 중',
    requestedBy: '남데이터',
    requestedAt: '2026-02-24',
    budget: 190_000_000,
    spent: 84_000_000,
    monthlyInfraBudget: 8_000_000,
    resource: 'GPU 2장 · onprem/gpt-oss-120b',
    gpuCards: 2,
    approvals: [
      { seq: 1, role: '부서장 검토', status: '완료' },
      { seq: 2, role: '사업 관리자 결재', status: '완료' },
      { seq: 3, role: 'AI거버넌스 승인', status: '완료' },
    ],
    agentIds: ['GRP-007'],
    pendingAgentIds: [],
    primaryModel: 'onprem/gpt-oss-120b',
    namespace: 'ns-bank-kn',
    summary:
      'AGB-006 ⑦지식/상품 어시스턴트 · v0.9-rc1 게시 대기(검증 중) — 서빙계 프로모션 결재 대기',
  },

  /* ───────── BNK캐피탈 ───────── */
  {
    id: 'PRJ-CP-007',
    name: '광고심의 지원 과제',
    tenant: 'BNK캐피탈',
    dept: '마케팅부',
    stage: '이행 중',
    requestedBy: '이정우',
    requestedAt: '2026-01-15',
    budget: 65_000_000,
    spent: 47_500_000,
    monthlyInfraBudget: 2_000_000,
    resource: 'GPU 1장 · google/gemma-4-31B-it-assistant',
    gpuCards: 1,
    approvals: [
      { seq: 1, role: '부서장 검토', status: '완료' },
      { seq: 2, role: '사업 관리자 결재', status: '완료' },
      { seq: 3, role: 'AI거버넌스 승인', status: '완료' },
    ],
    agentIds: ['GRP-006'],
    pendingAgentIds: [],
    primaryModel: 'google/gemma-4-31B-it-assistant',
    namespace: 'ns-capital',
    summary:
      'AGB-006 ⑥광고심의 지원 · v1.4 게시 중 (금칙어 완화 예외 EXC-102 적용 · 2026-08-12 만료)',
  },
  {
    id: 'PRJ-CP-012',
    name: '청구서류 자동분류 과제',
    tenant: 'BNK캐피탈',
    dept: '보상지원부',
    stage: '이행 중',
    requestedBy: '정우진',
    requestedAt: '2026-03-19',
    budget: 88_000_000,
    spent: 31_000_000,
    monthlyInfraBudget: 4_000_000,
    resource: 'GPU 1장 · onprem/gpt-oss-120b',
    gpuCards: 1,
    approvals: [
      { seq: 1, role: '부서장 검토', status: '완료' },
      { seq: 2, role: '사업 관리자 결재', status: '완료' },
      { seq: 3, role: 'AI거버넌스 승인', status: '완료' },
    ],
    agentIds: ['AGT-708'],
    pendingAgentIds: [],
    primaryModel: 'onprem/gpt-oss-120b',
    namespace: 'ns-capital',
    summary: '진단서·소견서·영수증 자동 분류 에이전트 — 학습계 검증 통과 후 서빙계 확대 중',
  },

  /* ───────── BNK투자증권 · BNK저축은행 ───────── */
  {
    id: 'PRJ-SC-014',
    name: '리스크 데일리 자동화 과제',
    tenant: 'BNK투자증권',
    dept: '리서치센터',
    stage: '이행 중',
    requestedBy: '이서연',
    requestedAt: '2026-02-02',
    budget: 72_000_000,
    spent: 38_500_000,
    monthlyInfraBudget: 1_500_000,
    resource: 'GPU 1장 · onprem/qwen3-32b',
    gpuCards: 1,
    approvals: [
      { seq: 1, role: '부서장 검토', status: '완료' },
      { seq: 2, role: '사업 관리자 결재', status: '완료' },
      { seq: 3, role: 'AI거버넌스 승인', status: '완료' },
    ],
    agentIds: ['AGT-812'],
    pendingAgentIds: [],
    primaryModel: 'onprem/qwen3-32b',
    namespace: 'ns-securities',
    summary: '시장 데이터 + 한도 위반 모니터링 → 오전 브리프 자동 생성 · 운영 중',
  },
  {
    id: 'PRJ-SV-007',
    name: '연금 상담 디지털화 과제',
    tenant: 'BNK저축은행',
    dept: '수신관리부',
    stage: '검토',
    requestedBy: '김재훈',
    requestedAt: '2026-05-06',
    budget: 48_000_000,
    spent: 3_200_000,
    monthlyInfraBudget: 2_000_000,
    resource: 'GPU 1장(학습계) · google/gemma-4-31B-it-assistant',
    gpuCards: 1,
    approvals: [
      { seq: 1, role: '부서장 검토', status: '진행' },
      { seq: 2, role: '사업 관리자 결재', status: '대기' },
      { seq: 3, role: 'AI거버넌스 승인', status: '대기' },
    ],
    agentIds: ['AGT-905'],
    pendingAgentIds: [],
    primaryModel: 'google/gemma-4-31B-it-assistant',
    namespace: 'ns-savings',
    summary:
      '연금 상품 비교·수령액 시뮬레이션 — 학습계 PoC 만 진행(운영 호출 0) · 서빙계 배포는 결재 후',
  },

  /* ───────── BNK시스템 ───────── */
  {
    id: 'PRJ-SY-003',
    name: '개발 생산성 향상 과제',
    tenant: 'BNK시스템',
    dept: '개발지원팀',
    stage: '이행 중',
    requestedBy: '한지훈',
    requestedAt: '2025-12-08',
    budget: 90_000_000,
    spent: 61_000_000,
    monthlyInfraBudget: 3_000_000,
    resource: 'GPU 2장 · onprem/gpt-oss-120b',
    gpuCards: 2,
    approvals: [
      { seq: 1, role: '부서장 검토', status: '완료' },
      { seq: 2, role: '사업 관리자 결재', status: '완료' },
      { seq: 3, role: 'AI거버넌스 승인', status: '완료' },
    ],
    agentIds: [],
    pendingAgentIds: ['AGT-410'],
    primaryModel: 'onprem/gpt-oss-120b',
    namespace: 'ns-system',
    summary:
      '코드 리뷰 · 시큐어코딩 점검 에이전트(AGT-410) v0.9-rc2 학습계 테스트 중 — 게시 대기 · 운영 계측 전',
  },
  {
    id: 'PRJ-SY-018',
    name: '상담 코파일럿 과제',
    tenant: 'BNK시스템',
    dept: '플랫폼운영부',
    stage: '이행 중',
    requestedBy: '한지훈',
    requestedAt: '2026-01-27',
    budget: 130_000_000,
    spent: 78_000_000,
    monthlyInfraBudget: 3_000_000,
    resource: 'GPU 2장 · onprem/gpt-oss-120b',
    gpuCards: 2,
    approvals: [
      { seq: 1, role: '부서장 검토', status: '완료' },
      { seq: 2, role: '사업 관리자 결재', status: '완료' },
      { seq: 3, role: 'AI거버넌스 승인', status: '완료' },
    ],
    agentIds: ['AGT-621'],
    pendingAgentIds: [],
    primaryModel: 'onprem/gpt-oss-120b',
    namespace: 'ns-system',
    summary: '상담원 응대 중 답변 초안·근거 문서를 제시하는 코파일럿 운영 중',
  },
  {
    id: 'PRJ-SY-021',
    name: '그룹 공통 업무 에이전트 과제',
    tenant: 'BNK시스템',
    dept: '개발1부',
    stage: '이행 중',
    requestedBy: '노운영',
    requestedAt: '2025-09-15',
    budget: 520_000_000,
    spent: 402_000_000,
    monthlyInfraBudget: 60_000_000,
    resource: 'GPU 8장 · onprem/gpt-oss-120b',
    gpuCards: 8,
    approvals: [
      { seq: 1, role: '부서장 검토', status: '완료' },
      { seq: 2, role: '사업 관리자 결재', status: '완료' },
      { seq: 3, role: 'AI거버넌스 승인', status: '완료' },
    ],
    agentIds: ['GRP-002', 'GRP-003', 'GRP-010'],
    pendingAgentIds: [],
    primaryModel: 'onprem/gpt-oss-120b',
    namespace: 'ns-system',
    summary:
      'AGB-006 ②그룹웨어 문서 · ③회의 보조 · ⑩단말기 네비게이터 제작 주관 (⑩은 개발 중)',
  },

  /* ───────── 그룹 공통 ───────── */
  {
    id: 'PRJ-GC-001',
    name: '자금세탁 방지 에이전트 과제',
    tenant: '그룹 공통',
    dept: '준법지원부',
    stage: '검토',
    requestedBy: '이도현',
    requestedAt: '2026-05-22',
    budget: 240_000_000,
    spent: 6_800_000,
    monthlyInfraBudget: 5_000_000,
    resource: 'GPU 1장(학습계) · onprem/gpt-oss-120b',
    gpuCards: 1,
    approvals: [
      { seq: 1, role: '부서장 검토', status: '진행' },
      { seq: 2, role: '사업 관리자 결재', status: '대기' },
      { seq: 3, role: 'AI거버넌스 승인', status: '대기' },
    ],
    agentIds: ['AGT-701'],
    pendingAgentIds: [],
    primaryModel: 'onprem/gpt-oss-120b',
    namespace: 'ns-group-common',
    summary:
      '이상거래 패턴 질의응답 + STR 초안 지원 — 학습계 PoC 진행(운영 호출 0) · 사업 타당성 검토 중',
  },
];

export const STAGE_TONE: Record<AdminTaskStage, 'ok' | 'warn' | 'bad' | 'info' | 'neutral'> = {
  등록: 'neutral',
  검토: 'info',
  결재: 'warn',
  '이행 중': 'ok',
  완료: 'ok',
  반려: 'bad',
};

/**
 * 에이전트 ID → 소속 과제. **에이전트는 반드시 한 과제에만 속한다** —
 * 두 과제가 같은 산출물을 주장하면 자원·비용이 이중 계상된다.
 */
export const TASK_BY_AGENT_ID: Record<string, AdminTask> = ADMIN_TASKS.reduce((acc, t) => {
  for (const a of t.agentIds) acc[a] = t;
  return acc;
}, {} as Record<string, AdminTask>);
