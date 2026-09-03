/**
 * 관리 콘솔 — 결재라인 관리 · 접속·활동 이력 mock.
 *
 * RFP 2-1 관리자 포털 37 「사용자 역할 권한 관리 화면」:
 *   "역할 조회/생성/비활성화, 권한 부여·변경, **결재라인 관리**, **접속·활동 이력 조회**"
 *
 * 전부 가상 창작물이다(CLAUDE.md 절대 규칙).
 */

export interface ApprovalLineStep {
  seq: number;
  role: string;
}

export interface ApprovalLineTemplate {
  category: string;
  desc: string;
  steps: ApprovalLineStep[];
}

export const APPROVAL_LINES: ApprovalLineTemplate[] = [
  {
    category: '과제 등록',
    desc: '계열사 과제 신규 등록 시 적용',
    steps: [
      { seq: 1, role: '부서장' },
      { seq: 2, role: '사업 관리자' },
      { seq: 3, role: 'AI거버넌스 사무국' },
    ],
  },
  {
    category: '운영계 배포',
    desc: '에이전트·모델을 운영 환경에 올릴 때 적용',
    steps: [
      { seq: 1, role: '개발 담당자(기안)' },
      { seq: 2, role: '승인권자(SoD 분리)' },
    ],
  },
  {
    category: '플랫폼 관리자 부여',
    desc: '플랫폼 관리자 역할 부여는 2인 결재 필수',
    steps: [
      { seq: 1, role: '현직 플랫폼 관리자 1' },
      { seq: 2, role: '현직 플랫폼 관리자 2' },
    ],
  },
  {
    category: '가드레일 예외',
    desc: '서비스별 가드레일 완화 예외 승인',
    steps: [
      { seq: 1, role: '정보보호 관리자' },
    ],
  },
  {
    category: '개인정보 예외조회',
    desc: 'PII 마스킹 해제 요청 승인',
    steps: [
      { seq: 1, role: '정보보호 관리자' },
      { seq: 2, role: '준법감시부' },
    ],
  },
];

export interface AccessHistoryEntry {
  at: string;
  actor: string;
  action: string;
  ip: string;
  result: '성공' | '실패';
}

export const ACCESS_HISTORY: AccessHistoryEntry[] = [
  { at: '2026-06-03 09:02:14', actor: '김플랫', action: 'SSO 로그인', ip: '10.20.1.14', result: '성공' },
  { at: '2026-06-03 08:58:02', actor: '박서연', action: '운영계 배포 승인', ip: '10.20.4.31', result: '성공' },
  { at: '2026-06-02 22:14:02', actor: 'unknown', action: 'SSO 로그인 실패 5회', ip: '203.0.113.9', result: '실패' },
  { at: '2026-06-02 17:20:41', actor: '이정우', action: '가드레일 예외 신청', ip: '10.20.7.2', result: '성공' },
  { at: '2026-06-02 14:02:10', actor: '임정보', action: '멤버 역할 변경(서민재 → 뷰어)', ip: '10.20.1.5', result: '성공' },
];
