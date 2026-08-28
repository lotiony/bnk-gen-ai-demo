/**
 * 레드팀 검증 mock.
 *
 * 시각 규약은 `mockAgentDeploys.ts` 상단 주석의 배포 게이트 축을 따른다 —
 * 커밋/태그 → 학습계 배포 → 평가 → **레드팀** → [미달 시 보강 후 재검]
 * → 결재 → 서빙계 승격. 날짜를 옮길 때는 deploys · evals 와 같은 오프셋으로
 * 함께 옮긴다.
 *
 * 통과 기준선은 차단율 **95%** 다(93.5·92.5·90.0 = 미달 / 95.0·96.0·97.0 = 통과).
 * 기준선을 바꾸면 status 도 같이 바꿔야 한다.
 *
 * 전부 가상 창작물이다(CLAUDE.md 절대 규칙).
 */
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
  team: '그룹 금융보안센터 · 레드팀',
  confidential: true,
  contactChannel: '#redteam-request (Slack)',
};

const DATASETS: Record<string, RedTeamDataset[]> = {
  'AGT-204': [
    {
      code: 'RT-A',
      name: '탈옥·우회 시나리오',
      category: 'Jailbreak / Instruction Bypass',
      updatedAt: '2026-05-20',
    },
    {
      code: 'RT-B',
      name: '프롬프트 인젝션',
      category: 'Indirect / Direct Prompt Injection',
      updatedAt: '2026-05-02',
    },
    {
      code: 'RT-C',
      name: '민감정보 누출',
      category: 'PII / 신용정보 추출 시도',
      updatedAt: '2026-05-11',
    },
    /*
     * RFP AGB-012 는 점검 축으로 "성능, **편향성, 윤리성** 등" 을 명시한다.
     * 탈옥·인젝션·PII 세 축만으로는 요건의 절반이 빈다. 금융 도메인에서
     * 편향은 곧 차별적 여신·상품 권유로 이어지므로 별도 셋으로 분리한다.
     */
    {
      code: 'RT-D',
      name: '편향 · 공정성',
      category: '성별·연령·지역·직업군 차별 응답 유도',
      updatedAt: '2026-05-26',
    },
    {
      code: 'RT-E',
      name: '윤리 · 유해표현',
      category: '불완전판매 유도 · 과장 수익 표현 · 유해 발언',
      updatedAt: '2026-05-26',
    },
  ],
};

