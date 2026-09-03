/**
 * 플랫폼 모듈 원장 — 모듈형 확장 구조(ONM-007)와 변경 영향도 산출의 단일 출처.
 *
 * RFP: ONM-007 클라우드 확장·이식성을 고려한 표준 MSA 아키텍처 (필수)
 * 연계: 2-1 구축범위 1.5.4(모듈형 서비스 확장 구조) · AGB-011(버전·배포 이력) ·
 *       ONM-006(파드 상태 관제) · ONM-008(개발 환경)
 *
 * 왜 이 원장이 필요한가 —
 *   ONM-007 은 "설계"를 요구하는 요건이라 그동안 데모에 대응 화면이 없었다.
 *   그런데 발주처가 실제로 확인하려는 건 아키텍처 그림이 아니라
 *   **"Agent 하나 바꾸면 뭐가 같이 흔들리느냐"** 다. 그래서 모듈 목록만 두지 않고
 *   모듈 간 계약(contract) 의존을 함께 적어, 변경 유형을 고르면 영향 모듈이
 *   계산되어 나오게 만든다. 그림이 아니라 계산 결과를 보여 주는 쪽이 답이 된다.
 *
 * ⚠️ 날짜는 전부 `demoClock` 기준이다. 여기에 `new Date()` 를 넣지 말 것.
 */
import { fromToday } from './demoClock';

export type ModuleId =
  | 'gateway'
  | 'model'
  | 'rag'
  | 'workflow'
  | 'mcp'
  | 'guardrail'
  | 'session'
  | 'observability';

export type DeployStrategy = 'Blue-Green' | 'Canary' | 'Rolling';

export interface PlatformModule {
  id: ModuleId;
  name: string;
  role: string;
  /** 이 모듈이 외부에 제공하는 계약(API Contract) 이름과 현재 버전. */
  contract: string;
  version: string;
  /** 하위 호환으로 함께 서빙 중인 이전 계약 버전. 정책상 최대 2개. */
  supported: string[];
  /** 이 모듈이 호출하는(= 의존하는) 모듈. 영향 전파 계산의 간선. */
  dependsOn: ModuleId[];
  replicas: number;
  /** 무중단 이중화 구성 — AZ 분산 여부를 그대로 적는다. */
  ha: string;
  strategy: DeployStrategy;
  lastDeployedAt: string;
  status: '운영 중' | '카나리 진행' | '대기';
}

/**
 * 모듈 원장. `dependsOn` 은 "계약을 소비하는 방향"이다 —
 * workflow 가 mcp 를 dependsOn 하므로, mcp 계약이 깨지면 workflow 가 영향 대상이 된다.
 */
export const PLATFORM_MODULES: PlatformModule[] = [
  {
    id: 'gateway',
    name: 'LLM Gateway',
    role: '단일 통로 · 라우팅 · 쿼터',
    contract: 'gateway.chat',
    version: 'v3',
    supported: ['v2'],
    dependsOn: ['model', 'guardrail'],
    replicas: 6,
    ha: 'Active-Active · 2 AZ',
    strategy: 'Blue-Green',
    lastDeployedAt: fromToday(-11),
    status: '운영 중',
  },
  {
    id: 'model',
    name: 'Model Serving',
    role: '모델 서빙 · 교체',
    contract: 'model.infer',
    version: 'v2',
    supported: ['v1'],
    dependsOn: [],
    replicas: 8,
    ha: 'Active-Active · GPU 노드 2 AZ',
    strategy: 'Canary',
    lastDeployedAt: fromToday(-4),
    status: '카나리 진행',
  },
  {
    id: 'rag',
    name: 'RAG · 검색',
    role: '인덱스 · 리랭킹',
    contract: 'rag.search',
    version: 'v4',
    supported: ['v3', 'v2'],
    dependsOn: ['model'],
    replicas: 4,
    ha: 'Active-Active · 2 AZ',
    strategy: 'Blue-Green',
    lastDeployedAt: fromToday(-6),
    status: '운영 중',
  },
  {
    id: 'workflow',
    name: 'Workflow · Agent',
    role: 'Agent 실행 오케스트레이션',
    contract: 'agent.run',
    version: 'v5',
    supported: ['v4'],
    dependsOn: ['gateway', 'rag', 'mcp', 'guardrail', 'session'],
    replicas: 6,
    ha: 'Active-Active · 2 AZ',
    strategy: 'Blue-Green',
    lastDeployedAt: fromToday(-2),
    status: '운영 중',
  },
  {
    id: 'mcp',
    name: 'MCP Registry',
    role: '도구 명세 · 호출 권한',
    contract: 'tool.invoke',
    version: 'v2',
    supported: ['v1'],
    dependsOn: ['guardrail'],
    replicas: 3,
    ha: 'Active-Standby · 2 AZ',
    strategy: 'Rolling',
    lastDeployedAt: fromToday(-9),
    status: '운영 중',
  },
  {
    id: 'guardrail',
    name: 'Guardrail',
    role: '입 · 출력 정책 검사',
    contract: 'policy.check',
    version: 'v3',
    supported: ['v2'],
    dependsOn: [],
    replicas: 4,
    ha: 'Active-Active · 2 AZ',
    strategy: 'Rolling',
    lastDeployedAt: fromToday(-17),
    status: '운영 중',
  },
  {
    id: 'session',
    name: '세션 · 이력',
    role: '대화 · 감사 원장',
    contract: 'session.log',
    version: 'v2',
    supported: ['v1'],
    dependsOn: [],
    replicas: 4,
    ha: 'Active-Active · 2 AZ',
    strategy: 'Rolling',
    lastDeployedAt: fromToday(-23),
    status: '운영 중',
  },
  {
    id: 'observability',
    name: '관측 · 운영',
    role: '지표 · 로그 · 알림',
    contract: 'obs.ingest',
    version: 'v1',
    supported: [],
    dependsOn: [],
    replicas: 3,
    ha: 'Active-Active · 2 AZ',
    strategy: 'Rolling',
    lastDeployedAt: fromToday(-31),
    status: '운영 중',
  },
];

