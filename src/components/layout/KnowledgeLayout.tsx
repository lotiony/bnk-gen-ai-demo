import WorkspaceLayout, { type WorkspaceNavItem } from './WorkspaceLayout';
import AreaGuard from './AreaGuard';

/**
 * 지식 · 데이터 셸.
 *
 * RFP 기술요건 구분 2(EDA)·3(RAG)을 한 메뉴로 묶는다.
 * **온톨로지는 여기 산다** — 프로젝트 하위 과제에서 옮겨 왔다.
 *   · RAG-007 그래프 RAG (필수) : 지식 그래프 기반 추론 리트리버
 *   · RAG-008 온톨로지 플랫폼 연계 (권고) : 도메인 온톨로지를 LLM/RAG 에 연결
 * 두 요건이 같은 자산을 근거로 하므로 검색 파이프라인 바로 옆에 두는 것이 맞다.
 */
const NAV: WorkspaceNavItem[] = [
  { label: '지식 데이터', to: '/knowledge', hint: '수집 · 파싱 · 임베딩', group: '지식', end: true },
  {
    label: '온톨로지 · 지식그래프',
    to: '/knowledge/ontology',
    hint: 'Graph RAG 리트리버',
    group: '지식',
  },
  {
    label: '검색 파이프라인',
    to: '/knowledge/pipeline',
    hint: '하이브리드 · 리랭킹 · 평가',
    group: '지식',
  },
  {
    label: '무중단 리인덱싱',
    to: '/knowledge/reindex',
    hint: '별칭 스왑 · 품질 게이트',
    group: '지식',
  },
  { label: '데이터베이스', to: '/knowledge/db', hint: '스키마 · DBA 결재', group: '데이터' },
  {
    label: '데이터 라우팅',
    to: '/knowledge/routing',
    hint: '개발DB / 운영DB 동적 전환',
    group: '데이터',
  },
  {
    label: '메타데이터 승인',
    to: '/knowledge/metadata',
    hint: 'Data Owner 사전 검증',
    group: '데이터',
  },
  {
    label: '자연어 조회',
    to: '/knowledge/nl2sql',
    hint: 'NL2SQL · 쿼리 가드레일',
    group: '데이터',
  },
];

const GROUPS = ['지식', '데이터'];

export default function KnowledgeLayout() {
  return (
    <AreaGuard area={'knowledge'}>
      <WorkspaceLayout
        eyebrow="데이터 워크스페이스"
        title="지식 · 데이터"
        subtitle="RAG · 온톨로지 · 연계"
        nav={NAV}
        groups={GROUPS}
      />
    </AreaGuard>
  );
}
