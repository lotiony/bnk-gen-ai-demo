/**
 * 노코드 워크플로우 빌더 mock — 핸드오프 §2 화면 7.
 *
 * RFP: AGB-002 · AGB-005 · AGB-008
 *
 * 데모에 넣는 컴포넌트 종류는 **핸드오프 §2 화면 7 이 명시한 것만** 둔다
 * (입출력 폼 · 조건문 · LLM 노드 · 에이전트 노드 · MCP Tool). 여기에 지식 검색을
 * 하나 더한 이유는, 이 데모의 서사가 RAG 이고 검색 노드 없이는 워크플로우가
 * 말이 안 되기 때문이다. 그 외에는 늘리지 않는다 — 화면에 그린 컴포넌트는
 * 곧 제공 확약이 된다(RFP Ⅳ.4.1).
 *
 * ⚠️ 전부 가상 데이터다.
 */

export type NodeKind = 'input' | 'knowledge' | 'condition' | 'llm' | 'agent' | 'mcp' | 'output';

export interface NodeKindMeta {
  kind: NodeKind;
  label: string;
  icon: string;
  /** 팔레트·노드 테두리 색. */
  color: string;
  /** 노드 배경(연한). */
  bg: string;
  desc: string;
  /** 출력 포트 라벨. 분기 노드는 둘이다. */
  outs: string[];
}

export const NODE_KINDS: NodeKindMeta[] = [
  {
    kind: 'input', label: '입력 폼', icon: '⌨', color: '#666666', bg: '#F6F6F6',
    desc: '사용자 입력을 받는 시작 노드', outs: ['out'],
  },
  {
    kind: 'knowledge', label: '지식 검색', icon: '📚', color: '#1F5BB8', bg: '#E8F0FB',
    desc: '지식 인덱스·온톨로지에서 근거를 가져온다', outs: ['out'],
  },
  {
    kind: 'condition', label: '조건 분기', icon: '◇', color: '#C9760F', bg: '#FFF6E5',
    desc: '값을 비교해 경로를 가른다', outs: ['참', '거짓'],
  },
  {
    kind: 'llm', label: 'LLM', icon: '✦', color: '#6E3BBD', bg: '#F4ECFF',
    desc: '모델을 직접 호출한다', outs: ['out'],
  },
  {
    kind: 'agent', label: '에이전트', icon: '🤖', color: '#CB2C10', bg: '#FBE9E6',
    desc: '등록된 에이전트를 호출한다', outs: ['out'],
  },
  {
    kind: 'mcp', label: 'MCP Tool', icon: '🔧', color: '#1B8A4D', bg: '#E8F5EE',
    desc: 'MCP 로 등록된 사내 API 를 호출한다', outs: ['out'],
  },
  {
    kind: 'output', label: '출력 폼', icon: '⇥', color: '#666666', bg: '#F6F6F6',
    desc: '결과를 사용자에게 돌려주는 종료 노드', outs: [],
  },
];

export const KIND_META: Record<NodeKind, NodeKindMeta> = NODE_KINDS.reduce(
  (a, k) => ({ ...a, [k.kind]: k }),
  {} as Record<NodeKind, NodeKindMeta>,
);

export interface WfNode {
  id: string;
  kind: NodeKind;
  /** 노드 제목 — 사용자가 바꾼다. */
  title: string;
  /** 속성 패널에 뜨는 설정값. */
  config: { k: string; v: string }[];
  x: number;
  y: number;
}

export interface WfEdge {
  id: string;
  from: string;
  /** 출발 포트 index — 조건 분기는 0=참, 1=거짓. */
  port: number;
  to: string;
}

/** 노드 크기 — 캔버스 좌표 계산이 전부 이 값에 걸린다. */
export const NODE_W = 178;
export const NODE_H = 62;

/**
 * 시드 워크플로우 — 여신 상담 처리.
 * 조건 분기가 실제로 두 갈래로 갈리고, 한쪽만 에이전트를 태운다.
 */
