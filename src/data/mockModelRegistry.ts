/**
 * 모델 레지스트리 mock — 관리 콘솔 「모델 관리」.
 *
 * RFP:
 *   LSM-001 필수 모델 관리 (필수)
 *     "플랫폼 내 기본(필수) LLM 모델의 등록, 추가, 버전 관리, 삭제를 위한 중앙 집중식
 *      관리 기능 제공 / 오픈소스 모델 및 자체 파인튜닝 모델의 용이한 카탈로그화 지원"
 *   LSM-004 API 기반 외부 서빙 (필수)
 *     "본 플랫폼에서 서빙하는 LLM을 그룹 내 계열사(자회사)의 외부 레거시 시스템 및
 *      앱에서 호출할 수 있도록 표준 RESTful API/gRPC 형태의 인터페이스 제공"
 * 연계: LSM-002(다중 LLM) · LSM-008(테넌트 쿼터) · LSM-009(승인 기반 배포) ·
 *       ONM-002(LLM Gateway) · SEC-001(테넌트 격리)
 *
 * ⚠️ **모델 목록의 단일 출처는 `mockLlmGateway.MODEL_POOL` 이다.**
 *    여기서 다시 선언하지 않고 그 배열을 확장한다. 화면마다 모델 mock 을 따로 만들면
 *    같은 모델이 화면마다 다른 이름·상태로 나오는 사고가 난다(이 저장소에서 반복된 유형).
 *    레지스트리에만 필요한 축(버전 이력·라이선스·공개범위)만 `REGISTRY_EXTRA` 로 덧댄다.
 *
 * 전부 가상 창작물이다(CLAUDE.md 절대 규칙).
 */
import { MODEL_POOL, EXTERNAL_SLOT, type ModelPoolEntry } from './mockLlmGateway';
import type { Tenant } from './tenants';

/* ═══════════════════════ ① 모델 레지스트리 ═══════════════════════ */

export type ModelOrigin = '오픈소스' | '자체 파인튜닝' | '상용';

/** 카탈로그 공개범위 — RFP 2-1 의 5단계 축을 모델에도 그대로 쓴다. */
export type ModelScope = '그룹 전체' | '해당 계열사' | '본부' | '비공개';

export type ModelState = '서빙 중' | '검증 트래픽' | '대기' | '중지' | '폐기';

export interface ModelVersion {
  v: string;
  at: string;
  note: string;
  /** 현재 서빙 중인 버전인지. */
  current?: boolean;
}

export interface RegistryModel extends ModelPoolEntry {
  /** Chat 모델 선택기(`mockChat.CHAT_MODELS`)와 같은 식별자를 쓴다. */
  id: string;
  origin: ModelOrigin;
  /** 파인튜닝 모델의 기반 모델. */
  baseModel?: string;
  license: string;
  params: string;
  contextLen: string;
  quantization: string;
  gpu: string;
  owner: Tenant;
  scope: ModelScope;
  registeredAt: string;
  state: ModelState;
  versions: ModelVersion[];
}

/** MODEL_POOL 에 없는, 레지스트리에만 필요한 축. 키는 모델명(MODEL_POOL.name). */
const REGISTRY_EXTRA: Record<
  string,
  Omit<RegistryModel, keyof ModelPoolEntry | 'state'> & { state: ModelState }
