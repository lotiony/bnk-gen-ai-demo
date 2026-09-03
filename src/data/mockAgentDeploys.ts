/**
 * 에이전트 배포 mock — 개발계 배포 · 운영계 프로모션 · API 키 · 부하 테스트.
 *
 * ⚠️ **타임스탬프 순서가 곧 배포 게이트의 증명이다.**
 *   화면은 "평가·레드팀이 끝나지 않으면 결재 기안 자체가 불가"라고 말하는데,
 *   데이터의 시각이 그 순서를 어기면 발주처가 표만 훑어도 반증된다
 *   (RFP Ⅳ.4.1 — 제안서 = 계약서). 그래서 아래 순서를 **항상** 지킨다.
 *
 *     커밋/태그 → 개발계 배포 → 평가(mockAgentEvals)
 *       → 레드팀 신청·수행(mockAgentRedTeam) → [미달 시 보강 후 재검]
 *       → 결재 → 운영계 승격
 *
 *   AGT-204 의 실제 축(데모 세계관 오늘 = 2026-06-03):
 *     v3.5.0  태그 04-20 09:10 → 개발계 04-20 09:30 → 평가 04-20 11:20 → 승격 04-22 11:10
 *     v4.0.0  태그 05-08 10:30 → 개발계 05-08 12:08 → 평가 05-08 14:42
 *             → 레드팀 05-09(RT-A·RT-B 미달) → 재검 05-10 통과 → 승격 05-12 10:24
 *     v4.1.0  태그 05-22 14:08 → 개발계 05-22 16:30 → 평가 05-22 17:10·17:34
 *             → 레드팀 05-23(RT-A·RT-B 미달) → 재검 05-24 통과 → 승격 05-25 14:08
 *     v4.2.0  태그 05-29 16:42 → 개발계 05-29 17:08 → 평가 05-29 17:48·18:02
 *             → 레드팀 05-30(RT-E 미달) → 재검 05-31 통과 → **결재 대기(승격 전)**
 *     v4.3.0-rc1 태그 05-30 14:12 → 개발계 미배포·평가 미완 → 결재 기안 불가
 *
 *   날짜를 옮길 때는 세 파일(deploys · evals · redteam)을 **같은 오프셋으로**
 *   함께 옮긴다. 한 파일만 옮기면 검증이 태그보다 앞서는 상태가 다시 생긴다.
 *
 * 전부 가상 창작물이다(CLAUDE.md 절대 규칙).
 */
export interface GitLabRepo {
  url: string;
  branch: string;
  lastFetchedAt: string;
}

export type CiStatus = 'success' | 'failed' | 'running';

export interface GitTag {
  name: string;
  /** 평가 탭과 매칭할 버전 키 (예: 'v4.2'). */
  evalVersion: string;
  commitSha: string;
  commitMessage: string;
  author: string;
  authoredAt: string;
  ci: CiStatus;
  /** 이 태그로 돌린 평가 run id (있으면 평가 탭 점프 가능). */
  linkedEvalRunIds: string[];
}

export type PreflightStatus = 'pass' | 'warn' | 'fail';

export interface PreflightCheck {
  ci: PreflightStatus;
  eval: { status: PreflightStatus; passRate?: number };
  security: PreflightStatus;
  secrets: { status: PreflightStatus; missing: string[] };
}

export interface TagDiff {
  fromTag: string;
  toTag: string;
  filesChanged: number;
  systemPromptAdded: number;
  systemPromptRemoved: number;
  toolsAdded: string[];
  toolsRemoved: string[];
  modelChanged: boolean;
}

export type DeployStatus = 'active' | 'replaced' | 'rolled-back';

export interface DeployRecord {
  id: string;
  tagName: string;
  deployedAt: string;
  deployedBy: string;
  status: DeployStatus;
  /** 결재 처리 시각/처리자 (단일 단계 결재). */
  approvedBy?: string;
}

