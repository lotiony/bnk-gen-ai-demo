/**
 * 관리 콘솔 > 멤버 관리 mock.
 *
 * RFP 2-1 관리자 포털 [37] 사용자·결재라인·접속 이력 관리 / [39] 이용권한 설정.
 *
 * 역할(role)은 플랫폼 전역 권한:
 *   - platform_admin: 전체 관리 콘솔·MFA 게이트·감사 원장 열람
 *   - pm:            본인이 담당인 과제의 결재·운영 기안
 *   - reviewer:      결재 검토자(보안·안전·재무 등)
 *   - member:        과제 수행 인력
 *   - viewer:        읽기 전용
 *
 * ⚠️ **두 가지가 다른 화면과 물려 있다.**
 *   ① `tenant` — 11개 Namespace 테넌트 격리(SEC-001)를 쓰는 관리 화면에서
 *      계열사 컬럼이 없으면 "누가 어느 테넌트 사람인가"를 답할 수 없다.
 *      값은 `tenants.ts` 의 11개만 쓴다.
 *   ② `taskIds` — 참여 과제는 **과제 원장(mockAdminTasks)의 실재 ID**여야 한다.
 *      예전에는 `projectCount: 6` 같은 숫자를 직접 적어 전체 과제 수보다 많은
 *      멤버가 있었다. 지금은 배열 길이가 곧 참여 건수다.
 *
 * 명단은 데모의 주요 인물(페르소나 · 과제 기안자 · 감사 원장 행위자)과 겹치게
 * 짰다. 관리 화면에만 등장하는 이름이 늘어나면 화면끼리 다른 조직을 말하게 된다.
 *
 * 전부 가상 창작물이다(CLAUDE.md 절대 규칙).
 */
import type { Tenant } from './tenants';

export type MemberRole = 'platform_admin' | 'pm' | 'reviewer' | 'member' | 'viewer';
export type MemberStatus = 'active' | 'invited' | 'suspended';

export interface AdminMember {
  id: string;
  /** 사번. */
  empNo: string;
  name: string;
  email: string;
  /** 소속 계열사 — 테넌트 격리의 기준. */
  tenant: Tenant;
  dept: string;
  role: MemberRole;
  status: MemberStatus;
  /** 참여 중인 과제 ID — mockAdminTasks 의 실재 ID. */
  taskIds: string[];
  /** 최근 활동 ISO 또는 한국어 짧은 형식. */
  lastSeen: string;
  /** MFA 등록 여부. */
  mfaEnabled: boolean;
}

export const ROLE_LABEL: Record<MemberRole, string> = {
  platform_admin: '플랫폼 관리자',
  pm: '과제 담당',
  reviewer: '검토자',
  member: '멤버',
  viewer: '뷰어',
};

export const STATUS_LABEL: Record<MemberStatus, string> = {
  active: '활성',
  invited: '초대 대기',
  suspended: '정지',
};