> = {
  'onprem/gpt-oss-120b': {
    id: 'mdl-001',
    origin: '오픈소스',
    license: 'Apache-2.0',
    params: '120B',
    contextLen: '128K',
    quantization: 'BF16',
    gpu: 'A100 80GB × 8',
    owner: '그룹 공통',
    scope: '그룹 전체',
    registeredAt: '2026-02-11',
    state: '서빙 중',
    versions: [
      { v: 'v1.2', at: '2026-05-20', note: '토크나이저 패치 · 한국어 금융용어 오분절 수정', current: true },
      { v: 'v1.1', at: '2026-03-30', note: '컨텍스트 64K → 128K 확장' },
      { v: 'v1.0', at: '2026-02-11', note: '최초 등록 · 반입 검사 통과' },
    ],
  },
  'onprem/llama-3.3-70b': {
    id: 'mdl-004',
    origin: '오픈소스',
    license: 'Llama 3.3 Community',
    params: '70B',
    contextLen: '128K',
    quantization: 'BF16',
    gpu: 'A100 80GB × 4',
    owner: '그룹 공통',
    scope: '그룹 전체',
    registeredAt: '2026-02-25',
    state: '서빙 중',
    versions: [
      { v: 'v1.1', at: '2026-04-18', note: '도구 호출 포맷 안정화', current: true },
      { v: 'v1.0', at: '2026-02-25', note: '최초 등록' },
    ],
  },
  'onprem/qwen3-32b': {
    id: 'mdl-003',
    origin: '오픈소스',
    license: 'Apache-2.0',
    params: '32B',
    contextLen: '32K',
    quantization: 'INT8',
    gpu: 'A100 80GB × 2',
    owner: '그룹 공통',
    scope: '그룹 전체',
    registeredAt: '2026-03-04',
    state: '서빙 중',
    versions: [{ v: 'v1.0', at: '2026-03-04', note: '최초 등록 · 저지연 경로 전용', current: true }],
  },
  'google/gemma-4-31B-it-assistant': {
    id: 'mdl-005',
    origin: '오픈소스',
    license: 'Gemma Terms of Use',
    params: '31B',
    contextLen: '32K',
    quantization: 'INT8',
    gpu: 'A100 80GB × 4',
    owner: '그룹 공통',
    scope: '그룹 전체',
    registeredAt: '2026-03-18',
    state: '대기',
    versions: [{ v: 'v1.0', at: '2026-03-18', note: 'Fallback 경로 전용 등록', current: true }],
  },
};

/**
 * 자체 파인튜닝 모델 — LSM-001 이 "오픈소스 모델 **및 자체 파인튜닝 모델**의 용이한
 * 카탈로그화"를 함께 적었으므로 레지스트리에 두 계열이 다 있어야 요건을 채운다.
 *
 * 계열사 소유이고 공개범위가 「해당 계열사」인 항목을 하나 둔다 — 그룹 공통 자산과
 * 계열사 전용 자산이 같은 레지스트리에서 공개범위로만 갈린다는 것이 2-1 의 구조다.
 */
const FINE_TUNED: RegistryModel[] = [
  {
    id: 'mdl-101',
    name: 'bnk/busan-credit-32b-sft',
    serving: 'vLLM · 공동존',
    role: '여신 심사 문서 특화',
    sharePct: 0,
    origin: '자체 파인튜닝',
    baseModel: 'onprem/qwen3-32b',
    license: 'Apache-2.0 (기반 모델 승계)',
    params: '32B',
    contextLen: '32K',
    quantization: 'INT8',
    gpu: 'A100 80GB × 2',
    owner: '부산은행',
    scope: '해당 계열사',
    registeredAt: '2026-05-12',
    state: '검증 트래픽',
    status: '검증 트래픽',
    versions: [
      { v: 'v0.3', at: '2026-05-28', note: '여신 품의서 5,200건 추가 학습 · 검증 트래픽 5%', current: true },
      { v: 'v0.2', at: '2026-05-12', note: '최초 등록 · 반입 검사 통과(학습 데이터 비식별 확인)' },
    ],
  },
];

/** 레지스트리 전체 — MODEL_POOL(단일 출처) + 레지스트리 축 + 파인튜닝 모델. */
export const REGISTRY_MODELS: RegistryModel[] = [
  ...MODEL_POOL.map((m) => {
    const extra = REGISTRY_EXTRA[m.name];
    return { ...m, ...extra } as RegistryModel;
  }),
  ...FINE_TUNED,
];