export interface AgentDeployData {
  repo: GitLabRepo;
  tags: GitTag[];
  history: DeployRecord[];
  /** 현재 개발계 활성 태그명. */
  currentTagName: string;
}

/* ---------- 운영계 프로모션 ----------
 * 운영계 배포 = 개발계에 배포되고 평가까지 완료된 버전 중 선택해서
 *               배포 결재(다단계)를 올리는 흐름.
 *               RAG 자산은 별도 프로세스로 배포되므로 여기서는 에이전트만 다룬다.
 */

export type CandidateStatus = 'recommended' | 'ready' | 'caution' | 'blocked';

export interface PromotionCandidate {
  tagName: string;
  evalVersion: string;
  /** 개발계에 배포된 일시. 미배포면 '—'. */
  trainDeployedAt: string;
  /** 개발계에서 운영된 기간(요약 텍스트). */
  trainDuration: string;
  /** 평가 통과율 — undefined면 평가 미완. */
  evalPassRate?: number;
  /** 평가 완료 일자. */
  evalCompletedAt?: string;
  redteamPassed?: boolean;
  status: CandidateStatus;
  /** 후보 카드에 보일 짧은 코멘트. */
  note?: string;
}

export type ServingStatus = 'active' | 'standby' | 'replaced' | 'rolled-back';

/** Blue/Green 슬롯 — active 트래픽 대상은 active, 대기 슬롯은 standby. */
export type DeploySlot = 'blue' | 'green';

export interface ServingDeployRecord {
  id: string;
  tagName: string;
  promotedAt: string;
  promotedBy: string;
  /** 결재 처리 요약 (마지막 단계 처리자 등). */
  approvedBy?: string;
  /** 현재 트래픽 비중. Blue/Green은 0 또는 100. */
  trafficPct: number;
  status: ServingStatus;
  /** 배포된 슬롯(Blue/Green). 이력에서 어느 슬롯에서 실행됐는지 표시. */
  slot?: DeploySlot;
}

export interface ServingDeployData {
  /** 대고객 여부 — 레드팀 게이트 자동 필수. */
  externalFacing: boolean;
  currentTagName: string;
  currentTrafficPct: number;
  candidates: PromotionCandidate[];
  history: ServingDeployRecord[];
}

const REPO: GitLabRepo = {
  url: 'git.aip.group.local/aip/pb-advisor',
  branch: 'main',
  lastFetchedAt: '2026-06-02 18:32',
};

const TAGS: GitTag[] = [
  {
    name: 'v4.3.0-rc1',
    evalVersion: 'v4.3',
    commitSha: '9a2f7c1',
    commitMessage: '응답 형식 JSON 강제 + 환각 사례 8건 패치 (RC)',
    author: '박서연',
    authoredAt: '2026-05-30 14:12',
    ci: 'success',
    linkedEvalRunIds: [],
  },
  {
    name: 'v4.2.0',
    evalVersion: 'v4.2',
    commitSha: '7f3a9c2',
    commitMessage: '응답 형식 JSON 강제 추가',
    author: '박서연',
    authoredAt: '2026-05-29 16:42',
    ci: 'success',
    linkedEvalRunIds: ['eval-9f2a', 'eval-9f2b'],
  },
  {
    name: 'v4.1.0',
    evalVersion: 'v4.1',
    commitSha: '3b1d5e8',
    commitMessage: 'PII 마스킹 룰 보강 · 주민번호 패턴 추가',
    author: '박서연',
    authoredAt: '2026-05-22 14:08',
    ci: 'success',
    linkedEvalRunIds: ['eval-9e84', 'eval-9e85'],
  },
  {
    name: 'v4.0.0',
    evalVersion: 'v4.0',
    commitSha: 'a0c4f12',
    commitMessage: '시스템 프롬프트 전면 개편 · few-shot 5개 도입',
    author: '조현우',
    authoredAt: '2026-05-08 10:30',
    ci: 'success',
    linkedEvalRunIds: ['eval-9d11'],
  },
  {
    name: 'v3.5.0',
    evalVersion: 'v3.5',
    commitSha: '8d2e6a4',
    commitMessage: '응답 길이 제한 1024 토큰으로 조정',
    author: '박서연',
    authoredAt: '2026-04-20 09:10',
    ci: 'success',
    linkedEvalRunIds: ['eval-9b01'],
  },
  {
    name: 'v3.4.1',
    evalVersion: 'v3.4',
    commitSha: '4f0b2c9',
    commitMessage: 'hotfix · 한국어 토큰 잘림 보정',
    author: '윤지수',
    authoredAt: '2026-04-07 11:42',
    ci: 'failed',
    linkedEvalRunIds: [],
  },
];

