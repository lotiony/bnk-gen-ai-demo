import type { FileRow } from './storageData';
import type { FileRunStatus } from './parseRunData';

export type EmbedModelId = 'bge-m3-ko' | 'text-embedding-3-large' | 'kb-embed-finance';

export interface EmbedModelDef {
  id: EmbedModelId;
  name: string;
  short: string;
  /** on-prem 또는 CSP. */
  source: 'on-prem' | 'csp';
  dimension: number;
  version: string;
  /** 1,000 토큰당 비용 (원). CSP 모델만 의미 있음. */
  costPerKWon: number;
  desc: string;
}

export const EMBED_MODELS: EmbedModelDef[] = [
  {
    id: 'bge-m3-ko',
    name: 'BGE-M3 Korean',
    short: 'bge-m3-ko',
    source: 'on-prem',
    dimension: 1024,
    version: 'v1.4.2',
    costPerKWon: 0,
    desc: '한국어·금융 도메인 파인튜닝 · 사내 GPU · 권장 기본값',
  },
  {
    id: 'kb-embed-finance',
    name: 'KB Embed Finance',
    short: 'kb-embed-finance',
    source: 'on-prem',
    dimension: 768,
    version: 'v0.9.1',
    costPerKWon: 0,
    desc: 'KB 사내 금융 코퍼스 학습 · 짧은 청크에 강점',
  },
  {
    id: 'text-embedding-3-large',
    name: 'OpenAI text-embedding-3-large',
    short: 'text-embedding-3-large',
    source: 'csp',
    dimension: 3072,
    version: '2024-01',
    costPerKWon: 0.18,
    desc: 'CSP · 영문 강점, 다국어 가능 · 비용 결재 필요',
  },
];

export function getEmbedModel(id: EmbedModelId): EmbedModelDef {
  return EMBED_MODELS.find((m) => m.id === id) ?? EMBED_MODELS[0];
}

export type IndexKind = 'hybrid' | 'vector' | 'bm25';
export type EmbedEnv = 'dev' | 'prod';

export interface IndexEnvStatus {
  env: EmbedEnv;
  /** 'built' = 빌드 완료, 'building' = 진행, 'pending' = 미배포, 'stale' = 원본 변경 후 재빌드 필요. */
  state: 'built' | 'building' | 'pending' | 'stale';
  vectors: number;
  sizeMB: number;
  builtAt?: string;
  /** 서빙계 프로모션 결재 상태 (prod만). */
  approval?: 'none' | 'pending' | 'approved';
}

export interface IndexInfo {
  indexId: string;
  indexName: string;
  modelId: EmbedModelId;
  kind: IndexKind;
  dev: IndexEnvStatus;
  /** 학습계 빌드 이후 추가된 새 청크 (재빌드 대기 카운트). */
  pendingChunks: number;
}

export type EmbedFileState = 'embedded' | 'embedding' | 'pending' | 'needsParse' | 'failed';

/** 임베딩 기록 — 데이터셋 단위로 임베딩을 실행한 이력. */
export interface EmbedRecord {
  id: string;
  datasetName: string;
  docCount: number;
  chunks: number;
  model: string;
  /** 대상 인덱스 이름. */
  indexName?: string;
  /** 인덱스 유형 라벨. */
  kind?: string;
  createdAt: string;
  state: 'embedding' | 'done';
}

export interface FileEmbedStatus {
  fileId: string;
  name: string;
  ext: FileRow['ext'];
  state: EmbedFileState;
  /** 임베딩 완료된 벡터 수 (= 청크 수). */
  vectors: number;
  /** 파싱 청킹에서 받은 청크 수 (= 임베딩 대상 크기). */
  chunks: number;
  /** 사용된 임베딩 모델 (완료된 경우). */
  modelId?: EmbedModelId;
  /** 마지막 임베딩 시각. */
  embeddedAt?: string;
  note?: string;
}

/** 페이지 진입 시 mock — 이미 학습계에 빌드된 (대표) 인덱스. EmbedSection이 누적하는 대상. */
export function buildIndexMock(): IndexInfo {
  return {
    indexId: 'idx-vp-call-7m2k',
    indexName: 'PB_상담_지식인덱스',
    modelId: 'bge-m3-ko',
    kind: 'hybrid',
    pendingChunks: 0,
    dev: {
      env: 'dev',
      state: 'built',
      vectors: 3415,
      sizeMB: 9.2,
      builtAt: '2026-01-08 09:34',
    },
  };
}

/** 인덱스의 한 버전. 같은 인덱스라도 모델/유형/문서 구성이 다를 수 있고, 그 변화가 새 버전이 된다. */
export interface IndexVersion {
  /** v1, v2, ... 또는 v0.3, v1.0 같은 라벨. */
  version: string;
  createdAt: string;
  createdBy: string;
  modelId: EmbedModelId;
  kind: IndexKind;
  vectors: number;
  sizeMB: number;
  /** 이 버전에 포함된 파일 id. */
  fileIds: string[];
  /** 'built' = 빌드 완료, 'building' = 진행, 'stale' = 원본 변경 후 재빌드 필요. */
  state: 'built' | 'building' | 'stale';
  /** 변경 메모 — 이 버전이 왜 만들어졌는지. */
  changeNote?: string;
}

