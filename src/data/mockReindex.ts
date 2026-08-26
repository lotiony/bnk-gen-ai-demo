/**
 * 무중단 리인덱싱 mock.
 *
 * RFP RAG-010 무중단 리인덱싱 지원 (권고)
 *   "임베딩 모델 변경 등으로 인해 에이전트/사용자별 Vector DB의 임베딩 데이터 및
 *    인덱스를 **서비스 중단 없는** 자동/수동 리인덱싱(Re-chunking 포함) 파이프라인 지원"
 *
 * 무중단의 실체는 **블루-그린 인덱스 스왑**이다. 새 인덱스를 옆에 다 만들어 두고,
 * 검증을 통과한 순간 별칭(alias)만 옮긴다. 그래서 화면은 진행률이 아니라
 * **"지금 어느 인덱스가 서빙 중인가"** 를 먼저 보여 준다.
 *
 * 전부 가상 창작물이다(CLAUDE.md 절대 규칙).
 */
import type { Tenant } from './tenants';

export type ReindexPhase =
  | '대기'
  | '재청킹'
  | '재임베딩'
  | '색인 빌드'
  | '품질 검증'
  | '스왑 대기'
  | '완료';

export const PHASE_ORDER: ReindexPhase[] = [
  '재청킹',
  '재임베딩',
  '색인 빌드',
  '품질 검증',
  '스왑 대기',
  '완료',
];

export interface ReindexJob {
  id: string;
  /** 대상 인덱스 별칭 — 서빙은 항상 이 별칭을 본다. */
  alias: string;
  tenant: Tenant;
  /** 현재 서빙 중인 실제 인덱스. */
  serving: string;
  /** 새로 만들고 있는 인덱스. */
  building: string;
  /** 왜 다시 마는가. */
  reason: string;
  /** 재청킹까지 하는가 — 임베딩만 바꾸면 청킹은 그대로 둘 수 있다. */
  rechunk: boolean;
  phase: ReindexPhase;
  /** 현재 단계 진행률 0~100. */
  progress: number;
  docs: number;
  chunks: number;
  startedAt: string;
  /** 예상 완료. */
  eta: string;
  /** 품질 검증 결과 — 스왑 판단 근거. 검증 전이면 undefined. */
  quality?: { metric: string; before: number; after: number; threshold: number }[];
}

export const REINDEX_JOBS: ReindexJob[] = [
  {
    id: 'RIX-2041',
    alias: 'idx-regulation',
    tenant: '그룹 공통',
    serving: 'idx-regulation-v3 (bge-m3)',
    building: 'idx-regulation-v4 (kure-v1)',
    reason: '임베딩 모델 교체 — 한국어 금융 도메인 검색 품질 개선',
    rechunk: false,
    phase: '스왑 대기',
    progress: 100,
    docs: 12_480,
    chunks: 186_200,
    startedAt: '2026-01-08 02:00',
    eta: '검증 완료 · 스왑 승인 대기',
    quality: [
      { metric: 'Recall@10', before: 0.81, after: 0.88, threshold: 0.81 },
      { metric: 'MRR', before: 0.64, after: 0.71, threshold: 0.64 },
      { metric: 'nDCG@10', before: 0.72, after: 0.79, threshold: 0.72 },
    ],
  },
  {
    id: 'RIX-2039',
    alias: 'idx-loan-manual',
    tenant: '부산은행',
    serving: 'idx-loan-manual-v2',
    building: 'idx-loan-manual-v3',
    reason: '청킹 전략 변경 — Fixed-size 512 → Semantic 청킹',
    rechunk: true,
    phase: '재임베딩',
    progress: 62,
    docs: 4_120,
    chunks: 71_400,
    startedAt: '2026-01-08 06:30',
    eta: '약 2시간 20분 남음',
  },
  {
    id: 'RIX-2036',
    alias: 'idx-product-kn',
    tenant: '경남은행',
    serving: 'idx-product-kn-v1',
    building: 'idx-product-kn-v2',
    reason: '상품매뉴얼 2026 개정판 반영 — 증분 색인',
    rechunk: false,
    phase: '색인 빌드',
    progress: 34,
    docs: 1_240,
    chunks: 18_600,
    startedAt: '2026-01-08 08:15',
    eta: '약 40분 남음',
  },
];

/** 무중단을 지탱하는 원칙 — 화면에 그대로 적는다. */
export const REINDEX_PRINCIPLES: { k: string; v: string }[] = [
  {
    k: '별칭 기반 스왑',
    v: '서빙은 항상 별칭(alias)을 본다. 새 인덱스를 옆에 다 만든 뒤 별칭만 옮기므로 전환 순간에도 조회가 끊기지 않는다.',
  },
  {
    k: '품질 게이트',
    v: '기존 인덱스 성능을 밑돌면 스왑하지 않는다. Recall@10 · MRR · nDCG 가 모두 기존값 이상이어야 승인 대상이 된다.',
  },
  {
    k: '즉시 롤백',
    v: '스왑 후 이상이 확인되면 별칭을 이전 인덱스로 되돌린다. 이전 인덱스는 7일간 삭제하지 않는다.',
  },
  {
    k: '자동 · 수동',
    v: '임베딩 모델 교체·원천 대량 변경은 자동 트리거, 청킹 전략 변경은 담당자가 수동으로 건다.',
  },
];