const HISTORY: DeployRecord[] = [
  {
    id: 'deploy-204-12',
    tagName: 'v4.2.0',
    deployedAt: '2026-05-29 17:08',
    deployedBy: '박서연',
    status: 'active',
    approvedBy: '김플랫 (프로젝트 오너 그룹)',
  },
  {
    id: 'deploy-204-11',
    tagName: 'v4.1.0',
    deployedAt: '2026-05-22 16:30',
    deployedBy: '박서연',
    status: 'replaced',
    approvedBy: '김플랫 (프로젝트 오너 그룹)',
  },
  {
    id: 'deploy-204-10',
    tagName: 'v4.0.0',
    deployedAt: '2026-05-08 12:08',
    deployedBy: '박서연',
    status: 'replaced',
    approvedBy: '김플랫 (프로젝트 오너 그룹)',
  },
  {
    id: 'deploy-204-09',
    tagName: 'v3.5.0',
    deployedAt: '2026-04-20 09:30',
    deployedBy: '박서연',
    status: 'replaced',
    approvedBy: '이도현 (프로젝트 오너 그룹)',
  },
];

const DATA: Record<string, AgentDeployData> = {
  'AGT-204': {
    repo: REPO,
    tags: TAGS,
    history: HISTORY,
    currentTagName: 'v4.2.0',
  },
};

export function getDeployData(agentId: string): AgentDeployData | undefined {
  return DATA[agentId];
}

const SERVING_DATA: Record<string, ServingDeployData> = {
  'AGT-204': {
    externalFacing: true,
    currentTagName: 'v4.1.0',
    currentTrafficPct: 100,
    candidates: [
      {
        tagName: 'v4.2.0',
        evalVersion: 'v4.2',
        trainDeployedAt: '2026-05-29 17:08',
        trainDuration: '개발계 운영 5일',
        evalPassRate: 95.5,
        evalCompletedAt: '2026-05-29',
        redteamPassed: true,
        status: 'recommended',
        note: '회귀 평가 통과 · 레드팀 윤리 셋(RT-E) 미달 → 가드레일 보강 후 재검 통과 · 개발계 무중단 5일',
      },
      {
        tagName: 'v4.1.0',
        evalVersion: 'v4.1',
        trainDeployedAt: '2026-05-22 16:30',
        trainDuration: '운영계 운영 중',
        evalPassRate: 94.0,
        evalCompletedAt: '2026-05-22',
        redteamPassed: true,
        status: 'ready',
        note: '현재 운영계 활성 버전 · 레드팀 1차 미달분(RT-A·RT-B) 재검 통과 후 승격',
      },
      {
        tagName: 'v4.3.0-rc1',
        evalVersion: 'v4.3',
        trainDeployedAt: '—',
        trainDuration: '개발계 미배포',
        evalPassRate: undefined,
        evalCompletedAt: undefined,
        redteamPassed: false,
        status: 'blocked',
        note: '개발계 배포 + 평가 미완 · 결재 기안 불가',
      },
    ],
    history: [
      {
        id: 'serv-204-08',
        tagName: 'v4.1.0',
        promotedAt: '2026-05-25 14:08',
        promotedBy: '박서연',
        approvedBy: '플랫폼 부서장',
        trafficPct: 100,
        status: 'active',
        slot: 'blue',
      },
      {
        id: 'serv-204-07',
        tagName: 'v4.0.0',
        promotedAt: '2026-05-12 10:24',
        promotedBy: '박서연',
        approvedBy: '플랫폼 부서장',
        trafficPct: 0,
        status: 'replaced',
        slot: 'green',
      },
      {
        id: 'serv-204-06',
        tagName: 'v3.5.0',
        promotedAt: '2026-04-22 11:10',
        promotedBy: '이도현',
        approvedBy: '플랫폼 부서장',
        trafficPct: 0,
        status: 'replaced',
        slot: 'blue',
      },
      {
        id: 'serv-204-05',
        tagName: 'v3.4.0',
        promotedAt: '2026-04-01 09:42',
        promotedBy: '박서연',
        approvedBy: '플랫폼 부서장',
        trafficPct: 0,
        status: 'rolled-back',
        slot: 'green',
      },
    ],
  },
};

