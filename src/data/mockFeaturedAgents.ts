/**
 * 홈 대시보드 "대표 에이전트" 섹션 mock.
 *
 * 큐레이션 기준: 그룹 표준 추천 — 산업표준 3축 통과 · 레드팀 검증 완료 · 운영 안정.
 * 카드에는 식별·설명·소속만 노출 (지표/액션 없음).
 */

export interface FeaturedAgent {
  id: string;
  name: string;
  /** 시각 식별용 이모지. */
  icon: string;
  /** 1~2문장 한 줄 설명 (용도). */
  description: string;
  /** 소속 프로젝트명. */
  projectName: string;
  /** 클릭 시 이동할 경로 — 카탈로그 상세(마켓플레이스). */
  projectHref: string;
  /** 표시 상태 — 운영 중 / 그룹 표준 등. */
  badge: '운영 중' | '그룹 표준';
}

export const FEATURED_AGENTS: FeaturedAgent[] = [
  {
    // 시나리오 1 진입점 — 홈에서 바로 고객 상담 워크스페이스로 간다 (AGB-006 ⑤).
    id: 'GRP-005',
    name: '고객 · 민원 분석 에이전트',
    icon: '🧑‍💼',
    description:
      '고객 정보 기반 프로필 생성, 성향 분석과 맞춤 상품 추천, 상담 내용 요약까지 한 흐름으로 지원합니다.',
    projectName: '그룹 공통 필수 Use Case ⑤',
    projectHref: '/chat?agent=GRP-005',
    badge: '그룹 표준',
  },
  {
    id: 'AGT-205',
    name: '시황 분석 에이전트',
    icon: '📈',
    description:
      '국내외 시장 지표·뉴스·리서치 리포트를 실시간 수집·요약해 오전 브리핑과 리스크 알람을 자동 생성합니다.',
    projectName: 'PB 에이전트 프로젝트',
    projectHref: '/catalog',
    badge: '운영 중',
  },
  {
    id: 'AGT-318',
    name: '수신 에이전트',
    icon: '💰',
    description:
      '예·적금 상품 안내와 금리 비교, 가입 자격·우대 조건 확인을 자동화하여 상담 초안을 제공합니다.',
    projectName: '금융상담 에이전트 프로젝트',
    projectHref: '/catalog',
    badge: '그룹 표준',
  },
  {
    id: 'AGT-072',
    name: '외환 에이전트',
    icon: '💱',
    description:
      '환율 조회·환전 시나리오·해외 송금 규정 안내를 자동화하고 고객 문의 초안을 실시간으로 지원합니다.',
    projectName: '금융상담 에이전트 프로젝트',
    projectHref: '/catalog',
    badge: '그룹 표준',
  },
];
