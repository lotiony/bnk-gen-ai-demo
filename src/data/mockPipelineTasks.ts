export type PipelineTaskState = '학습계 배포' | '평가 진행' | '서빙계 운영' | '기획';
export type RetrievalMethod = 'BM25' | 'Dense' | 'Hybrid' | 'Hybrid + Rerank';
export type IndexBuildState = 'built' | 'building' | 'stale';
export type IndexKind = 'hybrid' | 'vector' | 'bm25';

export interface PipelineIndexVersion {
  /** v1, v2, ... */
  version: string;
  createdAt: string;
  createdBy: string;
  /** 임베딩 모델 short ID (예: bge-m3-ko). */
  modelId: string;
  kind: IndexKind;
  vectors: number;
  /** 문서 개수. */
  docs: number;
  state: IndexBuildState;
  changeNote?: string;
}

export interface PipelineIndexRef {
  id: string;
  /** 인덱스 표시명 (지식데이터 과제의 indexName). */
  indexName: string;
  /** 인덱스 소유 과제명. */
  ownerTask: string;
  mine: boolean;
  sens: 1 | 2 | 3 | 4;
  refresh: '실시간' | '일' | '주' | '월' | '분기';
  lastSync: string;
  /** 최신 빌드 이후 추가된 새 청크 (재빌드 대기). */
  pendingChunks: number;
  /** 버전 이력 — 최신이 [0], 내림차순. 본 파이프라인이 현재 어떤 버전을 사용 중인지는 pinnedVersion으로 표기. */
  versions: PipelineIndexVersion[];
  /** 본 파이프라인이 현재 사용 중인 버전. 미지정 시 최신(versions[0]) 사용. */
  pinnedVersion?: string;
}

/**
 * 학습계 단일 API 키. 에이전트 과제의 ApiKey와 동일한 패턴 —
 * fullKey/lastFour로 보기·마스킹 토글, 재발급 시 누적 호출 0으로 초기화.
 */
export interface PipelineApiKey {
  /** 전체 키 (발급 직후 화면에서만 노출). */
  fullKey: string;
  /** 마스킹된 마지막 4자리. */
  lastFour: string;
  endpoint: string;
  issuedAt: string;
  issuedBy: string;
  callCount: number;
  lastUsedAt?: string;
}

export type DevDeployStatus = 'active' | 'previous' | 'rolled-back' | 'failed';

export interface PipelineDevDeployment {
  id: string;
  /** d1, d2, ... 또는 d.7 같은 라벨. */
  version: string;
  deployedAt: string;
  deployedBy: string;
  /** 이 배포가 사용한 인덱스 버전 조합 (indexId → version). */
  indexConfig: { indexId: string; indexName: string; version: string }[];
  status: DevDeployStatus;
  /** 변경 노트. */
  note?: string;
  /** 결재 ID (있으면 결재 내역 링크). */
  approvalId?: string;
}

export interface PipelineConsumer {
  agentId: string;
  agentName: string;
  ownerName: string;
  /** 호출 가중치 — 7일 비율(%) */
  share: number;
  state: '연동 중' | '검토 중' | '대기';
}

export interface PipelineEvalMetric {
  name: 'Recall@10' | 'MRR@10' | 'nDCG@10';
  baseline: number;
  threshold: number;
  current?: number;
  /** 통과 여부. current가 없으면 undefined. */
  passed?: boolean;
}

export interface PipelineEvalRun {
  id: string;
  /** 학습계 배포 버전 (어떤 인덱스 조합에 대해 평가한 회차인지). */
  deployVersion?: string;
  runAt: string;
  trigger: '수동' | '자동' | '원천 변경';
  ranBy: string;
  goldenSize: number;
  metrics: PipelineEvalMetric[];
  /** 변경 노트. */
  note: string;
  /** 외부 평가 콘솔(예: Langfuse) 안에서 본 run의 deep link. */
  consoleRunUrl?: string;
}

/** 평가 콘솔 (Langfuse 같은 외부 도구) 메타. */
export interface PipelineEvalConsole {
  name: string;
  url: string;
  /** 누적 trace 수. */
  traceCount: number;
  lastSyncedAt: string;
  /** 새 평가 실행 진입 URL. */
  runUrl: string;
  /** 데이터셋(골든셋) 관리 URL. */
  datasetUrl: string;
}