export const SEED_NODES: WfNode[] = [
  {
    id: 'n1', kind: 'input', title: '상담 요청 접수', x: 16, y: 205,
    config: [
      { k: '입력 필드', v: '고객번호 · 신청금액 · 자금용도' },
      { k: '필수 검증', v: '신청금액 > 0' },
    ],
  },
  {
    id: 'n2', kind: 'knowledge', title: '여신 규정 검색', x: 214, y: 205,
    config: [
      { k: '인덱스', v: '여신 온톨로지 ONT-101' },
      { k: '검색 방식', v: 'Graph RAG (관계 순회)' },
      { k: 'Top-K', v: '5' },
    ],
  },
  {
    id: 'n3', kind: 'condition', title: '신청금액 ≥ 5억?', x: 412, y: 205,
    config: [
      { k: '좌변', v: '{{입력.신청금액}}' },
      { k: '연산자', v: '≥' },
      { k: '우변', v: '500,000,000' },
    ],
  },
  {
    id: 'n4', kind: 'agent', title: '여신심사 보조 에이전트', x: 610, y: 112,
    config: [
      { k: '에이전트', v: 'AGT-204 여신심사 보조' },
      { k: '배포 상태', v: 'Approved (서빙계)' },
      { k: '타임아웃', v: '30s' },
    ],
  },
  {
    id: 'n5', kind: 'llm', title: '간이 요약 생성', x: 610, y: 298,
    config: [
      { k: '모델', v: 'onprem/qwen3-32b' },
      { k: 'temperature', v: '0.2' },
      { k: '최대 출력', v: '512 tokens' },
    ],
  },
  {
    id: 'n6', kind: 'mcp', title: '전결권 조회 (MCP)', x: 808, y: 205,
    config: [
      { k: 'Tool', v: 'authority.lookup' },
      { k: '원본 Spec', v: 'OpenAPI 3.0 · 전결규정 API' },
      { k: '인증', v: '서비스 계정 · 감사 기록' },
    ],
  },
  {
    id: 'n7', kind: 'output', title: '상담 결과 반환', x: 1006, y: 205,
    config: [
      { k: '출력 형식', v: '판정 + 근거 조항 + 전결권자' },
      { k: '표시', v: '생성형 AI 산출물 고지 포함' },
    ],
  },
];

export const SEED_EDGES: WfEdge[] = [
  { id: 'e1', from: 'n1', port: 0, to: 'n2' },
  { id: 'e2', from: 'n2', port: 0, to: 'n3' },
  { id: 'e3', from: 'n3', port: 0, to: 'n4' },
  { id: 'e4', from: 'n3', port: 1, to: 'n5' },
  { id: 'e5', from: 'n4', port: 0, to: 'n6' },
  { id: 'e6', from: 'n5', port: 0, to: 'n6' },
  { id: 'e7', from: 'n6', port: 0, to: 'n7' },
];

/* ═══════════════════════ 실행 Trace ═══════════════════════ */

export interface TraceStep {
  nodeId: string;
  /** 이 스텝에서 무엇이 들어왔나. */
  input: string;
  /** 무엇이 나갔나. */
  output: string;
  ms: number;
  /** 토큰 소비 — LLM·에이전트만. */
  tokens?: { in: number; out: number };
  /** 분기 노드가 고른 경로. */
  branch?: string;
}

/**
 * 재생 스크립트. 조건 분기가 '참'을 타므로 n5(LLM)는 실행되지 않는다 —
 * **실행되지 않은 노드가 Trace 에 없다는 것**이 분기가 진짜로 동작한다는 증거다.
 */
export const TRACE: TraceStep[] = [
  {
    nodeId: 'n1',
    input: '고객번호 CUST-88421 · 신청금액 500,000,000 · 운전자금',
    output: '검증 통과 · 3개 필드 정규화',
    ms: 12,
  },
  {
    nodeId: 'n2',
    input: '질의: 신규 여신 5억 승인 요건과 전결 구분',
    output: '조항 2건 · 개체 6건 · 관계 15홉 (여신업무규정 제12조, 전결규정 제5조 별표1)',
    ms: 340,
  },
  {
    nodeId: 'n3',
    input: '500,000,000 ≥ 500,000,000',
    output: 'true',
    ms: 3,
    branch: '참',
  },
  {
    nodeId: 'n4',
    input: '근거 조항 2건 + 고객 재무 개체 6건',
    output: '조건부 가능 — 신용공여 1.58억이 제12조 한도(2억) 이내',
    ms: 1840,
    tokens: { in: 3120, out: 486 },
  },
  {
    nodeId: 'n6',
    input: '여신 총액 17억 · 신용공여 포함',
    output: '전결권자: 여신본부장',
    ms: 96,
  },
  {
    nodeId: 'n7',
    input: '판정 + 근거 2건 + 전결권자',
    output: '응답 반환 · 생성형 AI 고지 부착',
    ms: 8,
  },
];

export const TRACE_TOTAL = {
  ms: TRACE.reduce((a, s) => a + s.ms, 0),
  tokensIn: TRACE.reduce((a, s) => a + (s.tokens?.in ?? 0), 0),
  tokensOut: TRACE.reduce((a, s) => a + (s.tokens?.out ?? 0), 0),
  skipped: SEED_NODES.filter((n) => !TRACE.some((t) => t.nodeId === n.id)).map((n) => n.title),
};
