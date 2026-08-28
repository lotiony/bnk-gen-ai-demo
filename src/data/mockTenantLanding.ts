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
 * ⚠️ **에이전트 수는 손으로 적지 않는다.**
 *   예전에는 여기 카드에 "공용 에이전트 7 · 부산은행 14" 라고 박아 뒀는데,
 *   실제 카탈로그는 부산은행 7종·그룹 공통 11종이었다. 랜딩(정거장 1)에서 본
 *   숫자와 마켓플레이스(정거장 6)에서 세는 카드 수가 다르면 그 자리에서 드러난다.
 *   그래서 `tenants.ts` 가 계열사의 단일 출처인 것과 같은 방식으로,
 *   에이전트 수는 **카탈로그·그룹 공통 에이전트에서 파생 계산**한다.
 *   관리 콘솔(mockAdminTasks·mockAdminDashboard)이 세는 23종과 같은 모집합이다
 *   — 계열사 자산 13 + AGB-006 그룹 공통 10.
 *
 * ⚠️ 이용자 수·토큰량은 계측에서 오는 값이라 파생시킬 원천이 없다. 그 둘만 상수다.
 */
import { TENANTS, type Tenant, type TenantMeta } from '@/data/tenants';
import { MOCK_CATALOG_AGENTS } from '@/data/mockCatalogAgents';
import { GROUP_AGENTS } from '@/data/mockGroupAgents';

export type TenantStatus = 'active' | 'onboarding';

export interface TenantStat {
  users: number;
  /** 이 Namespace 에 배포된 에이전트 수 — 카탈로그에서 파생. */
  agents: number;
  /** 월 토큰 사용량(M). */
  tokensM: number;
  status: TenantStatus;
}

/** 계측에서 오는 값 — 파생시킬 원천이 없어 상수로 둔다. */
const MEASURED: Record<Tenant, { users: number; tokensM: number }> = {
  '부산은행': { users: 4820, tokensM: 1_260 },
  '경남은행': { users: 3140, tokensM: 720 },
  'BNK캐피탈': { users: 780, tokensM: 180 },
  'BNK투자증권': { users: 640, tokensM: 360 },
  'BNK저축은행': { users: 310, tokensM: 72 },
  'BNK자산운용': { users: 190, tokensM: 41 },
  'BNK벤처투자': { users: 90, tokensM: 12 },
  'BNK시스템': { users: 520, tokensM: 96 },
  'BNK신용정보': { users: 240, tokensM: 28 },
  'BNK엘앤에스': { users: 160, tokensM: 9 },
  '그룹 공통': { users: 11_090, tokensM: 480 },
};

/**
 * 이 Namespace 에 배포된 에이전트 수.
 *  · 계열사   = 카탈로그에 등재된 자사 에이전트
 *  · 그룹 공통 = AGB-006 필수 Use Case 10종 + 카탈로그의 그룹 공통 자산
 */
function agentsOf(t: Tenant): number {
  const own = MOCK_CATALOG_AGENTS.filter((a) => a.tenant === t).length;
  return t === '그룹 공통' ? own + GROUP_AGENTS.length : own;
}

/**
 * 상태도 파생값이다 — 자사 에이전트가 아직 0종이면 '온보딩'.
 * 손으로 적으면 "운영 중인데 에이전트 0" 같은 카드가 남는다.
 */
function statusOf(t: Tenant): TenantStatus {
  if (t === '그룹 공통') return 'active';
  return agentsOf(t) > 0 ? 'active' : 'onboarding';
}

const STATS: Record<Tenant, TenantStat> = TENANTS.reduce(
  (acc, t) => ({
    ...acc,
    [t.name]: {
      users: MEASURED[t.name].users,
      agents: agentsOf(t.name),
      tokensM: MEASURED[t.name].tokensM,
      status: statusOf(t.name),
    },
  }),
  {} as Record<Tenant, TenantStat>,
);

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
