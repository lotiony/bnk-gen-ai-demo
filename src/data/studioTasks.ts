/**
 * AI Studio 과제 목록 — 여러 종류의 과제를 **하나의 평면 목록**으로 합친다.
 *
 * 왜 평면인가 —
 *   RFP 어디에도 사용자 포털의 "프로젝트" 계층은 없다. `과제` 는 두 곳에만 나오고
 *   둘 다 사용자 포털이 아니다.
 *     · 2-1 관리자 포털 : "과제 관리 화면: 계열사별 과제 등록·검토·결재·이행 모니터링,
 *                          과제별 자원·비용 현황"
 *     · 2-1 마켓플레이스: "커뮤니티(과제 산출물 등록 및 공유)"
 *   그래서 제작자 화면(AI Studio)은 프로젝트로 묶지 않고 **과제를 직접 나열**한다.
 *   프로젝트 상세 화면 자체는 딥링크 보존용으로 남아 있다(GNB 에서만 내렸다).
 *
 * 대응 요건: AGB-001(에이전트 빌더) · AGB-002(워크플로우) · AGB-011(버전·배포 이력)
 *            LSM-009(승인 기반 배포) · ONM-008(개발 환경)
 */
import { useSyncExternalStore } from 'react';
import { MOCK_AGENT_TASKS, subscribeAgentTasks } from './mockAgentTasks';
import { MOCK_KNOWLEDGE_TASKS } from './mockKnowledgeTasks';
import { MOCK_PIPELINE_TASKS } from './mockPipelineTasks';
import { MOCK_MODEL_TASKS } from './mockModelTasks';
import { MOCK_DEVENV_TASKS } from './mockDevenvTasks';
import type { Tenant } from './tenants';

/** 딥링크가 향하는 기준 프로젝트 — 과제 상세 화면이 아직 프로젝트 경로에 매달려 있다. */
export const PRIMARY_PROJECT_ID = 'PRJ-2025-PB-001';

export type StudioTaskKind =
  | 'agent'
  | 'workflow'
  | 'knowledge'
  | 'pipeline'
  | 'model'
  | 'devenv'
  | 'ontology';

export const KIND_LABEL: Record<StudioTaskKind, string> = {
  agent: '에이전트',
  workflow: '워크플로우',
  knowledge: '지식 데이터',
  pipeline: '검색 파이프라인',
  model: '모델 신청',
  devenv: '개발환경',
  ontology: '온톨로지',
};

/** 카드 좌측 스트라이프 · 배지 색. 데이터 잉크와 브랜드 레드를 섞지 않는다. */
export const KIND_TONE: Record<StudioTaskKind, string> = {
  agent: 'bg-info-bg text-info border-info-border',
  workflow: 'bg-accent-purple-bg text-accent-purple border-accent-purple-border',
  knowledge: 'bg-ok-bg text-ok border-ok-border',
  pipeline: 'bg-accent-brown-bg text-accent-brown border-accent-brown-border',
  model: 'bg-warn-bg text-warn border-warn-border',
  devenv: 'bg-surface-soft text-ink-mid border-line-soft',
  ontology: 'bg-brand-tint text-brand border-brand-tint',
};

export interface StudioTask {
  id: string;
  kind: StudioTaskKind;
  name: string;
  /** 원 과제의 상태 문자열을 그대로 쓴다 — 종류마다 어휘가 다르다. */
  state: string;
  ownerName: string;
  ownerInitial: string;
  updatedAt: string;
  /** 1줄 변경 요약. */
  note: string;
  /** 진행률(있는 과제만). */
  progress?: number;
  /** 상세 경로. */
  href: string;
  /** 소속 계열사 — 테넌트 스코프 필터에 쓴다. */
  tenant: Tenant;
}

/**
 * 과제별 소속 계열사.
 * mock 과제는 원래 테넌트 표기가 없어서 여기서 부여한다. 부산은행에 몰아두지 않고
 * 경남은행·BNK시스템에도 나눠 둬야 테넌트 전환의 효과가 화면에 드러난다.
 */
const TENANT_OF: Record<string, Tenant> = {
  'AGT-204': '부산은행',
  'KNW-198': '부산은행',
  'KNW-201': '부산은행',
  /*
   * KNW-187 은 보이스피싱 과제(부산은행 PRJ-101)의 커넥터이고 소유자도 부산은행
   * 사람이다. 테넌트 전환 효과를 보이겠다고 여기서만 경남은행으로 돌려놓으면,
   * 같은 카드가 소유자는 부산은행 · 계열사는 경남은행으로 뜬다.
   * 경남은행 자산은 MDL-308 이 맡는다.
   */
  'KNW-187': '부산은행',
  'SRC-301': '그룹 공통',
  'MDL-301': '부산은행',
  'MDL-308': '경남은행',
  'DEV-CDR-204': 'BNK시스템',
  'DEV-CDR-205': 'BNK시스템',
  'DEV-CI-101': 'BNK시스템',
  'DEV-CD-101': 'BNK시스템',
};

/** 표에 없는 과제는 그룹 공통 자산으로 본다. */
function tenantOf(id: string): Tenant {
  return TENANT_OF[id] ?? '그룹 공통';
}

/**
 * 과제 목록 스냅샷을 만든다.
 *
 * 예전에는 이게 모듈 최상단의 `const` 배열이었다. 그래서 **import 시점에 굳어**
 * 기안으로 새로 생긴 에이전트가 목록에 영영 나타나지 않았다. 지금은 읽을 때마다
 * 다시 만들고, 원본이 바뀌면 아래 스토어가 스냅샷을 교체한다.
 */
