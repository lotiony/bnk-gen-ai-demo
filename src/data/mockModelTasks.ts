/**
 * 모델 신청 과제 mock.
 *
 * 모든 모델은 화이트리스트 등록 + 프로젝트별 사용 신청 과제를 거쳐야 사용 가능.
 * 한 과제 = 한 모델 = 한 신청 건. 신청 → 1차 심의(정보보호) → 2차 심의(필요 시 혁신금융)
 * → 승인 → 사용 중. 반려 시 사유 기록.
 */

export type ModelTaskState =
  | '신청'
  | '1차 심의'
  | '2차 심의'
  | '사용 중'
  | '반려'
  | '보류';

export type ModelTaskEnv = '학습계' | '서빙계' | '학습계+서빙계';

export interface ModelTaskApproval {
  /** 단계 라벨. */
  stage: '신청' | '1차 심의' | '2차 심의' | '최종 승인';
  /** 진행 상태. */
  state: '대기' | '진행' | '승인' | '반려';
  /** 처리 부서 또는 결재선. */
  by: string;
  /** 처리(혹은 처리 예정) 시각. */
  at?: string;
  note?: string;
}

/** 환경별 PTU 할당/실사용 — 학습계, 서빙계. */
export interface ModelPtuAllocation {
  env: '학습계' | '서빙계';
  /** 약정·할당된 PTU 수 (또는 시간). */
  allocated: number;
  /** 어제 기준 평균 사용량. */
  used: number;
  unit: 'PTU' | '시간';
  /** 최근 7일 일별 사용률(%). */
  weeklyUtilPct: number[];
}

export interface ModelTask {
  id: string;
  /** 신청 모델의 카탈로그 id. */
  modelId: string;
  /** 모델 풀네임 — 예: onprem/gpt-oss-120b. */
  modelName: string;
  /** 서빙 위치. */
  modelHost: string;
  /** llm / embed / rerank / vision. */
  modelKind: 'llm' | 'embed' | 'rerank' | 'vision';
  /** 과제 제목. */
  name: string;
  state: ModelTaskState;
  /** 사용 환경. */
  env: ModelTaskEnv;
  /** 환경별 PTU 할당/사용량. 사용 중인 모델만 채워짐. */
  ptu: ModelPtuAllocation[];
  /** 1차 사용 시점 (계획). */
  plannedUseAt?: string;
  /** 실제 승인 시점 (사용 중 상태에서만). */
  approvedAt?: string;
  /** 신청 사유 (1~2문장). */
  reason: string;
  /** 혁신금융서비스 지정 인용 여부. */
  innovDesignationRequired: boolean;
  /** 신청자. */
  ownerName: string;
  ownerInitial: string;
  /** 신청일. */
  requestedAt: string;
  /** 결재 단계 진행 상황. */
  approvals: ModelTaskApproval[];
  /** 예상 월 비용 (KRW). */
  estimatedMonthCost: number;
}

/**
 * PB 에이전트 프로젝트의 모델 신청 과제 — gpt-oss-120b, gpt-5.5.
 * Whisper(음성) 등 다른 모델은 별도 과제로 추가 신청해야 함.
 */
