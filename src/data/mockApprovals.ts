/**
 * 결재 mock — 결재함·결재 상세의 단일 진실 공급원.
 *
 * RFP 구축범위 1.3.2(마켓플레이스):
 *   "검증된 Agent, Prompt 등 AI 자산의 그룹·계열사·부서 단위 공유 및 재사용 기능.
 *    에이전트/워크플로우/프롬프트의 템플릿화 및 조직 내 재사용 자산 관리.
 *    **관리자 승인 절차 기반** 배포·공유 범위(개인/부서/본부/해당계열사/그룹 전체) 통제"
 *
 * 공유 범위 5단계 자체는 mockCatalog.ts 에 있었지만 **"관리자 승인 절차"** 가
 * 화면에 없었다 — 마켓플레이스의 '그룹 공개 요청' 이 토스트만 띄우고 결재함에는
 * 아무것도 생기지 않았다. 요건 문장의 절반이 화면에서 증명되지 않는 상태였고,
 * 데모에 넣은 것이 곧 확약인 이상(RFP Ⅳ.4.1) 반대로 넣지 않은 절차는 비어 보인다.
 * 그래서 **공유범위 승격 결재**를 결재 유형으로 신설한다.
 *
 * ⚠️ 전부 가상 데이터다(CLAUDE.md 절대 규칙).
 */
import { useSyncExternalStore } from 'react';
import type { ApprovalItem } from '@/types';
import type { Tenant } from '@/data/tenants';
import { TENANTS } from '@/data/tenants';
import type { AssetKind, ShareScope } from '@/data/mockCatalog';
import { promoteAssetScope } from '@/data/mockCatalog';

/**
 * 공유범위 승격 결재의 `category` 값.
 *
 * `ApprovalCategory`(src/types)는 이 데모의 다른 화면들이 함께 쓰는 공용 타입이라
 * 여기서 유니온을 넓히지 않는다. 대신 값만 추가하고 결재함·결재 상세가 이 상수로
 * 분기한다.
 *
 * ⚠️ 캐스팅으로 유니온을 우회하므로 **칩 매핑 누락을 타입 검사가 잡아 주지 못한다.**
 *    실제로 홈·프로젝트 결재 탭이 각자 복사해 둔 매핑에 `promote` 가 없어서
 *    이 값이 섞이는 순간 화면 전체가 빈 채로 죽었다(`chip.cls` of undefined).
 *    그래서 매핑을 아래 `APPROVAL_CHIP` 한 곳으로 모으고, 조회는 반드시
 *    `approvalChip()` 을 거치게 한다 — 모르는 값이 와도 화면은 살아 있어야 한다.
 */
export const PROMOTE_CATEGORY = 'promote' as unknown as ApprovalItem['category'];

/**
 * 결재 종류 칩 — **단일 출처**.
 *
 * 홈 · 전역 결재함 · 프로젝트 결재 탭이 같은 라벨과 색을 쓴다. 예전에는 세 화면이
 * 각자 같은 객체를 복사해 갖고 있었고, 새 종류가 생겼을 때 한 곳만 갱신되었다.
 */
export const APPROVAL_CHIP: Record<string, { cls: string; label: string }> = {
  register: { cls: 'bg-brand-tint text-brand border-brand-tint', label: '프로젝트 생성' },
  train: { cls: 'bg-info-bg text-info border-info-border', label: '학습계' },
  serv: { cls: 'bg-ok-bg text-ok border-ok-border', label: '서빙계 배포' },
  discard: { cls: 'bg-accent-brown-bg text-accent-brown border-accent-brown-border', label: '폐기' },
  policy: { cls: 'bg-warn-bg text-warn border-warn-border', label: '정책' },
  table: { cls: 'bg-accent-purple-bg text-accent-purple border-accent-purple-border', label: '테이블 생성' },
  account: { cls: 'bg-bad-bg text-bad border-bad-border', label: '계정 생성' },
  redteam: { cls: 'bg-warn-bg text-bad border-bad-border', label: '레드팀 신청' },
  // RFP 1.3.2 "관리자 승인 절차 기반 배포·공유 범위 통제" — 마켓플레이스에서 올라온 승격 결재.
  promote: { cls: 'bg-accent-purple-bg text-accent-purple border-accent-purple-border', label: '공유범위 승격' },
};

