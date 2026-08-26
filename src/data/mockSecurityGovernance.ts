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

/* ── 감사 로그 검색 ── */

export type AuditActionType = '로그인' | '데이터 복호화' | '권한 변경' | '서비스 배포' | '정책 변경' | '반입 승인' | '조회';

export interface AuditLogEntry {
  at: string;
  actor: string;
  tenant: Tenant;
  actionType: AuditActionType;
  target: string;
  result: '성공' | '차단' | '실패';
}

export const AUDIT_LOGS: AuditLogEntry[] = [
  { at: '2026-06-03 09:41:02', actor: '박서연', tenant: '부산은행', actionType: '데이터 복호화', target: 'AGT-204 · 운영 DB 조회 (동의 권원 확인)', result: '성공' },
  { at: '2026-06-03 09:12:04', actor: 'AGT-411', tenant: '부산은행', actionType: '조회', target: 'V_CUSTOMER_PROFILE — CLS 위반 4컬럼', result: '차단' },
  { at: '2026-06-02 17:22:10', actor: '이정우', tenant: 'BNK캐피탈', actionType: '정책 변경', target: '금칙어 정책 예외(EXC-102) 적용', result: '성공' },
  { at: '2026-06-02 14:20:33', actor: '임정보', tenant: '그룹 공통', actionType: '권한 변경', target: '서민재 → 뷰어 역할 부여', result: '성공' },
  { at: '2026-06-01 11:08:19', actor: '김플랫', tenant: 'BNK시스템', actionType: '반입 승인', target: 'IN-2036 상품 매뉴얼 반입 승인', result: '성공' },
  { at: '2026-06-01 08:55:44', actor: '노운영', tenant: 'BNK시스템', actionType: '서비스 배포', target: 'GRP-007 지식·상품 어시스턴트 게시 대기 등록', result: '성공' },
  { at: '2026-05-31 22:14:02', actor: 'unknown', tenant: '경남은행', actionType: '로그인', target: 'AD 인증 실패 5회 연속', result: '실패' },
];
