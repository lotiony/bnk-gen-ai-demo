/**
 * 공통 카탈로그 확장 mock — 핸드오프 §2 화면 6.
 *
 * RFP: 마켓플레이스 요건
 *
 * 원본 mockup 의 카탈로그는 **"계열사 간 공유는 지원되지 않는다"** 를 하드코딩하고
 * 있었다. BNK 는 정반대다 — 그룹 공동 플랫폼이고, 화면 1(랜딩)에서 이미
 * "계열사 간 공유는 그룹 공통 포털의 카탈로그 등재를 거친 자산에 한한다"고
 * 말했다. 두 화면이 반대로 말하면 그대로 리스크다. 그래서 공유 규칙을 뒤집되,
 * **아무거나 열리는 게 아니라 공유 범위에 따라 갈리게** 한다.
 *
 * 공유 범위 5단계는 핸드오프 §2 화면 6 이 명시한 그대로다.
 *   개인 → 부서 → 본부 → 계열사 → 그룹
 * 이 중 **그룹** 만이 타 계열사에서 바로 쓸 수 있다. 나머지는 소유 계열사 안에서만
 * 보이며, 타 계열사 사용자는 '그룹 공개 요청'(거버넌스 결재)을 낼 수 있다.
 *
 * 자산 종류도 셋으로 나눈다(에이전트·프롬프트·MCP Tool) — 스펙이 "에이전트·
 * 프롬프트·MCP 통합 카탈로그"라고 썼기 때문이다.
 *
 * ⚠️ 전부 가상 데이터다.
 */
import type { Tenant } from '@/data/tenants';
import { MOCK_CATALOG_AGENTS } from '@/data/mockCatalogAgents';

export type ShareScope = '개인' | '부서' | '본부' | '계열사' | '그룹';

export const SCOPE_ORDER: ShareScope[] = ['개인', '부서', '본부', '계열사', '그룹'];

export const SCOPE_META: Record<ShareScope, { cls: string; desc: string }> = {
  개인: { cls: 'bg-surface text-ink-mid border-line', desc: '만든 사람만' },
  부서: { cls: 'bg-surface text-ink-dark border-line', desc: '같은 부서' },
  본부: { cls: 'bg-info-bg text-info border-info-border', desc: '같은 본부' },
  계열사: { cls: 'bg-warn-bg text-warn border-warn-border', desc: '같은 계열사 전체' },
  그룹: { cls: 'bg-ok-bg text-ok border-ok-border', desc: '11개 Namespace 전체' },
};

/** 자산 공통 메타 — 랭킹·공유 범위. */
export interface CatalogMeta {
  scope: ShareScope;
  /** 5점 만점 평균 평가. */
  rating: number;
  ratingCount: number;
  /** 다른 조직이 가져다 쓴 횟수. */
  installs: number;
  tags: string[];
}

/**
 * 에이전트 메타를 별도 맵으로 둔다 — 원본 `MOCK_CATALOG_AGENTS` 리터럴을
 * 건드리지 않기 위해서다(다른 화면이 같은 배열을 쓴다).
 */
export const AGENT_META: Record<string, CatalogMeta> = {
  'AGT-204': { scope: '계열사', rating: 4.6, ratingCount: 38, installs: 12, tags: ['PB', '자산진단', '상담'] },
  'AGT-301': { scope: '그룹', rating: 4.8, ratingCount: 96, installs: 41, tags: ['보이스피싱', '분류', '대고객'] },
  'AGT-411': { scope: '그룹', rating: 4.4, ratingCount: 52, installs: 27, tags: ['컴플라이언스', '규정', '내부통제'] },
  'AGT-512': { scope: '본부', rating: 4.1, ratingCount: 19, installs: 4, tags: ['여신', '사전심사'] },
  'AGT-602': { scope: '계열사', rating: 4.2, ratingCount: 31, installs: 6, tags: ['카드', '분실신고', '응대'] },
  'AGT-708': { scope: '그룹', rating: 4.5, ratingCount: 44, installs: 18, tags: ['보험금', '서류분류', 'OCR'] },
  'AGT-812': { scope: '부서', rating: 3.9, ratingCount: 8, installs: 1, tags: ['리스크', '브리핑'] },
  'AGT-905': { scope: '개인', rating: 0, ratingCount: 0, installs: 0, tags: ['연금', '상담'] },
  'AGT-205': { scope: '계열사', rating: 4.3, ratingCount: 15, installs: 5, tags: ['시황', '리서치', 'PB'] },
  'AGT-318': { scope: '그룹', rating: 4.7, ratingCount: 61, installs: 33, tags: ['수신', '예적금', '상담'] },
  'AGT-072': { scope: '그룹', rating: 4.5, ratingCount: 47, installs: 26, tags: ['외환', '환전', '상담'] },
  'AGT-621': { scope: '계열사', rating: 4.0, ratingCount: 12, installs: 3, tags: ['CS', '코파일럿'] },
  'AGT-701': { scope: '개인', rating: 0, ratingCount: 0, installs: 0, tags: ['자금세탁방지', 'AML'] },
};

