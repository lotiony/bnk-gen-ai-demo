/**
 * 계열사 자산 활용 현황 · 그룹 승격 판단 mock — 시연 3막 파트 B (3B-2 ~ 3B-6).
 *
 * RFP: 1.3.2 「관리자 승인 절차 기반 배포·공유 범위 통제」 ·
 *      2-1 관리자 포털 40(공개·공유 범위 설정) · ONM-005 · SEC-009
 *
 * 지주 관리자만의 관점 —
 *   계열사 관리자는 자기 계열사 자산만 본다. **계열사를 가로지르는 재사용
 *   현황**은 지주 관리자만 볼 수 있고, 그래서 "이 자산을 그룹 공동으로
 *   올릴까" 라는 판단도 지주 관리자만 할 수 있다. 그룹 공동 플랫폼의
 *   정체성이 실무로 드러나는 지점이다.
 *
 * 판단의 근거는 **개별 요청 이력**이다. 여러 계열사가 같은 자산을 각자
 * 요청해 왔다면, 그 절차를 반복시키는 것보다 범위를 넓히는 게 맞다.
 *
 * ⚠️ 자산 ID·이름·소유자·계열사·호출량·평가는 카탈로그(mockCatalogAgents ·
 *    mockCatalog)와 **같은 값이어야 한다.** 화면끼리 다른 말을 하면 그 자체가
 *    리스크다.
 *
 *    실제로 AGT-602 는 여기서 「외환 규정 질의 어시스턴트 · 남데이터」였는데
 *    카탈로그에서는 「카드 분실신고 응대 봇 · 한지민」이었고, AGT-812 도 이름·
 *    소유 계열사·호출량이 전부 달랐다. 같은 ID 가 화면마다 다른 자산으로
 *    보이던 상태라 정본에 맞춰 정정했다. 행을 추가할 때는 반드시 카탈로그에서
 *    값을 옮겨 올 것.
 *
 * 전부 가상 창작물이다(CLAUDE.md 절대 규칙).
 */
import type { Tenant } from './tenants';
import { effectiveScope } from './mockCatalog';
import type { ShareScope } from './mockCatalog';

/* ═══════════════════ 3B-2 계열사 자산 활용 현황 ═══════════════════ */

export interface SpreadRow {
  assetId: string;
  assetName: string;
  ownerTenant: Tenant;
  ownerName: string;
  /**
   * 최초 공유 범위. **화면은 이 값을 직접 쓰지 않는다** — 승격이 반영된 값은
   * `spreadRows()` 가 카탈로그에서 읽어 채운다. 승인했는데 표가 그대로면
   * 화면이 거짓말을 한다.
   */
  scope: ShareScope;
  callsWeekly: number;
  /** 이 자산을 쓰겠다고 **요청해 온** 계열사 수. 승격 판단의 1차 신호. */
  requestingTenants: number;
  /** 그중 승인되어 실제로 쓰는 계열사 수. */
  grantedTenants: number;
  rating: number;
  ratingCount: number;
}

/**
 * 요청 계열사가 많은 순. 맨 위가 곧 승격 후보다.
 *
 * AGT-204 는 부산은행이 만든 PB 자산진단 어시스턴트로, 6개 계열사가 개별
 * 요청을 올렸고 4곳이 승인받아 쓰고 있다 — 같은 절차가 여섯 번 반복됐다는
 * 뜻이고, 그게 3B-5 승격 상신의 근거가 된다.
 */
const SEED_SPREAD_ROWS: SpreadRow[] = [
  { assetId: 'AGT-204', assetName: 'PB 자산진단 어시스턴트', ownerTenant: '부산은행', ownerName: '박서연', scope: '계열사', callsWeekly: 12480, requestingTenants: 6, grantedTenants: 4, rating: 4.6, ratingCount: 38 },
  { assetId: 'AGT-731', assetName: '신용평가 조회 에이전트', ownerTenant: 'BNK신용정보', ownerName: '서신용', scope: '계열사', callsWeekly: 7400, requestingTenants: 3, grantedTenants: 2, rating: 4.4, ratingCount: 22 },
  { assetId: 'AGT-602', assetName: '카드 분실신고 응대 봇', ownerTenant: '경남은행', ownerName: '한지민', scope: '계열사', callsWeekly: 32000, requestingTenants: 2, grantedTenants: 1, rating: 4.2, ratingCount: 31 },
  { assetId: 'MCP-034', assetName: 'crm.customer_profile', ownerTenant: '부산은행', ownerName: '조디비', scope: '부서', callsWeekly: 3960, requestingTenants: 2, grantedTenants: 0, rating: 4.1, ratingCount: 9 },
  { assetId: 'AGT-812', assetName: '리스크 일일 브리프 봇', ownerTenant: 'BNK투자증권', ownerName: '이서연', scope: '부서', callsWeekly: 280, requestingTenants: 1, grantedTenants: 1, rating: 3.9, ratingCount: 8 },
];

/**
 * 화면이 읽는 목록 — 승격 결재가 최종 승인되면 그 자산의 범위가 여기서도 바뀐다.
 * 카탈로그(`effectiveScope`)와 같은 출처를 보므로 마켓플레이스와 어긋나지 않는다.
 */
