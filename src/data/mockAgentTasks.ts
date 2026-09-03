/**
 * 에이전트 과제 mock — 과제 상세(AgentTaskDetailPage)와 등록 폼이 쓴다.
 *
 * 조회 전용 카탈로그 view 는 `mockCatalogAgents` 가 따로 갖는다.
 * **AGT-204 의 정본은 `mockCatalogAgents`** 이므로 이름·소유자·갱신 시각은 그쪽과
 * 같아야 한다.
 *
 * 전부 가상 창작물이다(CLAUDE.md 절대 규칙).
 */
import { DEMO_TODAY } from '@/data/demoClock';
import type { Tenant } from '@/data/tenants';

export type AgentTaskState =
  | '실행 중'
  | '계획'
  | '운영 중'
  | '보류'
  /** 기안 직후 상태 — 배포 결재가 걸려 있어 아직 아무 데도 안 올라갔다. */
  | '학습계 결재 진행 중'
  | '서빙계 결재 진행 중';
export type AgentDeployStage = '학습계' | '서빙계';
/** Studio(노코드) · Code(pro-code) · LangGraph 3종. */
export type AgentBuilder = 'studio' | 'pro-code' | 'graph';

export interface AgentTask {
  id: string;
  name: string;
  state: AgentTaskState;
  stage: AgentDeployStage;
  /** 빌더 종류. 카드 메타로 노출. */
  builder: AgentBuilder;
  /** 주력 모델. 예: onprem/gpt-oss-120b */
  mainModel: string;
  /** Fallback 모델 (선택). */
  fallbackModel?: string;
  /** 연결된 지식 자산 (KNW-* IDs). */
  linkedKnowledge: string[];
  /** 사용 가능 도구 키. */
  tools: string[];
  ownerName: string;
  ownerInitial: string;
  /**
   * 소속 계열사. 기안자의 Namespace 를 그대로 물려받는다 — 부산은행 개발자가
   * 만든 에이전트가 그룹 공통으로 뜨면 SEC-001 격리가 화면에서 무너진다.
   */
  tenant?: Tenant;
  updatedAt: string;
  changeNote: string;
  progress: number;
  /** 시스템 프롬프트 본문. */
  systemPrompt: string;
  temperature: number;
  maxOutputTokens: number;
  piiMasking: boolean;
  redteam: boolean;
}

export const BUILDER_LABEL: Record<AgentBuilder, string> = {
  studio: 'Studio (노코드)',
  'pro-code': 'pro-code',
  graph: 'LangGraph',
};

/** 진행 중인 인메모리 mock 저장소 — 새로고침 시 시드 상태로 돌아감. */
export const MOCK_AGENT_TASKS: AgentTask[] = [
  {
    id: 'AGT-204',
    name: 'PB 자산진단 어시스턴트',
    state: '운영 중',
    stage: '서빙계',
    builder: 'pro-code',
    mainModel: 'onprem/qwen3-32b',
    fallbackModel: 'onprem/gpt-oss-120b',
    linkedKnowledge: ['KNW-198'],
    tools: ['rag_search', 'function_call', 'db_query'],
    ownerName: '박서연',
    ownerInitial: '서연',
    tenant: '부산은행',
    updatedAt: '2026-05-29 16:42',
    changeNote: '시스템 프롬프트 v4.2 · 응답 형식 JSON 강제 추가',
    progress: 100,
    systemPrompt:
      '당신은 그룹 계열사의 PB(Private Banker) 자산진단 어시스턴트입니다. 고객의 보유 자산 데이터를 기반으로 위험도, 분산도, 유동성 점수를 산출하고 개선안을 JSON 형식으로 반환합니다. 외부 시장 전망이나 추천 종목은 제시하지 않습니다.',
    temperature: 0.2,
    maxOutputTokens: 1024,
    piiMasking: true,
    redteam: true,
  },
];

/*
 * 신규 발번 대역.
 *
 * 예전에는 `AGT-301` 부터 셌는데 그 ID 는 카탈로그에 이미
 * **'보이스피싱 1차 분류 에이전트'** 로 존재한다 — 시연 중 등록 폼을 한 번만
 * 눌러도 기존 에이전트와 ID 가 충돌했다. 게다가 등록 폼은 코드 예시를
 * `AGT-2026-NEW` 로 보여 주는데 실제 발번은 `AGT-301` 이라 표기와 결과도 달랐다.
 *
 * 그래서 **연도 대역**으로 옮긴다. `AGT-2026-###` 는 3자리 레거시 대역
 * (AGT-072 · 204 · 205 · 301 · 318 · 411 · 512 · 602 · 621 · 701 · 708 · 812 · 905)
 * 과 형태부터 겹치지 않아, 카탈로그가 늘어나도 충돌하지 않는다.
 */