export interface IndexWithVersions {
  indexId: string;
  indexName: string;
  /** 최신이 [0]. 내림차순. */
  versions: IndexVersion[];
  /** 최신 빌드 이후 추가된 새 청크 (재빌드 대기). */
  pendingChunks: number;
  /**
   * 동의어 맵 규칙(Solr 포맷). 쿼리 시점 확장 — 재빌드 불필요.
   * 예: '적금, 정기적금, 예적금' (동등) / 'USB => 유에스비' (명시 매핑).
   * 키워드/하이브리드 검색에만 적용되고 벡터 전용에는 적용되지 않는다.
   */
  synonyms: string[];
}

/** 여러 인덱스 + 버전 이력 mock. 같은 과제 안에서 모델/유형/문서 구성을 바꿔가며 만든 버전들. */
export function buildIndexListMock(): IndexWithVersions[] {
  return [
    {
      indexId: 'idx-vp-call-7m2k',
      indexName: 'PB_상담_지식인덱스',
      pendingChunks: 0,
      synonyms: ['ISA, 개인종합자산관리계좌', '적금, 정기적금, 예적금', '중도해지, 중도해약', '납입한도 => 납입 한도'],
      versions: [
        {
          version: 'v4',
          createdAt: '2026-01-08 09:34',
          createdBy: '윤지수',
          modelId: 'bge-m3-ko',
          kind: 'hybrid',
          vectors: 3415,
          sizeMB: 9.2,
          fileIds: ['f-vp-manual-2025q4', 'f-vp-manual-2025q3', 'f-script-v31'],
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
          sizeMB: 4.6,
          fileIds: ['f-vp-manual-2025q3', 'f-script-v31'],
          state: 'built',
          changeNote: '상담스크립트 v3.1 추가',
        },
        {
          version: 'v2',
          createdAt: '2025-09-04 10:21',
          createdBy: '박서연',
          modelId: 'bge-m3-ko',
          kind: 'vector',
          vectors: 1524,
          sizeMB: 3.9,
          fileIds: ['f-vp-manual-2025q3'],
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
          sizeMB: 4.1,
          fileIds: ['f-vp-manual-2025q3'],
          state: 'built',
          changeNote: '첫 빌드',
        },
      ],
    },
    {
      indexId: 'idx-reg-verify-3a9x',
      indexName: '규정_검증_인덱스',
      pendingChunks: 0,
      synonyms: ['약관, 약정서', '수수료, 보수'],
      versions: [
        {
          version: 'v2',
          createdAt: '2025-12-30 15:12',
          createdBy: '조현우',
          modelId: 'kb-embed-finance',
          kind: 'bm25',
          vectors: 842,
          sizeMB: 2.3,
          fileIds: ['reg-1', 'reg-2', 'reg-3'],
          state: 'built',
          changeNote: '규정 매뉴얼 3종 재빌드',
        },
      ],
    },
    {
      indexId: 'idx-new-prod-5k1p',
      indexName: '2026_신상품_FAQ_인덱스',
      pendingChunks: 0,
      synonyms: [],
      versions: [
        {
          version: 'v1',
          createdAt: '2026-02-13 10:05',
          createdBy: '박서연',
          modelId: 'bge-m3-ko',
          kind: 'vector',
          vectors: 318,
          sizeMB: 0.9,
          fileIds: [],
          state: 'built',
          changeNote: '첫 빌드',
        },
      ],
    },
  ];
}

/** 파싱 청킹 run을 기반으로 임베딩 상태 도출.
 *  완료된 청크는 'embedded' (mock), 진행 중/대기/실패는 그대로 매핑. */
export function deriveFileEmbedStatus(
  files: FileRow[],
  runs: FileRunStatus[],
): FileEmbedStatus[] {
  return files.map((f) => {
    // 한 파일에 여러 run이 있을 수 있어 (다른 파서) — 가장 진행도 높은 것 우선
    const fileRuns = runs.filter((r) => r.id.split('__')[0] === f.id);
    if (fileRuns.length === 0) {
      return {
        fileId: f.id,
        name: f.name,
        ext: f.ext,
        state: 'needsParse',
        vectors: 0,
        chunks: 0,
      };
    }
    const score = (s: FileRunStatus['state']) => (s === 'run' ? 3 : s === 'fail' ? 2 : s === 'done' ? 1 : 0);
    const top = [...fileRuns].sort((a, b) => score(b.state) - score(a.state))[0];
    if (top.state === 'done') {
      // 완료된 청크는 데모용으로 이미 임베딩되었다고 가정
      return {
        fileId: f.id,
        name: f.name,
        ext: f.ext,
        state: 'embedded',
        vectors: top.chunks,
        chunks: top.chunks,
        modelId: 'bge-m3-ko',
        embeddedAt: top.finishedAt ? top.finishedAt.replace(' ', ' · ') : undefined,
      };
    }
    if (top.state === 'fail') {
      return {
        fileId: f.id,
        name: f.name,
        ext: f.ext,
        state: 'failed',
        vectors: 0,
        chunks: top.chunks,
        note: '파싱 실패 — 재파싱 후 임베딩 가능',
      };
    }
    if (top.state === 'run') {
      return {
        fileId: f.id,
        name: f.name,
        ext: f.ext,
        state: 'pending',
        vectors: 0,
        chunks: top.chunks,
        note: '파싱 진행 중',
      };
    }
    return {
      fileId: f.id,
      name: f.name,
      ext: f.ext,
      state: 'needsParse',
      vectors: 0,
      chunks: 0,
    };
  });
}