export interface PipelineTask {
  id: string;
  name: string;
  state: PipelineTaskState;
  /** 현재 단계 (1~4). 4-stage stepper의 현재 위치. */
  currentStage: 1 | 2 | 3 | 4;
  retrieval: RetrievalMethod;
  /** 결합 방식. */
  combine: '단일' | '페더레이션' | '라우팅';
  /** 멀티테넌시 격리 여부. */
  tenancy: '단일 테넌트' | '다중 테넌트';
  /** 입력 인덱스. */
  indexes: PipelineIndexRef[];
  /** 임베딩 모델. */
  embedModel: string;
  /** Rerank 모델 (선택). CSP 모델이면 비용 결재가 묶임. */
  rerankModel?: string;
  /** 기본 Top-K. */
  topK: number;
  /** 청크 윈도우 (매칭 ±N). */
  chunkWindow: number;
  /** 골든셋 정보. */
  golden: { fileName: string; count: number; min: number; uploadedAt: string; uploadedBy: string };
  /** 평가 메트릭 (최근 1회 기준 베이스라인·임계값·현재값). */
  metrics: PipelineEvalMetric[];
  /** 평가 실행 이력. */
  evalRuns: PipelineEvalRun[];
  /** 소비 Agent (연결 카탈로그). */
  consumers: PipelineConsumer[];
  /** 평가 콘솔(외부 도구) 연결 정보. */
  evalConsole?: PipelineEvalConsole;
  /** 학습계 단일 API 키 (없으면 미발급 상태). */
  apiKey?: PipelineApiKey;
  /** 학습계 배포 버전 이력 (최신이 [0]). */
  devDeployments: PipelineDevDeployment[];
  /** 학습계 endpoint URL. */
  endpointDev?: string;
  /** 서빙계 endpoint URL (운영 중일 때만). */
  endpointProd?: string;
  /** 일간 호출량 (7일 평균). */
  callsDaily?: number;
  /** P95 응답시간 (ms). */
  p95Ms?: number;
  /** 가용성 (%). */
  availability?: number;
  ownerName: string;
  ownerInitial: string;
  updatedAt: string;
  changeNote: string;
  /** 평가 진행률 0~100 (Stage 3 기준). */
  evalProgress: number;
}