/* ═══════════════════════ 프롬프트 ═══════════════════════ */

export interface CatalogPrompt {
  id: string;
  name: string;
  tenant: Tenant;
  owner: string;
  description: string;
  /** 프롬프트가 겨냥한 모델. */
  model: string;
  /** 최근 30일 사용 횟수. */
  uses30d: number;
  updatedAt: string;
  meta: CatalogMeta;
}

export const CATALOG_PROMPTS: CatalogPrompt[] = [
  {
    id: 'PRM-101', name: '규정 조항 요약 프롬프트', tenant: '그룹 공통', owner: '박거버',
    description: '조항 원문을 실무자 언어로 3줄 요약하되, 단서 조항을 빠뜨리지 않게 강제한다.',
    model: 'onprem/gpt-oss-120b', uses30d: 4820, updatedAt: '2026-06-01',
    meta: { scope: '그룹', rating: 4.7, ratingCount: 64, installs: 33, tags: ['규정', '요약', '컴플라이언스'] },
  },
  {
    id: 'PRM-118', name: '상담 이력 비식별 요약', tenant: '부산은행', owner: '정오너',
    description: '상담 로그에서 개인정보를 제거하고 상담 의도·처리 결과만 남긴다.',
    model: 'onprem/qwen3-32b', uses30d: 2140, updatedAt: '2026-05-31',
    meta: { scope: '그룹', rating: 4.5, ratingCount: 41, installs: 19, tags: ['비식별', '요약', 'PII'] },
  },
  {
    id: 'PRM-204', name: '여신 심사 의견 초안', tenant: '부산은행', owner: '조디비',
    description: '재무 지표와 담보 정보를 받아 심사 의견 초안을 작성한다. 확정 표현을 금지한다.',
    model: 'onprem/llama-3.3-70b', uses30d: 960, updatedAt: '2026-05-30',
    meta: { scope: '계열사', rating: 4.3, ratingCount: 22, installs: 3, tags: ['여신', '심사', '초안'] },
  },
  {
    id: 'PRM-231', name: '고객 응대 톤 교정', tenant: 'BNK캐피탈', owner: '정우진',
    description: '초안 응대문을 금융 표준 문체로 교정한다. 단정·확약 표현을 걸러낸다.',
    model: 'onprem/qwen3-32b', uses30d: 1380, updatedAt: '2026-05-29',
    meta: { scope: '그룹', rating: 4.1, ratingCount: 17, installs: 9, tags: ['응대', '문체', '대고객'] },
  },
  {
    id: 'PRM-309', name: '내부 보고서 개조식 변환', tenant: 'BNK투자증권', owner: '이서연',
    description: '서술형 문단을 개조식 보고 형식으로 바꾼다.', model: 'onprem/gpt-oss-120b',
    uses30d: 410, updatedAt: '2026-05-24',
    meta: { scope: '부서', rating: 3.8, ratingCount: 6, installs: 0, tags: ['보고서', '개조식'] },
  },
];

/* ═══════════════════════ MCP Tool ═══════════════════════ */

export interface CatalogMcp {
  id: string;
  name: string;
  server: string;
  tenant: Tenant;
  owner: string;
  description: string;
  /** 읽기 전용인가. 쓰기 도구는 결재 없이는 못 쓴다(화면 8과 같은 규칙). */
  readOnly: boolean;
  calls30d: number;
  updatedAt: string;
  meta: CatalogMeta;
}

