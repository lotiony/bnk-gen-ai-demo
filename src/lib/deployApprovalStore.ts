import { useSyncExternalStore } from 'react';
import type { ApprovalItem } from '@/types';
import { DEMO_TODAY } from '@/data/demoClock';

/* ---------------- 검색엔진 검색 옵션 (공유 타입) ---------------- */

export type QueryType = 'keyword' | 'vector' | 'hybrid';
export type VectorAlgo = 'hnsw' | 'knn';

export interface SearchConfig {
  queryType: QueryType;
  semanticRanker: boolean;
  vectorAlgo: VectorAlgo;
  topK: number;
  captions: boolean;
}

export interface DeploySourceSnap {
  name: string;
  version: string;
  model: string;
}

/** 운영계 배포 결재 — ApprovalItem(결재함 표시) + 배포 상세 스냅샷. */
export interface DeployApproval extends ApprovalItem {
  apiName: string;
  apiId: string;
  endpoint: string;
  datasetName: string;
  /** 배포 버전 라벨 (d3 등). */
  version: string;
  sources: DeploySourceSnap[];
  search: SearchConfig;
  /** 현재 운영계 요약(비교용). */
  currentSummary?: string;
  reviewer?: string;
  reviewNote?: string;
  decidedAt?: string;
}

/**
 * 시연 시각 라벨. **`new Date()` 를 쓰지 않는다** — 2026-09-09 시연 당일이면
 * 이 값만 '2026-09-09' 를 찍고 옆의 mock 은 전부 06-03 을 찍는다.
 * 리허설에서는 절대 잡히지 않는 종류의 어긋남이라 세계관 시각으로 고정한다.
 */
const nowLabel = () => `${DEMO_TODAY} 09:40`;

/* ---------------- 스토어 (모듈 레벨 + 구독) ---------------- */

let items: DeployApproval[] = [
  {
    id: 'APV-DEP-002',
    category: 'train',
    title: '지식 검색 API 개발계 배포 (d2)',
    projectName: 'PB 에이전트 프로젝트',
    draftedBy: '정오너',
    draftedAt: '2026-06-02 10:30',
    stage: { current: 1, total: 1, label: '프로젝트 오너 그룹 결재' },
    state: 'done',
    apiName: '지식 검색 API',
    apiId: 'api-pb-7m2k',
    endpoint: 'https://search.aip.group.local/indexes/pb-consult/docs/search',
    datasetName: '상품·시장 안내 매뉴얼',
    version: 'd2',
    sources: [{ name: 'PB_상담_지식인덱스', version: 'v4', model: 'bge-m3-ko' }],
    search: { queryType: 'hybrid', semanticRanker: true, vectorAlgo: 'hnsw', topK: 5, captions: true },
    reviewer: '이도현',
    reviewNote: '검토 완료',
    decidedAt: '2026-06-02 11:05',
  },
  {
    id: 'APV-DEP-001',
    category: 'train',
    title: '지식 검색 API 개발계 배포 (d1)',
    projectName: 'PB 에이전트 프로젝트',
    draftedBy: '박서연',
    draftedAt: '2026-05-20 14:02',
    stage: { current: 1, total: 1, label: '프로젝트 오너 그룹 결재' },
    state: 'done',
    apiName: '지식 검색 API',
    apiId: 'api-pb-7m2k',
    endpoint: 'https://search.aip.group.local/indexes/pb-consult/docs/search',
    datasetName: '상품·시장 안내 매뉴얼',
    version: 'd1',
    sources: [{ name: 'PB_상담_지식인덱스', version: 'v2', model: 'bge-m3-ko' }],
    search: { queryType: 'vector', semanticRanker: false, vectorAlgo: 'hnsw', topK: 3, captions: false },
    reviewer: '이도현',
    reviewNote: '최초 배포 승인',
    decidedAt: '2026-05-20 15:20',
  },
  {
    id: 'APV-SRV-001',
    category: 'serv',
    title: '지식 검색 API 운영계 배포',
    projectName: 'PB 에이전트 프로젝트',
    draftedBy: '정오너',
    draftedAt: '2026-05-27 09:30',
    stage: { current: 3, total: 3, label: '플랫폼 관리 그룹 결재' },
    state: 'done',
    apiName: '지식 검색 API',
    apiId: 'api-pb-7m2k',
    endpoint: 'https://search.aip.group.local/indexes/pb-consult/docs/search',
    datasetName: '상품·시장 안내 매뉴얼',
    version: 's1',
    sources: [{ name: 'PB_상담_지식인덱스', version: 'v2', model: 'bge-m3-ko' }],
    search: { queryType: 'vector', semanticRanker: false, vectorAlgo: 'hnsw', topK: 3, captions: false },
    reviewer: '이도현',
    reviewNote: '운영계 최초 배포 승인',
    decidedAt: '2026-05-27 10:15',
  },
];

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function getDeployApprovals(): DeployApproval[] {
  return items;
}

export function addDeployApproval(a: DeployApproval) {
  items = [a, ...items];
  emit();
}

export function cancelDeployApproval(id: string) {
  items = items.filter((i) => i.id !== id);
  emit();
}

/**
 * 결재 승인/반려.
 *
 * `reviewer` 는 **호출부가 현재 페르소나를 넘긴다.** 이전에는 '이도현' 이
 * 하드코딩돼 있어 누가 승인하든 감사 원장에 같은 이름이 남았다 — ONM-004
 * ("**누가** 언제 무엇을 승인·배포했는가")의 첫 항목이 틀리는 셈이라, 그대로
 * 두면 감사 추적 요건이 화면에서 무너진다.
 */
export function decideDeployApproval(
  id: string,
  decision: 'approve' | 'reject',
  note: string,
  reviewer: string,
) {
  items = items.map((i) =>
    i.id === id
      ? {
          ...i,
          state: decision === 'approve' ? 'done' : 'rejected',
          reviewer,
          reviewNote: note.trim() || undefined,
          decidedAt: nowLabel(),
          stage: { ...i.stage, current: i.stage.total },
        }
      : i,
  );
  emit();
}

/** 다음 배포 버전 라벨 (d{n}). */
export function nextDeployVersion(): string {
  return `d${items.length + 1}`;
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** 컴포넌트에서 스토어 변경에 반응하도록 구독. 반환값은 현재 목록. */
export function useDeployApprovals(): DeployApproval[] {
  return useSyncExternalStore(subscribe, getDeployApprovals, getDeployApprovals);
}
