// ===== 도메인 타입 =====

export type RoleKey = 'pm' | 'dev' | 'data' | 'gov' | 'pmo' | 'platform';
export type EnvKey = 'train' | 'serv';
export type Sensitivity = 1 | 2 | 3 | 4;
export type ServiceTarget = '대고객' | '대직원';

export interface Member {
  id: string;
  name: string;
  initial: string;
  dept: string;
  /** 사번. 표시하지 않는 멤버는 생략 가능. */
  empNo?: string;
  roleLabel: string;
  roleKey: RoleKey;
  isLead?: boolean;
  active: boolean;
}

export interface MemberGroup {
  title: string;
  groupTag?: string;
  members: Member[];
}

export type TaskState = 'progress' | 'plan' | 'done' | 'hold';
export type TaskCategory = 'knowledge' | 'pipeline' | 'agent' | 'env';

export interface Task {
  id: string;
  name: string;
  category: TaskCategory;
  state: TaskState;
  type: string;
  ownerId: string;
}

export type ModelCategory = 'onprem' | 'csp' | 'voice';
export type ModelStatus = 'ok' | 'warn' | 'bad' | 'maint';

export interface ModelUsageBar {
  env: EnvKey;
  used: number;
  capacity: number;
  unit: string; // 'PTU' | '시간'
}

export interface ModelEntry {
  id: string;
  name: string;
  category: ModelCategory;
  statusKey: ModelStatus;
  statusLabel: string;
  usage: ModelUsageBar[];
}

export interface KpiBandItem {
  label: string;
  value: string;
  unit?: string;
  delta?: { value: string; tone: 'up' | 'down' | 'neutral' };
  sub?: string;
  tone: 'ok' | 'warn' | 'bad';
  spark?: number[];
}

export interface Project {
  id: string; // PRJ-2025-PB-001
  name: string;
  status: '운영 중' | '계획' | '폐기';
  dept: string;
  pmName: string;
  pmBackups: string[];
  startDate: string;
  endDate: string;
  innovDesignation?: { start: string; end: string };
  target: ServiceTarget;
  sensitivity: Sensitivity;
  pii: boolean;
  credit: boolean;
  callsMonthly: { value: string; deltaPct: number };
  costMonthly: { value: string; budget: string; deltaPct: number; csp: string; onprem: string };
  slo30d: { value: number; target: number; p95Resp: string; availability: string };
  safety7d: { count: number; deltaCount: number; guardrailBlocks: number; piiMasked: number };
  recentActivity: string;
  bizGoal: string;
  painPoints: string[];
  modality: { text: boolean; doc: boolean; voice: boolean; image: boolean; video: boolean };
  serviceChannel: string;
  dailyCalls: number;
  expectedMAU: number;
  slaResp: string;
  ragIndexCount: number;
  structuredDbCount: number;
  tasks: Task[];
  models: ModelEntry[];
  members: MemberGroup[];
  traffic: TrafficData;
}

export interface TrafficData {
  kpis: { label: string; value: string; unit?: string; tone: 'ok' | 'warn' | 'bad' }[];
  daily14d: { date: string; train: number; serv: number; isToday?: boolean }[];
  daily14dSummary: { total: string; servPct: number; trainPct: number; deltaPct: number };
  latency: { label: string; secs: string; pct: number; tone: 'ok' | 'warn' | 'bad' }[];
  hourly24: { hour: number; pct: number; isPeak?: boolean }[];
}

export type ApprovalCategory = 'register' | 'train' | 'serv' | 'discard' | 'policy' | 'table' | 'account' | 'redteam';
export type ApprovalState = 'pending' | 'done' | 'rejected';

export interface ApprovalItem {
  id: string;
  category: ApprovalCategory;
  title: string;
  /** 이 결재가 기안된 프로젝트명. 프로젝트 생성 결재 등 프로젝트 컨텍스트가 없는 경우 비움. */
  projectName?: string;
  draftedBy: string;
  draftedAt: string;
  stage: { current: number; total: number; label: string };
  state: ApprovalState;
  urgent?: boolean;
  mine?: boolean;
}
