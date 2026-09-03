/**
 * 프로젝트(레거시 계층) mock.
 *
 * ⚠️ 인물의 소속 부서는 `mockPersonas` 가 정본이다. 여기 부서명이 페르소나
 *   정의와 다르면, 같은 사람이 화면마다 다른 부서 소속으로 뜬다.
 *   `AI디지털전략부` 는 그룹 공통(김지주) 부서이므로 부산은행 과제 멤버에게
 *   붙이지 않는다 — SEC-001 의 계열사 귀속을 흐린다.
 *
 * 전부 가상 창작물이다(CLAUDE.md 절대 규칙).
 */
import type { Project } from '@/types';
import { MOCK_KNOWLEDGE_TASKS } from './mockKnowledgeTasks';
import { MOCK_PIPELINE_TASKS } from './mockPipelineTasks';
import { MOCK_MODEL_TASKS } from './mockModelTasks';
import { MOCK_AGENT_TASKS } from './mockAgentTasks';
import { MOCK_DEVENV_TASKS } from './mockDevenvTasks';

export const pbAgentProject: Project = {
  id: 'PRJ-2025-PB-001',
  name: 'PB 에이전트 프로젝트',
  status: '운영 중',
  dept: '디지털혁신부',
  pmName: '정오너',
  pmBackups: ['박서연', '이도현'],
  startDate: '2025-08-01',
  endDate: '2026-12-31',
  innovDesignation: { start: '2025-07-22', end: '2027-07-21' },
  target: '대직원',
  sensitivity: 4,
  pii: true,
  credit: true,
  callsMonthly: { value: '12K', deltaPct: 8.2 },
  costMonthly: { value: '₩0.6M', budget: '₩1.2M', deltaPct: 5.4, ptu: '₩0.42M', variable: '₩0.18M' },
  slo30d: { value: 99.42, target: 99.5, p95Resp: '2.1s', availability: '99.96%' },
  safety7d: { count: 14, deltaCount: 3, guardrailBlocks: 14, piiMasked: 218 },
  recentActivity: '2026-06-02 14:22 (정오너)',
  bizGoal:
    'PB(Private Banker)의 1차 고객 상담 업무를 지원한다. 상품 안내·시장 동향·간단한 자산 진단에 필요한 자료를 즉시 조회·요약해 답변 초안을 제공하고, PB는 고난도·고가치 상담에 집중하도록 한다.',
  painPoints: [
    'PB 1명당 평균 86건/월 상담 중 41%가 표준 응답 가능 범위',
    '상담 중 상품·시장 자료 조회에 건당 평균 7분 소요',
    '상품 정보 업데이트 반영까지 PB 교육 사이클 3주 소요',
  ],
  modality: { text: true, doc: true, voice: true, image: false, video: false },
  serviceChannel: '사내 임베드',
  dailyCalls: 410,
  expectedMAU: 820,
  slaResp: 'P95 3.0s',
  ragIndexCount: 2,
  structuredDbCount: 1,
  tasks: [],
  models: [
    {
      id: 'gpt-oss-120b',
      name: 'onprem/gpt-oss-120b',
      category: 'onprem',
      statusKey: 'ok',
      statusLabel: '정상',
      usage: [
        { env: 'train', used: 5.2, capacity: 8, unit: 'PTU' },
        { env: 'serv', used: 28, capacity: 40, unit: 'PTU' },
      ],
    },
    {
      id: 'whisper-large',
      name: 'Whisper-Large-KO',
      category: 'voice',
      statusKey: 'warn',
      statusLabel: 'EOL 임박',
      usage: [
        { env: 'train', used: 8.4, capacity: 20, unit: '시간' },
        { env: 'serv', used: 215, capacity: 500, unit: '시간' },
      ],
    },
    {
      id: 'gpt-5_5',
      name: 'onprem/qwen3-32b',
      category: 'onprem',
      statusKey: 'ok',
      statusLabel: '정상',
      usage: [
        { env: 'train', used: 0.5, capacity: 2, unit: 'PTU' },
        { env: 'serv', used: 14.5, capacity: 20, unit: 'PTU' },
      ],
    },
  ],
  members: [
    {
      title: '프로젝트 오너 그룹',
      members: [
        {
          id: 'jung-owner',
          name: '정오너',
          initial: '정',
          dept: '디지털혁신부',
          roleLabel: '프로젝트 오너',
          roleKey: 'pm',
          isLead: true,
          active: true,
        },
        {
          id: 'park-sy-pm',
          name: '박서연',
          initial: '서',
          dept: '디지털혁신부',
          roleLabel: '프로젝트 오너',
          roleKey: 'pm',
          active: true,
        },
        {
          id: 'lee-dh',
          name: '이도현',
          initial: '도',
          // 그룹 플랫폼 관리 그룹 소속 승인권자 — 계열사 과제 결재선에 든다.
          dept: '플랫폼 관리 그룹',
          roleLabel: '프로젝트 오너',
          roleKey: 'pm',
          active: true,
        },
      ],
    },
    {
      title: '개발·데이터',
      members: [
        {
          id: 'kang-dev',
          name: '강개발',
          initial: '강',
          dept: 'IT개발부',
          roleLabel: '에이전트 개발자',
          roleKey: 'dev',
          active: true,
        },
        {
          id: 'cho-db',
          name: '조디비',
          initial: '조',
          dept: '데이터관리부',
          roleLabel: '데이터 개발자',
          roleKey: 'data',
          active: true,
        },
      ],
    },
    {
      title: '프로젝트 참여',
      members: [
        {
          id: 'yoon-member',
          name: '윤참여',
          initial: '윤',
          dept: '여신기획부',
          roleLabel: '프로젝트 참여자',
          roleKey: 'pmo',
          active: true,
        },
      ],
    },
    {
      title: '서비스 사용',
      // 서비스 사용 권한은 개인이 아니라 조직 단위로 부여한다.
      members: [
        {
          id: 'grp-pb',
          name: 'PB사업부',
          initial: 'PB',
          dept: '그룹 단위 · 1,240명',
          roleLabel: '서비스 사용자',
          roleKey: 'platform',
          active: true,
        },
        {
          id: 'seo-user',
          name: '서사용',
          initial: '서',
          dept: '영업그룹',
          roleLabel: '서비스 사용자',
          roleKey: 'platform',
          active: true,
        },
      ],
    },
  ],
  traffic: {
    kpis: [
      { label: '일평균 호출', value: '410', unit: '건', tone: 'ok' },
      { label: 'P95 응답', value: '2.1', unit: 's', tone: 'warn' },
      { label: '성공률', value: '99.96', unit: '%', tone: 'ok' },
      { label: '피크 RPS', value: '14', unit: '/s', tone: 'ok' },
    ],
    daily14d: [
      { date: '05-02', train: 4, serv: 26 },
      { date: '05-03', train: 6, serv: 34 },
      { date: '05-04', train: 5, serv: 30 },
      { date: '05-05', train: 7, serv: 42 },
      { date: '05-06', train: 6, serv: 38 },
      { date: '05-07', train: 5, serv: 46 },
      { date: '05-08', train: 8, serv: 58 },
      { date: '05-09', train: 7, serv: 50 },
      { date: '05-10', train: 10, serv: 68 },
      { date: '05-11', train: 9, serv: 60 },
      { date: '05-12', train: 11, serv: 74 },
      { date: '05-13', train: 9, serv: 64 },
      { date: '05-14', train: 12, serv: 82 },
      { date: '오늘', train: 10, serv: 70, isToday: true },
    ],
    daily14dSummary: { total: '5,742건', servPct: 87, trainPct: 13, deltaPct: 6.4 },
    latency: [
      { label: 'P50', secs: '0.6초', pct: 20, tone: 'ok' },
      { label: 'P90', secs: '1.5초', pct: 50, tone: 'ok' },
      { label: 'P95', secs: '2.1초', pct: 70, tone: 'warn' },
      { label: 'P99', secs: '2.9초', pct: 88, tone: 'warn' },
      { label: '최대', secs: '4.6초', pct: 98, tone: 'bad' },
    ],
    hourly24: [
      { hour: 0, pct: 8 },
      { hour: 1, pct: 6 },
      { hour: 2, pct: 4 },
      { hour: 3, pct: 3 },
      { hour: 4, pct: 3 },
      { hour: 5, pct: 5 },
      { hour: 6, pct: 12 },
      { hour: 7, pct: 28 },
      { hour: 8, pct: 55 },
      { hour: 9, pct: 82, isPeak: true },
      { hour: 10, pct: 95, isPeak: true },
      { hour: 11, pct: 70 },
      { hour: 12, pct: 48 },
      { hour: 13, pct: 62 },
      { hour: 14, pct: 88, isPeak: true },
      { hour: 15, pct: 90, isPeak: true },
      { hour: 16, pct: 72 },
      { hour: 17, pct: 50 },
      { hour: 18, pct: 32 },
      { hour: 19, pct: 22 },
      { hour: 20, pct: 16 },
      { hour: 21, pct: 12 },
      { hour: 22, pct: 10 },
      { hour: 23, pct: 9 },
    ],
  },
};

