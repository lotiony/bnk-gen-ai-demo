/**
 * 에이전트 실행 Trace mock — RFP: AGB-009 (필수).
 *
 * "에이전트가 작동하는 과정에서의 단계별 실행 로그, 입력값, 출력값, 중간 추론
 *  과정(Chain of Thought 등)을 표시, 기록하고 관리자가 추적할 수 있는 기능"
 *
 * 외부 Langfuse 링크만으로는 "표시·기록·추적 기능 제공"이 화면에서 증명되지
 * 않는다 — 포탈 안에 내장 Trace 뷰를 둔다. 대상은 AGT-204(PB 자산진단)의
 * 실제 운영 호출 1건이며, 도구 호출(knowledge.search)은 카탈로그의 MCP-021 과
 * 같은 자산이다.
 *
 * 전부 가상 창작물이다(CLAUDE.md 절대 규칙).
 */

export type SpanKind = 'input' | 'guard' | 'retrieve' | 'llm' | 'tool' | 'validate' | 'output';
export type SpanStatus = 'ok' | 'warn' | 'error';

export interface TraceSpan {
  id: string;
  /** 트리 깊이 — 0 이 루트. */
  depth: number;
  kind: SpanKind;
  name: string;
  ms: number;
  status: SpanStatus;
  /** 입력값 미리보기 — PII 는 이미 마스킹된 상태로 기록된다(SEC-008). */
  input?: string;
  /** 출력값 미리보기. */
  output?: string;
  /** 중간 추론(CoT) 요약 — 원문 전체가 아니라 관리자 추적용 요약. */
  thought?: string;
  note?: string;
}

export const SPAN_KIND_META: Record<SpanKind, { label: string; cls: string }> = {
  input:    { label: '입력',      cls: 'bg-surface text-ink-mid border-line-soft' },
  guard:    { label: '가드레일',  cls: 'bg-bad-bg text-bad border-bad-border' },
  retrieve: { label: '검색',      cls: 'bg-info-bg text-info border-info-border' },
  llm:      { label: 'LLM',      cls: 'bg-brand-tint text-brand border-brand-tint' },
  tool:     { label: '도구',      cls: 'bg-accent-purple-bg text-accent-purple border-accent-purple-border' },
  validate: { label: '검증',      cls: 'bg-warn-bg text-warn border-warn-border' },
  output:   { label: '출력',      cls: 'bg-ok-bg text-ok border-ok-border' },
};

export interface TraceRun {
  id: string;
  at: string;
  /** 마스킹된 호출 사용자 — LSM-013 과 같은 규칙. */
  maskedUser: string;
  agentId: string;
  model: string;
  totalMs: number;
  tokensIn: number;
  tokensOut: number;
  verdict: '정상 완료' | '부분 실패' | '차단';
  spans: TraceSpan[];
}

export const TRACE_RUNS: TraceRun[] = [
  {
    id: 'RUN-20260603-0412',
    at: '2026-06-03 09:41:02',
    maskedUser: 'u-***41f2',
    agentId: 'AGT-204',
    model: 'onprem/qwen3-32b',
    totalMs: 2140,
    tokensIn: 1820,
    tokensOut: 460,
    verdict: '정상 완료',
    spans: [
      {
        id: 's1', depth: 0, kind: 'input', name: '입력 수신', ms: 12, status: 'ok',
        input: '고객 보유 자산 진단 요청 — 예수금 ***, 펀드 2건, ELS 1건 (금액 마스킹)',
      },
      {
        id: 's2', depth: 1, kind: 'guard', name: 'PII 스캔 · 입력 가드레일', ms: 46, status: 'ok',
        output: '계좌번호 1건 마스킹 처리 후 통과', note: 'SEC-002 · 마스킹 후 파이프라인 진입',
      },
      {
        id: 's3', depth: 1, kind: 'retrieve', name: 'knowledge.search (MCP-021)', ms: 320, status: 'ok',
        input: 'query: "위험성향 중립 포트폴리오 리밸런싱"',
        output: 'PB_상담_지식인덱스 v4 · 청크 6건 반환 (top score 0.87)',
      },
      {
        id: 's4', depth: 1, kind: 'llm', name: '진단 초안 생성', ms: 1380, status: 'ok',
        thought: '① 자산군 비중 산출 → ② 위험성향(중립) 대비 주식형 초과 판단 → ③ 리밸런싱 2안 작성 — 근거 청크 3·5 인용',
        output: '위험도 68 · 분산도 54 · 유동성 71 + 개선안 JSON',
      },
      {
        id: 's5', depth: 2, kind: 'tool', name: 'authority.lookup (MCP-011)', ms: 140, status: 'ok',
        input: 'amount: 상담 한도 확인', output: '상담사 안내 가능 범위 — 투자권유 불가, 초안 제공 가능',
        note: '도구 호출은 사용자 허용범위 안에서만 — 실행 통제(2-1)',
      },
      {
        id: 's6', depth: 1, kind: 'validate', name: '출력 검증 · 금칙 표현', ms: 88, status: 'warn',
        output: '"수익 보장" 유사 표현 1건 → 중립 표현으로 자동 교정', note: '교정 이력 기록',
      },
      {
        id: 's7', depth: 0, kind: 'output', name: '응답 반환', ms: 24, status: 'ok',
        output: '진단 JSON + 상담 초안 — 근거 문서 링크 2건 첨부',
      },
    ],
  },
  {
    id: 'RUN-20260602-1187',
    at: '2026-06-02 16:38:52',
    maskedUser: 'u-***9c07',
    agentId: 'AGT-204',
    model: 'onprem/qwen3-32b',
    totalMs: 310,
    tokensIn: 240,
    tokensOut: 0,
    verdict: '차단',
    spans: [
      {
        id: 's1', depth: 0, kind: 'input', name: '입력 수신', ms: 10, status: 'ok',
        input: '고객 주민등록번호 포함 질의 (원문 저장 안 함)',
      },
      {
        id: 's2', depth: 1, kind: 'guard', name: 'PII 스캔 · 입력 가드레일', ms: 52, status: 'error',
        output: '주민등록번호 패턴 검출 — 파이프라인 진입 전 차단',
        note: 'SEC-003 · 차단 이력은 통합 감사 원장에 적산',
      },
    ],
  },
];