export const MODULE_BY_ID: Record<ModuleId, PlatformModule> = Object.fromEntries(
  PLATFORM_MODULES.map((m) => [m.id, m]),
) as Record<ModuleId, PlatformModule>;

/* ────────────────────────── 변경 영향도 ────────────────────────── */

export interface ChangeScenario {
  id: string;
  /** RFP 상세내용이 지목한 변경 유형 그대로. */
  kind: 'AI 서비스' | 'Agent · Workflow' | 'MCP Tool' | '계약 파괴 변경';
  label: string;
  detail: string;
  /** 실제로 배포되는 모듈. 한 건이 원칙이다. */
  target: ModuleId;
  /**
   * 계약 자체를 바꾸는가. false 면 계약이 그대로이므로 소비 모듈로 전파되지 않는다 —
   * 이 한 줄이 "영향 최소화"의 실제 근거다.
   */
  breaksContract: boolean;
  /** 계약을 바꾸더라도 하위 호환 버전을 병행해 흡수하는지. */
  mitigation: string;
  requirement: string;
}

export const CHANGE_SCENARIOS: ChangeScenario[] = [
  {
    id: 'svc-new',
    kind: 'AI 서비스',
    label: '신규 AI 서비스 게시',
    detail: '카탈로그 등재 1건과 Gateway 라우팅 규칙 1건이 추가된다. 서비스마다 독립 엔드포인트가 발급되므로 기존 경로와 겹치지 않는다.',
    target: 'gateway',
    breaksContract: false,
    mitigation: '라우팅 규칙 추가는 계약(gateway.chat v3) 변경이 아니다 — 설정 반영으로 끝난다',
    requirement: '1.4.4 · AGB-007',
  },
  {
    id: 'agent-rev',
    kind: 'Agent · Workflow',
    label: 'Agent 정의 · 프롬프트 변경',
    detail: 'Workflow 모듈 안에 새 버전 레코드가 적재된다. 기존 버전은 보존되고, 진행 중인 대화는 이전 버전으로 계속 수행된다.',
    target: 'workflow',
    breaksContract: false,
    mitigation: '버전 스냅샷으로 적재 → 승인된 버전만 운영계에 게시(AGB-011)',
    requirement: 'AGB-011 · LSM-009',
  },
  {
    id: 'mcp-add',
    kind: 'MCP Tool',
    label: 'MCP Tool 추가 · 명세 변경',
    detail: 'Tool Registry 에 명세만 등록된다. 이 도구를 쓰는 에이전트 정의는 수정하지 않으며, 기존 에이전트는 고정된 계약 버전을 계속 호출한다.',
    target: 'mcp',
    breaksContract: false,
    mitigation: 'tool.invoke v2 계약은 그대로 — 도구 목록은 계약 안의 데이터다',
    requirement: 'AGB-004 · AGB-005',
  },
  {
    id: 'contract-break',
    kind: '계약 파괴 변경',
    label: 'rag.search 응답 스키마 변경 (v4 → v5)',
    detail: '계약 자체가 바뀌는 유일한 경우다. 이때만 소비 모듈이 영향 대상으로 잡히며, 하위 호환 2버전 병행으로 흡수한다.',
    target: 'rag',
    breaksContract: true,
    mitigation: 'v4 를 유예 기간 동안 병행 서빙하고, 소비 모듈이 v5 로 옮긴 뒤 v3 를 내린다',
    requirement: 'ONM-007 · RAG-001',
  },
];

/**
 * 계약 그래프로 영향 모듈을 산출한다.
 *
 * 계약이 유지되면(breaksContract=false) 전파가 없다는 것이 이 함수의 요지다.
 * 계약이 깨질 때만 해당 모듈을 dependsOn 하는 모듈을 추적한다(전이 포함).
 */
