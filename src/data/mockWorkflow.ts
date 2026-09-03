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
    /*
     * 여신 사전심사 담당은 카탈로그의 **AGT-512 비대면 여신 사전심사 보조**다.
     * AGT-204 는 'PB 자산진단 어시스턴트'(부산은행·박서연)이며 업무 축이 다르다 —
     * 시연 정거장 6(마켓플레이스)에서 AGT-204 카드를 본 직후 정거장 7에서 이
     * 노드를 열면 같은 ID 가 다른 이름을 달고 있는 게 바로 드러난다.
     */
    id: 'n4', kind: 'agent', title: '비대면 여신 사전심사 보조', x: 610, y: 112,
    config: [
      { k: '에이전트', v: 'AGT-512 비대면 여신 사전심사 보조' },
      { k: '배포 상태', v: 'Approved (운영계)' },
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

export type StepStatus = 'ok' | 'fail' | 'compensated';

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
  /**
   * 스텝 결과. 생략하면 'ok'.
   * 'fail'        — 여기서 런타임 에러가 났다
   * 'compensated' — 실패 이후 되돌려진 스텝(Saga 보상 트랜잭션)
   */
  status?: StepStatus;
  /** 보상 트랜잭션으로 실제 수행된 되돌리기 동작. */
  compensation?: string;
  /** 이 스텝 직후 체크포인트가 저장됐다면 그 식별자. */
  checkpoint?: string;
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

/* ═══════════════════════ 보상 트랜잭션 정의 (AGB-008) ═══════════════════════ */

/**
 * RFP AGB-008 후단:
 *   "에이전트 다단계 업무 처리 중 일부 단계 실패 시 이전에 완료된 거래를 원상
 *    복구하는 **Saga 패턴 기반 보상 트랜잭션(Compensating Transaction)** 제어 기능 탑재"
 *
 * 그래서 **부수효과가 있는 노드**에는 되돌리기 동작을 함께 정의한다.
 * 조회 노드(지식 검색·조건 분기)는 되돌릴 것이 없으므로 보상 대상이 아니다 —
 * 전부를 보상 대상으로 그리면 오히려 설계를 이해 못한 것으로 보인다.
 */
export interface CompensationDef {
  nodeId: string;
  /** 되돌릴 것이 있는가. */
  compensable: boolean;
  /** 되돌리기 동작(역연산). */
  action: string;
  /** 왜 이 동작이 역연산인지. */
  note: string;
}

export const COMPENSATIONS: CompensationDef[] = [
  {
    nodeId: 'n1',
    compensable: true,
    action: '접수 건 상태를 「접수취소」로 갱신',
    note: '상담 접수번호가 이미 채번됐으므로 삭제 대신 취소 상태로 남긴다(감사 추적 보존)',
  },
  { nodeId: 'n2', compensable: false, action: '—', note: '조회 전용 · 부수효과 없음' },
  { nodeId: 'n3', compensable: false, action: '—', note: '분기 판정 · 부수효과 없음' },
  {
    nodeId: 'n4',
    compensable: true,
    action: '심사 임시결과 폐기 + 여신 가심사 락 해제',
    note: '에이전트가 잡은 심사 락을 풀지 않으면 후속 상담이 대기 상태로 묶인다',
  },
  { nodeId: 'n5', compensable: false, action: '—', note: '생성 결과만 반환 · 부수효과 없음' },
  {
    nodeId: 'n6',
    compensable: true,
    action: '전결권 조회 이력에 「무효」 플래그 기록',
    note: '외부 시스템 호출은 취소가 불가하므로 무효 표기로 상쇄한다',
  },
  { nodeId: 'n7', compensable: false, action: '—', note: '미실행 · 되돌릴 것 없음' },
];

export const COMPENSATION_BY_NODE: Record<string, CompensationDef> = COMPENSATIONS.reduce(
  (a, c) => ({ ...a, [c.nodeId]: c }),
  {} as Record<string, CompensationDef>,
);

/**
 * 실패 → 보상 재생 스크립트.
 * MCP 호출(n6)에서 외부 시스템 타임아웃이 나고, **역순으로** n4 → n1 이 되돌려진다.
 * 역순인 것이 중요하다 — 락 해제보다 접수 취소가 먼저 일어나면 락이 남는다.
 */
export const TRACE_FAIL: TraceStep[] = [
  { ...TRACE[0], status: 'ok', checkpoint: 'ckpt-1 · 접수 확정' },
  { ...TRACE[1], status: 'ok' },
  { ...TRACE[2], status: 'ok' },
  { ...TRACE[3], status: 'ok', checkpoint: 'ckpt-2 · 심사 보조 완료' },
  {
    nodeId: 'n6',
    input: '여신 총액 17억 · 신용공여 포함',
    output: '❌ 전결규정 API 응답 없음 — 30s 타임아웃 (재시도 3회 모두 실패)',
    ms: 30_000,
    status: 'fail',
  },
  {
    nodeId: 'n4',
    input: '보상 트랜잭션 · 역순 1/2',
    output: '심사 임시결과 폐기 · 여신 가심사 락 해제 완료',
    ms: 240,
    status: 'compensated',
    compensation: '심사 임시결과 폐기 + 여신 가심사 락 해제',
  },
  {
    nodeId: 'n1',
    input: '보상 트랜잭션 · 역순 2/2',
    output: '접수 건 REQ-88421 상태를 「접수취소」로 갱신 완료',
    ms: 88,
    status: 'compensated',
    compensation: '접수 건 상태를 「접수취소」로 갱신',
  },
];

export const TRACE_FAIL_TOTAL = {
  ms: TRACE_FAIL.reduce((a, s) => a + s.ms, 0),
  failedAt: 'n6',
  compensated: TRACE_FAIL.filter((s) => s.status === 'compensated').length,
};

/* ═══════════════════════ 체크포인트 · 장기 실행 (AGB-002) ═══════════════════════ */

/**
 * RFP AGB-002 후단:
 *   "**수시간~수일에 걸친 장기 실행(Long-running) 워크플로우**에 대한
 *    **체크포인트 기반 장애 복구** 기능 제공"
 *
 * 여신 상담은 서류 보완·심사역 검토 때문에 실제로 수일이 걸린다. 그래서
 * 실행 상태를 노드 경계마다 체크포인트로 남기고, 장애가 나면 **처음이 아니라
 * 마지막 체크포인트에서 재개**한다.
 */
export interface CheckpointDef {
  id: string;
  /** 어느 노드 완료 직후 저장되는가. */
  afterNodeId: string;
  label: string;
  /** 저장되는 상태값. */
  state: string;
  /** 보존 기간 — 장기 실행이므로 실행 컨텍스트를 오래 들고 있어야 한다. */
  ttl: string;
}

export const CHECKPOINTS: CheckpointDef[] = [
  {
    id: 'ckpt-1',
    afterNodeId: 'n1',
    label: '접수 확정',
    state: '입력 3필드 · 접수번호 REQ-88421',
    ttl: '30일',
  },
  {
    id: 'ckpt-2',
    afterNodeId: 'n4',
    label: '심사 보조 완료',
    state: '심사 판정 초안 · 근거 조항 2건 · 가심사 락 ID',
    ttl: '30일',
  },
  {
    id: 'ckpt-3',
    afterNodeId: 'n6',
    label: '전결권 확정',
    state: '전결권자 · 조회 이력 ID',
    ttl: '30일',
  },
];

/** 장기 실행 인스턴스 — 재개 대기 중인 실행들. */
export interface LongRun {
  runId: string;
  startedAt: string;
  /** 마지막으로 저장된 체크포인트. */
  lastCheckpoint: string;
  /** 왜 멈춰 있나. */
  waitingOn: string;
  elapsed: string;
  state: '대기 중' | '장애 · 재개 가능' | '재개됨';
}

export const LONG_RUNS: LongRun[] = [
  {
    runId: 'RUN-7712',
    startedAt: '2026-05-26 09:41',
    lastCheckpoint: 'ckpt-1 · 접수 확정',
    waitingOn: '고객 서류 보완 대기 (소득증빙 미제출)',
    elapsed: '2일 6시간',
    state: '대기 중',
  },
  {
    runId: 'RUN-7698',
    startedAt: '2026-05-25 14:02',
    lastCheckpoint: 'ckpt-2 · 심사 보조 완료',
    waitingOn: '전결규정 API 장애로 중단 — 복구 후 ckpt-2 에서 재개',
    elapsed: '3일 2시간',
    state: '장애 · 재개 가능',
  },
  {
    runId: 'RUN-7655',
    startedAt: '2026-05-23 10:15',
    lastCheckpoint: 'ckpt-3 · 전결권 확정',
    waitingOn: '심사역 최종 검토 대기',
    elapsed: '5일 8시간',
    state: '대기 중',
  },
];

/* ═══════════════════════ 자연어 → 워크플로우 생성 (AGB-003) ═══════════════════════ */

/**
 * RFP AGB-003 자연어 기반 워크플로우 생성 (권고)
 *   "프롬프트 창에 자연어로 수행할 업무 프로세스를 입력하면, 플랫폼이 이를 해석하여
 *    **워크플로우 가이드 파이프라인을 자동 생성**해 주는 기능"
 *
 * 문장을 넣으면 노드가 툭 튀어나오는 것처럼 보이면 오히려 신뢰가 떨어진다.
 * **무엇을 어떻게 해석했는지**를 함께 보여 줘야 현업이 검토하고 고칠 수 있다.
 * 그래서 해석 결과(의도·단계·분기·필요한 연계)를 먼저 펼치고 노드를 배치한다.
 */
export interface NlParseLine {
  /** 원문에서 뽑아낸 조각. */
  phrase: string;
  /** 무엇으로 해석했는가. */
  as: string;
  /** 어느 노드가 되는가. */
  nodeKind: NodeKind;
}

export interface NlGeneration {
  /** 예시 입력 문장. */
  prompt: string;
  /** 해석 결과. */
  parsed: NlParseLine[];
  /** 자동 생성 후 사람이 확인해야 하는 것. */
  todo: string[];
}

export const NL_GENERATION: NlGeneration = {
  prompt:
    '여신 상담이 접수되면 관련 규정을 찾아보고, 신청금액이 5억 이상이면 심사 보조 에이전트를 태우고 아니면 간단히 요약만 해서, 전결권을 조회한 뒤 결과를 돌려줘.',
  parsed: [
    { phrase: '여신 상담이 접수되면', as: '시작 트리거 · 입력 3필드', nodeKind: 'input' },
    { phrase: '관련 규정을 찾아보고', as: '지식 검색 (여신 온톨로지)', nodeKind: 'knowledge' },
    { phrase: '신청금액이 5억 이상이면 … 아니면', as: '조건 분기 · 임계값 500,000,000', nodeKind: 'condition' },
    { phrase: '심사 보조 에이전트를 태우고', as: '등록된 에이전트 호출', nodeKind: 'agent' },
    { phrase: '간단히 요약만 해서', as: 'LLM 직접 호출', nodeKind: 'llm' },
    { phrase: '전결권을 조회한 뒤', as: 'MCP Tool · authority.lookup', nodeKind: 'mcp' },
    { phrase: '결과를 돌려줘', as: '출력 폼 · 생성형 AI 고지 포함', nodeKind: 'output' },
  ],
  todo: [
    '임계값 5억을 규정 개정에 맞춰 확인할 것 — 문장에서 그대로 읽었다',
    '에이전트는 AGT-512(비대면 여신 사전심사 보조)로 임의 지정했다. 다른 에이전트라면 속성에서 교체할 것',
    '부수효과가 있는 노드의 보상 트랜잭션은 자동 생성되지 않는다 — 직접 정의해야 한다',
  ],
};

/* ═══════════════════ 템플릿 골격 그래프 (2-1 템플릿화) ═══════════════════ */

/**
 * 「승인 기반 심사 워크플로우 템플릿」(TPL-02)이 복제해 오는 골격.
 *
 * 시드 그래프(SEED_NODES)를 그대로 주면 "템플릿에서 시작" 이 아니라 그냥
 * 같은 화면이 다시 뜬 것으로 보인다. 템플릿은 **뼈대만** 준다 —
 *   접수 → 규정 검색 → 조건 분기 → (참) 심사 · (거짓) 바로 전결 → 전결권 조회
 * 5단계이고, 설정값 일부는 일부러 `미지정` 으로 남겨 복제한 팀이 채우게 한다.
 * 템플릿 카드의 설명 문구("5단계 골격")와 화면이 어긋나면 안 되므로 노드 수를
 * 여기서 맞춰 둔다.
 *
 * 좌표는 SEED 와 같은 198px 피치. 폭은 986px 로 시드(1184px)보다 좁아
 * 좁은 셸에서도 축소 없이 들어온다.
 */
export const TPL_APPROVAL_NODES: WfNode[] = [
  {
    id: 'n1', kind: 'input', title: '심사 요청 접수', x: 16, y: 205,
    config: [
      { k: '입력 필드', v: '요청번호 · 신청금액 · 구분' },
      { k: '필수 검증', v: '미지정' },
    ],
  },
  {
    id: 'n2', kind: 'knowledge', title: '관련 규정 검색', x: 214, y: 205,
    config: [
      { k: '인덱스', v: '미지정 — 복제 후 지정' },
      { k: '검색 방식', v: 'Graph RAG (관계 순회)' },
      { k: 'Top-K', v: '5' },
    ],
  },
  {
    id: 'n3', kind: 'condition', title: '심사 조건 분기', x: 412, y: 205,
    config: [
      { k: '좌변', v: '{{입력.신청금액}}' },
      { k: '연산자', v: '≥' },
      { k: '임계값', v: '미지정 — 규정에 맞춰 설정' },
    ],
  },
  {
    id: 'n4', kind: 'agent', title: '심사 보조 에이전트', x: 610, y: 112,
    config: [
      { k: '에이전트', v: '미지정 — 등록된 것 중 선택' },
      { k: '타임아웃', v: '20s' },
    ],
  },
  {
    id: 'n5', kind: 'mcp', title: '전결권 조회 (MCP)', x: 808, y: 205,
    config: [
      { k: 'Tool', v: 'authority.lookup' },
      { k: '보상 트랜잭션', v: '미정의 — 부수효과가 있으면 정의할 것' },
    ],
  },
];

export const TPL_APPROVAL_EDGES: WfEdge[] = [
  { id: 'e1', from: 'n1', port: 0, to: 'n2' },
  { id: 'e2', from: 'n2', port: 0, to: 'n3' },
  { id: 'e3', from: 'n3', port: 0, to: 'n4' },
  { id: 'e4', from: 'n3', port: 1, to: 'n5' },
  { id: 'e5', from: 'n4', port: 0, to: 'n5' },
];