/** 매핑에 없는 종류가 와도 화면이 죽지 않도록 항상 이 함수로 조회한다. */
export function approvalChip(category: string): { cls: string; label: string } {
  return APPROVAL_CHIP[category] ?? { cls: 'bg-surface text-ink-mid border-line', label: category };
}

export const approvals: ApprovalItem[] = [
  {
    id: 'APV-2026-091',
    category: 'register',
    title: '리스크 관리 에이전트 프로젝트',
    draftedBy: '정오너',
    draftedAt: '2026-05-14 09:42',
    stage: { current: 2, total: 5, label: '플랫폼 결재 그룹' },
    state: 'pending',
    urgent: true,
    mine: true,
  },
  {
    id: 'APV-2026-093',
    category: 'serv',
    title: '시황 분석 에이전트 v4.2',
    projectName: 'PB 에이전트 프로젝트',
    draftedBy: '강개발',
    draftedAt: '2026-05-14 14:18',
    stage: { current: 1, total: 3, label: '정보보호 검토' },
    state: 'pending',
    mine: true,
  },
  {
    id: 'APV-2026-094',
    category: 'table',
    title: '국내외 지수 테이블',
    projectName: 'PB 에이전트 프로젝트',
    draftedBy: '조디비',
    draftedAt: '2026-05-14 16:32',
    stage: { current: 1, total: 2, label: 'DBA 승인' },
    state: 'pending',
    mine: true,
  },
  {
    id: 'APV-2026-095',
    category: 'serv',
    title: '시황분석 리포트 파서',
    projectName: 'PB 에이전트 프로젝트',
    draftedBy: '강개발',
    draftedAt: '2026-05-14 17:05',
    stage: { current: 2, total: 3, label: '부서장 결재' },
    state: 'pending',
    mine: true,
  },
  {
    id: 'APV-2026-096',
    category: 'train',
    title: '시황 분석 에이전트 커스텀 파이프라인',
    projectName: 'PB 에이전트 프로젝트',
    draftedBy: '강개발',
    draftedAt: '2026-05-14 18:20',
    stage: { current: 1, total: 2, label: 'PM 결재' },
    state: 'pending',
    mine: true,
  },
  {
    id: 'APV-2026-097',
    category: 'account',
    title: '국내외 지수 테이블 조회 계정',
    projectName: 'PB 에이전트 프로젝트',
    draftedBy: '강개발',
    draftedAt: '2026-05-14 18:42',
    stage: { current: 1, total: 2, label: 'DBA 승인' },
    state: 'pending',
    mine: true,
  },
  {
    id: 'APV-2026-098',
    category: 'redteam',
    title: '수신 에이전트 v3.7 레드팀 검증',
    projectName: '금융상담 에이전트 프로젝트',
    draftedBy: '강개발',
    draftedAt: '2026-05-14 19:10',
    stage: { current: 1, total: 2, label: '거버넌스 승인' },
    state: 'pending',
    mine: true,
  },
  {
    id: 'APV-2026-088',
    category: 'serv',
    title: '에이전트 v1.7 → 서빙계 프로모션 (풀 번들)',
    projectName: 'PB 에이전트 프로젝트',
    draftedBy: '김플랫',
    draftedAt: '2026-05-13 16:08',
    stage: { current: 5, total: 5, label: '부서장 결재' },
    state: 'done',
    mine: true,
  },
  {
    id: 'APV-2026-086',
    category: 'train',
    title: '에이전트 v1.7 → 학습계 배포',
    projectName: 'PB 에이전트 프로젝트',
    draftedBy: '박서연 (SoD 자동 위임)',
    draftedAt: '2026-05-10 11:24',
    stage: { current: 1, total: 1, label: '김플랫 결재' },
    state: 'done',
  },
  {
    id: 'APV-2026-079',
    category: 'policy',
    title: 'EX-2026-014 야간 fallback 모델 예외 신청',
    projectName: 'PB 에이전트 프로젝트',
    draftedBy: '김플랫',
    draftedAt: '2026-04-28 14:14',
    stage: { current: 2, total: 2, label: '거버넌스 강민호' },
    state: 'done',
  },
  {
    id: 'APV-2026-073',
    category: 'serv',
    title: 'RAG-only 번들: 상품 카탈로그 v3.2',
    projectName: '금융상담 에이전트 프로젝트',
    draftedBy: '정수민',
    draftedAt: '2026-04-22 10:01',
    stage: { current: 5, total: 5, label: '플랫폼 부서장' },
    state: 'done',
  },
  {
    id: 'APV-2026-062',
    category: 'register',
    title: '프로젝트 예산 변경 (Q3 +₩0.3M)',
    draftedBy: '김플랫',
    draftedAt: '2026-04-08 13:30',
    stage: { current: 3, total: 3, label: '플랫폼 부서장' },
    state: 'done',
  },
  {
    id: 'APV-2026-040',
    category: 'discard',
    title: '레거시 RAG 인덱스 폐기 (시장 동향 v0.9)',
    projectName: 'PB 에이전트 프로젝트',
    draftedBy: '정수민',
    draftedAt: '2026-03-12 11:00',
    stage: { current: 2, total: 2, label: '플랫폼 결재 그룹' },
    state: 'rejected',
  },
];