const RUNS: Record<string, RedTeamRun[]> = {
  'AGT-204': [
    /*
     * 미달 셋은 **재검 회차**로 닫는다. 레드팀 게이트가 "미달이면 승격 못 한다"를
     * 말하려면 화면에 미달 → 보강 → 재검 통과가 다 남아 있어야 한다. 재검만
     * 남기면 애초에 막힌 적이 없어 보이고, 미달만 남기면 지금 서빙계에 올라가
     * 있는 버전이 게이트를 뚫고 올라간 것이 된다.
     * 재검은 에이전트 재빌드가 아니라 **플랫폼 가드레일 정책 보강**으로 닫았다
     * (mockGuardrailPolicy) — 그래서 태그 번호가 그대로다.
     */
    {
      id: 'rt-9f3c',
      agentId: 'AGT-204',
      version: 'v4.2',
      datasetCode: 'RT-E',
      ranAt: '2026-05-31 10:40',
      blockRate: 96.0,
      status: 'pass',
      reviewer: '정태우',
    },
    {
      id: 'rt-9f3a',
      agentId: 'AGT-204',
      version: 'v4.2',
      datasetCode: 'RT-A',
      ranAt: '2026-05-30 14:20',
      blockRate: 97.5,
      status: 'pass',
      reviewer: '정태우',
    },
    {
      id: 'rt-9f39',
      agentId: 'AGT-204',
      version: 'v4.2',
      datasetCode: 'RT-B',
      ranAt: '2026-05-30 14:38',
      blockRate: 95.0,
      status: 'pass',
      reviewer: '이수연',
    },
    {
      id: 'rt-9f38',
      agentId: 'AGT-204',
      version: 'v4.2',
      datasetCode: 'RT-C',
      ranAt: '2026-05-30 14:52',
      blockRate: 99.0,
      status: 'pass',
      reviewer: '정태우',
    },
    {
      id: 'rt-9f37',
      agentId: 'AGT-204',
      version: 'v4.2',
      datasetCode: 'RT-D',
      ranAt: '2026-05-30 15:06',
      blockRate: 96.0,
      status: 'pass',
      reviewer: '이수연',
    },
    {
      id: 'rt-9f36',
      agentId: 'AGT-204',
      version: 'v4.2',
      datasetCode: 'RT-E',
      ranAt: '2026-05-30 15:21',
      blockRate: 93.5,
      status: 'fail',
      reviewer: '정태우',
    },
    {
      id: 'rt-9e87',
      agentId: 'AGT-204',
      version: 'v4.1',
      datasetCode: 'RT-A',
      ranAt: '2026-05-24 10:20',
      blockRate: 96.0,
      status: 'pass',
      reviewer: '박정민',
    },
    {
      id: 'rt-9e86',
      agentId: 'AGT-204',
      version: 'v4.1',
      datasetCode: 'RT-B',
      ranAt: '2026-05-24 10:38',
      blockRate: 95.5,
      status: 'pass',
      reviewer: '박정민',
    },
    {
      id: 'rt-9e85',
      agentId: 'AGT-204',
      version: 'v4.1',
      datasetCode: 'RT-A',
      ranAt: '2026-05-23 11:14',
      blockRate: 92.5,
      status: 'fail',
      reviewer: '박정민',
    },
    {
      id: 'rt-9e84',
      agentId: 'AGT-204',
      version: 'v4.1',
      datasetCode: 'RT-B',
      ranAt: '2026-05-23 11:30',
      blockRate: 90.0,
      status: 'fail',
      reviewer: '박정민',
    },
    {
      id: 'rt-9e83',
      agentId: 'AGT-204',
      version: 'v4.1',
      datasetCode: 'RT-C',
      ranAt: '2026-05-23 11:48',
      blockRate: 97.0,
      status: 'pass',
      reviewer: '이수연',
    },
    {
      id: 'rt-9d14',
      agentId: 'AGT-204',
      version: 'v4.0',
      datasetCode: 'RT-A',
      ranAt: '2026-05-10 09:58',
      blockRate: 96.5,
      status: 'pass',
      reviewer: '정태우',
    },
    {
      id: 'rt-9d13',
      agentId: 'AGT-204',
      version: 'v4.0',
      datasetCode: 'RT-B',
      ranAt: '2026-05-10 10:20',
      blockRate: 95.5,
      status: 'pass',
      reviewer: '박정민',
    },
    {
      id: 'rt-9d12',
      agentId: 'AGT-204',
      version: 'v4.0',
      datasetCode: 'RT-A',
      ranAt: '2026-05-09 09:42',
      blockRate: 86.0,
      status: 'fail',
      reviewer: '정태우',
    },
    {
      id: 'rt-9d11',
      agentId: 'AGT-204',
      version: 'v4.0',
      datasetCode: 'RT-B',
      ranAt: '2026-05-09 10:02',
      blockRate: 88.5,
      status: 'fail',
      reviewer: '박정민',
    },
  ],
};

/**
 * 레드팀 신청 이력.
 *
 * 신청은 **검증 대상 태그가 존재한 뒤**에 올라간다. 신청일이 태그 생성일보다
 * 앞서면 "무엇을 검증했는가"가 성립하지 않는다 — 배포 게이트 서사의 급소다.
 * 수행 시각은 RUNS 와 맞물리고, 완료 시각은 그 신청 범위의 **마지막 회차
 * (재검 포함)** 시각이다.
 */
const REQUESTS: Record<string, RedTeamRequest[]> = {
  'AGT-204': [
    {
      id: 'RT-REQ-12',
      agentId: 'AGT-204',
      requestedAt: '2026-05-31 14:00',
      requestedBy: '박서연',
      scope: ['RT-A', 'RT-B', 'RT-C', 'RT-D', 'RT-E'],
      status: 'in-progress',
      estimatedAt: '2026-06-05',
      reason: '차기 RC 사전 검증 — 전체 셋',
      targetVersion: 'v4.3.0-rc1',
    },
    {
      id: 'RT-REQ-11',
      agentId: 'AGT-204',
      requestedAt: '2026-05-29 18:20',
      requestedBy: '박서연',
      scope: ['RT-A', 'RT-B', 'RT-C', 'RT-D', 'RT-E'],
      status: 'done',
      completedAt: '2026-05-31 10:40',
      reason: '서빙계 프로모션 사전 검증 · RT-E 미달분 재검 포함',
      targetVersion: 'v4.2.0',
    },
    {
      id: 'RT-REQ-10',
      agentId: 'AGT-204',
      requestedAt: '2026-05-22 17:50',
      requestedBy: '박서연',
      scope: ['RT-A', 'RT-B', 'RT-C'],
      status: 'done',
      completedAt: '2026-05-24 10:38',
      reason: '서빙계 프로모션 사전 검증 · RT-A·RT-B 미달분 재검 포함',
      targetVersion: 'v4.1.0',
    },
    {
      id: 'RT-REQ-09',
      agentId: 'AGT-204',
      requestedAt: '2026-05-08 15:10',
      requestedBy: '박서연',
      scope: ['RT-A', 'RT-B'],
      status: 'done',
      completedAt: '2026-05-10 10:20',
      reason: '서빙계 프로모션 사전 검증 · 1차 미달 후 재검',
      targetVersion: 'v4.0.0',
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
