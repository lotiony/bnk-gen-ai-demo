/**
 * 관리 콘솔 — 가드레일 정책 mock.
 *
 * RFP 2-1 관리자 포털:
 *   42 "그룹ᆞ계열사별 AI가드레일 정책의 적용범위 및 세부기준 설정 기능 제공"
 *   43 "AI서비스, Agent별 입ᆞ출력 실행 등 가드레일 적용 및 예외 설정 기능 제공"
 *   44 "가드레일의 탐지ᆞ차단ᆞ정책위반 현황 및 이력 조회 기능 제공"
 *
 * 정책은 2계층이다 — 그룹 베이스라인이 항상 깔리고, 계열사가 그 위에 강화만 얹을 수
 * 있다(완화는 불가). 서비스별 예외는 승인이 있어야 유효하다.
 *
 * 전부 가상 창작물이다(CLAUDE.md 절대 규칙).
 */
import type { Tenant } from './tenants';

export type GuardCategory = 'PII 탐지' | '유해콘텐츠' | '프롬프트 인젝션' | '금칙어';
export type GuardAction = '차단' | '마스킹' | '경고';

export interface GuardPolicy {
  scope: '그룹' | Tenant;
  category: GuardCategory;
  action: GuardAction;
  threshold: string;
  editable: boolean;
}

export const GROUP_BASELINE: GuardPolicy[] = [
  { scope: '그룹', category: 'PII 탐지', action: '차단', threshold: '주민번호·계좌번호·카드번호 — 신뢰도 90% 이상', editable: true },
  { scope: '그룹', category: '유해콘텐츠', action: '차단', threshold: '혐오·차별·폭력 표현 — 표준 정책셋', editable: true },
  { scope: '그룹', category: '프롬프트 인젝션', action: '차단', threshold: '지시 우회 패턴 매칭', editable: true },
  { scope: '그룹', category: '금칙어', action: '경고', threshold: '내부 금칙어 사전 v3 (612건)', editable: true },
];

export const TENANT_OVERRIDES: GuardPolicy[] = [
  { scope: '부산은행', category: 'PII 탐지', action: '차단', threshold: '그룹 기준 + 고객번호 패턴 추가', editable: true },
  { scope: '경남은행', category: '금칙어', action: '차단', threshold: '그룹 기준보다 강화 — 경고 → 차단', editable: true },
  { scope: 'BNK캐피탈', category: '유해콘텐츠', action: '차단', threshold: '광고심의 특화 — 과장 수익 표현 추가 차단', editable: true },
];

export interface GuardException {
  id: string;
  serviceId: string;
  serviceName: string;
  tenant: Tenant;
  category: GuardCategory;
  reason: string;
  approvedBy: string;
  approvedAt: string;
  expiresAt: string;
}

export const GUARD_EXCEPTIONS: GuardException[] = [
  {
    id: 'EXC-101',
    serviceId: 'GRP-005',
    serviceName: '고객 · 민원 분석 에이전트',
    tenant: '부산은행',
    category: 'PII 탐지',
    reason: '동의 권원 확인된 상담 이력만 다루므로 고객번호 마스킹을 완화(차단→마스킹 표시)',
    approvedBy: '임정보',
    approvedAt: '2026-05-10',
    expiresAt: '2026-11-10',
  },
  {
    id: 'EXC-102',
    serviceId: 'GRP-006',
    serviceName: '광고심의 지원 에이전트',
    tenant: 'BNK캐피탈',
    category: '금칙어',
    reason: '광고 문구 초안 작성 특성상 심의 대상 표현 자체를 다뤄야 하므로 경고로 완화',
    approvedBy: '임정보',
    approvedAt: '2026-05-12',
    expiresAt: '2026-08-12',
  },
];

export interface ViolationLog {
  at: string;
  serviceId: string;
  serviceName: string;
  tenant: Tenant;
  category: GuardCategory;
  action: GuardAction;
  detail: string;
}

export const VIOLATION_LOGS: ViolationLog[] = [
  { at: '2026-06-03 09:12:04', serviceId: 'AGT-411', serviceName: '금융상담 챗봇', tenant: '부산은행', category: 'PII 탐지', action: '차단', detail: '주민등록번호 패턴 검출 — 입력 차단' },
  { at: '2026-06-03 08:58:41', serviceId: 'AGT-701', serviceName: '자금세탁 방지 에이전트', tenant: '그룹 공통', category: '프롬프트 인젝션', action: '차단', detail: '"이전 지시 무시" 패턴 검출' },
  { at: '2026-06-02 17:22:10', serviceId: 'GRP-006', serviceName: '광고심의 지원 에이전트', tenant: 'BNK캐피탈', category: '금칙어', action: '경고', detail: '예외 정책(EXC-102) 적용 — 경고만 기록' },
  { at: '2026-06-02 14:03:55', serviceId: 'AGT-621', serviceName: 'CS 챗봇 코파일럿', tenant: 'BNK시스템', category: '유해콘텐츠', action: '차단', detail: '혐오 표현 유도 질의 차단' },
  { at: '2026-06-01 11:40:02', serviceId: 'GRP-005', serviceName: '고객 · 민원 분석 에이전트', tenant: '부산은행', category: 'PII 탐지', action: '마스킹', detail: '예외 정책(EXC-101) 적용 — 고객번호 마스킹 처리 후 통과' },
];