/** 진행 중인 인메모리 mock 저장소. */
export const MOCK_PIPELINE_TASKS: PipelineTask[] = [
  {
    id: 'SRC-301',
    name: '규정검색_컴플라이언스',
    state: '평가 진행',
    currentStage: 3,
    retrieval: 'Hybrid + Rerank',
    combine: '페더레이션',
    tenancy: '다중 테넌트',
    indexes: [
      {
        id: 'idx-vp-call-7m2k',
        indexName: '보이스피싱_탐지_지식인덱스',
        ownerTask: '보이스피싱 사례매뉴얼',
        mine: true,
        sens: 2,
        refresh: '분기',
        lastSync: '2026-05-22 14:08',
        pendingChunks: 0,
        pinnedVersion: 'v4',
        versions: [
          {
            version: 'v4',
            createdAt: '2026-01-08 09:34',
            createdBy: '윤지수',
            modelId: 'bge-m3-ko',
            kind: 'hybrid',
            vectors: 3415,
            docs: 3,
            state: 'built',
            changeNote: '2025Q4 매뉴얼 추가 임베딩 · 총 1,683 벡터 증가',
          },
          {
            version: 'v3',
            createdAt: '2025-10-14 11:32',
            createdBy: '윤지수',
            modelId: 'bge-m3-ko',
            kind: 'hybrid',
            vectors: 1732,
            docs: 2,
            state: 'built',
            changeNote: '응대스크립트 v3.1 추가',
          },
          {
            version: 'v2',
            createdAt: '2025-09-04 10:21',
            createdBy: '박서연',
            modelId: 'bge-m3-ko',
            kind: 'vector',
            vectors: 1524,
            docs: 1,
            state: 'built',
            changeNote: '인덱스 유형 비교 — 벡터 전용으로 빌드 후 하이브리드로 전환',
          },
          {
            version: 'v1',
            createdAt: '2025-08-22 16:08',
            createdBy: '조현우',
            modelId: 'bge-m3-ko',
            kind: 'hybrid',
            vectors: 1524,
            docs: 1,
            state: 'built',
            changeNote: '첫 빌드',
          },
        ],
      },
      {
        id: 'idx-compliance-rules-3p4k',
        indexName: '전사_규정_컴플라이언스_지식인덱스',
        ownerTask: '전사 규정·컴플라이언스 지식',
        mine: false,
        sens: 3,
        refresh: '실시간',
        lastSync: '2026-05-23 09:12',
        pendingChunks: 184,
        pinnedVersion: 'v7',
        versions: [
          {
            version: 'v8',
            createdAt: '2026-05-23 09:12',
            createdBy: '김재훈',
            modelId: 'e5-large-ko',
            kind: 'hybrid',
            vectors: 12407,
            docs: 84,
            state: 'building',
            changeNote: '신용정보법 시행령 개정 반영 진행 중 · 32 청크 갱신',
          },
          {
            version: 'v7',
            createdAt: '2026-04-30 17:48',
            createdBy: '김재훈',
            modelId: 'e5-large-ko',
            kind: 'hybrid',
            vectors: 12183,
            docs: 82,
            state: 'built',
            changeNote: '2026 1분기 규정 추가 · 본 파이프라인이 현재 사용 중',
          },
          {
            version: 'v6',
            createdAt: '2026-03-12 14:20',
            createdBy: '정우진',
            modelId: 'e5-large-ko',
            kind: 'hybrid',
            vectors: 11842,
            docs: 79,
            state: 'built',
            changeNote: '컴플라이언스 부서 가이드라인 통합',
          },
        ],
      },
    ],
    embedModel: 'on-prem/e5-large-ko-1024d',
    rerankModel: 'azure/cohere-rerank-3',
    topK: 10,
    chunkWindow: 3,
    golden: {
      fileName: 'goldset_compliance_v1.jsonl',
      count: 147,
      min: 120,
      uploadedAt: '2026-05-22',
      uploadedBy: '윤지수',
    },
    metrics: [
      { name: 'Recall@10', baseline: 0.82, threshold: 0.85, current: 0.87, passed: true },
      { name: 'MRR@10', baseline: 0.61, threshold: 0.68, current: 0.71, passed: true },
      { name: 'nDCG@10', baseline: 0.74, threshold: 0.78, current: 0.79, passed: true },
    ],
    evalRuns: [
      {
        id: 'EVAL-3',
        deployVersion: 'd3',
        runAt: '2026-05-23 11:20',
        trigger: '자동',
        ranBy: '윤지수',
        goldenSize: 147,
        metrics: [
          { name: 'Recall@10', baseline: 0.82, threshold: 0.85, current: 0.87, passed: true },
          { name: 'MRR@10', baseline: 0.61, threshold: 0.68, current: 0.71, passed: true },
          { name: 'nDCG@10', baseline: 0.74, threshold: 0.78, current: 0.79, passed: true },
        ],
        note: '3차 — rerank 가중 0.7로 상향, 모든 임계값 통과',
        consoleRunUrl: 'https://evals.aip.group.local/runs/EVAL-3',
      },
      {
        id: 'EVAL-2',
        deployVersion: 'd3',
        runAt: '2026-05-22 17:48',
        trigger: '수동',
        ranBy: '조현우',
        goldenSize: 147,
        metrics: [
          { name: 'Recall@10', baseline: 0.82, threshold: 0.85, current: 0.84, passed: false },
          { name: 'MRR@10', baseline: 0.61, threshold: 0.68, current: 0.67, passed: false },
          { name: 'nDCG@10', baseline: 0.74, threshold: 0.78, current: 0.76, passed: false },
        ],
        note: '2차 — rerank 가중 0.5, 일부 게이트 미달',
        consoleRunUrl: 'https://evals.aip.group.local/runs/EVAL-2',
      },
      {
        id: 'EVAL-1',
        deployVersion: 'd2',
        runAt: '2026-05-22 15:02',
        trigger: '수동',
        ranBy: '조현우',
        goldenSize: 120,
        metrics: [
          { name: 'Recall@10', baseline: 0.82, threshold: 0.85, current: 0.79, passed: false },
          { name: 'MRR@10', baseline: 0.61, threshold: 0.68, current: 0.58, passed: false },
          { name: 'nDCG@10', baseline: 0.74, threshold: 0.78, current: 0.71, passed: false },
        ],
        note: '1차 — Hybrid only (rerank 미적용), 베이스라인 대비 하락',
        consoleRunUrl: 'https://evals.aip.group.local/runs/EVAL-1',
      },
    ],
    evalConsole: {
      name: 'Search Evals',
      url: 'https://evals.aip.group.local/projects/SRC-301',
      traceCount: 4218,
      lastSyncedAt: '2026-05-23 14:08',
      runUrl: 'https://evals.aip.group.local/projects/SRC-301/runs/new',
      datasetUrl: 'https://evals.aip.group.local/projects/SRC-301/datasets',
    },
    consumers: [
      {
        agentId: 'AGT-301',
        agentName: '보이스피싱탐지 에이전트',
        ownerName: '조현우',
        share: 64,
        state: '연동 중',
      },
      {
        agentId: 'AGT-411',
        agentName: '컴플라이언스 자문 챗봇',
        ownerName: '박서연',
        share: 36,
        state: '검토 중',
      },
    ],
    apiKey: {
      fullKey: 'sk-train-A8h2k9PqRtX4mNbVcF6sLwYz3DjGhKfE5uTqWnBpQrJyXcVnMr',
      lastFour: 'k7zA',
      endpoint: 'https://retriever-dev.aip.group.local/v1/search/regulation-compliance',
      issuedAt: '2026-05-19 10:24',
      issuedBy: '조현우',
      callCount: 4218,
      lastUsedAt: '2026-05-23 13:58',
    },
    devDeployments: [
      {
        id: 'dep-3',
        version: 'd3',
        deployedAt: '2026-05-22 14:08',
        deployedBy: '조현우',
        indexConfig: [
          { indexId: 'idx-vp-call-7m2k', indexName: '보이스피싱_탐지_지식인덱스', version: 'v4' },
          { indexId: 'idx-compliance-rules-3p4k', indexName: '전사_규정_컴플라이언스_지식인덱스', version: 'v7' },
        ],
        status: 'active',
        note: '보이스피싱 인덱스 v3 → v4, 컴플라이언스 v6 → v7 동시 갱신',
        approvalId: 'APR-2026-0418',
      },
      {
        id: 'dep-2',
        version: 'd2',
        deployedAt: '2026-05-08 11:20',
        deployedBy: '윤지수',
        indexConfig: [
          { indexId: 'idx-vp-call-7m2k', indexName: '보이스피싱_탐지_지식인덱스', version: 'v3' },
          { indexId: 'idx-compliance-rules-3p4k', indexName: '전사_규정_컴플라이언스_지식인덱스', version: 'v6' },
        ],
        status: 'previous',
        note: '컴플라이언스 v6 추가 — 페더레이션 검증 시작',
        approvalId: 'APR-2026-0392',
      },
      {
        id: 'dep-1',
        version: 'd1',
        deployedAt: '2026-04-21 09:48',
        deployedBy: '조현우',
        indexConfig: [
          { indexId: 'idx-vp-call-7m2k', indexName: '보이스피싱_탐지_지식인덱스', version: 'v3' },
        ],
        status: 'previous',
        note: '최초 학습계 배포 (단일 인덱스 BM25)',
        approvalId: 'APR-2026-0367',
      },
    ],
    endpointDev: 'https://retriever-dev.aip.group.local/v1/search/regulation-compliance',
    endpointProd: undefined,
    callsDaily: 0,
    p95Ms: 720,
    availability: 99.94,
    ownerName: '조현우',
    ownerInitial: '현우',
    updatedAt: '2026-05-23 14:08',
    changeNote: '골든셋 147건 업로드 · 3차 자동 평가 통과 (R@10 0.87, MRR 0.71, nDCG 0.79)',
    evalProgress: 80,
  },
];

export function findPipelineTask(id: string): PipelineTask | undefined {
  return MOCK_PIPELINE_TASKS.find((t) => t.id === id);
}
