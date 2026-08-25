export interface AgentVersion {
  version: string;
  releasedAt: string;
  /** 현재 운영 중인 버전이면 true. */
  isCurrent: boolean;
  note: string;
}

export interface TestSet {
  id: string;
  name: string;
  caseCount: number;
  owner: string;
  /** 마지막 갱신일. */
  updatedAt: string;
  /** Langfuse dataset URL (있으면 카드에 바로가기 표시). */
  langfuseDatasetUrl?: string;
}

export type JudgeKind = 'llm' | 'rule';

export interface EvalRun {
  id: string;
  agentId: string;
  version: string;
  testSetId: string;
  ranAt: string;
  ranBy: string;
  /** 0~100. */
  passRate: number;
  totalCases: number;
  failedCases: number;
  avgLatencyMs: number;
  /** 콜당 평균 비용(원). */
  avgCostKrw: number;
  /** 이전 동일 테스트셋 결과 대비 통과율 delta(%p). 첫 회차면 undefined. */
  deltaVsPrev?: number;
  status: 'pass' | 'partial' | 'fail';
  /** 채점에 사용한 judge. LLM judge 모델명 또는 'rule-based'. */
  judge: { kind: JudgeKind; name: string };
}

export interface LangfuseProject {
  /** 전체 URL. 예: https://langfuse.kbfg.com/project/clxk... */
  url: string;
  /** 프로젝트 표시명. */
  name: string;
  /** 누적 trace 수. */
  traceCount: number;
  /** 마지막 동기화 시각. */
  lastSyncedAt: string;
  /** 평가 영역에서 "Langfuse에서 자세히" 점프 대상 (experiments 목록 등). */
  runUrl: string;
}

/** agentId → 버전 목록. */
export const AGENT_VERSIONS: Record<string, AgentVersion[]> = {
  'AGT-204': [
    { version: 'v4.2', releasedAt: '2026-05-19', isCurrent: true, note: '응답 형식 JSON 강제 · 환각 사례 8건 패치' },
    { version: 'v4.1', releasedAt: '2026-05-12', isCurrent: false, note: 'PII 마스킹 룰 보강 · 주민번호 패턴 추가' },
    { version: 'v4.0', releasedAt: '2026-04-28', isCurrent: false, note: '시스템 프롬프트 전면 개편 · few-shot 5개 도입' },
    { version: 'v3.5', releasedAt: '2026-04-10', isCurrent: false, note: '응답 길이 제한 1024 토큰으로 조정' },
  ],
};

export const TEST_SETS: Record<string, TestSet[]> = {
  'AGT-204': [
    {
      id: 'ts-baseline-v3',
      name: 'PB 자산진단 베이스라인 v3',
      caseCount: 120,
      owner: '박서연',
      updatedAt: '2026-05-18',
      langfuseDatasetUrl: 'https://langfuse.kbfg.com/project/kb-pb-advisor/datasets/ds-baseline-v3',
    },
    {
      id: 'ts-baseline-v2',
      name: 'PB 자산진단 베이스라인 v2',
      caseCount: 92,
      owner: '박서연',
      updatedAt: '2026-04-05',
      langfuseDatasetUrl: 'https://langfuse.kbfg.com/project/kb-pb-advisor/datasets/ds-baseline-v2',
    },
  ],
};

export const LANGFUSE_PROJECTS: Record<string, LangfuseProject> = {
  'AGT-204': {
    url: 'https://langfuse.kbfg.com/project/kb-pb-advisor',
    name: 'kb-pb-advisor',
    traceCount: 1842,
    lastSyncedAt: '2026-05-20 18:32',
    /** 평가 이력 영역에서 "자세히" 진입 — experiments 목록으로 점프. */
    runUrl: 'https://langfuse.kbfg.com/project/kb-pb-advisor/experiments',
  },
};

