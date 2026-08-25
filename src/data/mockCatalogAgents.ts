/**
 * 공통 카탈로그용 에이전트 view — 모든 계열사·과제의 에이전트가 한 곳에 모임.
 * 본 페이지는 조회 전용이라 mockAgentTasks(과제 상세용)와 분리.
 */

import type { AgentBuilder, AgentDeployStage } from './mockAgentTasks';

export type Tenant =
  | 'KB국민은행'
  | 'KB증권'
  | 'KB손해보험'
  | 'KB라이프'
  | 'KB국민카드'
  | 'KB캐피탈'
  | 'KB자산운용';

export type AgentDomain = 'CX' | 'PB자산' | '컴플라이언스' | '여신심사' | '리스크' | '운영자동화' | '마케팅';

export interface CatalogAgent {
  id: string;
  name: string;
  tenant: Tenant;
  /** 소속 프로젝트명. */
  projectName: string;
  projectId: string;
  domain: AgentDomain;
  builder: AgentBuilder;
  stage: AgentDeployStage;
  /** 운영 상태 — 카탈로그에 보일 라벨. */
  state: '운영 중' | '실행 중' | '계획' | '보류';
  mainModel: string;
  fallbackModel?: string;
  /** 연결된 지식 인덱스 수. */
  linkedKnowledgeCount: number;
  /** 7일 호출 수. */
  callsWeekly: number;
  /** P95 응답 (ms). */
  p95Ms?: number;
  /** 대고객 여부. */
  customerFacing: boolean;
  /** 민감도 등급 1~4. */
  sensitivity: 1 | 2 | 3 | 4;
  ownerName: string;
  ownerInitial: string;
  updatedAt: string;
  /** 한 줄 설명. */
  description: string;
}

