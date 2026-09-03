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
import { affiliateApprover, taskOwnerOf } from '@/data/mockPersonas';
import { markAgentDeployDecision } from '@/data/mockAgentTasks';
import type { AssetKind, ShareScope } from '@/data/mockCatalog';
import { promoteAssetScope } from '@/data/mockCatalog';
import { DEMO_TODAY } from '@/data/demoClock';

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

/**
 * 요청 계열사 안에서의 활용 예정 범위.
 * 공유 범위(ShareScope)와 다르다 — 그쪽은 자산이 **열리는** 범위, 이쪽은 요청 측이
 * **쓰겠다는** 범위다. 승인권자가 영향도를 가늠하는 입력이라 기안 폼에서 받는다.
 */
export type DeployUnit = '부서' | '본부' | '계열사 전체';

export const DEPLOY_UNIT_ORDER: DeployUnit[] = ['부서', '본부', '계열사 전체'];

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

/** 결재선 한 단계 — **표시용**. 판정의 근거는 `PromotionStage` 다. */
export interface PromotionStep {
  seq: string;
  label: string;
  sub: string;
  tone: 'done' | 'current' | 'upcoming';
}

/**
 * 승격 결재의 단계 종류.
 *
 *   affiliate-admin   — 소유 계열사 관리자의 승인. RFP 관리자 포털이 "그룹 공통
 *                       AI자산과 계열사 전용 AI 자산의 공개, 공유 범위 설정" 을
 *                       관리자 기능으로 규정한다. 자산을 만든 개발자가 아니다 —
 *                       ONM-003 이 "에이전트 개발자와 승인권자 간 직무 분리" 를
 *                       필수로 요구하므로, 개발자가 승인 행위를 하면 요건 위반이다.
 *   group-governance  — 그룹 거버넌스의 최종 승인. 공유 범위 통제의 마지막 관문.
 *
 * 두 단계 모두 **관리자 그룹**이 처리한다. RFP 1.3.2 의 문구도 "**관리자** 승인
 * 절차 기반 배포·공유 범위 통제" 다.
 */
export type PromotionStageKind =
  | 'affiliate-admin'
  | 'group-governance'
  /** 에이전트 배포 결재 1단계 — 과제를 책임지는 사람. */
  | 'task-owner'
  /** 에이전트 배포 결재 2단계 — 공동존 플랫폼 관리 그룹. */
  | 'platform-admin';

/**
 * 결재선 한 단계의 **승인 주체**.
 *
 * 단계마다 처리할 사람이 다르다는 것이 직무 분리(SoD)의 실체다(ONM-003).
 * `personaView.canDecideApproval()` 이 이 값으로 승인 자격을 판정하고,
 * 자격이 없으면 화면에서 승인 버튼 자체가 나오지 않는다.
 */
export interface PromotionStage {
  /** 결재선 순번 — 1단계는 기안이므로 2 부터 시작한다. */
  seq: number;
  kind: PromotionStageKind;
  label: string;
  /** 이 단계를 처리해야 할 사람. 표시와 판정에 함께 쓴다. */
  approverName: string;
  approverTenant: Tenant;
  state: 'done' | 'current' | 'upcoming';
  /** 처리 이력 — 감사 원장의 '누가·언제'(ONM-004). */
  decidedBy?: string;
  decidedAt?: string;
  note?: string;
}

/**
 * 그룹 거버넌스 승인 단계의 담당자 — mockPersonas 의 `governance_admin`.
 *
 * 페르소나 모듈을 import 하면 결재 mock 이 로그인 모듈에 의존하게 되므로
 * 이름만 상수로 둔다. 값이 갈라지지 않게 한 곳에서만 쓴다.
 */
export const GROUP_GOVERNANCE_APPROVER = {
  name: '박거버',
  tenant: '그룹 공통' as Tenant,
};

/**
 * 소유 계열사에 승인권자 계정이 없을 때 대신 처리할 사람 — **정보보호 관리자**.
 *
 * 10개 계열사 전부에 관리자 계정을 두지는 않았다. 그 계열사 자산에 승격 요청이
 * 올라오면 2단계를 아무도 처리할 수 없어 결재가 교착한다. 실제 운영에서도
 * 미배치·공석으로 같은 일이 생기므로 위임 규칙이 필요하다.
 *
 * 거버넌스 승인자(박거버)가 아닌 사람을 대리인으로 둔다 — 같은 사람이 2·3단계를
 * 모두 처리하면 단계를 나눈 의미가 없다(ONM-003).
 */
