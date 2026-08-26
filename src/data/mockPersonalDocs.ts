/**
 * 개인 문서 기반 RAG mock.
 *
 * RFP 2-1 사용자 포털:
 *   "개인 문서 기반 RAG 구성: 업로드 문서 자동 파싱·벡터 적재 후 에이전트 개발 및
 *    대화에 활용 가능한 환경 제공(**개인별 격리 저장**)"
 *
 * 조직 단위 지식 데이터 과제(KnowledgeDataTaskPage)와 다른 축이다 — 이건 **개인**
 * 소유이고, 계열사·부서 공유 없이 본인만 조회한다. 공유하려면 지식 데이터 과제로
 * 별도 승격 신청해야 한다(그래서 "승격 신청" 액션을 둔다).
 *
 * 전부 가상 창작물이다(CLAUDE.md 절대 규칙).
 */

export type PersonalDocState = '파싱 중' | '적재 완료' | '실패';

export interface PersonalDoc {
  id: string;
  name: string;
  ext: string;
  sizeMB: number;
  uploadedAt: string;
  state: PersonalDocState;
  /** 파싱 후 생성된 청크 수. */
  chunks?: number;
  /** 개인 격리 인덱스 이름. */
  index: string;
}

export const PERSONAL_DOCS: PersonalDoc[] = [
  { id: 'PDOC-01', name: '5월_영업전략_초안.docx', ext: 'DOCX', sizeMB: 1.2, uploadedAt: '2026-06-01 10:20', state: '적재 완료', chunks: 24, index: 'idx-personal-usr_8f3a' },
  { id: 'PDOC-02', name: '거래처_미팅_메모.pdf', ext: 'PDF', sizeMB: 0.4, uploadedAt: '2026-06-02 14:05', state: '적재 완료', chunks: 8, index: 'idx-personal-usr_8f3a' },
  { id: 'PDOC-03', name: '분기_실적_초안.xlsx', ext: 'XLSX', sizeMB: 2.8, uploadedAt: '2026-06-03 09:11', state: '파싱 중', index: 'idx-personal-usr_8f3a' },
];
