/**
 * 플레이그라운드 mock — 모델 시험(LSM-005)과 RAG 검증(RAG-009).
 *
 * RFP 원문
 *   LSM-005 모델별 플레이그라운드 (필수)
 *     "등록된 모델별 개별 테스트가 가능한 웹 기반 플레이그라운드 인터페이스 제공"
 *     "시스템 역할(System Prompt), 온도(Temperature), Top-P, 최대 토큰 수 등
 *      하이퍼파라미터를 **실시간 조정하며 텍스트 추론을 시험**할 수 있는 기능"
 *   RAG-009 RAG 전용 플레이그라운드 (권고)
 *     "프롬프트 템플릿 변경, 청크 크기 조절, 검색 가중치(Top-K, Score Threshold) 설정 등에
 *      따른 검색 결과 및 최종 답변 품질을 **비교·테스트**할 수 있는 검증 환경 제공"
 *
 * 실동작 백엔드는 범위 밖이므로(CLAUDE.md) 응답은 **사전 정의 시나리오**다.
 * 자유 입력에는 정직하게 "사전 정의 질의만 준비돼 있다"고 답한다 —
 * 시연 중 없는 기능을 있는 것처럼 보이면 그대로 리스크가 된다(RFP Ⅳ.4.1).
 */

/* ═══════════════════════ 모델 플레이그라운드 ═══════════════════════ */

export interface PlaygroundPreset {
  id: string;
  /** 사용자가 고르는 예시 질의. */
  prompt: string;
  /** 이 질의가 무엇을 보여주는가. */
  purpose: string;
  /** 모델별 응답. key = 모델 name. */
  answers: Record<string, string>;
  /** 응답 메타 — 모델별. */
  meta: Record<string, { ttftMs: number; totalMs: number; tokensIn: number; tokensOut: number }>;
}

export const PLAYGROUND_PRESETS: PlaygroundPreset[] = [
  {
    id: 'pg-1',
    prompt: '여신 기한이익상실 사유를 조항 근거와 함께 3가지로 요약해줘.',
    purpose: '규정 요약 — 근거 인용 습관과 형식 준수를 본다',
    answers: {
      'onprem/gpt-oss-120b':
        '기한이익상실 사유는 다음 3가지로 정리됩니다.\n\n1. **원리금 연체** — 약정 상환일 경과 후 일정 기간 이상 연체가 지속되는 경우\n2. **담보가치 하락** — 담보물 가액이 약정 담보비율 아래로 떨어지고 추가 담보 제공이 이행되지 않은 경우\n3. **신용상태 중대한 악화** — 압류·가압류, 회생·파산 신청 등 채무자의 신용상태가 현저히 나빠진 경우\n\n※ 실제 적용 조항과 유예기간은 여신거래약정서 및 내규를 확인해야 합니다.',
      'google/gemma-4-31B-it-assistant':
        '1. 원리금 연체 발생\n2. 담보가치 하락\n3. 신용상태 악화(압류·회생·파산 등)\n\n세부 기준은 약정서를 따릅니다.',
    },
    meta: {
      'onprem/gpt-oss-120b': { ttftMs: 340, totalMs: 2180, tokensIn: 42, tokensOut: 214 },
      'google/gemma-4-31B-it-assistant': { ttftMs: 190, totalMs: 940, tokensIn: 42, tokensOut: 86 },
    },
  },
  {
    id: 'pg-2',
    prompt: '고객 홍길동(주민번호 900101-1234567)의 대출 잔액을 알려줘.',
    purpose: '가드레일 — 프롬프트 입력 단계의 PII 실시간 탐지·차단을 본다',
    answers: {
      'onprem/gpt-oss-120b':
        '⛔ 입력에 주민등록번호가 포함되어 차단되었습니다.\n\n플레이그라운드는 LLM 게이트웨이를 그대로 통과하므로, 개인식별정보가 포함된 프롬프트는 모델에 도달하기 전에 차단되고 차단 이력이 감사 원장에 남습니다(SEC-002 · SEC-003).\n\n고객 정보 조회가 필요하면 정식 승인된 에이전트를 통해, 동의 권원이 확인된 경로로 요청하십시오(SEC-007).',
      'google/gemma-4-31B-it-assistant':
        '⛔ 입력에 주민등록번호가 포함되어 차단되었습니다.\n\n차단은 모델과 무관하게 게이트웨이에서 일괄 적용됩니다(SEC-002 · SEC-003).',
    },
    meta: {
      'onprem/gpt-oss-120b': { ttftMs: 12, totalMs: 18, tokensIn: 0, tokensOut: 0 },
      'google/gemma-4-31B-it-assistant': { ttftMs: 11, totalMs: 16, tokensIn: 0, tokensOut: 0 },
    },
  },
  {
    id: 'pg-3',
    prompt: '아래 문장을 고객 안내문 톤으로 바꿔줘: "서류 미비로 접수 불가."',
    purpose: '문체 변환 — Temperature 를 올렸을 때의 변화를 관찰한다',
    answers: {
      'onprem/gpt-oss-120b':
        '제출해 주신 서류 중 일부가 확인되지 않아 접수가 어려운 상황입니다. 누락된 서류를 보완해 주시면 곧바로 처리해 드리겠습니다. 필요한 서류 목록은 아래에서 확인하실 수 있습니다.',
      'google/gemma-4-31B-it-assistant':
        '서류가 일부 누락되어 접수가 어렵습니다. 보완해 주시면 바로 진행하겠습니다.',
    },
    meta: {
      'onprem/gpt-oss-120b': { ttftMs: 280, totalMs: 1120, tokensIn: 28, tokensOut: 92 },
      'google/gemma-4-31B-it-assistant': { ttftMs: 160, totalMs: 520, tokensIn: 28, tokensOut: 38 },
    },
  },
];

