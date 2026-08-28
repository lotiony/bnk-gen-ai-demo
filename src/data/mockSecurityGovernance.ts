/**
 * 관리 콘솔 — 보안 · 거버넌스 관리 mock.
 *
 * RFP 2-1 관리자 포털:
 *   "보안·거버넌스 관리 화면: 개인정보 탐지·예외승인 정책 관리, 가드레일·필터링
 *    정책 관리, 데이터 스코프 정책 관리, 감사 로그 검색·조회"
 *
 * 가드레일·필터링 정책 자체는 AdminGuardrailPage 가 담당하므로 이 화면은 나머지
 * 세 가지 — PII 예외승인, 데이터 스코프 정책, 감사 로그 검색 — 을 담는다.
 *
 * 전부 가상 창작물이다(CLAUDE.md 절대 규칙).
 */
import type { Tenant } from './tenants';

/* ── 개인정보 예외승인 ── */

export type PiiExceptionState = '대기' | '승인' | '반려';

export interface PiiExceptionRequest {
  id: string;
  requestedBy: string;
  dept: string;
  tenant: Tenant;
  /** 무엇을 요청하는가 — 마스킹 해제 범위. */
  target: string;
  reason: string;
  state: PiiExceptionState;
  requestedAt: string;
  decidedBy?: string;
  decidedAt?: string;
}

export const PII_EXCEPTION_REQUESTS: PiiExceptionRequest[] = [
  {
    id: 'PII-EXC-33',
    requestedBy: '한지민',
    dept: '준법감시부',
    tenant: '부산은행',
    target: '2026-05 민원 조사 건 · 고객 연락처 마스킹 해제',
    reason: '금융감독원 민원 조사 협조 — 원본 연락처 확인 필요',
    state: '대기',
    requestedAt: '2026-06-02 10:15',
  },
  {
    id: 'PII-EXC-31',
    requestedBy: '서민재',
    dept: '리스크관리부',
    tenant: '그룹 공통',
    target: '자금세탁 의심거래 조사 · 계좌번호 원본 조회',
    reason: 'STR(의심거래보고) 작성을 위한 원본 계좌 확인',
    state: '승인',
    requestedAt: '2026-05-28 09:30',
    decidedBy: '임정보',
    decidedAt: '2026-05-28 14:02',
  },
  {
    id: 'PII-EXC-29',
    requestedBy: '오태경',
    dept: 'AI플랫폼팀',
    tenant: 'BNK시스템',
    target: '성능 디버깅 목적 · 대화 로그 원본 전체 조회',
    reason: '단순 디버깅 목적은 업무상 정당한 사유로 보기 어려움',
    state: '반려',
    requestedAt: '2026-05-20 11:00',
    decidedBy: '임정보',
    decidedAt: '2026-05-20 16:40',
  },
];

/* ── 데이터 스코프 정책 ── */

export interface DataScopeRule {
  scope: '개인' | '부서' | '본부' | '계열사' | '그룹 전체';
  desc: string;
  /** 이 범위로 승격하려면 필요한 승인자. */
  approver: string;
  /** 기본값(신규 자산 등록 시). */
  isDefault: boolean;
}

export const DATA_SCOPE_RULES: DataScopeRule[] = [
  { scope: '개인', desc: '본인만 조회 · 승격 전까지 타인 접근 불가', approver: '승인 불요', isDefault: true },
  { scope: '부서', desc: '동일 부서원 조회 가능', approver: '부서장', isDefault: false },
  { scope: '본부', desc: '동일 본부 소속 전 부서 조회 가능', approver: '본부장', isDefault: false },
  { scope: '계열사', desc: '해당 계열사 전 임직원 조회 가능', approver: '계열사 AI책임자', isDefault: false },
  { scope: '그룹 전체', desc: '10개 계열사 전 임직원 조회 가능 — 교차 활용 대상', approver: '그룹 AI거버넌스', isDefault: false },
];