/* ═══════════════════════ 공유범위 승격 결재 (RFP 1.3.2) ═══════════════════════ */

/** 승격 근거 한 줄 — 지표와 승격 기준 충족 여부. */
export interface PromotionEvidence {
  k: string;
  v: string;
  /** 그룹 승격 기준을 충족했는가. */
  pass: boolean;
}

/** 승격 심사에 첨부되는 검증 산출물. */
export interface PromotionArtifact {
  name: string;
  /** 산출물 식별자 — 감사 원장에서 되짚을 수 있게 ID 로 남긴다. */
  ref: string;
  result: string;
  ok: boolean;
}

/** 결재선 한 단계. */
export interface PromotionStep {
  seq: string;
  label: string;
  sub: string;
  tone: 'done' | 'current' | 'upcoming';
}

/**
 * 공유범위 승격 결재 상세.
 *
 * 결재함 표시는 `ApprovalItem` 이 담당하고, 이 구조는 **자산과 범위**를 담는다.
 * 승격 결재는 프로젝트 결재(기본 정보·비즈니스 케이스·데이터 자산)와 성격이
 * 완전히 다르다 — 결재자가 판단할 것은 "이 자산을 11개 Namespace 에 열어도
 * 되는가" 한 가지다.
 */
export interface ScopePromotion {
  approvalId: string;
  assetKind: AssetKind;
  assetId: string;
  assetName: string;
  /** 자산 소유 계열사 — 승격은 소유권을 옮기지 않는다. */
  ownerTenant: Tenant;
  ownerName: string;
  version: string;
  updatedAt: string;
  fromScope: ShareScope;
  toScope: ShareScope;
  /** 요청자와 요청자의 계열사 — 타 계열사에서 올라온 요청임을 보여 준다. */
  requestedBy: string;
  requesterTenant: Tenant;
  reason: string;
  evidence: PromotionEvidence[];
  artifacts: PromotionArtifact[];
  line: PromotionStep[];
}

/** 계열사명 → K8s Namespace. 승인 시 노출 범위를 Namespace 단위로 보여 준다. */
export function namespaceOf(t: Tenant): string {
  return TENANTS.find((x) => x.name === t)?.namespace ?? '-';
}