const CONSENT_DELEGATE = {
  name: '임정보',
  tenant: '그룹 공통' as Tenant,
};

/**
 * 그룹 공동존 운영 역할의 예비 결재자 — 플랫폼 관리자.
 *
 * 기안자는 자기 건을 결재할 수 없다. 그래서 배정된 결재자가 하필 기안자면
 * 아무도 처리할 수 없는 결재가 만들어진다. 실제 결재 시스템이 대결(代決)
 * 지정을 두는 이유와 같다 — 배정 시점에 기안자를 피해서 정한다.
 */
const BACKUP_APPROVER = {
  name: '김플랫',
  tenant: '그룹 공통' as Tenant,
};

/** 기안자와 겹치면 예비 결재자로 넘긴다. */
function avoidDrafter(
  who: { name: string; tenant: Tenant },
  drafter: string,
): { name: string; tenant: Tenant } {
  return who.name === drafter ? BACKUP_APPROVER : who;
}

/**
 * 2단계(소유 계열사 관리자 승인)의 실제 처리자를 정한다.
 * 위임된 경우 라벨에 그 사실을 드러내 감사 이력에 남게 한다.
 */
function resolveAffiliateApprover(
  ownerTenant: Tenant,
  drafter: string,
): { name: string; tenant: Tenant; label: string } {
  const admin = affiliateApprover(ownerTenant);
  if (admin && admin.name !== drafter) {
    return { name: admin.name, tenant: admin.tenant, label: '소유 계열사 관리자 승인' };
  }
  const d = avoidDrafter(CONSENT_DELEGATE, drafter);
  return {
    ...d,
    label: `소유 계열사 관리자 승인 (SoD 자동 위임 · ${ownerTenant} 승인권자 미배치)`,
  };
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
  /** 기안 폼 입력 — 요청 계열사에서 이 자산을 어느 업무에 쓰려는가. */
  purpose: string;
  /** 기안 폼 입력 — 요청 계열사 안에서 어느 범위까지 쓸 계획인가. */
  deployUnit: DeployUnit;
  reason: string;
  evidence: PromotionEvidence[];
  artifacts: PromotionArtifact[];
  /** 기안 시각 — 결재선 1단계 표시에 쓴다. */
  draftedAt: string;
  /** 2단계 이후 결재선. 단계별 승인 주체가 SoD 판정의 근거다. */
  stages: PromotionStage[];
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
 * 승격 결재 시드는 **두지 않는다.**
 *
 * 예전에는 AGT-204(PB 자산진단)에 「설개발 상신 · 고승인 승인 완료 · 박거버 대기」
 * 건을 심어 뒀다. 그런데 시연 3막 파트 B 는 **지주 관리자가 그 자산의 승격을
 * 발의하는** 이야기다 — 이미 올라간 결재가 있으면 중복 상신으로 막혀 그 장면이
 * 성립하지 않는다.
 *
 * 대신 그 서사를 `mockAssetSpread.ACCESS_REQUESTS` 가 맡는다. 여러 계열사가
 * **개별 권한 요청만 반복**했고 아직 아무도 승격을 올리지 않은 상태 — 그래서
 * 지주 관리자가 "절차를 반복시키느니 범위를 넓히자" 고 판단하는 흐름이 된다.
 *
 * 진행 중인 승격 결재는 시연 중에 실제로 상신되어 생긴다(1막 AGT-731 · 3막 AGT-204).
 */
const SEED_PROMOTIONS: ScopePromotion[] = [];

/** 진행 중인 승격 결재 상세. 시연 중 상신으로 채워진다. */
let promotions: ScopePromotion[] = [...SEED_PROMOTIONS];

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

/**
 * 지금 처리해야 할 단계. 없으면(전부 done) 완결된 건이다.
 * 승인 자격 판정(`canDecideApproval`)과 결재함 노출이 모두 이 값을 본다.
 */
export function currentPromotionStage(promo: ScopePromotion): PromotionStage | undefined {
  return promo.stages.find((s) => s.state === 'current');
}

/**
 * 화면에 그릴 결재선 — **`stages` 에서 파생**한다.
 *
 * 표시용 배열을 따로 들고 있으면 단계가 넘어갈 때 둘이 어긋난다.
 * 결재선이 실제 승인 상태와 다른 말을 하는 건 이 데모에서 가장 하면 안 되는 일이다.
 */
export function promotionLine(promo: ScopePromotion): PromotionStep[] {
  const head: PromotionStep = {
    seq: '✓',
    label: '기안 — 그룹 공개 요청',
    sub: `${promo.requestedBy} (${promo.requesterTenant}) · ${promo.draftedAt}`,
    tone: 'done',
  };
  return [
    head,
    ...promo.stages.map<PromotionStep>((st) => ({
      seq: st.state === 'done' ? '✓' : String(st.seq),
      label: st.label,
      sub:
        st.state === 'done'
          ? [`${st.decidedBy ?? st.approverName}`, st.decidedAt, st.note].filter(Boolean).join(' · ')
          : `${st.approverName} (${st.approverTenant}) · ${st.state === 'current' ? '결재 대기' : '대기'}`,
      tone: st.state,
    })),
  ];
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

/**
 * 기안 시각 — **세계관의 오늘**로 찍는다.
 *
 * 예전에는 `new Date()` 였다. 그러면 2026-09-09 시연 당일에 방금 상신한 결재만
 * '2026-09-09' 를 찍고, 같은 화면의 과제 카드·감사 원장은 전부 2026-06-03 을
 * 찍는다. 리허설에서는 절대 안 잡히는 유형이라 실시간 시계를 걷어낸다
 * (`demoClock` 의 원칙, `mockAgentTasks.addAgentTask` 와 같은 값).
 */
export const nowLabel = (): string => `${DEMO_TODAY} 09:40`;

/**
 * 결재 처리 시각 — 기안보다 뒤이면서 **처리할 때마다 앞으로 나아가야** 한다.
 *
 * 2단계 결재를 연달아 승인했는데 두 단계가 같은 분(分)을 찍으면 결재선이
 * 순서를 증명하지 못한다. 그렇다고 실시간 시계를 쓰면 위와 같은 문제가 난다.
 * 그래서 세계관 안에서 정해진 시각을 차례로 소비한다 — 리허설과 본 시연이
 * 항상 같은 화면을 만든다.
 */
const DECISION_TIMES = ['10:05', '11:20', '13:40', '14:55', '16:10', '17:25'];
let decisionTick = 0;
const decisionLabel = (): string =>
  `${DEMO_TODAY} ${DECISION_TIMES[decisionTick++ % DECISION_TIMES.length]}`;

/**
 * 결재 승인·반려·보류.
 *
 * 보류는 상태를 바꾸지 않는다 — 결재선에 그대로 걸려 있고 처리 이력만 남는다.
 *
 * **승격 결재는 다단계다.** 한 단계 승인으로 끝나지 않고 다음 결재자에게 넘어간다.
 * 결재선을 3단계로 그려 놓고 클릭 한 번에 완결되면 화면이 거짓말을 하는 것이고,
 * 무엇보다 단계별 승인 주체가 다르다는 직무 분리(ONM-003)가 증명되지 않는다.
 * 그래서 마지막 단계를 통과할 때만 상태를 확정하고 공유 범위를 넓힌다.
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
  const trimmed = note?.trim() || undefined;
  const promo = promotions.find((p) => p.approvalId === id);
  // 승격이든 배포든 단계 진행 규칙은 하나다 — `stages` 를 가진 쪽을 집는다.
  const staged: { stages: PromotionStage[] } | undefined =
    promo ?? agentDeploys.find((d) => d.approvalId === id);
  const stamp = decisionLabel();

  if (kind === 'hold') {
    decisions[id] = { kind, reviewer, reviewerRole, note: trimmed, decidedAt: stamp };
    emit();
    return;
  }

  // 처리한 사람을 단계에 새긴다 — 승인이든 반려든 '누가' 가 남아야 한다(ONM-004).
  const stage = staged?.stages.find((st) => st.state === 'current');
  if (stage) {
    stage.decidedBy = `${reviewer} (${reviewerRole})`;
    stage.decidedAt = stamp;
    stage.note = trimmed;
  }

  if (staged && stage && kind === 'approve') {
    stage.state = 'done';
    const next = staged.stages.find((s) => s.state === 'upcoming');
    if (next) {
      // 아직 완결이 아니다. 다음 단계의 승인권자에게 넘어간다.
      next.state = 'current';
      target.stage = { current: next.seq, total: staged.stages.length + 1, label: next.label };
      emit();
      return;
    }
  }

  const dep = agentDeploys.find((d) => d.approvalId === id);
  decisions[id] = { kind, reviewer, reviewerRole, note: trimmed, decidedAt: stamp };
  if (kind === 'approve') {
    target.state = 'done';
    target.stage = { ...target.stage, current: target.stage.total };
    target.mine = false;
    // 최종 승인에서만 카탈로그의 공유 범위가 넓어진다 — 승인과 화면이 어긋나면 안 된다.
    if (promo) promoteAssetScope(promo.assetId, promo.toScope);
    // 마찬가지로 최종 승인에서만 과제가 「결재 진행 중」을 벗어난다.
    if (dep) markAgentDeployDecision(dep.agentId, 'approve', dep.deployStage);
  } else {
    target.state = 'rejected';
    target.mine = false;
    if (dep) markAgentDeployDecision(dep.agentId, 'reject', dep.deployStage);
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
  /** 기안 폼 입력. 자동 생성하지 않는다 — 결재자가 읽을 사유를 요청자가 직접 쓴다. */
  purpose: string;
  deployUnit: DeployUnit;
  reason: string;
}

/**
 * 기안 폼의 결재선 미리보기 — 상신 전에 누가 결재할지 보여 준다.
 * `createScopePromotion` 과 같은 배정 규칙을 쓰므로 미리보기와 실제가 어긋나지 않는다.
 */
export function previewPromotionApprovers(
  ownerTenant: Tenant,
  drafter: string,
): { affiliate: { name: string; tenant: Tenant; label: string }; governance: { name: string; tenant: Tenant } } {
  return {
    affiliate: resolveAffiliateApprover(ownerTenant, drafter),
    governance: avoidDrafter(GROUP_GOVERNANCE_APPROVER, drafter),
  };
}

/**
 * 마켓플레이스의 「그룹 공개 요청」 → 실제 결재 건 생성.
 *
 * 토스트만 띄우면 요건의 "관리자 승인 절차 기반" 이 화면에서 끊긴다.
 * 여기서 만든 건은 결재함에서 조회되고, 결재 상세에서 승인·반려된다.
 */
export function createScopePromotion(d: PromotionDraft): ApprovalItem {
  const id = `APV-2026-${++promoteSeq}`;
  const consent = resolveAffiliateApprover(d.ownerTenant, d.requestedBy);
  const governance = avoidDrafter(GROUP_GOVERNANCE_APPROVER, d.requestedBy);
  const item: ApprovalItem = {
    id,
    category: PROMOTE_CATEGORY,
    title: `[공유범위 승격] ${d.assetName} · ${d.fromScope} → 그룹`,
    draftedBy: d.requestedBy,
    draftedAt: nowLabel(),
    stage: { current: 2, total: 3, label: '소유 계열사 관리자 승인' },
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
    purpose: d.purpose,
    deployUnit: d.deployUnit,
    reason: d.reason,
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
    draftedAt: item.draftedAt,
    stages: [
      {
        seq: 2,
        kind: 'affiliate-admin',
        label: consent.label,
        approverName: consent.name,
        approverTenant: consent.tenant,
        state: 'current',
      },
      {
        seq: 3,
        kind: 'group-governance',
        label: '그룹 거버넌스 승인',
        approverName: governance.name,
        approverTenant: governance.tenant,
        state: 'upcoming',
      },
    ],
  };
  promotions.unshift(detail);
  approvals.unshift(item);
  emit();
  return item;
}


/* ═══════════════ 에이전트 배포 결재 (AI Studio 기안) ═══════════════ */

/**
 * AI Studio 에서 에이전트를 기안하면 생기는 **배포 결재**.
 *
 * RFP 근거
 *  · LSM-009 「승인 기반 에이전트 배포」 — 만들었다고 올라가지 않는다
 *  · ONM-003 「직무 분리(SoD) 기반 RBAC」 — 개발자와 승인권자는 반드시 다른 사람
 *
 * 승격 결재(`ScopePromotion`)와 **같은 `stages` 기계**를 쓴다. 단계 진행·승인
 * 자격 판정이 한 곳에서만 돌아가야 두 화면이 다른 말을 하지 않는다.
 */

/**
 * 에이전트 등록 시 고를 수 있는 사용 범위.
 *
 * **계열사 이상은 여기서 고를 수 없다.** 자기 부서를 넘어 남이 보는 자산이 되는
 * 순간부터는 마켓플레이스의 승격 결재(`ScopePromotion`)로 넘어간다 — 등록 폼에서
 * 계열사 공개까지 한 번에 끝내면 RFP 1.3.2 의 "관리자 승인 절차 기반 공유 범위
 * 통제" 가 화면에서 우회된다.
 */
export type AgentUseScope = '개인' | '부서';
export const AGENT_USE_SCOPES: AgentUseScope[] = ['개인', '부서'];

export interface AgentDeployKnowledge {
  id: string;
  name: string;
  owner: string;
  updatedAt: string;
}

export interface AgentDeployApproval {
  approvalId: string;
  agentId: string;
  agentName: string;
  /** 어느 환경으로 올리는 결재인가. */
  deployStage: '학습계' | '서빙계';
  useScope: AgentUseScope;
  ownerTenant: Tenant;
  draftedBy: string;
  draftedByRole: string;
  draftedAt: string;
  mainModel: string;
  builderLabel: string;
  /** 템플릿에서 복제했다면 그 출처 — 재사용 자산 관리 이력(2-1). */
  templateFrom?: { id: string; name: string };
  linkedKnowledge: AgentDeployKnowledge[];
  /** 기안 시점에 확인된 필수 항목. 결재자가 판단 근거로 본다. */
  checks: { k: string; v: string; pass: boolean }[];
  stages: PromotionStage[];
}

const agentDeploys: AgentDeployApproval[] = [];

export function getAgentDeploys(): AgentDeployApproval[] {
  return agentDeploys;
}

export function findAgentDeploy(approvalId: string | undefined): AgentDeployApproval | undefined {
  if (!approvalId) return undefined;
  return agentDeploys.find((d) => d.approvalId === approvalId);
}

/** 플랫폼 관리 그룹 승인 단계의 담당자 — mockPersonas 의 `platform_admin`. */
const PLATFORM_APPROVER = { name: '김플랫', tenant: '그룹 공통' as Tenant };

/**
 * 배포 결재 1단계(과제 오너 그룹)의 실제 처리자.
 *
 * 피해야 할 사람이 둘이다 — **기안자**(자기결재)와 **2단계 승인자**(같은 사람이
 * 두 단계를 다 처리하면 단계를 나눈 의미가 없다). 그룹 공통 소속 기안자의 경우
 * 과제 오너가 없어 플랫폼 관리자로 떨어지는데, 그러면 1·2단계가 같은 사람이
 * 된다. 그래서 배제 목록을 받아 순서대로 내려간다(ONM-003).
 */
function resolveTaskOwnerApprover(
  ownerTenant: Tenant,
  drafter: string,
  taken: string[] = [],
): { name: string; tenant: Tenant; label: string } {
  const blocked = (who?: { name: string }) => !who || who.name === drafter || taken.includes(who.name);

  const owner = taskOwnerOf(ownerTenant);
  if (!blocked(owner)) {
    return { name: owner!.name, tenant: owner!.tenant, label: '과제 오너 그룹 승인' };
  }
  const admin = affiliateApprover(ownerTenant);
  if (!blocked(admin)) {
    return { name: admin!.name, tenant: admin!.tenant, label: '과제 오너 그룹 승인 (계열사 승인권자 대결)' };
  }
  // 그룹 공통 자산이거나 계열사에 배치된 사람이 없을 때 — 거버넌스가 1단계를 본다.
  const g = GROUP_GOVERNANCE_APPROVER;
  if (!blocked(g)) {
    return { ...g, label: `과제 오너 그룹 승인 (SoD 자동 위임 · ${ownerTenant} 오너 미배치)` };
  }
  return { ...CONSENT_DELEGATE, label: '과제 오너 그룹 승인 (SoD 자동 위임)' };
}

/**
 * 기안 전에 결재선을 미리 보여 준다 — 등록 폼 사이드바가 쓴다.
 * 2단계를 먼저 정하고 1단계가 그 사람을 피하게 한다.
 */
export function previewDeployApprovers(ownerTenant: Tenant, drafter: string) {
  const platform = avoidDrafter(PLATFORM_APPROVER, drafter);
  return {
    owner: resolveTaskOwnerApprover(ownerTenant, drafter, [platform.name]),
    platform,
  };
}

export interface AgentDeployDraft {
  agentId: string;
  agentName: string;
  deployStage: '학습계' | '서빙계';
  useScope: AgentUseScope;
  ownerTenant: Tenant;
  draftedBy: string;
  draftedByRole: string;
  mainModel: string;
  builderLabel: string;
  templateFrom?: { id: string; name: string };
  linkedKnowledge: AgentDeployKnowledge[];
  checks: { k: string; v: string; pass: boolean }[];
}

/*
 * 발번 대역을 **승격 결재와 분리한다.**
 *
 * 처음엔 승격과 같은 `APV-2026-###` 를 101 부터 썼는데, 시드 승격 결재가 이미
 * `APV-2026-101` 을 쓰고 있어서 기안 한 번에 ID 가 겹쳤다. 결재함에 같은 번호가
 * 두 줄 뜨고, 상세 화면은 먼저 조회되는 쪽(배포)으로 넘어가 승격 결재가 열리지
 * 않았다. 종류가 다른 결재는 대역도 달라야 한다.
 */
let deploySeq = 1;

/** AI Studio 「기안」 → 실제 결재 건 생성. 결재함과 상세 화면이 이걸 읽는다. */
export function submitAgentDeploy(draft: AgentDeployDraft): ApprovalItem {
  const id = `APV-AGT-${String(deploySeq++).padStart(3, '0')}`;
  const stamp = nowLabel();
  const platform = avoidDrafter(PLATFORM_APPROVER, draft.draftedBy);
  const owner = resolveTaskOwnerApprover(draft.ownerTenant, draft.draftedBy, [platform.name]);

  const item: ApprovalItem = {
    id,
    category: draft.deployStage === '서빙계' ? 'serv' : 'train',
    title: `${draft.agentName} ${draft.deployStage} 배포`,
    draftedBy: `${draft.draftedBy} (${draft.draftedByRole})`,
    draftedAt: stamp,
    stage: { current: 1, total: 3, label: owner.label },
    state: 'pending',
    mine: true,
  };

  agentDeploys.unshift({
    ...draft,
    approvalId: id,
    draftedAt: stamp,
    stages: [
      {
        seq: 1,
        kind: 'task-owner',
        label: owner.label,
        approverName: owner.name,
        approverTenant: owner.tenant,
        state: 'current',
      },
      {
        seq: 2,
        kind: 'platform-admin',
        label: '플랫폼 관리 그룹 승인',
        approverName: platform.name,
        approverTenant: platform.tenant,
        state: 'upcoming',
      },
    ],
  });
  approvals.unshift(item);
  emit();
  return item;
}

/**
 * 화면에 그릴 결재선 — `promotionLine` 과 같은 규칙으로 `stages` 에서 파생한다.
 * 표시용 배열을 따로 들면 단계가 넘어갈 때 둘이 어긋난다.
 */
export function deployLine(dep: AgentDeployApproval): PromotionStep[] {
  const head: PromotionStep = {
    seq: '✓',
    label: `기안 — ${dep.deployStage} 배포 요청`,
    sub: `${dep.draftedBy} (${dep.ownerTenant}) · ${dep.draftedAt}`,
    tone: 'done',
  };
  return [
    head,
    ...dep.stages.map<PromotionStep>((st) => ({
      seq: st.state === 'done' ? '✓' : String(st.seq),
      label: st.label,
      sub:
        st.state === 'done'
          ? [`${st.decidedBy ?? st.approverName}`, st.decidedAt, st.note].filter(Boolean).join(' · ')
          : `${st.approverName} (${st.approverTenant}) · ${st.state === 'current' ? '결재 대기' : '대기'}`,
      tone: st.state,
    })),
  ];
}

/** 지금 처리해야 할 단계. 없으면 완결된 건이다. */
export function currentDeployStage(dep: AgentDeployApproval): PromotionStage | undefined {
  return dep.stages.find((s) => s.state === 'current');
}