export function getServingDeployData(agentId: string): ServingDeployData | undefined {
  return SERVING_DATA[agentId];
}

/* ---------- API 키 ---------- */

export type ApiKeyEnv = 'train' | 'serv';

export interface ApiKey {
  env: ApiKeyEnv;
  /** 평소엔 마스킹, 보기 토글 시 노출. */
  fullKey: string;
  /** 마스킹 표시용 마지막 4자리. */
  lastFour: string;
  issuedAt: string;
  issuedBy: string;
  /** 누적 호출 수. */
  callCount: number;
  /** 마지막 호출 시각 (없으면 미사용). */
  lastUsedAt?: string;
  endpoint: string;
}

const API_KEYS: Record<string, Record<ApiKeyEnv, ApiKey>> = {
  'AGT-204': {
    train: {
      env: 'train',
      fullKey: 'sk-train-9a2f7c1b4e0d8f6a3c5e2b1d4f7c9a02',
      lastFour: '9a02',
      issuedAt: '2026-04-22 09:30',
      issuedBy: '박서연',
      callCount: 1842,
      lastUsedAt: '2026-06-02 18:14',
      endpoint: 'https://api-dev.aip.group.local/agents/AGT-204',
    },
    serv: {
      env: 'serv',
      fullKey: 'sk-live-7f3a9c2b1d4e0d8f6a3c5e2b1d4f0a3c',
      lastFour: '0a3c',
      issuedAt: '2026-05-25 14:08',
      issuedBy: '박서연',
      callCount: 12032,
      lastUsedAt: '2026-06-02 18:20',
      endpoint: 'https://api.aip.group.local/agents/AGT-204',
    },
  },
};

export function getApiKey(agentId: string, env: ApiKeyEnv): ApiKey | undefined {
  return API_KEYS[agentId]?.[env];
}

/* ---------- 부하 테스트 ---------- */

export type LoadTestStatus = 'pass' | 'warn' | 'fail' | 'running';
export type LoadTestScenario = 'eval-dataset' | 'prod-sample' | 'custom';

export interface LoadTestRun {
  id: string;
  version: string;
  ranAt: string;
  ranBy: string;
  concurrentUsers: number;
  /** 분 단위. */
  durationMin: number;
  scenario: LoadTestScenario;
  /** 실측 처리량 RPS. */
  rps: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  /** 0~100, 에러율. */
  errorRate: number;
  status: LoadTestStatus;
  /** 누적 비용(원). */
  costKrw: number;
}

