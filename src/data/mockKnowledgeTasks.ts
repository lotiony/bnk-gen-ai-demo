export type KnowledgeTaskState = '실행 중' | '계획' | '완료' | '보류';
export type AssetKind = '지식 데이터' | 'DB 커넥터' | 'API 커넥터';

export interface KnowledgeTask {
  id: string;
  name: string;
  state: KnowledgeTaskState;
  assetKind: AssetKind;
  /** 산출 자산 식별자. 예: idx-voice-phishing-v3 */
  assetId: string;
  /** 마지막 갱신 / 빌드 일시. */
  updatedAt: string;
  ownerName: string;
  ownerInitial: string;
  /** 원천 문서 개수. */
  sourceCount: number;
  /** 빌드된 청크 수. 진행 중이면 미정일 수 있음. */
  chunkCount?: number;
  /** 진행률 0~100. 완료면 100, 보류면 멈춰있는 값. */
  progress: number;
  /** 이번 회차에 변경된 사항 요약 (1줄). */
  changeNote: string;
}

/** "보이스피싱탐지 에이전트_디지털전략부" 프로젝트의 지식데이터 과제 예시. */
export const MOCK_KNOWLEDGE_TASKS: KnowledgeTask[] = [
  {
    id: 'KNW-201',
    name: '보이스피싱 사례매뉴얼',
    state: '실행 중',
    assetKind: '지식 데이터',
    assetId: 'idx-voice-phishing-v3',
    updatedAt: '2026-05-18 10:42',
    ownerName: '조현우',
    ownerInitial: '현우',
    sourceCount: 3,
    chunkCount: 1842,
    progress: 64,
    changeNote: '사례매뉴얼 2026Q1·응대스크립트 v3.2·FAQ 2026 신규 반영 중',
  },
  {
    id: 'KNW-187',
    name: '금감원 보이스피싱 통계 DB 커넥터',
    state: '계획',
    assetKind: 'DB 커넥터',
    assetId: 'db-fss-vp-stats',
    updatedAt: '2026-05-15 09:12',
    ownerName: '박서연',
    ownerInitial: '서연',
    sourceCount: 1,
    progress: 0,
    changeNote: 'PostgreSQL 읽기 전용 커넥터 추가 · 결재 대기 (APR-2026-051)',
  },
];