/* ── 통합 감사 원장 (SEC-009 · ONM-004) ── */

/**
 * SEC-009: "시스템 관리자, 모델 개발자, 일반 사용자의 모든 행위(자원 변경, 권한 양도,
 *           모델 배포, 프롬프트 실행, 데이터 복호화 요청 등)에 대한 상세 보안 실행 로그 적산"
 * ONM-004: "누가, 어떤 에이전트를 통해, 어떤 동의 권원 기반으로 복호화된 데이터를
 *           조회했는지"를 포함한 End-to-End 금융 감사로그.
 *
 * 5개 카테고리를 **한 원장**에 적산한다 — 화면마다 로그가 흩어지면 "감사 로그가
 * 어디 있느냐"는 질문에 답할 수 없다. 복호화요청 행의 대상·동의권원 문구는
 * 데이터 라우팅 화면(mockDataRouting)과 동일 리터럴이다 — 두 화면이 같은 원장을
 * 본다는 서사가 성립해야 ONM-004 가 산다.
 */
export type UnifiedAuditCategory = '자원변경' | '권한양도' | '모델배포' | '프롬프트실행' | '복호화요청';

export type UnifiedAuditVerdict = '허용' | '차단' | '익명화';

export interface UnifiedAuditRow {
  at: string;
  actor: string;
  /** 어떤 에이전트를 통했는가 — ONM-004 의 "어떤 에이전트를 통해". */
  via?: string;
  tenant: Tenant;
  category: UnifiedAuditCategory;
  action: string;
  target: string;
  verdict: UnifiedAuditVerdict;
  /** 복호화요청에만 — 어떤 동의 권원에 근거했는가(ONM-004). */
  consentBasis?: string;
  note?: string;
}

/**
 * ⚠️ **감사 원장은 시간순이 생명이다.** 아래 배열은 카테고리별로 묶어 읽기 좋게
 * 적어 두었으므로 배열 순서가 곧 시간순은 아니다. 그래서 아래에서 한 번
 * **최신순으로 정렬한 값**을 export 한다 — 화면이 배열 순서를 그대로 그리면
 * 06-03 → 06-02 → 06-03 처럼 시간이 역행해 보인다(ONM-004 · SEC-009 근거 화면).
 */
