/**
 * 관리 콘솔 > 멤버 관리 mock.
 *
 * 역할(role)은 플랫폼 전역 권한:
 *   - platform_admin: 전체 관리 콘솔·MFA 게이트·감사 원장 열람
 *   - pm:            본인이 PM인 프로젝트의 결재·운영 기안
 *   - reviewer:      결재 검토자(보안·안전·재무 등)
 *   - member:        프로젝트 멤버 — 과제 수행
 *   - viewer:        읽기 전용
 */

export type MemberRole = 'platform_admin' | 'pm' | 'reviewer' | 'member' | 'viewer';
export type MemberStatus = 'active' | 'invited' | 'suspended';

export interface AdminMember {
  id: string;
  /** 사번. */
  empNo: string;
  name: string;
  email: string;
  dept: string;
  role: MemberRole;
  status: MemberStatus;
  /** 참여 중인 프로젝트 수. */
  projectCount: number;
  /** 최근 활동 ISO 또는 한국어 짧은 형식. */
  lastSeen: string;
  /** MFA 등록 여부. */
  mfaEnabled: boolean;
}

export const ROLE_LABEL: Record<MemberRole, string> = {
  platform_admin: '플랫폼 관리자',
  pm: 'PM',
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
  {
    id: 'USR-001',
    empNo: '20180312',
    name: '김국민',
    email: 'kookmin.kim@kbfg.com',
    dept: 'AI플랫폼팀',
    role: 'platform_admin',
    status: 'active',
    projectCount: 6,
    lastSeen: '방금',
    mfaEnabled: true,
  },
  {
    id: 'USR-002',
    empNo: '20150921',
    name: '이지현',
    email: 'jihyun.lee@kbfg.com',
    dept: 'PB영업본부',
    role: 'pm',
    status: 'active',
    projectCount: 1,
    lastSeen: '12분 전',
    mfaEnabled: true,
  },
  {
    id: 'USR-003',
    empNo: '20191115',
    name: '박서준',
    email: 'seojun.park@kbfg.com',
    dept: '여신심사부',
    role: 'pm',
    status: 'active',
    projectCount: 2,
    lastSeen: '1시간 전',
    mfaEnabled: true,
  },
  {
    id: 'USR-004',
    empNo: '20200518',
    name: '최유나',
    email: 'yuna.choi@kbfg.com',
    dept: '디지털채널부',
    role: 'pm',
    status: 'active',
    projectCount: 1,
    lastSeen: '오늘 09:21',
    mfaEnabled: false,
  },
  {
    id: 'USR-005',
    empNo: '20140402',
    name: '정성호',
    email: 'sungho.jung@kbfg.com',
    dept: '정보보호부',
    role: 'reviewer',
    status: 'active',
    projectCount: 6,
    lastSeen: '3시간 전',
    mfaEnabled: true,
  },
  {
    id: 'USR-006',
    empNo: '20170811',
    name: '한지민',
    email: 'jimin.han@kbfg.com',
    dept: '준법감시부',
    role: 'reviewer',
    status: 'active',
    projectCount: 4,
    lastSeen: '어제',
    mfaEnabled: true,
  },
  {
    id: 'USR-007',
    empNo: '20210303',
    name: '오태경',
    email: 'taekyung.oh@kbfg.com',
    dept: 'AI플랫폼팀',
    role: 'member',
    status: 'active',
    projectCount: 2,
    lastSeen: '32분 전',
    mfaEnabled: true,
  },
  {
    id: 'USR-008',
    empNo: '20220115',
    name: '윤지원',
    email: 'jiwon.yoon@kbfg.com',
    dept: '여신심사부',
    role: 'member',
    status: 'active',
    projectCount: 1,
    lastSeen: '오늘 10:48',
    mfaEnabled: false,
  },
  {
    id: 'USR-009',
    empNo: '20230420',
    name: '강은영',
    email: 'eunyoung.kang@kbfg.com',
    dept: 'PB영업본부',
    role: 'member',
    status: 'invited',
    projectCount: 0,
    lastSeen: '—',
    mfaEnabled: false,
  },
  {
    id: 'USR-010',
    empNo: '20160707',
    name: '서민재',
    email: 'minjae.seo@kbfg.com',
    dept: '리스크관리부',
    role: 'viewer',
    status: 'active',
    projectCount: 3,
    lastSeen: '2일 전',
    mfaEnabled: true,
  },
  {
    id: 'USR-011',
    empNo: '20131220',
    name: '임수정',
    email: 'soojung.lim@kbfg.com',
    dept: '디지털채널부',
    role: 'member',
    status: 'suspended',
    projectCount: 0,
    lastSeen: '2026-04-12',
    mfaEnabled: false,
  },
];