const LOAD_TEST_RUNS: Record<string, LoadTestRun[]> = {
  'AGT-204': [
    {
      id: 'lt-9c4a',
      version: 'v4.2.0',
      ranAt: '2026-05-30 11:42',
      ranBy: '박서연',
      concurrentUsers: 100,
      durationMin: 15,
      scenario: 'eval-dataset',
      rps: 24.3,
      p50Ms: 980,
      p95Ms: 1820,
      p99Ms: 2540,
      errorRate: 0.2,
      status: 'pass',
      costKrw: 2680,
    },
    {
      id: 'lt-9c49',
      version: 'v4.2.0',
      ranAt: '2026-05-29 18:30',
      ranBy: '박서연',
      concurrentUsers: 200,
      durationMin: 5,
      scenario: 'prod-sample',
      rps: 41.2,
      p50Ms: 1240,
      p95Ms: 2680,
      p99Ms: 4120,
      errorRate: 0.8,
      status: 'warn',
      costKrw: 1820,
    },
    {
      id: 'lt-9b30',
      version: 'v4.1.0',
      ranAt: '2026-05-24 14:10',
      ranBy: '이도현',
      concurrentUsers: 100,
      durationMin: 15,
      scenario: 'eval-dataset',
      rps: 22.8,
      p50Ms: 1100,
      p95Ms: 2050,
      p99Ms: 2920,
      errorRate: 0.4,
      status: 'pass',
      costKrw: 2410,
    },
    {
      id: 'lt-9a12',
      version: 'v4.0.0',
      ranAt: '2026-05-09 16:05',
      ranBy: '박서연',
      concurrentUsers: 100,
      durationMin: 10,
      scenario: 'eval-dataset',
      rps: 19.4,
      p50Ms: 1380,
      p95Ms: 3210,
      p99Ms: 5840,
      errorRate: 2.4,
      status: 'fail',
      costKrw: 1620,
    },
  ],
};

export function getLoadTestRuns(agentId: string): LoadTestRun[] {
  return LOAD_TEST_RUNS[agentId] ?? [];
}

export const SCENARIO_LABEL: Record<LoadTestScenario, string> = {
  'eval-dataset': '평가 데이터셋',
  'prod-sample': '프로덕션 샘플',
  custom: '커스텀 입력',
};

/**
 * 선택된 태그의 사전 점검 결과를 mock으로 생성.
 * 실제 시스템이면 GitLab CI/평가/SAST/시크릿 vault에 비동기 조회를 날림.
 */
export function getPreflight(tag: GitTag): PreflightCheck {
  // RC 태그는 평가 미완 + 시크릿 누락 시나리오
  if (tag.name.includes('-rc')) {
    return {
      ci: 'pass',
      eval: { status: 'warn' },
      security: 'pass',
      secrets: { status: 'warn', missing: ['SLACK_WEBHOOK_RC'] },
    };
  }
  // 빌드 실패 태그
  if (tag.ci === 'failed') {
    return {
      ci: 'fail',
      eval: { status: 'fail' },
      security: 'fail',
      secrets: { status: 'fail', missing: [] },
    };
  }
  // 정상 태그 — 통과율은 linkedEvalRunIds로 계산하는 척
  const passRateMap: Record<string, number> = {
    'v4.2': 91.8,
    'v4.1': 89.9,
    'v4.0': 86.1,
    'v3.5': 75.3,
  };
  const passRate = passRateMap[tag.evalVersion] ?? 88.0;
  return {
    ci: 'pass',
    eval: { status: passRate >= 85 ? 'pass' : 'warn', passRate },
    security: 'pass',
    secrets: { status: 'pass', missing: [] },
  };
}

/** 두 태그 사이의 변경사항을 mock으로 생성. */
export function getDiff(fromTag: string, toTag: string): TagDiff {
  // 인접 메이저 버전 비교는 큰 diff
  const fromMajor = parseInt(fromTag.split('.')[0].replace('v', ''), 10);
  const toMajor = parseInt(toTag.split('.')[0].replace('v', ''), 10);
  const big = Math.abs(fromMajor - toMajor) >= 1;
  return {
    fromTag,
    toTag,
    filesChanged: big ? 24 : 8,
    systemPromptAdded: big ? 18 : 3,
    systemPromptRemoved: big ? 6 : 1,
    toolsAdded: big ? ['web_search', 'code_interp'] : ['web_search'],
    toolsRemoved: [],
    modelChanged: big,
  };
}