const KIND_KO: Record<AssetKind, string> = {
  agent: '에이전트',
  prompt: '프롬프트',
  mcp: 'MCP Tool',
};

/** 자산 종류 한글 라벨 — 상세 화면·토스트가 같은 어휘를 쓰게 한다. */
export function promotionKindLabel(kind: AssetKind): string {
  return KIND_KO[kind];
}

/**
 * 시드 1건 — **AGT-204 PB 자산진단 어시스턴트** 를 계열사 → 그룹으로 승격.
 *
 * 자산·소유자·계열사·지표는 전부 mockCatalogAgents.ts / mockCatalog.ts 의
 * 실재 값이다(AGT-204 · 부산은행 · 박서연 · 계열사 범위 · ★4.6(38) · 12곳 도입 ·
 * 주간 12,480 호출 · 시스템 프롬프트 v4.2). 카탈로그에서 이 카드를 열어 두고
 * 결재 화면으로 넘어가면 같은 숫자가 이어진다.
 */
const SEED_PROMOTIONS: ScopePromotion[] = [
  {
    approvalId: 'APV-2026-101',
    assetKind: 'agent',
    assetId: 'AGT-204',
    assetName: 'PB 자산진단 어시스턴트',
    ownerTenant: '부산은행',
    ownerName: '박서연',
    version: 'v4.2',
    updatedAt: '2026-05-19 16:08',
    fromScope: '계열사',
    toScope: '그룹',
    requestedBy: '설개발',
    requesterTenant: '경남은행',
    reason:
      '경남은행 PB 채널에서 동일 업무를 별도로 만들 계획이었으나, 부산은행 자산이 이미 검증을 마쳐 중복 구축이 불필요합니다. 그룹 범위로 열어 주시면 경남은행·투자증권·자산운용이 각 Namespace 에서 그대로 호출하겠습니다.',
    evidence: [
      { k: '사용량', v: '주간 12,480 호출 · 최근 8주 연속 증가', pass: true },
      { k: '이용자 평가', v: '★ 4.6 / 5.0 · 38명 평가', pass: true },
      { k: '도입 부서', v: '12개 부서 (소유 계열사 내)', pass: true },
      { k: '운영 기간', v: '서빙계 운영 6개월 · 중단 이력 없음', pass: true },
      { k: '대고객 노출', v: '대직원 전용 — 대고객 채널 미노출', pass: true },
    ],
    artifacts: [
      { name: '레드팀 검증 결과서', ref: 'RT-2026-0412', result: '치명 0 · 중 2 (조치 완료)', ok: true },
      { name: '가드레일 정책 적용 확인', ref: 'GRD-PB-04', result: '입력·출력 필터 적용', ok: true },
      { name: 'PII 마스킹 점검', ref: 'PII-AGT-204', result: '기본 항목 6종 전량 활성', ok: true },
      { name: 'SLO 리포트 (30일)', ref: 'SLO-2026-05', result: 'P95 2.1초 · 가용률 99.7%', ok: true },
      { name: '타 계열사 적용 영향도 검토', ref: 'IMP-KN-011', result: '경남은행 상품코드 매핑 1건 보완 필요', ok: false },
    ],
    line: [
      { seq: '✓', label: '기안 — 그룹 공개 요청', sub: '설개발 (경남은행) · 2026-05-15 10:20', tone: 'done' },
      { seq: '✓', label: '자산 소유 계열사 동의', sub: '박서연 (부산은행) · 2026-05-15 15:41 동의', tone: 'done' },
      { seq: '3', label: '그룹 거버넌스 승인', sub: '결재 대기 — 공유 범위 최종 통제', tone: 'current' },
    ],
  },
];

const SEED_PROMOTION_APPROVALS: ApprovalItem[] = [
  {
    id: 'APV-2026-101',
    category: PROMOTE_CATEGORY,
    title: '[공유범위 승격] PB 자산진단 어시스턴트 · 계열사 → 그룹',
    draftedBy: '설개발',
    draftedAt: '2026-05-15 10:20',
    stage: { current: 3, total: 3, label: '그룹 거버넌스 승인' },
    state: 'pending',
    mine: true,
  },
];