export function spreadRows(): SpreadRow[] {
  return SEED_SPREAD_ROWS.map((r) => ({ ...r, scope: effectiveScope(r.assetId, r.scope) }));
}

/** 승격 검토 대상 — 요청 계열사 3곳 이상. 화면에서 하이라이트한다. */
export const SPREAD_THRESHOLD = 3;
export function isSpreadCandidate(r: SpreadRow): boolean {
  return r.scope !== '그룹' && r.requestingTenants >= SPREAD_THRESHOLD;
}

/* ═══════════════════ 3B-4 개별 권한 요청 이력 ═══════════════════ */

export interface AccessRequest {
  id: string;
  assetId: string;
  tenant: Tenant;
  requestedBy: string;
  dept: string;
  requestedAt: string;
  reason: string;
  state: '승인' | '검토 중' | '반려';
  /** 승인·반려 처리 시각. 검토 중이면 비운다. */
  decidedAt?: string;
  decidedBy?: string;
}

/**
 * AGT-204 에 대한 계열사별 개별 요청 — **여섯 번 반복된 같은 절차**.
 *
 * 이 목록이 3B-5 승격 상신의 근거다. 승인 4건은 이미 쓰고 있다는 뜻이고,
 * 검토 중 2건은 지금도 같은 절차가 돌고 있다는 뜻이다.
 */
export const ACCESS_REQUESTS: AccessRequest[] = [
  { id: 'REQ-2026-0412', assetId: 'AGT-204', tenant: '경남은행',     requestedBy: '설개발', dept: 'IT기획팀',     requestedAt: '2026-04-12', reason: 'PB 채널 상담 초안 — 동일 업무 중복 구축 회피', state: '승인', decidedAt: '2026-04-14', decidedBy: '고승인' },
  { id: 'REQ-2026-0428', assetId: 'AGT-204', tenant: 'BNK투자증권',  requestedBy: '한지민', dept: '리테일영업부', requestedAt: '2026-04-28', reason: '고액 자산가 상담 시 포트폴리오 진단 참고', state: '승인', decidedAt: '2026-05-02', decidedBy: '고승인' },
  { id: 'REQ-2026-0509', assetId: 'AGT-204', tenant: 'BNK자산운용',  requestedBy: '윤리서', dept: '운용본부',     requestedAt: '2026-05-09', reason: '자산배분 제안서 초안 작성 보조', state: '승인', decidedAt: '2026-05-12', decidedBy: '고승인' },
  { id: 'REQ-2026-0521', assetId: 'AGT-204', tenant: 'BNK저축은행',  requestedBy: '오수신', dept: '수신관리부',   requestedAt: '2026-05-21', reason: '예금 만기 고객 재예치 상담 지원', state: '승인', decidedAt: '2026-05-25', decidedBy: '고승인' },
  { id: 'REQ-2026-0601', assetId: 'AGT-204', tenant: 'BNK캐피탈',    requestedBy: '정우진', dept: '기업금융부',   requestedAt: '2026-06-01', reason: '기업 고객 자산 현황 브리핑 초안', state: '검토 중' },
  { id: 'REQ-2026-0602', assetId: 'AGT-204', tenant: 'BNK벤처투자',  requestedBy: '남투자', dept: '투자심사부',   requestedAt: '2026-06-02', reason: '피투자사 대표 개인자산 상담 참고', state: '검토 중' },
];

export function requestsOf(assetId: string): AccessRequest[] {
  return ACCESS_REQUESTS.filter((r) => r.assetId === assetId);
}

/* ═══════════════════ 3B-6 승격 예상 효과 ═══════════════════ */

export interface PromotionEffect {
  k: string;
  before: string;
  after: string;
}

/**
 * 승격하면 무엇이 달라지는가 — 개별 요청 절차가 사라지는 게 핵심이다.
 * 숫자는 위 요청 이력에서 그대로 도출한다(요청 6건 · 평균 처리 3.2일).
 */
export function promotionEffects(r: SpreadRow): PromotionEffect[] {
  const reqs = requestsOf(r.assetId);
  const pending = reqs.filter((x) => x.state === '검토 중').length;
  return [
    {
      k: '개별 권한 요청',
      before: `계열사마다 요청·승인 필요 (누적 ${reqs.length}건 · 진행 중 ${pending}건)`,
      after: '절차 없이 즉시 사용 — 진행 중 건은 자동 종결',
    },
    {
      k: '사용 가능 범위',
      before: `${r.ownerTenant} + 승인 ${r.grantedTenants}개 계열사`,
      after: '10개 계열사 전 임직원 · 그룹 공통 Namespace 노출',
    },
    {
      k: '중복 구축',
      before: `요청 계열사 ${r.requestingTenants}곳이 각자 유사 자산 구축 검토`,
      after: '검증된 자산 1개를 공동 사용 — 중복 개발비 절감',
    },
    {
      k: '자산 소유',
      before: `${r.ownerTenant} 소유 · 운영 책임도 ${r.ownerTenant}`,
      after: `${r.ownerTenant} 소유 유지 — 노출 범위만 확대`,
    },
  ];
}