export const MOCK_MODEL_TASKS: ModelTask[] = [
  {
    id: 'MDL-301',
    modelId: 'mdl-001',
    modelName: 'onprem/gpt-oss-120b',
    modelHost: 'on-prem · A100×8',
    modelKind: 'llm',
    name: 'onprem/gpt-oss-120b 사용 신청',
    state: '사용 중',
    env: '학습계+서빙계',
    ptu: [
      {
        env: '학습계',
        allocated: 8,
        used: 5.2,
        unit: 'PTU',
        weeklyUtilPct: [58, 62, 71, 65, 60, 64, 65],
      },
      {
        env: '서빙계',
        allocated: 40,
        used: 28,
        unit: 'PTU',
        weeklyUtilPct: [66, 72, 78, 74, 71, 68, 70],
      },
    ],
    plannedUseAt: '2025-11-10',
    approvedAt: '2025-11-04 16:22',
    reason:
      'PB 자산진단 본 대화 모델로 채택. 범용 추론 품질과 한국어 응답 안정성 검증 완료, 대고객 운영 권장 등급(★5).',
    innovDesignationRequired: false,
    ownerName: '박서연',
    ownerInitial: '서연',
    requestedAt: '2025-10-28 11:08',
    approvals: [
      {
        stage: '신청',
        state: '승인',
        by: '박서연 · PM',
        at: '2025-10-28 11:08',
        note: '본 대화 모델 채택 사유 기재 · 별첨: 평가 리포트 v0.3',
      },
      {
        stage: '1차 심의',
        state: '승인',
        by: '정보보호부 · 정성호',
        at: '2025-10-31 14:42',
        note: '온프렘 운영 · 데이터 외부 유출 없음 · 가드레일 정책 표준안 적용 조건',
      },
      {
        stage: '2차 심의',
        state: '승인',
        by: '준법감시부 · 한지민',
        at: '2025-11-03 10:08',
        note: '온프렘 모델로 별도 외부 지정 불필요',
      },
      {
        stage: '최종 승인',
        state: '승인',
        by: 'AI플랫폼팀 · 김플랫',
        at: '2025-11-04 16:22',
      },
    ],
    estimatedMonthCost: 240_000_000,
  },
  {
    id: 'MDL-308',
    modelId: 'mdl-003',
    modelName: 'onprem/qwen3-32b',
    modelHost: 'On-Prem · 공동존',
    modelKind: 'llm',
    name: 'onprem/qwen3-32b 사용 신청 — 멀티모달 PB 진단',
    state: '사용 중',
    env: '서빙계',
    ptu: [
      {
        env: '서빙계',
        allocated: 20,
        used: 14.5,
        unit: 'PTU',
        weeklyUtilPct: [62, 70, 74, 81, 78, 72, 73],
      },
    ],
    plannedUseAt: '2026-03-15',
    approvedAt: '2026-03-08 17:54',
    reason:
      '대형 컨텍스트(400K) + 멀티모달이 필요한 PB 포트폴리오 시각자료 해석 시나리오. 혁신금융서비스 지정 인용 ✓.',
    innovDesignationRequired: true,
    ownerName: '박서연',
    ownerInitial: '서연',
    requestedAt: '2026-02-19 09:30',
    approvals: [
      {
        stage: '신청',
        state: '승인',
        by: '박서연 · PM',
        at: '2026-02-19 09:30',
        note: '시각자료 해석 시나리오 · 별첨: POC 결과 v0.1',
      },
      {
        stage: '1차 심의',
        state: '승인',
        by: '정보보호부 · 정성호',
        at: '2026-02-24 13:12',
        note: 'PII 마스킹·암호화 전송 게이트웨이 우회 금지 조건',
      },
      {
        stage: '2차 심의',
        state: '승인',
        by: '준법감시부 · 한지민',
        at: '2026-03-04 16:48',
        note: '혁신금융서비스 지정 인용(2025-07-22 ~ 2027-07-21) 확인',
      },
      {
        stage: '최종 승인',
        state: '승인',
        by: 'AI플랫폼팀 · 김플랫',
        at: '2026-03-08 17:54',
      },
    ],
    estimatedMonthCost: 128_000_000,
  },
];

export function findModelTask(id: string): ModelTask | undefined {
  return MOCK_MODEL_TASKS.find((t) => t.id === id);
}

export const MODEL_TASK_STATE_TONE: Record<
  ModelTaskState,
  { cls: string; dot: string }
> = {
  신청: {
    cls: 'bg-surface-soft text-ink-mid border-line',
    dot: 'bg-ink-mid',
  },
  '1차 심의': {
    cls: 'bg-info-bg text-info border-info-border',
    dot: 'bg-info',
  },
  '2차 심의': {
    cls: 'bg-accent-purple-bg text-accent-purple border-accent-purple-border',
    dot: 'bg-accent-purple',
  },
  '사용 중': {
    cls: 'bg-ok-bg text-ok border-ok-border',
    dot: 'bg-ok',
  },
  반려: {
    cls: 'bg-bad-bg text-bad border-bad-border',
    dot: 'bg-bad',
  },
  보류: {
    cls: 'bg-warn-bg text-warn border-warn-border',
    dot: 'bg-warn',
  },
};
