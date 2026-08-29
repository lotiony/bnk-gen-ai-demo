/**
 * 포털(워크스페이스) 정의 — 이 데모의 상위 정보구조 단일 진실 공급원.
 *
 * RFP 근거 —
 *  · 2-1 포탈 구축 공통
 *      "포탈 사용자의 다양한 역할(일반 사용자, 에이전트 개발자, 모델러, 데이터 담당자,
 *       운영자, 관리자 등)별 **워크스페이스(화면 구성) 제공**"
 *      "로그인 후 사용자 권한에 따라 **접근 가능한 워크스페이스·메뉴·기능만 노출**"
 *  · 2-3        "AI플랫폼 포탈 내 **별도 기능**으로 'AI거버넌스 포탈' 구축"
 *  · 인프라 나-(3) "**공통 포털 웹**(각 계열사 접속 전 랜딩 웹페이지 개념)" +
 *                  "10개 계열사를 10개의 Namespace(tenant) 기준으로 분리"
 *
 * ── 왜 GNB 를 평면 6개에서 포털 4개로 바꿨나 ───────────────────────────
 * RFP 가 요구하는 단위는 **메뉴가 아니라 워크스페이스**다. 예전 GNB 는
 * `홈·AI 어시스턴트·AI Studio·지식·데이터·마켓플레이스·관리` 를 한 줄에 늘어놓아,
 * 성격이 다른 네 개의 포털이 하나의 메뉴 바처럼 보였다. 그러면 랜딩에서
 * "포털을 고르세요" 라고 해 놓고 들어가는 순간 그 개념이 사라진다.
 *
 * 그래서 —
 *   ① 로그인 직후 **공통 포털 랜딩**(`/portal`)에서 접근 가능한 포털만 카드로 고르고,
 *   ② 포털에 들어가면 GNB 는 **그 포털의 섹션만** 그린다,
 *   ③ 포털 이동은 GNB 좌측 `PortalSwitcher` 로만 한다.
 *
 * ── Namespace 서사 (SEC-001) ───────────────────────────────────────
 * 랜딩과 포털 카드가 말하는 것은 하나다 —
 *   · **공통 포털 웹 Namespace(`ns-group-common`) 1개** : 랜딩·인증·그룹 공유 자산·
 *     거버넌스 원장·운영 콘솔처럼 계열사를 가로지르는 것.
 *   · **계열사 Namespace 10개** : 대화·지식 인덱스·에이전트 런타임·전용 볼륨처럼
 *     소속 계열사 안에서만 실행·보관되는 것.
 * 포털 카드의 `nsScope` 가 이 둘 중 어디서 도는 포털인지를 밝힌다.
 * 화면마다 말이 달라지면 SEC-001 서술이 무너지므로 문구를 여기 한곳에 둔다.
 *
 * ⚠️ 권한 밖 포털은 **회색 처리가 아니라 미렌더**다(RFP 2-1). 잠긴 카드를 보여 주는
 *    테넌트 랜딩과 규칙이 다른데, 이유는 RFP 가 "워크스페이스" 를 명시적으로
 *    노출 통제 대상으로 지목했기 때문이다. 테넌트 잠금은 격리 증명이고,
 *    포털 미노출은 권한 기반 화면 구성이다 — 두 개는 다른 요건이다.
 */
import type { NavArea } from '@/lib/personaView';

export type PortalId = 'work' | 'studio' | 'ops' | 'gov';

/** 이 포털이 어느 Namespace 성격에서 도는가. */
export type PortalNsScope = 'common' | 'affiliate';

export interface PortalNavItem {
  label: string;
  to: string;
  /** 권한 판정 키 — 권한 밖이면 렌더하지 않는다(RFP 2-1). */
  area: NavArea | 'governance';
  /** prefix 로 active 판정할 경우. 없으면 정확 매치. */
  matchPrefix?: string;
}

export interface PortalDef {
  id: PortalId;
  /** 랜딩 카드 좌상단 순번. */
  seq: string;
  /** 랜딩 카드 코드 표기 — 시연 중 "S 포털로 갑니다" 처럼 부르기 위한 것. */
  code: string;
  /** GNB 칩·랜딩 카드 제목. */
  label: string;
  /** 좁은 폭(GNB 칩)에서 쓰는 짧은 표기. */
  short: string;
  /** 칩 앞에 붙는 1자 코드. */
  initial: string;
  /** 랜딩 카드 부제. */
  tagline: string;
  /**
   * 랜딩 카드 본문. **한 문장으로 끝낸다** — 타일이 정사각 비율을 유지해야 하고,
   * 네 장이 1920×1080 한 화면에 들어와야 한다(랜딩 주석 참조).
   * Namespace 스코프는 카드 하단 줄이 이미 말하므로 여기서 반복하지 않는다.
   */
  desc: string;
  /** 카드를 눌렀을 때 도착하는 경로. */
  home: string;
  nsScope: PortalNsScope;
  /** 이 포털을 여는 역할. 카드 하단 한 줄에 들어가야 하므로 짧게 적는다. */
  audience: string;
  /** 이 포털 화면이 근거로 삼는 대표 요건 — 조견표 상호 참조용. */
  reqs: string[];
  nav: PortalNavItem[];
  /** 이 포털에 들어와 있을 때 GNB 우측에 붙는 Namespace 설명. */
  nsNote: string;
}

