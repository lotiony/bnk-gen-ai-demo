export interface RedTeamOperator {
  /** 운영 부서 (외부 위탁 or 내부 보안센터). */
  team: string;
  /** 사용자가 데이터셋·시나리오 내용을 볼 수 없다는 안내. */
  confidential: true;
  contactChannel: string;
}

/** 시나리오 셋 — 카드에 메타만 표시, 케이스 내용은 비공개. */
export interface RedTeamDataset {
  code: string; // 'RT-A'
  name: string; // '탈옥/우회 시나리오'
  category: string;
  updatedAt: string;
  /** 사용자에게는 case 수 공개하지 않음. */
}

export type RedTeamStatus = 'pass' | 'fail';

export interface RedTeamRun {
  id: string;
  agentId: string;
  version: string;
  datasetCode: string;
  ranAt: string;
  /** 차단율 0~100 (= blocked / total). */
  blockRate: number;
  status: RedTeamStatus;
  /** 검수자 — 금융보안센터 레드팀 담당자 이름. */
  reviewer: string;
}

export type RequestStatus = 'pending' | 'in-progress' | 'done' | 'rejected';

export interface RedTeamRequest {
  id: string;
  agentId: string;
  requestedAt: string;
  requestedBy: string;
  /** 신청한 시나리오 셋 코드들. */
  scope: string[];
  status: RequestStatus;
  estimatedAt?: string;
  completedAt?: string;
  /** 신청 사유 / 트리거 (서빙계 프로모션 직전 등). */
  reason?: string;
  /** 검증 대상 학습계 버전 (어떤 학습계 빌드로 신청했는지). */
  targetVersion: string;
}

const OPERATOR: RedTeamOperator = {
  team: 'KB 금융보안센터 · 레드팀',
  confidential: true,
  contactChannel: '#redteam-request (Slack)',
};

const DATASETS: Record<string, RedTeamDataset[]> = {
  'AGT-204': [
    {
      code: 'RT-A',
      name: '탈옥·우회 시나리오',
      category: 'Jailbreak / Instruction Bypass',
      updatedAt: '2026-05-10',
    },
    {
      code: 'RT-B',
      name: '프롬프트 인젝션',
      category: 'Indirect / Direct Prompt Injection',
      updatedAt: '2026-04-22',
    },
    {
      code: 'RT-C',
      name: '민감정보 누출',
      category: 'PII / 신용정보 추출 시도',
      updatedAt: '2026-05-01',
    },
  ],
};

const RUNS: Record<string, RedTeamRun[]> = {
  'AGT-204': [
    {
      id: 'rt-9f3a',
      agentId: 'AGT-204',
      version: 'v4.2',
      datasetCode: 'RT-A',
      ranAt: '2026-05-19 14:20',
      blockRate: 97.5,
      status: 'pass',
      reviewer: '정태우',
    },
    {
      id: 'rt-9f39',
      agentId: 'AGT-204',
      version: 'v4.2',
      datasetCode: 'RT-B',
      ranAt: '2026-05-19 14:38',
      blockRate: 95.0,
      status: 'pass',
      reviewer: '이수연',
    },
    {
      id: 'rt-9f38',
      agentId: 'AGT-204',
      version: 'v4.2',
      datasetCode: 'RT-C',
      ranAt: '2026-05-19 14:52',
      blockRate: 99.0,
      status: 'pass',
      reviewer: '정태우',
    },
    {
      id: 'rt-9e85',
      agentId: 'AGT-204',
      version: 'v4.1',
      datasetCode: 'RT-A',
      ranAt: '2026-05-12 11:14',
      blockRate: 92.5,
      status: 'fail',
      reviewer: '박정민',
    },
    {
      id: 'rt-9e84',
      agentId: 'AGT-204',
      version: 'v4.1',
      datasetCode: 'RT-B',
      ranAt: '2026-05-12 11:30',
      blockRate: 90.0,
      status: 'fail',
      reviewer: '박정민',
    },
    {
      id: 'rt-9e83',
      agentId: 'AGT-204',
      version: 'v4.1',
      datasetCode: 'RT-C',
      ranAt: '2026-05-12 11:48',
      blockRate: 97.0,
      status: 'pass',
      reviewer: '이수연',
    },
    {
      id: 'rt-9d12',
      agentId: 'AGT-204',
      version: 'v4.0',
      datasetCode: 'RT-A',
      ranAt: '2026-04-28 09:42',
      blockRate: 86.0,
      status: 'fail',
      reviewer: '정태우',
    },
    {
      id: 'rt-9d11',
      agentId: 'AGT-204',
      version: 'v4.0',
      datasetCode: 'RT-B',
      ranAt: '2026-04-28 10:02',
      blockRate: 88.5,
      status: 'fail',
      reviewer: '박정민',
    },
  ],
};

const REQUESTS: Record<string, RedTeamRequest[]> = {
  'AGT-204': [
    {
      id: 'RT-REQ-12',
      agentId: 'AGT-204',
      requestedAt: '2026-05-20 11:00',
      requestedBy: '박서연',
      scope: ['RT-A', 'RT-B', 'RT-C'],
      status: 'in-progress',
      estimatedAt: '2026-05-25',
      reason: '서빙계 프로모션 사전 검증',
      targetVersion: 'v4.3.0-rc1',
    },
    {
      id: 'RT-REQ-11',
      agentId: 'AGT-204',
      requestedAt: '2026-05-15 09:30',
      requestedBy: '박서연',
      scope: ['RT-A', 'RT-B', 'RT-C'],
      status: 'done',
      completedAt: '2026-05-19 14:52',
      reason: '서빙계 프로모션 사전 검증',
      targetVersion: 'v4.2.0',
    },
    {
      id: 'RT-REQ-10',
      agentId: 'AGT-204',
      requestedAt: '2026-05-08 14:00',
      requestedBy: '박서연',
      scope: ['RT-A', 'RT-B', 'RT-C'],
      status: 'done',
      completedAt: '2026-05-12 11:48',
      reason: '정기 회귀 검증',
      targetVersion: 'v4.1.0',
    },
  ],
};

export function getRedTeamOperator(): RedTeamOperator {
  return OPERATOR;
}

export function getRedTeamDatasets(agentId: string): RedTeamDataset[] {
  return DATASETS[agentId] ?? [];
}

export function getRedTeamRuns(agentId: string): RedTeamRun[] {
  return RUNS[agentId] ?? [];
}

export function getRedTeamRequests(agentId: string): RedTeamRequest[] {
  return REQUESTS[agentId] ?? [];
}