/** 자유 입력 시 돌려주는 정직한 안내. */
export const FREEFORM_NOTICE =
  '이 시연 환경에는 사전 정의 질의만 준비되어 있습니다. 위 예시 중 하나를 선택하면 실제 하이퍼파라미터 반영 결과를 확인할 수 있습니다.';

/* ═══════════════════════ RAG 플레이그라운드 ═══════════════════════ */

export type RetrieverMode = 'bm25' | 'dense' | 'hybrid' | 'graph';

export const RETRIEVER_LABEL: Record<RetrieverMode, string> = {
  bm25: 'BM25 (키워드)',
  dense: 'Dense (벡터)',
  hybrid: 'Hybrid + Rerank',
  graph: 'Graph RAG (온톨로지)',
};

export interface RetrievedChunk {
  /** 원천 문서명. */
  doc: string;
  /** 조항·페이지 등 위치. */
  locator: string;
  /** 0~1 유사도/스코어. */
  score: number;
  /** 청크 본문 발췌. */
  excerpt: string;
  /** Graph RAG 에서만 채워지는 관계 경로. */
  path?: string;
}

export interface RagScenario {
  id: string;
  question: string;
  /** 리트리버별 결과. */
  results: Record<
    RetrieverMode,
    {
      chunks: RetrievedChunk[];
      answer: string;
      /** 골든셋 대비 정답 근거 포함률 0~100. */
      groundedness: number;
      latencyMs: number;
    }
  >;
}

export const RAG_SCENARIOS: RagScenario[] = [
  {
    id: 'rag-1',
    question: '한도 초과 여신을 취급하려면 누구 전결이고, 최근 개정으로 뭐가 바뀌었나?',
    results: {
      bm25: {
        chunks: [
          {
            doc: '여신업무방법서',
            locator: '제4장 3절',
            score: 0.71,
            excerpt: '한도 초과 취급 시 별도 승인 절차를 따른다. 승인 권한은 전결규정에 의한다.',
          },
          {
            doc: '여신 FAQ 모음',
            locator: 'Q17',
            score: 0.58,
            excerpt: '한도 초과 문의가 많습니다. 담당 심사역에게 문의하십시오.',
          },
        ],
        answer:
          '한도 초과 여신은 별도 승인 절차를 따르며 승인 권한은 전결규정에 의합니다. — 전결 주체와 개정 내용은 검색된 문서에서 확인되지 않습니다.',
        groundedness: 34,
        latencyMs: 210,
      },
      dense: {
        chunks: [
          {
            doc: '여신업무방법서',
            locator: '제4장 3절',
            score: 0.83,
            excerpt: '한도 초과 취급 시 별도 승인 절차를 따른다. 승인 권한은 전결규정에 의한다.',
          },
          {
            doc: '전결규정',
            locator: '별표 2',
            score: 0.79,
            excerpt: '여신 한도 초과 건은 본부장 전결. 다만 일정 금액 이상은 여신위원회 부의.',
          },
        ],
        answer:
          '한도 초과 여신은 본부장 전결이며, 일정 금액 이상은 여신위원회에 부의합니다. — 개정 이력은 확인되지 않습니다.',
        groundedness: 61,
        latencyMs: 340,
      },
      hybrid: {
        chunks: [
          {
            doc: '전결규정',
            locator: '별표 2',
            score: 0.91,
            excerpt: '여신 한도 초과 건은 본부장 전결. 다만 일정 금액 이상은 여신위원회 부의.',
          },
          {
            doc: '여신업무방법서',
            locator: '제4장 3절',
            score: 0.86,
            excerpt: '한도 초과 취급 시 별도 승인 절차를 따른다. 승인 권한은 전결규정에 의한다.',
          },
          {
            doc: '전결규정 개정 대비표',
            locator: '2026-03 개정',
            score: 0.74,
            excerpt: '개정 전: 부점장 전결 → 개정 후: 본부장 전결로 상향.',
          },
        ],
        answer:
          '한도 초과 여신은 **본부장 전결**이며, 일정 금액 이상은 여신위원회에 부의합니다. 2026-03 개정으로 전결권이 부점장에서 본부장으로 상향되었습니다.',
        groundedness: 88,
        latencyMs: 520,
      },
      graph: {
        chunks: [
          {
            doc: '전결규정',
            locator: '별표 2',
            score: 0.93,
            excerpt: '여신 한도 초과 건은 본부장 전결. 다만 일정 금액 이상은 여신위원회 부의.',
            path: '여신업무방법서 —[근거규정]→ 전결규정 —[적용]→ 본부장',
          },
          {
            doc: '전결규정 개정 대비표',
            locator: '2026-03 개정',
            score: 0.9,
            excerpt: '개정 전: 부점장 전결 → 개정 후: 본부장 전결로 상향.',
            path: '전결규정 —[개정]→ 2026-03 개정본 —[대비]→ 개정 전 조항',
          },
          {
            doc: '책무구조도',
            locator: '여신 부문',
            score: 0.81,
            excerpt: '여신 승인 책무는 여신본부장에게 배분되며, 위반 시 책무 위반으로 관리된다.',
            path: '본부장 —[책무보유]→ 여신 승인 책무',
          },
        ],
        answer:
          '한도 초과 여신은 **본부장 전결**입니다(전결규정 별표 2). 2026-03 개정으로 부점장 → 본부장으로 상향되었고, 이 전결권은 책무구조도상 **여신본부장의 여신 승인 책무**와 연결됩니다. 따라서 개정 이후 부점장 전결로 처리된 건은 책무 위반 소지가 있어 소급 점검 대상입니다.',
        groundedness: 96,
        latencyMs: 680,
      },
    },
  },
];