export const MODEL_STATE_TONE: Record<ModelState, 'ok' | 'info' | 'warn' | 'bad' | 'neutral'> = {
  '서빙 중': 'ok',
  '검증 트래픽': 'info',
  대기: 'warn',
  중지: 'neutral',
  폐기: 'bad',
};

/**
 * 폐기(삭제) 규칙 — LSM-001 의 "삭제"는 레코드 제거가 아니라 **폐기 상태 전이**다.
 * 감사 원장(SEC-009)과 배포 이력(AGB-011)이 사라진 모델을 참조해야 하므로
 * 물리 삭제를 하면 추적이 끊긴다. 화면에서 이 규칙을 명시한다.
 */
export const RETIRE_RULE =
  '모델 삭제는 레코드 제거가 아니라 「폐기」 상태 전이로 처리합니다. 감사 원장·배포 이력·미터링 실적이 폐기된 모델을 계속 참조하므로 물리 삭제하지 않습니다. 폐기 모델은 신규 라우팅 대상에서 제외되며 카탈로그에서 숨겨집니다.';

/** 신규 모델 등록 절차 — 반입 승인(2-1)·승인 배포(LSM-009)와 이어진다. */
export const REGISTER_STEPS: { step: string; owner: string; note: string }[] = [
  { step: '① 등록 신청', owner: '모델러', note: '모델 아티팩트·라이선스·학습 데이터 출처를 첨부해 기안' },
  { step: '② 반입 검사', owner: '플랫폼 운영', note: '라이선스 적합성 · 학습 데이터 비식별 · 악성코드 검사 (반입 승인 화면 연동)' },
  { step: '③ 검증 트래픽', owner: '모델러', note: '5% 트래픽으로 품질·지연 측정, 기준 미달 시 반려' },
  { step: '④ 서빙 승인', owner: '그룹 거버넌스', note: '승인 시 Gateway 라우팅 규칙에 편입되고 카탈로그에 공개' },
];

/* ═══════════════════════ ② 외부 서빙 API (LSM-004) ═══════════════════════ */

export interface ServingEndpoint {
  protocol: 'REST' | 'gRPC';
  url: string;
  spec: string;
  note: string;
}

/**
 * 계열사 레거시 시스템이 호출하는 **표준 인터페이스**.
 *
 * RAG 검색 API(`ServingApiSection`)와 다른 통로다 — 저쪽은 검색 결과를 돌려주고
 * 이쪽은 LLM 추론을 돌려준다. 화면에서 둘을 구분해 두지 않으면 LSM-004 를
 * RAG-005 로 답한 셈이 된다.
 */
export const SERVING_ENDPOINTS: ServingEndpoint[] = [
  {
    protocol: 'REST',
    url: 'https://llm.aip.group.local/v1/chat/completions',
    spec: 'OpenAPI 3.1 · /v1/openapi.json',
    note: 'OpenAI 호환 스키마 — 계열사 레거시의 기존 클라이언트 라이브러리를 그대로 쓴다',
  },
  {
    protocol: 'gRPC',
    url: 'llm-grpc.aip.group.local:8443',
    spec: 'Protobuf · inference.v1.CompletionService',
    note: '스트리밍·대량 배치 호출용 — 계정계 야간 배치가 이 통로를 쓴다',
  },
];

export type ClientState = '운영' | '검증' | '만료 임박' | '정지';

export interface ApiClient {
  id: string;
  /** 호출하는 계열사 레거시 시스템 이름. */
  system: string;
  tenant: Tenant;
  protocol: 'REST' | 'gRPC';
  /** 발급 키 — 화면에는 항상 마스킹해 표시한다. */
  key: string;
  state: ClientState;
  issuedAt: string;
  expiresAt: string;
  /** 이 키로 호출 가능한 모델. 전체 허용을 두지 않는 것이 요지다. */
  models: string[];
  /** 초당 호출 상한 — LSM-008 쿼터와 같은 축. */
  rps: number;
  /** 소스 IP 화이트리스트. */
  sourceIp: string;
  callsToday: number;
}