function buildStudioTasks(): StudioTask[] {
  return [
  ...MOCK_AGENT_TASKS.map<StudioTask>((t) => ({
    id: t.id,
    kind: 'agent',
    name: t.name,
    state: t.state,
    ownerName: t.ownerName,
    ownerInitial: t.ownerInitial,
    updatedAt: t.updatedAt,
    note: t.changeNote,
    progress: t.progress,
    href: `/projects/${PRIMARY_PROJECT_ID}/tasks/agent/${t.id}`,
    tenant: t.tenant ?? tenantOf(t.id),
  })),
  ...MOCK_KNOWLEDGE_TASKS.map<StudioTask>((t) => ({
    id: t.id,
    kind: 'knowledge',
    name: t.name,
    state: t.state,
    ownerName: t.ownerName,
    ownerInitial: t.ownerInitial,
    updatedAt: t.updatedAt,
    note: t.changeNote,
    progress: t.progress,
    href: `/knowledge/data`,
    tenant: tenantOf(t.id),
  })),
  ...MOCK_PIPELINE_TASKS.map<StudioTask>((t) => ({
    id: t.id,
    kind: 'pipeline',
    name: t.name,
    state: t.state,
    ownerName: t.ownerName,
    ownerInitial: t.ownerInitial,
    updatedAt: t.updatedAt,
    note: t.changeNote,
    href: `/knowledge/pipeline/${t.id}`,
    tenant: tenantOf(t.id),
  })),
  ...MOCK_MODEL_TASKS.map<StudioTask>((t) => ({
    id: t.id,
    kind: 'model',
    name: t.name,
    state: t.state,
    ownerName: t.ownerName,
    ownerInitial: t.ownerInitial,
    updatedAt: t.requestedAt,
    note: t.reason,
    href: `/projects/${PRIMARY_PROJECT_ID}/tasks/model/${t.id}`,
    tenant: tenantOf(t.id),
  })),
  ...MOCK_DEVENV_TASKS.map<StudioTask>((t) => ({
    id: t.id,
    kind: 'devenv',
    name: t.name,
    state: t.state,
    ownerName: t.ownerName,
    ownerInitial: t.ownerInitial,
    updatedAt: t.lastActivity,
    note: t.meta,
    href: `/studio/devenv/${t.id}`,
    tenant: tenantOf(t.id),
  })),
  // 빌더 산출물이라 원 mock 이 목록형이 아닌 과제들 — 카드 1개로 고정 노출한다.
  {
    id: 'WKF-501',
    kind: 'workflow',
    name: '여신 상담 워크플로우',
    state: '학습계 배포',
    ownerName: '강개발',
    ownerInitial: '강',
    updatedAt: '2026-05-28',
    note: '조건 분기 2개 · 보상 트랜잭션 구간 지정',
    href: '/studio/workflow',
    tenant: '부산은행',
  },
  {
    id: 'ONT-601',
    kind: 'ontology',
    name: '여신 도메인 온톨로지',
    state: '운영 중',
    ownerName: '조디비',
    ownerInitial: '조',
    updatedAt: '2026-05-26',
    note: '기업·재무·담보 클래스 관계 정비 · Graph RAG 리트리버 연결',
    href: '/knowledge/ontology',
    tenant: '그룹 공통',
  },
  ];
}

/* ═══════════════ 과제 목록 스토어 (메모리 전용) ═══════════════ */

/**
 * 기안 결과가 목록에 바로 뜨게 하는 구독형 스냅샷.
 * localStorage 를 쓰지 않는다(CLAUDE.md 절대 규칙). 패턴은 `useTemplates` 와 같다.
 */
let snapshot: StudioTask[] = buildStudioTasks();
const listeners = new Set<() => void>();

function refresh(): void {
  snapshot = buildStudioTasks();
  listeners.forEach((l) => l());
}

// 에이전트 기안 → 목록 갱신. studioTasks 가 구독을 걸어야 순환 참조가 안 생긴다.
subscribeAgentTasks(refresh);

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function getStudioTasks(): StudioTask[] {
  return snapshot;
}

/** 과제 목록 구독 — 기안으로 늘어난 과제가 즉시 반영된다. */
export function useStudioTasks(): StudioTask[] {
  return useSyncExternalStore(subscribe, getStudioTasks, getStudioTasks);
}

/**
 * 테넌트 스코프 필터.
 * 그룹 공통을 고르면 전체가 보이고, 계열사를 고르면 **그 계열사 + 그룹 공통**만 보인다.
 * RFP 2-1 기타: "그룹 공통 AI자산은 재사용하되 계열사별 데이터ᆞ보안ᆞ권한 정책을
 * 독립적으로 적용" — 공통 자산은 계열사에서도 보이고, 남의 계열사 자산은 안 보인다.
 */
export function scopeTasks(
  tasks: StudioTask[],
  tenant: Tenant,
  /**
   * 그룹 공통 Namespace 에서 **계열사 자산까지 조망하는가**.
   *
   * 전체 조망은 공동존을 운영·감독하는 역할의 것이다(`canSwitchTenant`).
   * 지주 개발자처럼 그룹 공통에 소속됐지만 감독 역할이 아닌 계정은 false 로
   * 넘겨 그룹 공통 자산만 보게 한다 — 아니면 개발자가 남의 계열사 과제를
   * 들여다보는 화면이 되어 SEC-001 이 무너진다.
   */
  wide = true,
): StudioTask[] {
  if (tenant === '그룹 공통') {
    return wide ? tasks : tasks.filter((t) => t.tenant === '그룹 공통');
  }
  return tasks.filter((t) => t.tenant === tenant || t.tenant === '그룹 공통');
}