export const PORTALS: PortalDef[] = [
  {
    id: 'work',
    seq: '01',
    code: 'U PORTAL',
    label: '업무 AI 포털',
    short: '업무 AI',
    initial: 'U',
    tagline: '전 임직원의 일상 업무 동선',
    desc: '그룹 공동 에이전트와 AI 대화, 마켓플레이스, 개인 문서를 한곳에서 이용한다.',
    home: '/',
    nsScope: 'affiliate',
    audience: '전 임직원',
    reqs: ['AGB-006', 'RAG-007', 'SEC-003', '2-1 개인화'],
    nav: [
      { label: '홈', to: '/', area: 'home' },
      { label: 'AI 어시스턴트', to: '/chat', area: 'chat', matchPrefix: '/chat' },
      { label: '마켓플레이스', to: '/catalog', area: 'catalog', matchPrefix: '/catalog' },
      { label: '내 문서', to: '/documents', area: 'home', matchPrefix: '/documents' },
    ],
    nsNote: '대화 · 지식 인덱스는 소속 Namespace 안에서만 실행 · 보관',
  },
  {
    id: 'studio',
    seq: '02',
    code: 'S PORTAL',
    label: 'AI Studio',
    short: 'AI Studio',
    initial: 'S',
    tagline: '만들고 검증해서 승인받는 곳',
    desc: '에이전트 · 워크플로우 · Tool 을 만들고, 지식과 데이터를 붙여 검증한 뒤 배포한다.',
    home: '/studio',
    nsScope: 'affiliate',
    audience: '개발자 · 모델러 · 데이터 담당자',
    reqs: ['AGB-001~012', 'EDA-006', 'RAG-009', 'LSM-005'],
    nav: [
      { label: 'AI Studio', to: '/studio', area: 'studio', matchPrefix: '/studio' },
      { label: '지식 · 데이터', to: '/knowledge', area: 'knowledge', matchPrefix: '/knowledge' },
    ],
    nsNote: '제작 산출물 · 개발 데이터는 소속 Namespace 에 귀속',
  },
  {
    id: 'ops',
    seq: '03',
    code: 'O PORTAL',
    label: '통합 운영 포털',
    short: '통합 운영',
    initial: 'O',
    tagline: '10개 계열사를 가로지르는 관리',
    desc: '사용자 · 권한 · 모델 · 보안 정책 · 자원과 비용을 계열사 단위로 나눠 통제한다.',
    home: '/admin',
    nsScope: 'common',
    audience: '운영자 · 관리자 · 정보보호',
    reqs: ['ONM-005', 'LSM-001', 'SEC-005', 'SEC-009'],
    nav: [{ label: '운영 콘솔', to: '/admin', area: 'admin', matchPrefix: '/admin' }],
    nsNote: '공통 포털 웹 Namespace 에서 10개 계열사 Namespace 를 가로질러 관리',
  },
  {
    id: 'gov',
    seq: '04',
    code: 'G PORTAL',
    label: 'AI 거버넌스 포탈',
    short: 'AI 거버넌스',
    initial: 'G',
    tagline: 'RFP 2-3 이 규정한 별도 포탈',
    desc: 'AI 서비스의 등록부터 폐기까지 관문 · 위험 평가 · 결재 · 재평가 기일을 추적한다.',
    home: '/governance',
    nsScope: 'common',
    audience: '거버넌스 · 준법 · 감사',
    reqs: ['2-3 AI거버넌스 포탈', 'ONM-004'],
    nav: [
      { label: '원장 · 라이프사이클', to: '/governance', area: 'governance' },
      {
        label: '포탈 관리',
        to: '/governance/admin',
        area: 'governance',
        matchPrefix: '/governance/admin',
      },
    ],
    nsNote: '그룹 원장은 공통 Namespace · 결재선은 계열사별로 분기',
  },
];

export const PORTAL_BY_ID: Record<PortalId, PortalDef> = PORTALS.reduce(
  (acc, p) => ({ ...acc, [p.id]: p }),
  {} as Record<PortalId, PortalDef>,
);

/**
 * 경로 → 포털 매핑.
 *
 * 목록 순서가 곧 판정 순서다. `/governance` 가 `/g…` 로 시작하는 다른 경로와
 * 겹치지 않도록 **긴 접두사를 먼저** 둔다.
 *
 * ⚠️ 여기 없는 경로(`/approvals`, `/portal`)는 포털에 매이지 않는다 —
 *    결재함은 네 포털이 공유하는 상단바 기능이고, 랜딩은 포털 밖이다.
 *    그 경우 `portalView.resolvePortal` 이 **마지막으로 머문 포털**을 쓴다.
 */
const PATH_MAP: { prefix: string; portal: PortalId }[] = [
  { prefix: '/governance', portal: 'gov' },
  { prefix: '/admin', portal: 'ops' },
  { prefix: '/studio', portal: 'studio' },
  { prefix: '/knowledge', portal: 'studio' },
  { prefix: '/projects', portal: 'studio' },
  { prefix: '/chat', portal: 'work' },
  { prefix: '/catalog', portal: 'work' },
  { prefix: '/documents', portal: 'work' },
];

/** 경로가 어느 포털에 속하는가. 매이지 않는 경로면 null. */
export function portalOfPath(pathname: string): PortalId | null {
  if (pathname === '/') return 'work';
  const hit = PATH_MAP.find((m) => pathname.startsWith(m.prefix));
  return hit ? hit.portal : null;
}

/** 플랫폼이 제공하는 포털 수 — 랜딩 히어로 문구가 이 값을 쓴다. */
export const PORTAL_COUNT = PORTALS.length;
