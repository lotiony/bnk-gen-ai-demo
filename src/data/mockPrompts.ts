/**
 * 프롬프트 라이브러리 mock — RFP: RAG-001 (필수).
 *
 * "RAG 아키텍처 작동 시 검색된 컨텍스트와 결합하는 필수 시스템 프롬프트의
 *  템플릿화, 버전 관리 및 중앙 제어 기능"
 *
 * **id·name·tenant·owner·model 은 마켓플레이스(mockCatalog.CATALOG_PROMPTS)의
 * PRM-* 리터럴을 조회해 재사용한다** — 카탈로그 카드와 여기 템플릿이 같은 자산이다.
 * 손으로 새 문자열을 만들면 두 화면이 다른 자산을 말하게 된다(에이전트 ID 충돌 전례).
 * 신규 템플릿은 PRM-4xx 대역만 사용한다.
 *
 * 전부 가상 창작물이다(CLAUDE.md 절대 규칙).
 */
import { CATALOG_PROMPTS } from './mockCatalog';

export type PromptVersionStatus = 'serving' | 'archived';

export interface PromptVersion {
  /** v1, v2, … — 최신이 versions[0]. */
  ver: string;
  at: string;
  by: string;
  body: string;
  changeNote: string;
  status: PromptVersionStatus;
}

export interface PromptTemplate {
  id: string;
  name: string;
  tenant: string;
  owner: string;
  model: string;
  description: string;
  /** 중앙 제어(RAG-001) — 서빙 버전 배포 시 전 Namespace 의 RAG 호출에 즉시 반영. */
  centralControl: boolean;
  /** 이 템플릿을 시스템 프롬프트로 쓰는 소비처. */
  usedBy: string[];
  versions: PromptVersion[];
}

/** 카탈로그의 PRM 자산에서 공통 필드를 가져온다 — 리터럴 단일 원천. */
function fromCatalog(id: string) {
  const p = CATALOG_PROMPTS.find((c) => c.id === id);
  if (!p) throw new Error(`CATALOG_PROMPTS 에 없는 프롬프트 id: ${id}`);
  return { id: p.id, name: p.name, tenant: p.tenant as string, owner: p.owner, model: p.model, description: p.description };
}

export const PROMPT_TEMPLATES_SEED: PromptTemplate[] = [
  {
    ...fromCatalog('PRM-101'),
    centralControl: true,
    usedBy: ['GRP-001 규정·책무 어시스턴트', 'SRC-301 규정검색_컴플라이언스'],
    versions: [
      {
        ver: 'v3', at: '2026-01-06 14:20', by: '박거버', status: 'serving',
        changeNote: '단서 조항 누락 금지 규칙을 출력 형식에 명시',
        body: `당신은 규정 조항 요약기입니다. 검색된 조항 원문을 실무자 언어로 요약합니다.

[출력 형식]
1) 핵심 3줄 요약 — 각 줄은 조항 번호를 괄호로 인용
2) 단서·예외 조항 — **원문에 단서("다만", "단," 등)가 있으면 반드시 별도 줄로 남긴다**
3) 개정 이력이 있으면 개정 전후 한 줄 비교

[금칙]
- 조항 번호를 추정해 쓰지 않는다. 검색 컨텍스트에 없는 조항은 인용하지 않는다.
- 요약 과정에서 의무·금지 표현("하여야 한다", "할 수 없다")의 강도를 바꾸지 않는다.`,
      },
      {
        ver: 'v2', at: '2025-12-18 10:05', by: '박거버', status: 'archived',
        changeNote: '개정 전후 비교 줄 추가',
        body: `당신은 규정 조항 요약기입니다. 검색된 조항 원문을 실무자 언어로 요약합니다.

[출력 형식]
1) 핵심 3줄 요약 — 각 줄은 조항 번호를 괄호로 인용
2) 개정 이력이 있으면 개정 전후 한 줄 비교

[금칙]
- 조항 번호를 추정해 쓰지 않는다.`,
      },
      {
        ver: 'v1', at: '2025-11-02 09:40', by: '박거버', status: 'archived',
        changeNote: '최초 등록',
        body: `당신은 규정 조항 요약기입니다. 검색된 조항 원문을 실무자 언어로 3줄 요약합니다. 조항 번호를 함께 인용합니다.`,
      },
    ],
  },
  {
    ...fromCatalog('PRM-118'),
    centralControl: true,
    usedBy: ['AGT-204 PB 자산진단 어시스턴트'],
    versions: [
      {
        ver: 'v2', at: '2026-01-05 16:44', by: '정오너', status: 'serving',
        changeNote: '계좌번호 부분 마스킹 → 전체 삭제로 강화',
        body: `당신은 상담 이력 요약기입니다. 상담 로그에서 개인정보를 제거하고 상담 의도·처리 결과만 남깁니다.

[비식별 규칙]
- 이름·연락처·계좌번호·주민등록번호는 요약에 포함하지 않는다(부분 마스킹도 금지 — 전체 삭제).
- 고객은 "고객"으로만 지칭한다.

[출력 형식]
- 상담 의도 1줄 / 처리 결과 1줄 / 후속 조치 필요 시 1줄`,
      },
      {
        ver: 'v1', at: '2025-12-10 11:20', by: '정오너', status: 'archived',
        changeNote: '최초 등록',
        body: `상담 로그에서 개인정보를 마스킹하고 상담 의도·처리 결과만 남겨 요약합니다.`,
      },
    ],
  },
  {
    ...fromCatalog('PRM-204'),
    centralControl: false,
    usedBy: ['AGT-512 비대면 여신 사전심사 보조'],
    versions: [
      {
        ver: 'v1', at: '2026-01-04 09:12', by: '조디비', status: 'serving',
        changeNote: '최초 등록',
        body: `재무 지표와 담보 정보를 받아 심사 의견 **초안**을 작성합니다.

[금칙]
- "승인 가능", "문제 없음" 등 확정 표현을 쓰지 않는다 — 판단 주체는 심사역이다.
- 제공되지 않은 재무 수치를 추정해 채우지 않는다.`,
      },
    ],
  },
  {
    ...fromCatalog('PRM-231'),
    centralControl: true,
    usedBy: ['AGT-602 카드 분실신고 응대 봇', 'AGT-621 CS 챗봇 코파일럿'],
    versions: [
      {
        ver: 'v2', at: '2026-01-03 13:30', by: '윤참여', status: 'serving',
        changeNote: '수익률 단정 표현 필터 추가',
        body: `초안 응대문을 금융 표준 문체로 교정합니다.

[교정 규칙]
- 단정·확약 표현("보장됩니다", "확실합니다", "무조건")을 중립 표현으로 바꾼다.
- 수익률·금리는 "고시 기준" 단서를 붙인다.
- 고객 호칭은 "고객님"으로 통일한다.`,
      },
      {
        ver: 'v1', at: '2025-12-01 10:00', by: '윤참여', status: 'archived',
        changeNote: '최초 등록',
        body: `초안 응대문을 금융 표준 문체로 교정합니다. 단정·확약 표현을 걸러냅니다.`,
      },
    ],
  },
  {
    ...fromCatalog('PRM-309'),
    centralControl: false,
    usedBy: [],
    versions: [
      {
        ver: 'v1', at: '2025-12-29 15:50', by: '강개발', status: 'serving',
        changeNote: '최초 등록',
        body: `서술형 문단을 개조식 보고 형식으로 바꿉니다. 원문에 없는 사실을 추가하지 않습니다.`,
      },
    ],
  },
];