export const ADMIN_MEMBERS: AdminMember[] = [
  /* ── 그룹 공통 · 플랫폼 ── */
  {
    id: 'USR-001',
    empNo: '20180312',
    name: '김플랫',
    email: 'platform.kim@bnkfg.group.local',
    tenant: '그룹 공통',
    dept: 'AI플랫폼팀',
    role: 'platform_admin',
    status: 'active',
    // 플랫폼 운영 주체라 특정 과제에 참여하지 않는다 — 전 과제의 자원·정책을 관리한다.
    taskIds: [],
    lastSeen: '방금',
    mfaEnabled: true,
  },
  {
    id: 'USR-002',
    empNo: '20140402',
    name: '임정보',
    email: 'infosec.lim@bnkfg.group.local',
    tenant: '그룹 공통',
    dept: '정보보호부',
    role: 'reviewer',
    status: 'active',
    // 개인정보 예외승인 결재자(mockSecurityGovernance) — 이행 중 과제 보안 검토.
    taskIds: ['PRJ-BS-042', 'PRJ-BS-061', 'PRJ-BS-077', 'PRJ-BS-088', 'PRJ-GC-001'],
    lastSeen: '3시간 전',
    mfaEnabled: true,
  },
  {
    id: 'USR-003',
    empNo: '20151107',
    name: '박거버',
    email: 'gov.park@bnkfg.group.local',
    tenant: '그룹 공통',
    dept: '디지털혁신부',
    role: 'reviewer',
    status: 'active',
    // 결재선 3단계 'AI거버넌스 승인' 담당.
    taskIds: ['PRJ-KN-018', 'PRJ-KN-031', 'PRJ-SV-007', 'PRJ-GC-001'],
    lastSeen: '어제',
    mfaEnabled: true,
  },
  {
    id: 'USR-004',
    empNo: '20170920',
    name: '이도현',
    email: 'dohyun.lee@bnkfg.group.local',
    tenant: '그룹 공통',
    dept: '준법지원부',
    role: 'pm',
    status: 'active',
    taskIds: ['PRJ-GC-001'],
    lastSeen: '32분 전',
    mfaEnabled: true,
  },
  {
    id: 'USR-005',
    empNo: '20160707',
    name: '서민재',
    email: 'minjae.seo@bnkfg.group.local',
    tenant: '그룹 공통',
    dept: '리스크관리부',
    role: 'viewer',
    status: 'active',
    taskIds: ['PRJ-GC-001'],
    lastSeen: '2일 전',
    mfaEnabled: true,
  },

  /* ── 부산은행 ── */
  {
    id: 'USR-006',
    empNo: '20191115',
    name: '박서연',
    email: 'seoyeon.park@bnkfg.group.local',
    tenant: '부산은행',
    dept: '여신기획부',
    role: 'pm',
    status: 'active',
    taskIds: ['PRJ-BS-042'],
    lastSeen: '1시간 전',
    mfaEnabled: true,
  },
  {
    id: 'USR-007',
    empNo: '20150921',
    name: '이지현',
    email: 'jihyun.lee@bnkfg.group.local',
    tenant: '부산은행',
    dept: 'PB영업본부',
    role: 'pm',
    status: 'active',
    taskIds: ['PRJ-BS-077'],
    lastSeen: '12분 전',
    mfaEnabled: true,
  },
  {
    id: 'USR-008',
    empNo: '20200518',
    name: '이서준',
    email: 'seojun.lee@bnkfg.group.local',
    tenant: '부산은행',
    dept: '고객만족부',
    role: 'pm',
    status: 'active',
    taskIds: ['PRJ-BS-061'],
    lastSeen: '오늘 09:21',
    mfaEnabled: false,
  },
  {
    id: 'USR-009',
    empNo: '20130118',
    name: '정오너',
    email: 'owner.jung@bnkfg.group.local',
    tenant: '부산은행',
    dept: '디지털혁신부',
    role: 'pm',
    status: 'active',
    taskIds: ['PRJ-BS-088'],
    lastSeen: '오늘 10:02',
    mfaEnabled: true,
  },
  {
    id: 'USR-010',
    empNo: '20210303',
    name: '강개발',
    email: 'dev.kang@bnkfg.group.local',
    tenant: '부산은행',
    dept: 'IT개발부',
    role: 'member',
    status: 'active',
    taskIds: ['PRJ-BS-042', 'PRJ-BS-061'],
    lastSeen: '오늘 10:48',
    mfaEnabled: true,
  },
  {
    id: 'USR-011',
    empNo: '20120826',
    name: '조디비',
    email: 'db.cho@bnkfg.group.local',
    tenant: '부산은행',
    dept: '데이터관리부',
    role: 'member',
    status: 'active',
    taskIds: ['PRJ-BS-042', 'PRJ-BS-077', 'PRJ-BS-088'],
    lastSeen: '2시간 전',
    mfaEnabled: true,
  },
  {
    id: 'USR-012',
    empNo: '20190408',
    name: '민모델',
    email: 'model.min@bnkfg.group.local',
    tenant: '부산은행',
    dept: '데이터사이언스팀',
    role: 'member',
    status: 'active',
    taskIds: ['PRJ-BS-061', 'PRJ-BS-088'],
    lastSeen: '어제',
    mfaEnabled: true,
  },
  {
    id: 'USR-013',
    empNo: '20170811',
    name: '한지민',
    email: 'jimin.han@bnkfg.group.local',
    tenant: '부산은행',
    dept: '준법감시부',
    role: 'reviewer',
    status: 'active',
    taskIds: ['PRJ-BS-042', 'PRJ-BS-088', 'PRJ-CP-007'],
    lastSeen: '어제',
    mfaEnabled: true,
  },
  {
    id: 'USR-014',
    empNo: '20220115',
    name: '서사용',
    email: 'user.seo@bnkfg.group.local',
    tenant: '부산은행',
    dept: '영업그룹',
    role: 'viewer',
    status: 'active',
    taskIds: [],
    lastSeen: '오늘 08:47',
    mfaEnabled: false,
  },
  {
    id: 'USR-015',
    empNo: '20131220',
    name: '임수정',
    email: 'soojung.lim@bnkfg.group.local',
    tenant: '부산은행',
    dept: '디지털채널부',
    role: 'member',
    status: 'suspended',
    taskIds: [],
    lastSeen: '2026-04-12',
    mfaEnabled: false,
  },

  /* ── 경남은행 ── */
  {
    id: 'USR-016',
    empNo: '20160229',
    name: '설개발',
    email: 'dev.seol@bnkfg.group.local',
    tenant: '경남은행',
    dept: 'IT기획팀',
    role: 'pm',
    status: 'active',
    taskIds: ['PRJ-KN-009', 'PRJ-KN-018', 'PRJ-KN-022'],
    lastSeen: '48분 전',
    mfaEnabled: true,
  },
  {
    id: 'USR-017',
    empNo: '20180614',
    name: '남데이터',
    email: 'data.nam@bnkfg.group.local',
    tenant: '경남은행',
    dept: '데이터기획팀',
    role: 'pm',
    status: 'active',
    taskIds: ['PRJ-KN-031'],
    lastSeen: '오늘 14:40',
    mfaEnabled: true,
  },
  {
    id: 'USR-018',
    empNo: '20200902',
    name: '문전략',
    email: 'strategy.moon@bnkfg.group.local',
    tenant: '경남은행',
    dept: '상품개발부',
    role: 'member',
    status: 'active',
    // PRJ-KN-025 는 범위 중복으로 반려됐다 — 참여 이력은 남는다.
    taskIds: ['PRJ-KN-025'],
    lastSeen: '3일 전',
    mfaEnabled: false,
  },
  {
    id: 'USR-019',
    empNo: '20230420',
    name: '하사용',
    email: 'user.ha@bnkfg.group.local',
    tenant: '경남은행',
    dept: '개인영업부',
    role: 'member',
    status: 'invited',
    taskIds: [],
    lastSeen: '—',
    mfaEnabled: false,
  },

  /* ── BNK신용정보 ── */
  // 문관제는 페르소나(ci_admin), 서신용은 AGT-731 소유자 — 카탈로그와 같은 이름.
  {
    id: 'USR-030',
    empNo: '20160218',
    name: '문관제',
    email: 'admin.moon@bnkfg.group.local',
    tenant: 'BNK신용정보',
    dept: '디지털전략팀',
    role: 'reviewer',
    status: 'active',
    taskIds: [],
    lastSeen: '방금',
    mfaEnabled: true,
  },
  {
    id: 'USR-031',
    empNo: '20190426',
    name: '서신용',
    email: 'credit.seo@bnkfg.group.local',
    tenant: 'BNK신용정보',
    dept: '신용조사부',
    role: 'pm',
    status: 'active',
    taskIds: [],
    lastSeen: '오늘 09:40',
    mfaEnabled: true,
  },
  {
    id: 'USR-032',
    empNo: '20210907',
    name: '강추심',
    email: 'chusim.kang@bnkfg.group.local',
    tenant: 'BNK신용정보',
    dept: '채권추심부',
    role: 'member',
    status: 'active',
    taskIds: [],
    lastSeen: '어제 18:20',
    mfaEnabled: false,
  },

  /* ── BNK캐피탈 · 투자증권 · 저축은행 ── */
  {
    id: 'USR-020',
    empNo: '20171003',
    name: '이정우',
    email: 'jungwoo.lee@bnkfg.group.local',
    tenant: 'BNK캐피탈',
    dept: '마케팅부',
    role: 'pm',
    status: 'active',
    taskIds: ['PRJ-CP-007'],
    lastSeen: '오늘 11:02',
    mfaEnabled: true,
  },
  {
    id: 'USR-021',
    empNo: '20190711',
    name: '정우진',
    email: 'woojin.jung@bnkfg.group.local',
    tenant: 'BNK캐피탈',
    dept: '보상지원부',
    role: 'pm',
    status: 'active',
    taskIds: ['PRJ-CP-012'],
    lastSeen: '5시간 전',
    mfaEnabled: false,
  },
  {
    id: 'USR-022',
    empNo: '20150408',
    name: '이서연',
    email: 'seoyeon.rhee@bnkfg.group.local',
    tenant: 'BNK투자증권',
    dept: '리서치센터',
    role: 'pm',
    status: 'active',
    taskIds: ['PRJ-SC-014'],
    lastSeen: '오늘 08:00',
    mfaEnabled: true,
  },
  {
    id: 'USR-023',
    empNo: '20210226',
    name: '김재훈',
    email: 'jaehoon.kim@bnkfg.group.local',
    tenant: 'BNK저축은행',
    dept: '수신관리부',
    role: 'pm',
    status: 'active',
    taskIds: ['PRJ-SV-007'],
    lastSeen: '어제',
    mfaEnabled: false,
  },

  /* ── BNK시스템 ── */
  {
    id: 'USR-024',
    empNo: '20140519',
    name: '한지훈',
    email: 'jihoon.han@bnkfg.group.local',
    tenant: 'BNK시스템',
    dept: '개발지원팀',
    role: 'pm',
    status: 'active',
    taskIds: ['PRJ-SY-003', 'PRJ-SY-018'],
    lastSeen: '오늘 17:20',
    mfaEnabled: true,
  },
  {
    id: 'USR-025',
    empNo: '20121108',
    name: '노운영',
    email: 'ops.noh@bnkfg.group.local',
    tenant: 'BNK시스템',
    dept: '서비스운영팀',
    role: 'pm',
    status: 'active',
    taskIds: ['PRJ-SY-021'],
    lastSeen: '1시간 전',
    mfaEnabled: true,
  },
  {
    id: 'USR-026',
    empNo: '20210303',
    name: '오태경',
    email: 'taekyung.oh@bnkfg.group.local',
    tenant: 'BNK시스템',
    dept: 'AI플랫폼팀',
    role: 'member',
    status: 'active',
    taskIds: ['PRJ-SY-018', 'PRJ-SY-021'],
    lastSeen: '32분 전',
    mfaEnabled: true,
  },
];
