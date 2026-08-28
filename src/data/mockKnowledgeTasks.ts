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

/**
 * 지식데이터 과제 원장.
 *
 * ⚠️ 에이전트가 `linkedKnowledge` 로 가리키는 KNW-* 는 **여기 반드시 있어야 한다.**
 *   과제 상세에서 연결 지식을 클릭하면 그대로 빈 화면이 된다.
 *
 * 결재 ID 접두사는 `APV-` 로 통일한다(정본은 `mockApprovals.approvals`).
 *   한때 `APR-` 을 쓰던 곳이 있었는데, 같은 결재함을 두 이름으로 부르면
 *   "이 둘이 같은 겁니까"에 답이 없다.
 */
export const MOCK_KNOWLEDGE_TASKS: KnowledgeTask[] = [
  {
    /*
     * AGT-204(PB 자산진단 어시스턴트)가 연결해 쓰는 지식 인덱스.
     * 포털 Chat 의 에이전트 설명(`mockChat.CHAT_AGENTS`)이 이 자산을
     * "PB_상담_지식인덱스 v4" 로 부르므로 이름·버전을 그쪽과 맞춘다.
     */
    id: 'KNW-198',
    name: 'PB_상담_지식인덱스',
    state: '완료',
    assetKind: '지식 데이터',
    assetId: 'idx-pb-consult-v4',
    updatedAt: '2026-05-28 14:36',
    ownerName: '박서연',
    ownerInitial: '서연',
    sourceCount: 5,
    chunkCount: 3260,
    progress: 100,
    changeNote: '상품매뉴얼 2026 개정판·시장브리프 2026Q2 반영 — v4 빌드 완료',
  },
  {
    id: 'KNW-201',
    name: '보이스피싱 사례매뉴얼',
    state: '실행 중',
    assetKind: '지식 데이터',
    assetId: 'idx-voice-phishing-v3',
    updatedAt: '2026-05-28 10:42',
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
    updatedAt: '2026-05-25 09:12',
    ownerName: '박서연',
    ownerInitial: '서연',
    sourceCount: 1,
    progress: 0,
    changeNote: 'PostgreSQL 읽기 전용 커넥터 추가 · 결재 대기 (APV-2026-092)',
  },
];