const UNIFIED_AUDIT_RAW: UnifiedAuditRow[] = [
  // ── 복호화요청 — 데이터 라우팅 화면(DRT-101 · AGT-204)과 같은 원장 ──
  {
    at: '2026-06-03 09:41:02', actor: '박서연', via: 'AGT-204 PB 자산진단', tenant: '부산은행',
    category: '복호화요청', action: '운영 DB 복호화 조회', target: 'ns-bank-bs-prod · consult_log ⋈ customer',
    verdict: '허용', consentBasis: '상담 이력 활용 동의 (2025-04-12 취득)', note: '가상화 계층 경유 · 복호화 컬럼 4개',
  },
  {
    at: '2026-06-02 15:10:44', actor: 'AGT-204 (Draft)', tenant: '부산은행',
    category: '복호화요청', action: '운영 DB 접근 시도', target: 'ns-bank-bs-prod',
    verdict: '차단', note: 'PDP 판정 — Draft 상태는 운영계 라우팅 불가 (SEC-007)',
  },
  {
    at: '2026-06-02 11:26:31', actor: 'svc_pb_consult_ro_dev', via: 'AGT-204 PB 자산진단', tenant: '부산은행',
    category: '복호화요청', action: 'SELECT consult_log ⋈ customer', target: 'ns-bank-bs-dev',
    verdict: '익명화', note: '개발계 — 익명화 복제본 조회 · 5행 반환 (SEC-006 기본값)',
  },
  // ── 프롬프트실행 ──
  {
    at: '2026-06-03 09:12:04', actor: '조현우', via: 'AGT-411 컴플라이언스 자문 챗봇', tenant: '부산은행',
    category: '프롬프트실행', action: '자연어 질의 → 가상 뷰 조회', target: 'V_CUSTOMER_PROFILE',
    verdict: '차단', note: 'CLS 위반 4컬럼 — 쿼리 가드레일 차단 (EDA-007)',
  },
  {
    at: '2026-06-03 08:47:19', actor: '서사용', via: 'GRP-001 규정·책무 어시스턴트', tenant: '부산은행',
    category: '프롬프트실행', action: '규정 질의 실행', target: 'Q1 · 여신 온톨로지(ONT-101)',
    verdict: '허용', note: '마스킹 사용자 ID로 질의·응답 로깅 (LSM-013)',
  },
  {
    at: '2026-06-02 16:38:52', actor: '강개발', tenant: '부산은행',
    category: '프롬프트실행', action: 'PII 포함 프롬프트 입력', target: '주민등록번호 패턴 1건',
    verdict: '차단', note: '입력 단계 실시간 차단 · 이력 기록 (SEC-003)',
  },
  // ── 모델배포 ──
  {
    // 서비스 등록부(mockServiceRegistry)의 GRP-007 행과 같은 사건이다 —
    // 행위자·계열사를 그 행(남데이터 · 경남은행)에 맞춘다.
    at: '2026-06-01 08:55:44', actor: '남데이터', tenant: '경남은행',
    category: '모델배포', action: '서비스 게시 대기 등록', target: 'GRP-007 지식·상품 어시스턴트',
    verdict: '허용', note: '과제 PRJ-KN-031 · v0.9-rc1 검증 중',
  },
  {
    at: '2026-05-30 14:02:18', actor: '이도현 (승인권자)', tenant: '부산은행',
    category: '모델배포', action: '배포 승인 — Draft → Approved', target: 'AGT-204',
    verdict: '허용', note: 'SOD — 개발자와 승인권자 직무 분리 (ONM-003)',
  },
  {
    at: '2026-05-29 10:44:07', actor: '강개발', tenant: '부산은행',
    category: '모델배포', action: '서빙계 배포 시도', target: 'AGT-204 v0.9',
    verdict: '차단', note: '개발자 본인 승인 불가 — 승인권자 결재 필요 (ONM-003)',
  },
  // ── 권한양도 ──
  {
    at: '2026-06-02 14:20:33', actor: '임정보', tenant: '그룹 공통',
    category: '권한양도', action: '역할 부여', target: '서민재 → 뷰어 역할',
    verdict: '허용',
  },
  {
    at: '2026-06-01 17:03:26', actor: '박거버', tenant: '그룹 공통',
    category: '권한양도', action: '전결 위임 등록 시도', target: 'authority.create_delegation',
    verdict: '차단', note: '쓰기 MCP 도구 — 승인권자 결재 선행 필요 (AGB-004)',
  },
  // ── 자원변경 ──
  {
    at: '2026-06-01 11:08:19', actor: '김플랫', tenant: 'BNK시스템',
    category: '자원변경', action: '반입 승인', target: 'IN-2036 상품 매뉴얼',
    verdict: '허용',
  },
  {
    at: '2026-05-31 09:15:40', actor: '김플랫', tenant: 'BNK시스템',
    category: '자원변경', action: 'GPU 상한 정책 변경', target: '과제 GPU 상한 4장 → 6장',
    verdict: '허용', note: '다음 배정부터 적용',
  },
];

/** 통합 감사 원장 — **최신순**. 소비처는 이 배열을 그대로 그리면 된다. */
export const UNIFIED_AUDIT: UnifiedAuditRow[] = [...UNIFIED_AUDIT_RAW].sort((a, b) =>
  b.at.localeCompare(a.at),
);

export const UNIFIED_AUDIT_CATEGORIES: UnifiedAuditCategory[] = [
  '복호화요청', '프롬프트실행', '모델배포', '권한양도', '자원변경',
];
