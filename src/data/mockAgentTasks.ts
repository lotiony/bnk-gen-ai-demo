export type AgentTaskState = '실행 중' | '계획' | '운영 중' | '보류';
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
  /** 주력 모델. 예: openai/gpt-oss-120b */
  mainModel: string;
  /** Fallback 모델 (선택). */
  fallbackModel?: string;
  /** 연결된 지식 자산 (KNW-* IDs). */
  linkedKnowledge: string[];
  /** 사용 가능 도구 키. */
  tools: string[];
  ownerName: string;
  ownerInitial: string;
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
    mainModel: 'azure/gpt-5.5',
    fallbackModel: 'openai/gpt-oss-120b',
    linkedKnowledge: ['KNW-198'],
    tools: ['rag_search', 'function_call', 'db_query'],
    ownerName: '박서연',
    ownerInitial: '서연',
    updatedAt: '2026-05-19 16:08',
    changeNote: '시스템 프롬프트 v4.2 · 응답 형식 JSON 강제 추가',
    progress: 100,
    systemPrompt:
      '당신은 KB국민은행의 PB(Private Banker) 자산진단 어시스턴트입니다. 고객의 보유 자산 데이터를 기반으로 위험도, 분산도, 유동성 점수를 산출하고 개선안을 JSON 형식으로 반환합니다. 외부 시장 전망이나 추천 종목은 제시하지 않습니다.',
    temperature: 0.2,
    maxOutputTokens: 1024,
    piiMasking: true,
    redteam: true,
  },
];

let counter = 301;

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
};

/** 등록 폼에서 호출 — 신규 에이전트 과제를 in-memory list에 추가하고 반환. */
export function addAgentTask(input: NewAgentInput): AgentTask {
  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate(),
  ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const task: AgentTask = {
    id: `AGT-${counter++}`,
    name: input.name,
    state: '계획',
    stage: input.stage,
    builder: input.builder,
    mainModel: input.mainModel,
    fallbackModel: input.fallbackModel,
    linkedKnowledge: input.linkedKnowledge,
    tools: input.tools,
    ownerName: '김국민',
    ownerInitial: '국민',
    updatedAt: stamp,
    changeNote: '신규 기안 · 결재 진행 중',
    progress: 0,
    systemPrompt: input.systemPrompt,
    temperature: input.temperature,
    maxOutputTokens: input.maxOutputTokens,
    piiMasking: input.piiMasking,
    redteam: input.redteam,
  };
  MOCK_AGENT_TASKS.unshift(task);
  return task;
}

export function findAgentTask(id: string): AgentTask | undefined {
  return MOCK_AGENT_TASKS.find((t) => t.id === id);
}