/** 승격 결재 상세 — approvalId 로 조회한다. */
const promotions: ScopePromotion[] = [...SEED_PROMOTIONS];

// 시드 승격 결재를 결재함 목록 맨 앞에 얹는다(진행 중 건이라 위에 보여야 한다).
approvals.unshift(...SEED_PROMOTION_APPROVALS);

/* ═══════════════════════ 결재 스토어 (메모리 전용) ═══════════════════════ */

/**
 * `approvals` 배열은 personaView 등 여러 화면이 **같은 참조**로 들고 있어서
 * 배열 자체를 교체할 수 없다. 그래서 제자리 변경(in-place)으로 갱신하고,
 * 리렌더는 리비전 번호 구독으로 건다. localStorage 는 쓰지 않는다.
 */
let rev = 0;
const listeners = new Set<() => void>();
const emit = () => {
  rev += 1;
  listeners.forEach((l) => l());
};
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
const revSnapshot = () => rev;

/** 결재 목록 변경(신규 상신·승인·반려·보류)에 반응하도록 구독. */
export function useApprovalRevision(): number {
  return useSyncExternalStore(subscribe, revSnapshot, revSnapshot);
}

export function getPromotions(): ScopePromotion[] {
  return promotions;
}

export function findPromotion(approvalId: string | undefined): ScopePromotion | undefined {
  if (!approvalId) return undefined;
  return promotions.find((p) => p.approvalId === approvalId);
}

/** 특정 자산에 대해 이미 올라간(진행 중) 승격 결재. 중복 상신을 막는다. */
export function findPromotionByAsset(assetId: string): ScopePromotion | undefined {
  return promotions.find((p) => {
    if (p.assetId !== assetId) return false;
    const a = approvals.find((x) => x.id === p.approvalId);
    return a?.state === 'pending';
  });
}

/* ---------------- 결재 처리 결과 (승인·반려·보류) ---------------- */

export type ApprovalDecisionKind = 'approve' | 'reject' | 'hold';

export interface ApprovalDecision {
  kind: ApprovalDecisionKind;
  /** **누가** 처리했는가 — ONM-004 감사 원장의 첫 항목이다. 하드코딩 금지. */
  reviewer: string;
  reviewerRole: string;
  note?: string;
  decidedAt: string;
}

const decisions: Record<string, ApprovalDecision> = {};

export function getApprovalDecision(id: string): ApprovalDecision | undefined {
  return decisions[id];
}

export const nowLabel = (): string =>
  new Date().toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

/**
 * 일반 결재 승인·반려·보류.
 *
 * 보류는 상태를 바꾸지 않는다 — 결재선에 그대로 걸려 있고 처리 이력만 남는다.
 * 승인·반려는 상태를 확정하고 단계를 마지막으로 옮긴다.
 */
export function decideApproval(
  id: string,
  kind: ApprovalDecisionKind,
  reviewer: string,
  reviewerRole: string,
  note?: string,
): void {
  const target = approvals.find((a) => a.id === id);
  if (!target) return;
  decisions[id] = { kind, reviewer, reviewerRole, note: note?.trim() || undefined, decidedAt: nowLabel() };
  if (kind === 'approve') {
    target.state = 'done';
    target.stage = { ...target.stage, current: target.stage.total };
    target.mine = false;
    // 승격 결재라면 카탈로그의 공유 범위가 실제로 넓어진다 — 승인과 화면이 어긋나면 안 된다.
    const promo = promotions.find((p) => p.approvalId === id);
    if (promo) promoteAssetScope(promo.assetId, promo.toScope);
  } else if (kind === 'reject') {
    target.state = 'rejected';
    target.mine = false;
  }
  emit();
}

/* ---------------- 그룹 공개 요청 상신 ---------------- */

let promoteSeq = 101;