export const CATALOG_MCP: CatalogMcp[] = [
  {
    id: 'MCP-011', name: 'authority.lookup', server: 'bnk-authority-mcp', tenant: '그룹 공통',
    owner: '박거버', description: '여신 금액·구분으로 전결권자와 근거 조항을 반환한다.',
    readOnly: true, calls30d: 8420, updatedAt: '2026-06-03',
    meta: { scope: '그룹', rating: 4.9, ratingCount: 51, installs: 24, tags: ['전결', '규정', '조회'] },
  },
  {
    id: 'MCP-012', name: 'authority.get_clause', server: 'bnk-authority-mcp', tenant: '그룹 공통',
    owner: '박거버', description: '전결규정 조항 원문을 조회한다.',
    readOnly: true, calls30d: 3110, updatedAt: '2026-06-03',
    meta: { scope: '그룹', rating: 4.6, ratingCount: 33, installs: 16, tags: ['규정', '원문'] },
  },
  {
    id: 'MCP-021', name: 'knowledge.search', server: 'bnk-knowledge-mcp', tenant: '그룹 공통',
    owner: '이사업', description: '지식 인덱스에서 문단을 검색한다. Namespace 격리가 적용된다.',
    readOnly: true, calls30d: 26400, updatedAt: '2026-06-02',
    meta: { scope: '그룹', rating: 4.7, ratingCount: 88, installs: 46, tags: ['검색', 'RAG'] },
  },
  {
    id: 'MCP-034', name: 'crm.customer_profile', server: 'bnk-crm-mcp', tenant: '부산은행',
    owner: '조디비', description: '고객 프로필을 조회한다. 동의 권원 확인 후에만 원본이 반환된다.',
    readOnly: true, calls30d: 5180, updatedAt: '2026-06-01',
    meta: { scope: '계열사', rating: 4.4, ratingCount: 26, installs: 2, tags: ['CRM', '고객', '권원'] },
  },
  {
    id: 'MCP-041', name: 'hr.leave_balance', server: 'bnk-hr-mcp', tenant: '그룹 공통',
    owner: '이사업', description: '임직원 잔여 연차를 조회한다.',
    readOnly: true, calls30d: 1920, updatedAt: '2026-05-28',
    meta: { scope: '그룹', rating: 4.0, ratingCount: 14, installs: 11, tags: ['인사', '연차'] },
  },
  {
    id: 'MCP-052', name: 'authority.create_delegation', server: 'bnk-authority-mcp', tenant: '그룹 공통',
    owner: '박거버', description: '전결 위임을 등록한다. 쓰기 동작이라 승인권자 결재가 선행된다.',
    readOnly: false, calls30d: 0, updatedAt: '2026-06-03',
    meta: { scope: '계열사', rating: 0, ratingCount: 0, installs: 0, tags: ['전결', '위임', '쓰기'] },
  },
];

/* ═══════════════════════ 공유 판정 ═══════════════════════ */

export type UseVerdict = 'own' | 'group-open' | 'request' | 'hidden';

/**
 * 내가 이 자산을 쓸 수 있는가.
 *   own        — 내 계열사 자산 (범위와 무관하게 조직 내부 규칙을 따른다)
 *   group-open — 타 계열사지만 **그룹 범위**로 공개된 자산 → 바로 사용
 *   request    — 타 계열사이고 계열사 범위 → 그룹 공개 요청(거버넌스 결재) 대상
 *   hidden     — 타 계열사이고 본부 이하 → 카탈로그에 노출되지 않는다
 */
export function useVerdict(assetTenant: Tenant, scope: ShareScope, myTenant: Tenant): UseVerdict {
  if (assetTenant === myTenant || assetTenant === '그룹 공통') return 'own';
  if (scope === '그룹') return 'group-open';
  if (scope === '계열사') return 'request';
  return 'hidden';
}

