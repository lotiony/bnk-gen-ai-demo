/**
 * 관리 콘솔 — 계열사 · 부서 · 사용자별 이용권한 설정 mock.
 *
 * RFP 2-1 관리자 포털 39:
 *   "계열사ᆞ부서ᆞ사용자별 AI서비스 및 Agent 접근 및 이용권한 설정 기능 제공"
 *
 * 전부 가상 창작물이다(CLAUDE.md 절대 규칙).
 */
import type { Tenant } from './tenants';

export interface DeptPermission {
  tenant: Tenant;
  dept: string;
  /** 서비스 카테고리별 접근 허용 여부. */
  access: Record<string, boolean>;
}

export const SERVICE_CATEGORIES = ['여신 업무', '외환 업무', '고객 상담', '규정·컴플라이언스', '일반 사무'];

export const DEPT_PERMISSIONS: DeptPermission[] = [
  { tenant: '부산은행', dept: '여신기획부', access: { '여신 업무': true, '외환 업무': false, '고객 상담': false, '규정·컴플라이언스': true, '일반 사무': true } },
  { tenant: '부산은행', dept: '고객만족부', access: { '여신 업무': false, '외환 업무': false, '고객 상담': true, '규정·컴플라이언스': false, '일반 사무': true } },
  { tenant: '경남은행', dept: '외환사업부', access: { '여신 업무': false, '외환 업무': true, '고객 상담': false, '규정·컴플라이언스': true, '일반 사무': true } },
  { tenant: 'BNK캐피탈', dept: '마케팅부', access: { '여신 업무': false, '외환 업무': false, '고객 상담': true, '규정·컴플라이언스': false, '일반 사무': true } },
  { tenant: 'BNK신용정보', dept: '신용조사부', access: { '여신 업무': true, '외환 업무': false, '고객 상담': false, '규정·컴플라이언스': true, '일반 사무': true } },
  { tenant: 'BNK신용정보', dept: '채권추심부', access: { '여신 업무': false, '외환 업무': false, '고객 상담': true, '규정·컴플라이언스': true, '일반 사무': true } },
];

export interface UserOverride {
  name: string;
  tenant: Tenant;
  dept: string;
  /** 부서 기본값과 다르게 개별 부여/회수된 항목. */
  category: string;
  granted: boolean;
  reason: string;
}

export const USER_OVERRIDES: UserOverride[] = [
  { name: '박서준', tenant: '부산은행', dept: '여신심사부', category: '외환 업무', granted: true, reason: '외환-여신 겸직 업무 수행' },
  { name: '윤지원', tenant: '부산은행', dept: '여신심사부', category: '규정·컴플라이언스', granted: false, reason: '신규 입사자 — 3개월 제한 정책' },
  { name: '강추심', tenant: 'BNK신용정보', dept: '채권추심부', category: '여신 업무', granted: true, reason: '여신 연체 사후관리 겸직' },
];
