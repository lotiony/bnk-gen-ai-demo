/**
 * AI 거버넌스 포탈 — 관리자 기능 mock.
 *
 * RFP 2-3 「AI거버넌스 포탈 > 관리자 기능」 원문 대응:
 *   · 부서별 담당자 설정 화면 제공
 *   · 각 단계 도래 시 알림 제공(그룹웨어 메일/메신저 등)
 *   · 보고서 export 기능 제공(사업 건별 및 전체)
 *   · 필요 단계별 파일 업로드 기능 제공
 * 및 「Flow Diagram」 원문 대응:
 *   · 기존 시스템(ex. ITSM)간 연동 감안한 확장성 제공
 *     * 각 단계별 타시스템의 트리거 추가 입력 On/Off 설정
 *
 * ⚠️ 계열사별로 절차가 다르다는 점이 이 화면의 핵심이다.
 *    RFP 인프라 나-(3): "결재프로세스를 위한 웹 서비스는 **회사별 일부 절차가
 *    상이하므로** 10개 Namespace 개별 웹 또는 통합 웹 서비스 내 그룹 공통
 *    서비스형태로 구축가능". 그래서 담당자·알림·트리거를 테넌트별로 나눠 둔다.
 *
 * 전부 가상 창작물이다(CLAUDE.md 절대 규칙).
 */
import type { LifecycleStage } from './mockAiGovernance';
import type { Tenant } from './tenants';

/* ═══════════════════════ 부서별 담당자 ═══════════════════════ */

export interface StageOwner {
  stage: LifecycleStage;
  /** 담당 부서. */
  dept: string;
  /** 1차 담당자. */
  owner: string;
  /** 부재 시 대리. */
  backup: string;
  /** 담당자 지정일. */
  assignedAt: string;
}

/**
 * 테넌트별 단계 담당자.
 * 그룹 공통은 사무국이 전 단계를 잡고, 계열사는 자기 조직 부서명을 쓴다.
 */
export const STAGE_OWNERS: Record<string, StageOwner[]> = {
  '그룹 공통': [
    { stage: 'plan', dept: 'AI거버넌스 사무국', owner: '박거버', backup: '한정책', assignedAt: '2026-03-30' },
    { stage: 'build', dept: '정보보호부', owner: '임정보', backup: '노보안', assignedAt: '2026-03-30' },
    { stage: 'assess', dept: '리스크관리부', owner: '서리스크', backup: '민평가', assignedAt: '2026-04-06' },
    { stage: 'operate', dept: 'AI디지털전략부', owner: '김플랫', backup: '정오너', assignedAt: '2026-04-06' },
    { stage: 'retire', dept: 'AI거버넌스 사무국', owner: '박거버', backup: '한정책', assignedAt: '2026-03-30' },
  ],
  부산은행: [
    { stage: 'plan', dept: '디지털혁신부', owner: '오기획', backup: '차등록', assignedAt: '2026-04-27' },
    { stage: 'build', dept: 'IT개발부', owner: '강개발', backup: '표구축', assignedAt: '2026-04-27' },
    { stage: 'assess', dept: '리스크관리부', owner: '천검증', backup: '유평가', assignedAt: '2026-05-04' },
    { stage: 'operate', dept: '디지털혁신부', owner: '오기획', backup: '남운영', assignedAt: '2026-05-04' },
    { stage: 'retire', dept: '준법감시부', owner: '허준법', backup: '차등록', assignedAt: '2026-05-11' },
  ],
  경남은행: [
    { stage: 'plan', dept: '디지털전략팀', owner: '문전략', backup: '배기획', assignedAt: '2026-06-01' },
    { stage: 'build', dept: 'IT기획팀', owner: '설개발', backup: '주구축', assignedAt: '2026-06-01' },
    // 경남은행은 평가·검증을 리스크가 아니라 준법에서 본다 — 계열사별 절차 상이 사례.
    { stage: 'assess', dept: '준법지원팀', owner: '위준법', backup: '연검증', assignedAt: '2026-06-01' },
    { stage: 'operate', dept: '디지털전략팀', owner: '문전략', backup: '탁운영', assignedAt: '2026-06-01' },
    { stage: 'retire', dept: '준법지원팀', owner: '위준법', backup: '연검증', assignedAt: '2026-06-01' },
  ],
};