export const API_CLIENTS: ApiClient[] = [
  {
    id: 'KEY-001',
    system: '여신 심사 지원 시스템',
    tenant: '부산은행',
    protocol: 'REST',
    key: 'aip-llm-sk-3f91c2a7e40dprod',
    state: '운영',
    issuedAt: '2026-03-02',
    expiresAt: '2027-03-01',
    models: ['onprem/gpt-oss-120b', 'onprem/qwen3-32b'],
    rps: 20,
    sourceIp: '10.42.8.0/24',
    callsToday: 4820,
  },
  {
    id: 'KEY-002',
    system: '고객 상담 이력 요약 배치',
    tenant: '경남은행',
    protocol: 'gRPC',
    key: 'aip-llm-sk-77b0e9d1c852prod',
    state: '운영',
    issuedAt: '2026-03-14',
    expiresAt: '2027-03-13',
    models: ['onprem/llama-3.3-70b'],
    rps: 8,
    sourceIp: '10.51.3.0/24',
    callsToday: 1960,
  },
  {
    id: 'KEY-003',
    system: '보험 상품 문서 생성 파일럿',
    tenant: 'BNK캐피탈',
    protocol: 'REST',
    key: 'aip-llm-sk-2c48af60b913test',
    state: '검증',
    issuedAt: '2026-05-19',
    expiresAt: '2026-08-18',
    models: ['onprem/qwen3-32b'],
    rps: 3,
    sourceIp: '10.63.11.0/24',
    callsToday: 240,
  },
  {
    id: 'KEY-004',
    system: '리서치 요약 포털',
    tenant: 'BNK투자증권',
    protocol: 'REST',
    key: 'aip-llm-sk-9de5104fa27bprod',
    state: '만료 임박',
    issuedAt: '2025-07-01',
    expiresAt: '2026-06-30',
    models: ['onprem/gpt-oss-120b'],
    rps: 12,
    sourceIp: '10.72.5.0/24',
    callsToday: 1130,
  },
  {
    id: 'KEY-005',
    system: '전자문서 자동분류 (구)',
    tenant: 'BNK저축은행',
    protocol: 'REST',
    key: 'aip-llm-sk-01ba7734fe6dprod',
    state: '정지',
    issuedAt: '2025-11-08',
    expiresAt: '2026-11-07',
    models: ['onprem/qwen3-32b'],
    rps: 5,
    sourceIp: '10.84.2.0/24',
    callsToday: 0,
  },
];

export const CLIENT_STATE_TONE: Record<ClientState, 'ok' | 'info' | 'warn' | 'bad'> = {
  운영: 'ok',
  검증: 'info',
  '만료 임박': 'warn',
  정지: 'bad',
};

/** 키를 화면에 그릴 때 항상 거치는 마스킹. 원문 노출 경로를 두지 않는다. */
export const maskKey = (key: string) => `${key.slice(0, 11)}${'•'.repeat(10)}${key.slice(-4)}`;

/**
 * 외부 호출도 게이트웨이 4단(인증→라우팅→가드레일→미터링)을 그대로 통과한다.
 * 이 문장이 없으면 "외부 API 는 가드레일을 우회한다"는 오해가 남는다.
 */
export const EXTERNAL_CALL_NOTE =
  '외부 서빙 API 호출도 포털 Chat 과 동일하게 LLM Gateway 4단(인증·인가 → 라우팅 → 보안 가드레일 → 미터링·쿼터)을 통과합니다. 키별 허용 모델·RPS 상한·소스 IP 화이트리스트가 인증 단계에서 적용되고, 호출량은 계열사 Chargeback 에 그대로 합산됩니다.';

/** 외부 LLM 슬롯 안내는 게이트웨이 화면과 같은 문장을 쓴다(두 화면이 어긋나면 안 된다). */
export { EXTERNAL_SLOT };