export const MOCK_CATALOG_AGENTS: CatalogAgent[] = [
  {
    id: 'AGT-204',
    name: 'PB 자산진단 어시스턴트',
    tenant: 'KB국민은행',
    projectName: 'PB 에이전트 프로젝트',
    projectId: 'PRJ-2025-PB-001',
    domain: 'PB자산',
    builder: 'pro-code',
    stage: '서빙계',
    state: '운영 중',
    mainModel: 'azure/gpt-5.5',
    fallbackModel: 'openai/gpt-oss-120b',
    linkedKnowledgeCount: 1,
    callsWeekly: 12480,
    p95Ms: 2100,
    customerFacing: false,
    sensitivity: 3,
    ownerName: '박서연',
    ownerInitial: '서연',
    updatedAt: '2026-05-19 16:08',
    description: '보유 자산 위험도·분산도·유동성 점수 산출 + 개선안 JSON 반환',
  },
  {
    id: 'AGT-301',
    name: '보이스피싱 1차 분류 에이전트',
    tenant: 'KB국민은행',
    projectName: '보이스피싱탐지 에이전트_디지털전략부',
    projectId: 'PRJ-101',
    domain: 'CX',
    builder: 'pro-code',
    stage: '서빙계',
    state: '운영 중',
    mainModel: 'openai/gpt-oss-120b',
    fallbackModel: 'google/gemma-4-31B-it-assistant',
    linkedKnowledgeCount: 2,
    callsWeekly: 84200,
    p95Ms: 1480,
    customerFacing: true,
    sensitivity: 3,
    ownerName: '조현우',
    ownerInitial: '현우',
    updatedAt: '2026-05-23 10:42',
    description: '통화 내용에서 보이스피싱 의심 단서 식별 후 risk_score 반환',
  },
  {
    id: 'AGT-411',
    name: '컴플라이언스 자문 챗봇',
    tenant: 'KB국민은행',
    projectName: '컴플라이언스 자문 챗봇',
    projectId: 'PRJ-118',
    domain: '컴플라이언스',
    builder: 'graph',
    stage: '학습계',
    state: '실행 중',
    mainModel: 'openai/gpt-oss-120b',
    linkedKnowledgeCount: 1,
    callsWeekly: 1820,
    p95Ms: 2640,
    customerFacing: false,
    sensitivity: 3,
    ownerName: '박서연',
    ownerInitial: '서연',
    updatedAt: '2026-05-22 14:18',
    description: '사내 규정·지침 인용형 답변 — 검색엔진 SRC-301 연동',
  },
  {
    id: 'AGT-512',
    name: '비대면 여신 사전심사 보조',
    tenant: 'KB국민은행',
    projectName: '디지털여신 보조 에이전트',
    projectId: 'PRJ-204',
    domain: '여신심사',
    builder: 'pro-code',
    stage: '서빙계',
    state: '운영 중',
    mainModel: 'aws/claude-sonnet-4.6',
    fallbackModel: 'openai/gpt-oss-120b',
    linkedKnowledgeCount: 3,
    callsWeekly: 6740,
    p95Ms: 3800,
    customerFacing: false,
    sensitivity: 4,
    ownerName: '윤지수',
    ownerInitial: '지수',
    updatedAt: '2026-05-21 11:30',
    description: '신청서·증빙 OCR + 약식 신용평가 — 심사역 보조용 (대내)',
  },
  {
    id: 'AGT-602',
    name: '카드 분실신고 응대 봇',
    tenant: 'KB국민카드',
    projectName: '카드 콜센터 응대 자동화',
    projectId: 'PRJ-CARD-008',
    domain: 'CX',
    builder: 'studio',
    stage: '서빙계',
    state: '운영 중',
    mainModel: 'google/gemma-4-31B-it-assistant',
    linkedKnowledgeCount: 1,
    callsWeekly: 32000,
    p95Ms: 920,
    customerFacing: true,
    sensitivity: 2,
    ownerName: '한지민',
    ownerInitial: '지민',
    updatedAt: '2026-05-20 09:14',
    description: '카드 분실·재발급 1차 응대 — 본인 인증 통과 시 즉시 정지 처리',
  },
  {
    id: 'AGT-708',
    name: '보험금 청구 서류 자동 분류',
    tenant: 'KB손해보험',
    projectName: '청구 자동화 1단계',
    projectId: 'PRJ-INS-031',
    domain: '운영자동화',
    builder: 'pro-code',
    stage: '학습계',
    state: '실행 중',
    mainModel: 'openai/gpt-oss-120b',
    linkedKnowledgeCount: 2,
    callsWeekly: 4180,
    p95Ms: 1750,
    customerFacing: false,
    sensitivity: 3,
    ownerName: '정우진',
    ownerInitial: '우진',
    updatedAt: '2026-05-23 13:02',
    description: '진단서·소견서·영수증 자동 분류·태깅 + 누락 항목 알림',
  },
  {
    id: 'AGT-812',
    name: '리스크 일일 브리프 봇',
    tenant: 'KB증권',
    projectName: '리스크 데일리 자동화',
    projectId: 'PRJ-SEC-014',
    domain: '리스크',
    builder: 'graph',
    stage: '서빙계',
    state: '운영 중',
    mainModel: 'azure/gpt-5.5',
    linkedKnowledgeCount: 4,
    callsWeekly: 280,
    p95Ms: 6200,
    customerFacing: false,
    sensitivity: 3,
    ownerName: '이서연',
    ownerInitial: '서연',
    updatedAt: '2026-05-22 08:00',
    description: '시장 데이터 + 리스크 한도 위반 모니터링 → 오전 브리프 자동 생성',
  },
  {
    id: 'AGT-905',
    name: '연금 상담 안내봇',
    tenant: 'KB라이프',
    projectName: '연금 가입 디지털화',
    projectId: 'PRJ-LIFE-007',
    domain: 'CX',
    builder: 'studio',
    stage: '학습계',
    state: '계획',
    mainModel: 'google/gemma-4-31B-it-assistant',
    linkedKnowledgeCount: 1,
    callsWeekly: 0,
    customerFacing: true,
    sensitivity: 2,
    ownerName: '김재훈',
    ownerInitial: '재훈',
    updatedAt: '2026-05-18 17:24',
    description: '연금 상품 비교·예상 수령액 시뮬레이션 — 학습계 검증 중',
  },
];

export const DOMAIN_TONE: Record<AgentDomain, string> = {
  CX: 'bg-info-bg text-info border-info-border',
  PB자산: 'bg-kb-yellow-tint text-ink border-kb-yellow-dark',
  컴플라이언스: 'bg-accent-purple-bg text-accent-purple border-accent-purple-border',
  여신심사: 'bg-bad-bg text-bad border-bad-border',
  리스크: 'bg-warn-bg text-warn border-warn-border',
  운영자동화: 'bg-ok-bg text-ok border-ok-border',
  마케팅: 'bg-accent-brown-bg text-accent-brown border-accent-brown-border',
};

export const TENANT_LIST: Tenant[] = [
  'KB국민은행',
  'KB증권',
  'KB손해보험',
  'KB라이프',
  'KB국민카드',
  'KB캐피탈',
  'KB자산운용',
];