/** 담당자 미지정 계열사는 그룹 공통 담당자가 대행한다. */
export const OWNER_FALLBACK_NOTE =
  '담당자 미지정 계열사는 그룹 공통 사무국이 대행한다 (온보딩 완료 시 계열사 담당자로 이관)';

export function getStageOwners(tenant: Tenant): { rows: StageOwner[]; delegated: boolean } {
  const own = STAGE_OWNERS[tenant];
  if (own) return { rows: own, delegated: false };
  return { rows: STAGE_OWNERS['그룹 공통'], delegated: true };
}

/* ═══════════════════════ 단계 도래 알림 ═══════════════════════ */

export type NotifyChannel = 'mail' | 'messenger' | 'portal';

export const CHANNEL_LABEL: Record<NotifyChannel, string> = {
  mail: '그룹웨어 메일',
  messenger: '그룹웨어 메신저',
  portal: '포탈 알림함',
};

export interface NotifyRule {
  stage: LifecycleStage;
  /** 언제 쏘는가. */
  trigger: string;
  channels: NotifyChannel[];
  /** 기본 On/Off. */
  enabled: boolean;
  /** 최근 30일 발송 건수. */
  sent30d: number;
}

export const NOTIFY_RULES: NotifyRule[] = [
  { stage: 'plan', trigger: '서비스 등록서 기안 시', channels: ['mail', 'portal'], enabled: true, sent30d: 12 },
  { stage: 'build', trigger: '데이터 권원 확인서 미제출 D-3', channels: ['mail', 'messenger'], enabled: true, sent30d: 7 },
  { stage: 'assess', trigger: '영향평가 결재 상신 시', channels: ['mail', 'messenger', 'portal'], enabled: true, sent30d: 9 },
  { stage: 'operate', trigger: '연 1회 재평가 기일 D-30 / D-7 / 당일', channels: ['mail', 'messenger', 'portal'], enabled: true, sent30d: 34 },
  { stage: 'operate', trigger: '재평가 기일 경과(에스컬레이션: 부서장 참조)', channels: ['mail', 'messenger'], enabled: true, sent30d: 5 },
  { stage: 'retire', trigger: '데이터 파기 증빙 미첨부 D-7', channels: ['mail'], enabled: false, sent30d: 0 },
];

/* ═══════════════════════ 타시스템 트리거 (ITSM 등) ═══════════════════════ */

export interface SystemTrigger {
  stage: LifecycleStage;
  /** 연동 대상 시스템. */
  system: string;
  /** 무엇을 주고받는가. */
  direction: 'inbound' | 'outbound';
  desc: string;
  enabled: boolean;
  /** 인터페이스 방식 — 표준 연계 방식 지원(2-1 기타) 근거. */
  iface: string;
}

export const SYSTEM_TRIGGERS: SystemTrigger[] = [
  {
    stage: 'plan',
    system: 'ITSM',
    direction: 'outbound',
    desc: '서비스 등록 승인 시 ITSM 변경요청(RFC) 자동 생성',
    enabled: true,
    iface: 'REST / JSON',
  },
  {
    stage: 'build',
    system: '정보보호 심의시스템',
    direction: 'outbound',
    desc: '가드레일 정책 승인 시 개인정보 영향평가 접수 요청 전송',
    enabled: true,
    iface: 'REST / JSON',
  },
  {
    stage: 'assess',
    system: 'ITSM',
    direction: 'inbound',
    desc: 'ITSM 변경 승인 결과를 평가 단계 관문 통과 조건으로 수신',
    enabled: true,
    iface: 'Webhook',
  },
  {
    stage: 'operate',
    system: '그룹웨어 결재',
    direction: 'outbound',
    desc: '연 1회 재평가 기일 도래 시 결재 문서 자동 기안',
    enabled: true,
    iface: 'EAI',
  },
  {
    stage: 'operate',
    system: '통합 관제(NMS)',
    direction: 'outbound',
    desc: '위험등급 「고」 서비스의 지표 이상 시 관제 이벤트 발행',
    enabled: false,
    iface: 'SNMP Trap',
  },
  {
    stage: 'retire',
    system: '기록관리시스템',
    direction: 'outbound',
    desc: '원장 종료 처리 시 보존 대상 기록 이관 요청',
    enabled: false,
    iface: 'REST / JSON',
  },
];

