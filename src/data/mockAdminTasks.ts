/**
 * 관리 콘솔 — 과제 관리 mock.
 *
 * RFP 2-1 관리자 포털:
 *   "**과제 관리 화면**: 계열사별 과제 등록·검토·결재·이행 모니터링, 과제별 자원·비용 현황"
 *
 * AI Studio 의 「과제」(에이전트·워크플로우 등 제작 단위)와는 축이 다르다. 여기서 말하는
 * 과제는 **계열사가 올리는 사업 단위**다 — 예산·자원이 배정되고 등록→검토→결재를
 * 거쳐 이행이 모니터링된다. 마켓플레이스 자산의 `prj` 필드("여신 디지털심사 과제
 * (PRJ-BS-042)")가 가리키는 그 과제와 같은 개념이다.
 *
 * 전부 가상 창작물이다(CLAUDE.md 절대 규칙).
 */
import type { Tenant } from './tenants';

export type AdminTaskStage = '등록' | '검토' | '결재' | '이행 중' | '완료' | '반려';

export interface AdminTaskApproval {
  seq: number;
  role: string;
  status: '완료' | '진행' | '대기';
}

export interface AdminTask {
  id: string;
  name: string;
  tenant: Tenant;
  dept: string;
  stage: AdminTaskStage;
  requestedBy: string;
  requestedAt: string;
  /** 배정 예산(원). */
  budget: number;
  /** 집행액(원). */
  spent: number;
  /** GPU/CPU 자원 요약. */
  resource: string;
  approvals: AdminTaskApproval[];
  summary: string;
}

export const ADMIN_TASKS: AdminTask[] = [
  {
    id: 'PRJ-BS-042',
    name: '여신 디지털심사 과제',
    tenant: '부산은행',
    dept: '여신기획부',
    stage: '이행 중',
    requestedBy: '박서연',
    requestedAt: '2026-03-04',
    budget: 420_000_000,
    spent: 268_000_000,
    resource: 'GPU 4장 · onprem/gpt-oss-120b',
    approvals: [
      { seq: 1, role: '부서장 검토', status: '완료' },
      { seq: 2, role: '사업 관리자 결재', status: '완료' },
      { seq: 3, role: 'AI거버넌스 승인', status: '완료' },
    ],
    summary: '여신 서류 검증·심사 보조 에이전트 3종 구축 · 서빙계 배포 완료',
  },
  {
    id: 'PRJ-KN-018',
    name: '외환 자동화 과제',
    tenant: '경남은행',
    dept: '외환사업부',
    stage: '결재',
    requestedBy: '김재훈',
    requestedAt: '2026-05-02',
    budget: 180_000_000,
    spent: 42_000_000,
    resource: 'GPU 2장 · onprem/gpt-oss-120b',
    approvals: [
      { seq: 1, role: '부서장 검토', status: '완료' },
      { seq: 2, role: '사업 관리자 결재', status: '진행' },
      { seq: 3, role: 'AI거버넌스 승인', status: '대기' },
    ],
    summary: 'SWIFT 전문 검증 에이전트 개발 중 — 결재 대기',
  },
  {
    id: 'PRJ-CP-007',
    name: '광고심의 지원 과제',
    tenant: 'BNK캐피탈',
    dept: '마케팅부',
    stage: '검토',
    requestedBy: '이정우',
    requestedAt: '2026-05-20',
    budget: 65_000_000,
    spent: 4_500_000,
    resource: 'GPU 1장 · google/gemma-4-31B',
    approvals: [
      { seq: 1, role: '부서장 검토', status: '진행' },
      { seq: 2, role: '사업 관리자 결재', status: '대기' },
      { seq: 3, role: 'AI거버넌스 승인', status: '대기' },
    ],
    summary: '마케팅 문구 자동 검증 에이전트 — 사업 타당성 검토 중',
  },
  {
    id: 'PRJ-BS-061',
    name: 'CS 자동화 과제',
    tenant: '부산은행',
    dept: '고객만족부',
    stage: '이행 중',
    requestedBy: '이서준',
    requestedAt: '2026-02-11',
    budget: 130_000_000,
    spent: 121_000_000,
    resource: 'GPU 2장 · onprem/gpt-oss-120b',
    approvals: [
      { seq: 1, role: '부서장 검토', status: '완료' },
      { seq: 2, role: '사업 관리자 결재', status: '완료' },
      { seq: 3, role: 'AI거버넌스 승인', status: '완료' },
    ],
    summary: '민원 분류·회신 초안 에이전트 운영 중 · 예산 93% 집행',
  },
  {
    id: 'PRJ-SY-003',
    name: '개발 생산성 향상 과제',
    tenant: 'BNK시스템',
    dept: '개발지원팀',
    stage: '등록',
    requestedBy: '한지훈',
    requestedAt: '2026-06-01',
    budget: 90_000_000,
    spent: 0,
    resource: '미배정',
    approvals: [
      { seq: 1, role: '부서장 검토', status: '대기' },
      { seq: 2, role: '사업 관리자 결재', status: '대기' },
      { seq: 3, role: 'AI거버넌스 승인', status: '대기' },
    ],
    summary: '코드 리뷰·시큐어코딩 점검 에이전트 신규 등록',
  },
  {
    id: 'PRJ-KN-025',
    name: '상품 안내 자동화 과제',
    tenant: '경남은행',
    dept: '상품개발부',
    stage: '반려',
    requestedBy: '문전략',
    requestedAt: '2026-04-18',
    budget: 55_000_000,
    spent: 0,
    resource: '미배정',
    approvals: [
      { seq: 1, role: '부서장 검토', status: '완료' },
      { seq: 2, role: '사업 관리자 결재', status: '완료' },
      { seq: 3, role: 'AI거버넌스 승인', status: '대기' },
    ],
    summary: '기존 지식/상품 어시스턴트(GRP-007)와 범위 중복 — 반려, 흡수 권고',
  },
];

export const STAGE_TONE: Record<AdminTaskStage, 'ok' | 'warn' | 'bad' | 'info' | 'neutral'> = {
  등록: 'neutral',
  검토: 'info',
  결재: 'warn',
  '이행 중': 'ok',
  완료: 'ok',
  반려: 'bad',
};