/** agentId → 평가 이력 (최신순). */
export const EVAL_RUNS: Record<string, EvalRun[]> = {
  'AGT-204': [
    {
      id: 'eval-9f2a',
      agentId: 'AGT-204',
      version: 'v4.2',
      testSetId: 'ts-baseline-v3',
      ranAt: '2026-05-19 17:48',
      ranBy: '박서연',
      passRate: 94.2,
      totalCases: 120,
      failedCases: 7,
      avgLatencyMs: 1840,
      avgCostKrw: 12.3,
      deltaVsPrev: 1.7,
      status: 'pass',
      judge: { kind: 'llm', name: 'azure/gpt-5.5-judge' },
    },
    {
      id: 'eval-9f2b',
      agentId: 'AGT-204',
      version: 'v4.2',
      testSetId: 'ts-baseline-v2',
      ranAt: '2026-05-19 18:02',
      ranBy: '박서연',
      passRate: 96.7,
      totalCases: 92,
      failedCases: 3,
      avgLatencyMs: 1780,
      avgCostKrw: 11.9,
      deltaVsPrev: 1.1,
      status: 'pass',
      judge: { kind: 'llm', name: 'azure/gpt-5.5-judge' },
    },
    {
      id: 'eval-9e84',
      agentId: 'AGT-204',
      version: 'v4.1',
      testSetId: 'ts-baseline-v3',
      ranAt: '2026-05-18 11:24',
      ranBy: '박서연',
      passRate: 92.5,
      totalCases: 120,
      failedCases: 9,
      avgLatencyMs: 1910,
      avgCostKrw: 12.0,
      status: 'pass',
      judge: { kind: 'llm', name: 'azure/gpt-5.5-judge' },
    },
    {
      id: 'eval-9e85',
      agentId: 'AGT-204',
      version: 'v4.1',
      testSetId: 'ts-baseline-v2',
      ranAt: '2026-05-12 16:10',
      ranBy: '박서연',
      passRate: 95.6,
      totalCases: 92,
      failedCases: 4,
      avgLatencyMs: 1880,
      avgCostKrw: 11.8,
      deltaVsPrev: 1.7,
      status: 'pass',
      judge: { kind: 'llm', name: 'azure/gpt-5.5-judge' },
    },
    {
      id: 'eval-9d11',
      agentId: 'AGT-204',
      version: 'v4.0',
      testSetId: 'ts-baseline-v2',
      ranAt: '2026-04-28 11:42',
      ranBy: '박서연',
      passRate: 93.9,
      totalCases: 92,
      failedCases: 6,
      avgLatencyMs: 2050,
      avgCostKrw: 11.8,
      deltaVsPrev: 5.8,
      status: 'pass',
      judge: { kind: 'llm', name: 'aws/claude-sonnet-4.6' },
    },
    {
      id: 'eval-9b01',
      agentId: 'AGT-204',
      version: 'v3.5',
      testSetId: 'ts-baseline-v2',
      ranAt: '2026-04-10 09:30',
      ranBy: '박서연',
      passRate: 88.1,
      totalCases: 92,
      failedCases: 11,
      avgLatencyMs: 2310,
      avgCostKrw: 11.2,
      status: 'partial',
      judge: { kind: 'llm', name: 'openai/gpt-4-turbo' },
    },
  ],
};

export function getAgentVersions(agentId: string): AgentVersion[] {
  return AGENT_VERSIONS[agentId] ?? [];
}

export function getTestSets(agentId: string): TestSet[] {
  return TEST_SETS[agentId] ?? [];
}

export function getEvalRuns(agentId: string): EvalRun[] {
  return EVAL_RUNS[agentId] ?? [];
}

export function getLangfuseProject(agentId: string): LangfuseProject | undefined {
  return LANGFUSE_PROJECTS[agentId];
}

/** 평가 run id에서 Langfuse experiment trace URL 도출 (케이스별 결과 점프용). */
export function getRunLangfuseUrl(agentId: string, runId: string): string | undefined {
  const proj = LANGFUSE_PROJECTS[agentId];
  if (!proj) return undefined;
  return `${proj.url}/experiments/${runId}`;
}
