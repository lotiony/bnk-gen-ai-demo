/**
 * 고객 상담 대화 스크립트 — 시나리오 1 (1-3 ~ 1-8) 을 대화 화면에서 푼다.
 *
 * RFP: AGB-006 ⑤ 고객/민원 분석 및 마케팅 · SEC-007 동의 권원 · EDA-001 가상 뷰 · ONM-004 감사
 *
 * 대화 화면의 파이프라인(사용자 버블 → 실행 단계 → 답변)은 그대로 쓰고, 답변에
 * **카드** 하나를 얹는다. 행원의 입력은 세 번(고객 소개 · 추천 요청 · 요약 요청)이고
 * 나머지 전이는 카드 안의 버튼이 일으킨다. 단계마다 무엇을 묻고 무엇을 돌려줄지가
 * 여기 한 곳에 있다 — 시연 직전 문구 수정은 이 파일과 mockCustomerConsult.ts 만 본다.
 *
 * ⚠️ 전부 가상 데이터다(CLAUDE.md 절대 규칙).
 */
import { LOOKUP_STEPS } from './mockCustomerConsult';

export const CONSULT_AGENT_ID = 'GRP-005';

/** 답변 카드 종류 — 시나리오 장면과 1:1. */
export type ConsultCardKind = 'profile' | 'consent' | 'analysis' | 'products' | 'summary';

/**
 * 대화 진행 단계. 카드가 커밋되면 그 카드의 단계로 넘어간다.
 *   idle → profile(1-3) → consent(1-4) → analysis(1-5·1-6) → products(1-7) → summary(1-8)
 */
export type ConsultStage = 'idle' | ConsultCardKind;

export const STAGE_ORDER: ConsultStage[] = ['idle', 'profile', 'consent', 'analysis', 'products', 'summary'];

export function stageIndex(s: ConsultStage): number {
  return STAGE_ORDER.indexOf(s);
}

type Step = { kind: string; label: string; ms: number };

/** 첫 턴 — 고객 소개를 받아 프로필 카드를 낸다. */
export const CONSULT_STEPS_INTRO: Step[] = [
  { kind: 'plan', label: '질의 해석 · 상담 유형 판별', ms: 480 },
  { kind: 'identify', label: '고객 식별 · 상담 프로필 준비', ms: 520 },
];

/** 동의 확인 뒤 — 부산은행 가상 뷰 조회. mockCustomerConsult 의 항목을 그대로 단계로 쓴다. */
export const CONSULT_STEPS_LOOKUP: Step[] = LOOKUP_STEPS.map((s) => ({
  kind: s.id,
  label: `${s.label.split(' — ')[0]} 조회 · ${s.source}`,
  ms: s.ms,
}));

/** 상품 추천 — 상품 인덱스 조회와 적합도 계산. */
export const CONSULT_STEPS_RECO: Step[] = [
  { kind: 'index', label: '상품 인덱스 조회 · 유사 프로필 통계', ms: 560 },
  { kind: 'fit', label: '성향 적합도 · 예상 이자 계산', ms: 520 },
];

/** 상담 요약. */
export const CONSULT_STEPS_SUMMARY: Step[] = [
  { kind: 'summarize', label: '상담 내용 요약 · 후속 조치 판별', ms: 620 },
];

/** 답변 버블에 붙는 AI 문장 — 카드 위에 한 줄로 나온다. */
export const CONSULT_TEXT: Record<ConsultCardKind, string> = {
  profile:
    '상담 대상 고객을 확인했습니다. 기본 정보는 고객 DB 가상 뷰에서 조회해 채웁니다 — 계열사 거래 여부만 체크하고 프로필을 생성해 주세요.',
  consent:
    '계열사 간 정보 조회에는 제3자 정보 활용 동의가 필요합니다. 사전 확보된 동의 이력을 조회했습니다 — 확인 후 진행합니다.',
  analysis:
    '부산은행 수신·여신·거래 이력을 조회해 종합 프로필을 생성했습니다. 자산 구성으로 보아 원금 보전을 우선하는 안정형 고객입니다.',
  products:
    '안정형 성향과 6월 만기 재예치 목적에 맞는 상품입니다. 근거는 상품 인덱스의 유사 프로필 통계이고, 예상 이자는 규칙으로 계산했습니다.',
  summary:
    '상담 내용을 요약했습니다. 추천 상품 가입 전에 고객 신용평가 확인이 필요합니다 — 담당 에이전트는 마켓플레이스에서 찾을 수 있습니다.',
};

/** 단계별 추천 질의 알약 — 행원이 다음에 할 말. 카드 버튼이 전이를 맡는 단계는 비운다. */
export function consultSuggestions(stage: ConsultStage): string[] {
  switch (stage) {
    case 'idle':
      return ['김보람 고객 · 6월 만기 정기예금 재예치 상담 요청', 'VIP 고객 자산 관리 상담 시작'];
    case 'analysis':
      return ['이 고객에게 맞는 상품 추천해줘'];
    case 'products':
      return ['상담 내용 요약해줘'];
    default:
      return [];
  }
}

export interface ConsultTurn {
  next: ConsultStage;
  steps: Step[];
  card: ConsultCardKind;
  text: string;
  /** 첫 턴에서 "○○ 고객" 을 잡으면 프로필 카드의 고객명으로 쓴다. */
  name?: string;
}

/**
 * 행원의 입력을 현재 단계에서 해석한다. 못 이으면 null — 그때는 다른 에이전트와
 * 같이 "근거를 잇지 못했다" 로 떨어진다.
 *
 * 첫 턴은 무엇을 치든 고객 소개로 받는다. 시연에서 행원이 알약 대신 자유롭게
 * 타이핑해도 흐름이 끊기지 않게 하기 위해서다.
 */
export function matchConsultTurn(stage: ConsultStage, input: string): ConsultTurn | null {
  const q = input.trim();
  if (stage === 'idle') {
    const m = q.match(/([가-힣]{2,4})\s*고객/);
    return { next: 'profile', steps: CONSULT_STEPS_INTRO, card: 'profile', text: CONSULT_TEXT.profile, name: m?.[1] };
  }
  if (stage === 'analysis' && /추천|상품/.test(q)) {
    return { next: 'products', steps: CONSULT_STEPS_RECO, card: 'products', text: CONSULT_TEXT.products };
  }
  if (stage === 'products' && /요약|정리/.test(q)) {
    return { next: 'summary', steps: CONSULT_STEPS_SUMMARY, card: 'summary', text: CONSULT_TEXT.summary };
  }
  return null;
}
