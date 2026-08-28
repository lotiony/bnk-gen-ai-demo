export type ModelKind = 'llm' | 'embed' | 'rerank' | 'vision';
export type ModelHost = 'on-prem';
export type ModelModality = 'text' | 'multimodal' | 'embed';

export interface CatalogModel {
  id: string;
  /** vendor/model 풀네임 (예: onprem/gpt-oss-120b). */
  name: string;
  kind: ModelKind;
  host: ModelHost;
  /** 서빙 스택 (예: vLLM · Triton). */
  provider: string;
  modality: ModelModality;
  /** 컨텍스트 윈도우 (토큰). */
  contextK?: number;
  /** 1M 토큰당 환산 단가 (GPU 분배 기준, 원). */
  pricePerMTokKrw?: number;
  /** on-prem 분배 단가 (시간당). */
  gpuHourKrw?: number;
  /** 사용 중인 과제 수. */
  usedByCount: number;
  /** 화이트리스트 등록일. */
  whitelistedAt: string;
  /** 1~5등급. */
  trustGrade: 1 | 2 | 3 | 4 | 5;
  /** 권장 용도. */
  recommendedFor: string;
}

export const MOCK_MODELS: CatalogModel[] = [
  {
    id: 'mdl-001',
    name: 'onprem/gpt-oss-120b',
    kind: 'llm',
    host: 'on-prem',
    provider: 'on-prem · A100×8',
    modality: 'text',
    contextK: 128,
    gpuHourKrw: 4200,
    usedByCount: 7,
    whitelistedAt: '2025-11-04',
    trustGrade: 5,
    recommendedFor: '범용 대화형·코드 생성 (대고객 권장)',
  },
  {
    id: 'mdl-002',
    name: 'google/gemma-4-31B-it-assistant',
    kind: 'llm',
    host: 'on-prem',
    provider: 'on-prem · A100×4',
    modality: 'text',
    contextK: 128,
    gpuHourKrw: 1800,
    usedByCount: 4,
    whitelistedAt: '2026-01-22',
    trustGrade: 4,
    recommendedFor: 'Fallback / 비용 절감 시나리오',
  },
  {
    id: 'mdl-003',
    name: 'onprem/qwen3-32b',
    kind: 'llm',
    host: 'on-prem',
    provider: 'vLLM · 공동존',
    modality: 'multimodal',
    contextK: 400,
    pricePerMTokKrw: 14500,
    usedByCount: 2,
    whitelistedAt: '2026-03-08',
    trustGrade: 5,
    recommendedFor: '복잡 추론 · 멀티모달',
  },
  {
    id: 'mdl-004',
    name: 'onprem/llama-3.3-70b',
    kind: 'llm',
    host: 'on-prem',
    provider: 'vLLM · 공동존',
    modality: 'multimodal',
    contextK: 1000,
    pricePerMTokKrw: 12800,
    usedByCount: 1,
    whitelistedAt: '2026-04-15',
    trustGrade: 5,
    recommendedFor: '장문 분석 · 도구 사용',
  },
  {
    id: 'mdl-005',
    name: 'on-prem/e5-large-ko-1024d',
    kind: 'embed',
    host: 'on-prem',
    provider: 'on-prem · A10×2',
    modality: 'embed',
    gpuHourKrw: 600,
    usedByCount: 3,
    whitelistedAt: '2025-09-30',
    trustGrade: 5,
    recommendedFor: '한국어 RAG 임베딩 표준',
  },
  {
    id: 'mdl-006',
    name: 'on-prem/bge-m3-1024d',
    kind: 'embed',
    host: 'on-prem',
    provider: 'on-prem · A10×2',
    modality: 'embed',
    gpuHourKrw: 600,
    usedByCount: 2,
    whitelistedAt: '2025-12-11',
    trustGrade: 4,
    recommendedFor: '다국어 / 영문 혼합 RAG',
  },
  {
    id: 'mdl-007',
    name: 'onprem/bge-reranker-v2-m3',
    kind: 'rerank',
    host: 'on-prem',
    provider: 'Triton · 공동존',
    modality: 'text',
    pricePerMTokKrw: 4200,
    usedByCount: 1,
    whitelistedAt: '2026-02-14',
    trustGrade: 4,
    recommendedFor: '검색 결과 재정렬 (cross-encoder)',
  },
  {
    id: 'mdl-008',
    name: 'on-prem/bge-reranker-large',
    kind: 'rerank',
    host: 'on-prem',
    provider: 'on-prem · A10×1',
    modality: 'text',
    gpuHourKrw: 400,
    usedByCount: 0,
    whitelistedAt: '2026-05-02',
    trustGrade: 3,
    recommendedFor: '비용 민감 시나리오의 rerank',
  },
  {
    /*
     * 반입 승인(`mockIntake` IN-2041, 2026-05-27 조건부 승인)을 거쳐 등재된 모델.
     * 게시판 공지(NTC-039 「kanana-flag-32.5B 반입 완료 안내」, 2026-05-28)가
     * 가리키는 대상이 이 항목이다 — 반입 승인 화면·공지·화이트리스트 셋이
     * 같은 모델을 같은 상태로 말해야 한다.
     * 편향 셋 기준 미달로 **학습계 한정** 조건이 붙어 있어 신뢰등급을 낮게 둔다.
     */
    id: 'mdl-009',
    name: 'kakao/kanana-flag-32.5b-it',
    kind: 'llm',
    host: 'on-prem',
    provider: 'on-prem · A100×4',
    modality: 'text',
    contextK: 32,
    gpuHourKrw: 1900,
    usedByCount: 0,
    whitelistedAt: '2026-05-28',
    trustGrade: 3,
    recommendedFor: '한국어 요약·문서 정리 (학습계 한정 · 대고객 서빙 별도 결재)',
  },
];

export const MODEL_KIND_LABEL: Record<ModelKind, string> = {
  llm: 'LLM',
  embed: '임베딩',
  rerank: 'Rerank',
  vision: 'Vision',
};