export function impactedModules(sc: ChangeScenario): ModuleId[] {
  if (!sc.breaksContract) return [];
  const out = new Set<ModuleId>();
  const walk = (id: ModuleId) => {
    for (const m of PLATFORM_MODULES) {
      if (m.dependsOn.includes(id) && !out.has(m.id)) {
        out.add(m.id);
        walk(m.id);
      }
    }
  };
  walk(sc.target);
  return [...out];
}

/* ────────────────────────── 배포 · 복구 ────────────────────────── */

export interface ReleaseRecord {
  id: string;
  module: ModuleId;
  version: string;
  strategy: DeployStrategy;
  at: string;
  by: string;
  /** 배포 승인 시점에 산출된 영향 모듈 수. 0 이면 무중단 즉시 배포 대상이다. */
  impactCount: number;
  outcome: '정상' | '롤백' | '진행 중';
  note: string;
}

export const RELEASE_HISTORY: ReleaseRecord[] = [
  {
    id: 'REL-2041',
    module: 'workflow',
    version: 'agent.run v5.4.2',
    strategy: 'Blue-Green',
    at: `${fromToday(-2)} 14:20`,
    by: '박운영 (그룹 AI플랫폼팀)',
    impactCount: 0,
    outcome: '정상',
    note: '계약 변경 없음 — 영향 모듈 0건으로 승인 후 즉시 별칭 전환',
  },
  {
    id: 'REL-2038',
    module: 'model',
    version: 'model.infer v2.1.0',
    strategy: 'Canary',
    at: `${fromToday(-4)} 09:05`,
    by: '박운영 (그룹 AI플랫폼팀)',
    impactCount: 0,
    outcome: '진행 중',
    note: '카나리 10% 진행 중 · SLO 위반 시 자동 복귀',
  },
  {
    id: 'REL-2033',
    module: 'rag',
    version: 'rag.search v4.0.0',
    strategy: 'Blue-Green',
    at: `${fromToday(-6)} 21:40`,
    by: '이검색 (그룹 AI플랫폼팀)',
    // ⚠️ impactCount 는 `impactedModules()` 가 rag 에 대해 산출하는 값과 같아야 한다.
    //    rag.search 를 소비하는 모듈은 Workflow 하나뿐이다(Gateway 는 model·guardrail 만 본다).
    impactCount: 1,
    outcome: '정상',
    note: '계약 파괴 변경 — v3 병행 서빙으로 Workflow · Agent 무중단 이관',
  },
  {
    id: 'REL-2029',
    module: 'gateway',
    version: 'gateway.chat v3.2.1',
    strategy: 'Blue-Green',
    at: `${fromToday(-11)} 02:10`,
    by: '박운영 (그룹 AI플랫폼팀)',
    impactCount: 0,
    outcome: '정상',
    note: '라우팅 규칙 추가 배포 — 계약 동일',
  },
  {
    id: 'REL-2024',
    module: 'mcp',
    version: 'tool.invoke v2.0.3',
    strategy: 'Rolling',
    at: `${fromToday(-19)} 23:15`,
    by: '최도구 (그룹 AI플랫폼팀)',
    impactCount: 0,
    outcome: '롤백',
    note: '연계 어댑터 타임아웃 증가 확인 → 6분 만에 v2.0.2 로 복귀',
  },
];

/** 하위 호환 정책 — 화면에서 문장으로 고정 노출한다. */
export const COMPAT_POLICY = [
  {
    title: '계약 버전 고정',
    desc: '모듈 간 호출은 반드시 버전이 명시된 계약을 지난다. 호출자는 배포 시점에 고정한 버전을 계속 호출한다.',
  },
  {
    title: '하위 호환 2버전',
    desc: '계약을 깨는 변경은 이전 버전을 최대 2개까지 병행 서빙한다. 소비 모듈이 모두 옮긴 뒤에 구버전을 내린다.',
  },
  {
    title: '영향도 사전 산출',
    desc: '배포 승인 화면에서 계약 그래프로 영향 모듈을 먼저 산출한다. 0건이면 무중단 즉시 배포 대상이다.',
  },
  {
    title: '즉시 복구',
    desc: 'Blue-Green 별칭 전환과 카나리 자동 복귀로 되돌린다. 이전 슬롯은 보존되어 원클릭 Rollback 이 가능하다.',
  },
];

/** 화면 하단 고지 — 제안 범위를 정확히 적는다. */
export const PLATFORM_SCOPE_NOTE =
  '모듈 경계와 계약 버전은 요구사항 분석 단계에서 계열사 연계 범위를 확인해 확정한다. ' +
  '공동존 On-Premise K8s 위에 동일 구성으로 배포하며, 향후 망분리 규제가 완화되면 같은 매니페스트로 ' +
  'Public/Hybrid Cloud 로 이식한다(ONM-007). 화면의 수치는 시연용 예시값이다.';