/* ═══════════════════════ 단계별 첨부 ═══════════════════════ */

export interface StageAttachment {
  stage: LifecycleStage;
  /** 제출해야 하는 서류명. */
  docName: string;
  required: boolean;
  /** 허용 포맷. */
  formats: string;
  /** 현재 제출 건수 / 대상 건수. */
  submitted: number;
  total: number;
}

export const STAGE_ATTACHMENTS: StageAttachment[] = [
  { stage: 'plan', docName: '고영향 해당 여부 판단서', required: true, formats: 'HWP · PDF', submitted: 18, total: 18 },
  { stage: 'plan', docName: '내부 위험등급 분류표', required: true, formats: 'XLSX', submitted: 18, total: 18 },
  { stage: 'build', docName: '데이터 권원 확인서', required: true, formats: 'HWP · PDF', submitted: 14, total: 16 },
  { stage: 'build', docName: '가드레일 정책서', required: true, formats: 'PDF', submitted: 16, total: 16 },
  { stage: 'assess', docName: '영향평가서', required: true, formats: 'HWP · PDF', submitted: 6, total: 7 },
  { stage: 'assess', docName: '레드팀 결과서', required: true, formats: 'PDF', submitted: 7, total: 7 },
  { stage: 'assess', docName: '외부 자문 의견서', required: false, formats: 'PDF · DOCX', submitted: 3, total: 7 },
  { stage: 'operate', docName: '연간 재평가서', required: true, formats: 'HWP · PDF', submitted: 9, total: 12 },
  { stage: 'retire', docName: '데이터 파기 증빙', required: true, formats: 'PDF · 이미지', submitted: 2, total: 2 },
];

/* ═══════════════════════ 보고서 Export ═══════════════════════ */

export interface ReportTemplate {
  id: string;
  name: string;
  /** 사업 건별인지 전체인지 — RFP가 둘 다 요구한다. */
  scope: '건별' | '전체';
  desc: string;
  formats: string[];
  /** 마지막 산출 시각. */
  lastRunAt?: string;
}

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'RPT-CASE-01',
    name: 'AI 서비스 거버넌스 이력서',
    scope: '건별',
    desc: '서비스 1건의 등록–개발–평가–운영–종료 전 이력과 결재·첨부를 한 문서로 묶는다',
    formats: ['PDF', 'HWP'],
    lastRunAt: '2026-06-02 17:20',
  },
  {
    id: 'RPT-CASE-02',
    name: '영향평가 결과 요약서',
    scope: '건별',
    desc: '고영향 판정 서비스의 영향평가·위험관리방안·잔여 위험을 요약한다',
    formats: ['PDF'],
    lastRunAt: '2026-06-01 09:44',
  },
  {
    id: 'RPT-ALL-01',
    name: '그룹 AI 서비스 현황 총괄표',
    scope: '전체',
    desc: '전 계열사 등록 서비스를 위험등급·진행단계·서비스유형 축으로 집계한다',
    formats: ['XLSX', 'PDF'],
    lastRunAt: '2026-06-03 08:00',
  },
  {
    id: 'RPT-ALL-02',
    name: '연 1회 모니터링 이행 현황',
    scope: '전체',
    desc: '재평가 기일 도래·경과 건을 계열사별로 집계해 이사회 보고에 쓴다',
    formats: ['XLSX', 'PDF'],
    lastRunAt: '2026-06-03 08:00',
  },
  {
    id: 'RPT-ALL-03',
    name: '감독기관 제출용 대장',
    scope: '전체',
    desc: '고영향 인공지능 목록과 안전성 확보 조치 이행 내역을 제출 서식으로 산출한다',
    formats: ['XLSX'],
  },
];
