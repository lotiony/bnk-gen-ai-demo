/**
 * 외환업무 대화 스크립트 — 외환 시나리오 화면 02 ~ 06 · 10 을 대화 화면에서 푼다.
 *
 * RFP: AGB-006 ⑨ 외환업무 어시스턴트 · 2-1 대화중 파일 업로드 · LSM-012 사용자 피드백
 *
 * 고객 상담(`mockConsultChat`)과 **같은 기계**를 쓴다 — 대화 파이프라인
 * (사용자 버블 → 실행 단계 → 답변 카드)은 그대로 두고 카드만 갈아 끼운다.
 * 두 시나리오가 서로 다른 대화 엔진을 갖게 되면 시연 중 한쪽만 고쳐지는
 * 사고가 난다.
 *
 * 직원의 입력은 두 번뿐이다(고객 질문 접수 · 검토 요청). 나머지 전이는 카드
 * 안의 버튼이 일으킨다 — 시연에서 타이핑이 많을수록 흐름이 끊긴다.
 *
 * ⚠️ 전부 가상 데이터다(CLAUDE.md 절대 규칙).
 */
import { FX_AGENT_ID } from './mockFxAssist';

export { FX_AGENT_ID };

/** 답변 카드 종류 — 외환 시나리오 화면과 1:1. */
export type FxCardKind =
  /** 02 고객 질문 접수 */
  | 'intake'
  /** 03 서류 검토 요청 */
  | 'upload'
  /** 04 검토 결과 */
  | 'result'
  /** 05 근거 확인 */
  | 'evidence'
  /** 06 업무 마무리 */
  | 'wrapup'
  /** 10 개선판 사용 — 경남은행 직원의 한 번에 보기 */
  | 'improved';

export type FxStage = 'idle' | FxCardKind;

/**
 * 단계 순서.
 *
 * `improved` 를 끝에 두는 이유 — 개선판은 부산은행 6단계를 **대체**하는
 * 한 장짜리 응답이라 중간에 끼지 않는다. 접힘 판정(`stageIndex` 비교)에서만
 * 쓰이므로 순서상 마지막이면 충분하다.
 */
export const FX_STAGE_ORDER: FxStage[] = [
  'idle',
  'intake',
  'upload',
  'result',
  'evidence',
  'wrapup',
  'improved',
];

export function fxStageIndex(s: FxStage): number {
  return FX_STAGE_ORDER.indexOf(s);
}

type Step = { kind: string; label: string; ms: number };

/** 첫 턴 — 고객 문의를 받아 확인 포인트로 분해한다. */
export const FX_STEPS_INTAKE: Step[] = [
  { kind: 'plan', label: '질의 해석 · 외환 업무 유형 판별', ms: 460 },
  { kind: 'fxsplit', label: '확인 포인트 분해 · 필요 서류 식별', ms: 540 },
];

/**
 * 검토 요청 — 반입 검사가 **먼저** 돌고 그 다음에 읽는다.
 *
 * 순서를 뒤집으면 "검사 없이 먼저 읽었다" 는 그림이 되어 SEC-004·SEC-008
 * 설명과 어긋난다. `ATTACH_STEPS` 와 같은 순서를 지킨다.
 */
export const FX_STEPS_REVIEW: Step[] = [
  { kind: 'scan', label: '첨부 반입 검사 · DRM 권원 확인 (4건)', ms: 560 },
  { kind: 'parse', label: '서류 파싱 · 조항 추출', ms: 600 },
  { kind: 'fxdiff', label: '원 조건 ↔ 변경 조건 대조', ms: 680 },
  { kind: 'fxmatch', label: '품목별 요구서류 대응 확인', ms: 620 },
];

/** 근거 확인 — 원문 위치를 되짚는다. */
export const FX_STEPS_EVIDENCE: Step[] = [
  { kind: 'doc', label: '변경 전문 원문 조회 · 인용 위치 확정', ms: 560 },
];