export interface PromotionDraft {
  assetKind: AssetKind;
  assetId: string;
  assetName: string;
  ownerTenant: Tenant;
  ownerName: string;
  updatedAt: string;
  fromScope: ShareScope;
  /** 카탈로그 카드가 이미 들고 있는 지표 — 승격 근거로 그대로 옮긴다. */
  usage: number;
  usageLabel: string;
  rating: number;
  ratingCount: number;
  installs: number;
  requestedBy: string;
  requesterRole: string;
  requesterTenant: Tenant;
}

/**
 * 마켓플레이스의 「그룹 공개 요청」 → 실제 결재 건 생성.
 *
 * 토스트만 띄우면 요건의 "관리자 승인 절차 기반" 이 화면에서 끊긴다.
 * 여기서 만든 건은 결재함에서 조회되고, 결재 상세에서 승인·반려된다.
 */
export function createScopePromotion(d: PromotionDraft): ApprovalItem {
  const id = `APV-2026-${++promoteSeq}`;
  const item: ApprovalItem = {
    id,
    category: PROMOTE_CATEGORY,
    title: `[공유범위 승격] ${d.assetName} · ${d.fromScope} → 그룹`,
    draftedBy: d.requestedBy,
    draftedAt: nowLabel(),
    stage: { current: 1, total: 3, label: '자산 소유 계열사 동의' },
    state: 'pending',
    mine: true,
  };
  const detail: ScopePromotion = {
    approvalId: id,
    assetKind: d.assetKind,
    assetId: d.assetId,
    assetName: d.assetName,
    ownerTenant: d.ownerTenant,
    ownerName: d.ownerName,
    version: '최신 배포본',
    updatedAt: d.updatedAt,
    fromScope: d.fromScope,
    toScope: '그룹',
    requestedBy: d.requestedBy,
    requesterTenant: d.requesterTenant,
    reason: `${d.requesterTenant} ${d.requesterRole} 가 동일 업무를 중복 구축하지 않고 재사용하기 위해 그룹 범위 공개를 요청했습니다.`,
    evidence: [
      {
        k: '사용량',
        v: `${d.usageLabel} ${d.usage.toLocaleString('ko-KR')}`,
        pass: d.usage > 0,
      },
      {
        k: '이용자 평가',
        v: d.ratingCount > 0 ? `★ ${d.rating.toFixed(1)} / 5.0 · ${d.ratingCount}명 평가` : '평가 이력 없음',
        pass: d.ratingCount > 0,
      },
      {
        k: '도입 부서',
        v: d.installs > 0 ? `${d.installs}개 부서 (소유 계열사 내)` : '도입 이력 없음',
        pass: d.installs > 0,
      },
      { k: '요청 계열사', v: `${d.requesterTenant} (${namespaceOf(d.requesterTenant)})`, pass: true },
      { k: '최근 갱신', v: d.updatedAt, pass: true },
    ],
    artifacts: [
      { name: '레드팀 검증 결과서', ref: `RT-${d.assetId}`, result: '승격 심사 시 확인 필요', ok: false },
      { name: '가드레일 정책 적용 확인', ref: `GRD-${d.assetId}`, result: '소유 계열사 정책 적용 중', ok: true },
      { name: 'PII 마스킹 점검', ref: `PII-${d.assetId}`, result: '기본 항목 활성', ok: true },
    ],
    line: [
      { seq: '✓', label: '기안 — 그룹 공개 요청', sub: `${d.requestedBy} (${d.requesterTenant}) · ${item.draftedAt}`, tone: 'done' },
      { seq: '2', label: '자산 소유 계열사 동의', sub: `${d.ownerName} (${d.ownerTenant}) · 대기`, tone: 'current' },
      { seq: '3', label: '그룹 거버넌스 승인', sub: '공유 범위 최종 통제', tone: 'upcoming' },
    ],
  };
  promotions.unshift(detail);
  approvals.unshift(item);
  emit();
  return item;
}