const NEW_ID_PREFIX = 'AGT-2026-';
let counter = 0;

/* ── 구독 ──
 * AI Studio 과제 목록(`studioTasks`)이 기안 결과를 바로 반영하려면 이쪽 변경을
 * 알려야 한다. studioTasks 를 여기서 import 하면 순환 참조가 되므로, 알림만
 * 내보내고 구독은 저쪽이 건다.
 */
const agentTaskListeners = new Set<() => void>();

export function subscribeAgentTasks(l: () => void): () => void {
  agentTaskListeners.add(l);
  return () => {
    agentTaskListeners.delete(l);
  };
}

type NewAgentInput = {
  name: string;
  stage: AgentDeployStage;
  builder: AgentBuilder;
  mainModel: string;
  fallbackModel?: string;
  linkedKnowledge: string[];
  tools: string[];
  systemPrompt: string;
  temperature: number;
  maxOutputTokens: number;
  piiMasking: boolean;
  redteam: boolean;
  /** 기안자 — 로그인 페르소나에서 온다. */
  ownerName: string;
  ownerInitial: string;
  tenant: Tenant;
};

/** 등록 폼에서 호출 — 신규 에이전트 과제를 in-memory list에 추가하고 반환. */
export function addAgentTask(input: NewAgentInput): AgentTask {
  /*
   * 기안 시각은 **세계관의 오늘**로 찍는다. `new Date()` 를 쓰면 2026-09-09 시연
   * 당일 이 값만 '2026-09-09' 를 찍고 옆의 mock 은 세계관 날짜를 찍는다 —
   * 리허설에서는 절대 안 잡히는 유형이라 아예 실시간 시계를 걷어냈다.
   */
  const stamp = `${DEMO_TODAY} 09:40`;

  const task: AgentTask = {
    id: `${NEW_ID_PREFIX}${String(++counter).padStart(3, '0')}`,
    name: input.name,
    // 기안했다고 배포된 게 아니다 — 결재가 끝나야 올라간다(ONM-003).
    state: input.stage === '서빙계' ? '서빙계 결재 진행 중' : '학습계 결재 진행 중',
    stage: input.stage,
    builder: input.builder,
    mainModel: input.mainModel,
    fallbackModel: input.fallbackModel,
    linkedKnowledge: input.linkedKnowledge,
    tools: input.tools,
    ownerName: input.ownerName,
    ownerInitial: input.ownerInitial,
    tenant: input.tenant,
    updatedAt: stamp,
    changeNote: `신규 기안 · ${input.stage} 배포 결재 진행 중`,
    progress: 0,
    systemPrompt: input.systemPrompt,
    temperature: input.temperature,
    maxOutputTokens: input.maxOutputTokens,
    piiMasking: input.piiMasking,
    redteam: input.redteam,
  };
  MOCK_AGENT_TASKS.unshift(task);
  agentTaskListeners.forEach((l) => l());
  return task;
}

/**
 * 배포 결재 결과를 과제 상태에 반영한다.
 *
 * 승인 전까지 과제는 「결재 진행 중」에 머문다. 최종 승인에서만 실제 배포 상태로
 * 넘어간다 — 결재를 그려 놓고 상태가 먼저 바뀌면 화면이 거짓말을 한다(LSM-009).
 */
export function markAgentDeployDecision(
  agentId: string,
  kind: 'approve' | 'reject',
  stage: AgentDeployStage,
): void {
  const task = MOCK_AGENT_TASKS.find((t) => t.id === agentId);
  if (!task) return;
  if (kind === 'approve') {
    task.state = stage === '서빙계' ? '운영 중' : '실행 중';
    task.changeNote = `${stage} 배포 승인 완료`;
    task.progress = stage === '서빙계' ? 100 : 60;
  } else {
    task.state = '보류';
    task.changeNote = `${stage} 배포 결재 반려 — 보완 후 재기안`;
  }
  agentTaskListeners.forEach((l) => l());
}

export function findAgentTask(id: string): AgentTask | undefined {
  return MOCK_AGENT_TASKS.find((t) => t.id === id);
}