/** 마무리 — 보완 서류 확인 후 고객 안내 초안. */
export const FX_STEPS_WRAPUP: Step[] = [
  { kind: 'scan', label: '보완 검사서 반입 검사', ms: 480 },
  { kind: 'fxmatch', label: '요구서류 충족 재확인', ms: 520 },
  { kind: 'summarize', label: '고객 안내 초안 작성', ms: 560 },
];

/** 개선판 — 한 번에 세 항목을 낸다. 단계도 그만큼 짧다. */
export const FX_STEPS_IMPROVED: Step[] = [
  { kind: 'scan', label: '첨부 반입 검사 · 서류 파싱', ms: 520 },
  { kind: 'fxdiff', label: '원 조건 ↔ 변경 조건 대조', ms: 620 },
  { kind: 'summarize', label: '결론 · 필요 서류 · 고객 안내 통합 생성', ms: 600 },
];

/** 답변 버블에 붙는 AI 문장 — 카드 위에 한 줄로 나온다. */
export const FX_TEXT: Record<FxCardKind, string> = {
  intake:
    '외환 서류 검토 문의로 확인했습니다. 이 건은 처음 조건·바뀐 조건·지금 받은 서류 세 가지를 함께 봐야 합니다 — 해당 서류를 올려 주세요.',
  upload:
    '올려 주신 서류 4건의 반입 검사를 마쳤습니다. 각각을 따로 요약하지 않고 서류 사이의 차이를 확인하겠습니다.',
  result:
    '변경 전문이 바꾼 것은 검사서 발급기관 조건이고, 그 적용 범위가 품목별로 다릅니다. 최종 판단은 담당자 확인이 필요합니다.',
  evidence:
    '판정 근거를 원문에서 그대로 짚었습니다. 추가로 물어보신 부분도 같은 서류의 문장으로 답합니다.',
  wrapup:
    '보완 검사서까지 확인했습니다. 고객에게 안내할 초안을 만들었습니다 — 발송 전 담당자 확인이 필요합니다.',
  improved:
    '서류 4건을 대조했습니다. 결론과 필요 서류, 고객 안내를 한 번에 정리했습니다 — 최종 판단은 담당자 확인이 필요합니다.',
};

/**
 * 단계별 추천 질의 알약 — 직원이 다음에 할 말.
 * 카드 버튼이 전이를 맡는 단계는 비운다(버튼과 알약이 같은 일을 하면 시연이 헷갈린다).
 */
export function fxSuggestions(stage: FxStage, improved: boolean): string[] {
  if (stage === 'idle') {
    return improved
      ? ['신용장 조건 변경 건 · 받은 서류로 거래 가능한지 확인해줘']
      : ['신용장 조건이 변경되었는데, 이 서류로 거래 되나요?', '외환 서류 검토를 시작할게요'];
  }
  return [];
}

export interface FxTurn {
  next: FxStage;
  steps: Step[];
  card: FxCardKind;
  text: string;
}

/**
 * 직원의 입력을 현재 단계에서 해석한다.
 *
 * 첫 턴은 무엇을 치든 문의 접수로 받는다 — 시연에서 알약 대신 자유롭게
 * 타이핑해도 흐름이 끊기지 않게 하기 위해서다(고객 상담과 같은 규칙).
 *
 * `improved` 는 **개선판을 쓰는 계열사인가**다. 경남은행은 부산은행이 개선하고
 * 관리자가 승인한 형식을 그대로 받으므로, 6단계를 거치지 않고 한 장으로 끝난다.
 * 개선이 무엇을 바꿨는지는 이 단계 수 차이로 드러난다.
 */
export function matchFxTurn(stage: FxStage, _input: string, improved: boolean): FxTurn | null {
  if (stage === 'idle') {
    return improved
      ? { next: 'improved', steps: FX_STEPS_IMPROVED, card: 'improved', text: FX_TEXT.improved }
      : { next: 'intake', steps: FX_STEPS_INTAKE, card: 'intake', text: FX_TEXT.intake };
  }
  return null;
}
