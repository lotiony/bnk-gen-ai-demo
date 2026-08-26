/**
 * 그룹 공통 랜딩 mock — 핸드오프 §2 화면 1.
 *
 * RFP: Ⅱ.3.나(3) 11개 Namespace 구조 · SEC-001 테넌트 격리
 *
 * 화면 1 의 목적은 "계열사를 고르게 하는 것"이 아니라
 * **11개 Namespace = 계열사 10 + 그룹 공통 1 이라는 구조를 각인시키는 것**이다
 * (핸드오프 §2). 그래서 카드마다 K8s Namespace 식별자를 그대로 노출하고,
 * 상단에 클러스터 한 덩어리 안에 11개가 나뉘어 있는 그림을 둔다.
 *
 * 테넌트 목록 자체는 `tenants.ts` 가 단일 진실 공급원이다. 여기서는
 * 화면에 얹을 **수치만** 덧붙인다 — 계열사를 추가·수정하려면 tenants.ts 만 고친다.
 *
 * ⚠️ 전부 가상 수치다.
 */
import { TENANTS, type Tenant, type TenantMeta } from '@/data/tenants';

export type TenantStatus = 'active' | 'onboarding';

export interface TenantStat {
  users: number;
  agents: number;
  /** 월 토큰 사용량(M). */
  tokensM: number;
  status: TenantStatus;
}

const STATS: Record<Tenant, TenantStat> = {
  '부산은행': { users: 4820, agents: 14, tokensM: 1_260, status: 'active' },
  '경남은행': { users: 3140, agents: 9, tokensM: 720, status: 'active' },
  'BNK캐피탈': { users: 780, agents: 5, tokensM: 180, status: 'active' },
  'BNK투자증권': { users: 640, agents: 6, tokensM: 360, status: 'active' },
  'BNK저축은행': { users: 310, agents: 3, tokensM: 72, status: 'active' },
  'BNK자산운용': { users: 190, agents: 2, tokensM: 41, status: 'active' },
  'BNK벤처투자': { users: 90, agents: 1, tokensM: 12, status: 'onboarding' },
  'BNK시스템': { users: 520, agents: 4, tokensM: 96, status: 'active' },
  'BNK신용정보': { users: 240, agents: 2, tokensM: 28, status: 'active' },
  'BNK엘앤에스': { users: 160, agents: 1, tokensM: 9, status: 'onboarding' },
  '그룹 공통': { users: 11_090, agents: 7, tokensM: 480, status: 'active' },
};

export interface TenantCard extends TenantMeta {
  stat: TenantStat;
}

export const TENANT_CARDS: TenantCard[] = TENANTS.map((t) => ({ ...t, stat: STATS[t.name] }));

export const GROUP_CARD: TenantCard = TENANT_CARDS.find((t) => t.kind === 'group')!;
export const AFFILIATE_CARDS: TenantCard[] = TENANT_CARDS.filter((t) => t.kind === 'affiliate');

export const TENANT_STATUS_META: Record<TenantStatus, { label: string; cls: string }> = {
  active: { label: '운영 중', cls: 'bg-ok-bg text-ok border-ok-border' },
  onboarding: { label: '온보딩', cls: 'bg-warn-bg text-warn border-warn-border' },
};

/** 랜딩 하단에 붙는 격리 원칙 — SEC-001 서술과 어긋나면 안 된다. */
export const ISOLATION_NOTES: { k: string; v: string }[] = [
  {
    k: '네트워크 격리',
    v: 'Namespace 간 통신은 NetworkPolicy 로 기본 차단. 계열사 내부망과도 분리된 공동존 상면에 위치한다.',
  },
  {
    k: '데이터 격리',
    v: '지식 인덱스·대화 이력·감사 로그는 소속 Namespace 안에서만 보관·조회된다.',
  },
  {
    k: '공유 경로',
    v: '계열사 간 공유는 그룹 공통 포털의 카탈로그 등재를 거친 자산에 한한다. 직접 접근 경로는 없다.',
  },
  {
    k: '자원 쿼터',
    v: 'GPU·토큰 쿼터는 Namespace 단위로 상한이 걸리며, 한 계열사의 폭주가 다른 계열사에 전이되지 않는다.',
  },
];

export const CLUSTER_SUMMARY = {
  namespaces: TENANTS.length,
  affiliates: AFFILIATE_CARDS.length,
  users: TENANT_CARDS.filter((t) => t.kind === 'affiliate').reduce((a, t) => a + t.stat.users, 0),
  agents: TENANT_CARDS.reduce((a, t) => a + t.stat.agents, 0),
};
