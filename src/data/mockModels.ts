export type ModelKind = 'llm' | 'embed' | 'rerank' | 'vision';
export type ModelHost = 'on-prem' | 'csp';
export type ModelModality = 'text' | 'multimodal' | 'embed';

export interface CatalogModel {
  id: string;
  /** vendor/model 풀네임 (예: openai/gpt-oss-120b). */
  name: string;
  kind: ModelKind;
  host: ModelHost;
  /** azure / aws / on-prem 등. */
  provider: string;
  modality: ModelModality;
  /** 컨텍스트 윈도우 (토큰). */
  contextK?: number;
  /** 1M 토큰당 단가 (input·output 평균, 원). on-prem은 GPU 분배 단가. */
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
    name: 'openai/gpt-oss-120b',
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
    name: 'azure/gpt-5.5',
    kind: 'llm',
    host: 'csp',
    provider: 'Azure OpenAI',
    modality: 'multimodal',
    contextK: 400,
    pricePerMTokKrw: 14500,
    usedByCount: 2,
    whitelistedAt: '2026-03-08',
    trustGrade: 5,
    recommendedFor: '복잡 추론 · 멀티모달 (혁신금융서비스 지정 필요)',
  },
  {
    id: 'mdl-004',
    name: 'aws/claude-sonnet-4.6',
    kind: 'llm',
    host: 'csp',
    provider: 'AWS Bedrock',
    modality: 'multimodal',
    contextK: 1000,
    pricePerMTokKrw: 12800,
    usedByCount: 1,
    whitelistedAt: '2026-04-15',
    trustGrade: 5,
    recommendedFor: '장문 분석 · 도구 사용 (혁신금융서비스 지정 필요)',
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
    name: 'azure/cohere-rerank-3',
    kind: 'rerank',
    host: 'csp',
    provider: 'Azure Cohere',
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
];

export const MODEL_KIND_LABEL: Record<ModelKind, string> = {
  llm: 'LLM',
  embed: '임베딩',
  rerank: 'Rerank',
  vision: 'Vision',
};