export const projectsList = [
  {
    id: pbAgentProject.id,
    name: pbAgentProject.name,
    status: pbAgentProject.status,
    dept: '디지털혁신부',
    pmName: pbAgentProject.pmName,
    startMonth: '2025-08',
    lastActivity: '06-02 14:22',
    target: pbAgentProject.target,
    sensitivity: pbAgentProject.sensitivity,
    piiTag: '개인정보·신용정보',
    callsMonthly: pbAgentProject.callsMonthly.value,
    costMonthly: pbAgentProject.costMonthly.value,
    // 과제·참여 수는 실제 목데이터에서 파생 (하드코딩 방지).
    taskCount:
      MOCK_KNOWLEDGE_TASKS.length +
      MOCK_PIPELINE_TASKS.length +
      MOCK_MODEL_TASKS.length +
      MOCK_AGENT_TASKS.length +
      MOCK_DEVENV_TASKS.length,
    memberCount: pbAgentProject.members.reduce((s, g) => s + g.members.length, 0),
    counts: {
      knowledge: MOCK_KNOWLEDGE_TASKS.length,
      pipeline: MOCK_PIPELINE_TASKS.length + MOCK_MODEL_TASKS.length,
      agent: MOCK_AGENT_TASKS.length,
      env: MOCK_DEVENV_TASKS.length,
    },
    members: [
      { initial: '정', role: 'pm' as const, title: '정오너 (프로젝트 오너)' },
      { initial: '서', role: 'pm' as const, title: '박서연 (프로젝트 오너)' },
      { initial: '도', role: 'pm' as const, title: '이도현 (프로젝트 오너)' },
      { initial: '강', role: 'dev' as const, title: '강개발 (에이전트 개발자)' },
      { initial: '조', role: 'data' as const, title: '조디비 (데이터 개발자)' },
      { initial: '윤', role: 'pmo' as const, title: '윤참여 (프로젝트 참여자)' },
      { initial: 'PB', role: 'platform' as const, title: 'PB사업부 (서비스 사용자)' },
      { initial: '서', role: 'platform' as const, title: '서사용 (서비스 사용자)' },
    ],
    rolesSummary:
      '프로젝트 오너 3 · 에이전트 개발자 1 · 데이터 개발자 1 · 프로젝트 참여자 1 · 서비스 사용자 2',
  },
  {
    id: 'PRJ-2024-FC-001',
    name: '금융상담 에이전트 프로젝트',
    status: '운영 중' as const,
    dept: '디지털혁신부',
    pmName: '정오너',
    startMonth: '2024-04',
    lastActivity: '05-24 09:48',
    target: '대고객',
    sensitivity: 3,
    piiTag: '개인정보',
    callsMonthly: '1.8M',
    costMonthly: '₩5.5M',
    // 과제 수는 실제 과제 목데이터에서 파생 (앱 전역 과제 데이터 공유).
    taskCount:
      MOCK_KNOWLEDGE_TASKS.length +
      MOCK_PIPELINE_TASKS.length +
      MOCK_MODEL_TASKS.length +
      MOCK_AGENT_TASKS.length +
      MOCK_DEVENV_TASKS.length,
    memberCount: 3,
    counts: {
      knowledge: MOCK_KNOWLEDGE_TASKS.length,
      pipeline: MOCK_PIPELINE_TASKS.length + MOCK_MODEL_TASKS.length,
      agent: MOCK_AGENT_TASKS.length,
      env: MOCK_DEVENV_TASKS.length,
    },
    members: [
      { initial: '정', role: 'pm' as const, title: '정오너 (PM)' },
      { initial: '민', role: 'dev' as const, title: '오민지 (개발)' },
      { initial: '수', role: 'data' as const, title: '정수민 (데이터)' },
    ],
    rolesSummary: 'PM 정오너 · 에이전트 개발자 1 · 데이터 개발자 1',
  },
];