export const VERDICT_META: Record<UseVerdict, { label: string; cls: string }> = {
  own: { label: '내 계열사 자산', cls: 'bg-surface text-ink-mid border-line-soft' },
  'group-open': { label: '그룹 공개 · 바로 사용', cls: 'bg-ok-bg text-ok border-ok-border' },
  request: { label: '그룹 공개 요청 대상', cls: 'bg-warn-bg text-warn border-warn-border' },
  hidden: { label: '비노출', cls: 'bg-surface text-ink-light border-line-soft' },
};

/** 통합 검색용 평면 목록 — 종류가 달라도 같은 축으로 정렬·검색한다. */
export type AssetKind = 'agent' | 'prompt' | 'mcp';

export interface CatalogItem {
  kind: AssetKind;
  id: string;
  name: string;
  tenant: Tenant;
  owner: string;
  description: string;
  /** 사용량 — 종류별 단위가 달라 라벨을 함께 갖는다. */
  usage: number;
  usageLabel: string;
  updatedAt: string;
  meta: CatalogMeta;
  /** 종류별 부가 표기. */
  extra: string;
}

export const KIND_META: Record<AssetKind, { label: string; icon: string; cls: string }> = {
  agent: { label: '에이전트', icon: '🤖', cls: 'bg-brand-tint text-brand border-brand-tint' },
  prompt: { label: '프롬프트', icon: '✎', cls: 'bg-accent-purple-bg text-accent-purple border-accent-purple-border' },
  mcp: { label: 'MCP Tool', icon: '🔧', cls: 'bg-ok-bg text-ok border-ok-border' },
};

/* ═══════════════════════ 승격 반영 ═══════════════════════ */

/**
 * 승인된 공유범위 승격 결과 — 자산 ID → 승격된 범위.
 *
 * RFP 1.3.2 는 공유 범위 통제를 "관리자 승인 절차 기반" 으로 요구한다.
 * 결재가 승인됐는데 카탈로그 배지가 그대로면 화면이 스스로와 모순되므로,
 * 승인 시점에 여기에 반영하고 카탈로그가 이 값을 우선 읽는다.
 * localStorage 를 쓰지 않는다(CLAUDE.md 절대 규칙).
 */
const scopeOverrides: Record<string, ShareScope> = {};

/** 승격 결재 승인 시 호출 — mockApprovals.decideApproval 이 부른다. */
export function promoteAssetScope(assetId: string, scope: ShareScope): void {
  scopeOverrides[assetId] = scope;
}

/** 승격이 반영된 실제 공유 범위. */
export function effectiveScope(assetId: string, base: ShareScope): ShareScope {
  return scopeOverrides[assetId] ?? base;
}

function withScope(id: string, meta: CatalogMeta): CatalogMeta {
  const sc = effectiveScope(id, meta.scope);
  return sc === meta.scope ? meta : { ...meta, scope: sc };
}

export function getCatalogItems(): CatalogItem[] {
  const agents: CatalogItem[] = MOCK_CATALOG_AGENTS.map((a) => ({
    kind: 'agent',
    id: a.id,
    name: a.name,
    tenant: a.tenant,
    owner: a.ownerName,
    description: a.description,
    usage: a.callsWeekly,
    usageLabel: '주간 호출',
    updatedAt: a.updatedAt,
    meta: withScope(
      a.id,
      AGENT_META[a.id] ?? { scope: '개인', rating: 0, ratingCount: 0, installs: 0, tags: [] },
    ),
    extra: `${a.projectName} · ${a.mainModel}`,
  }));
  const prompts: CatalogItem[] = CATALOG_PROMPTS.map((p) => ({
    kind: 'prompt', id: p.id, name: p.name, tenant: p.tenant, owner: p.owner,
    description: p.description, usage: p.uses30d, usageLabel: '30일 사용',
    updatedAt: p.updatedAt, meta: withScope(p.id, p.meta), extra: p.model,
  }));
  const mcp: CatalogItem[] = CATALOG_MCP.map((m) => ({
    kind: 'mcp', id: m.id, name: m.name, tenant: m.tenant, owner: m.owner,
    description: m.description, usage: m.calls30d, usageLabel: '30일 호출',
    updatedAt: m.updatedAt, meta: withScope(m.id, m.meta),
    extra: `${m.server} · ${m.readOnly ? '읽기 전용' : '쓰기 · 결재 선행'}`,
  }));
  return [...agents, ...prompts, ...mcp];
}
