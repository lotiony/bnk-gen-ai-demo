/**
 * 관리 콘솔 — 공지 · 콘텐츠 · 게시판 관리 mock.
 *
 * RFP 2-1 관리자 포털:
 *   33 "어드민 포털 화면 구축(UI 기반 콘텐츠 관리, 사이트 관리, 커뮤니티 관리 포함)"
 *   48 "공지·콘텐츠·게시판 관리 화면"
 *
 * 마켓플레이스의 「공지사항 · 커뮤니티 · 지식공유 게시판」(2-1 항목 31)을 실제로
 * 만들고 관리하는 반대편(관리자) 화면이다.
 *
 * 전부 가상 창작물이다(CLAUDE.md 절대 규칙).
 */
import type { Tenant } from './tenants';

export type NoticeState = '게시 중' | '임시저장' | '종료';

export interface Notice {
  id: string;
  title: string;
  scope: '그룹 전체' | Tenant;
  author: string;
  publishedAt: string;
  pinned: boolean;
  state: NoticeState;
}

export const NOTICES: Notice[] = [
  { id: 'NTC-041', title: 'AI 플랫폼 6월 정기 점검 안내 (06-08 02:00~04:00)', scope: '그룹 전체', author: '노운영', publishedAt: '2026-06-02', pinned: true, state: '게시 중' },
  { id: 'NTC-039', title: '온프렘 신규 모델 kanana-flag-32.5B 반입 완료 안내', scope: '그룹 전체', author: '민모델', publishedAt: '2026-05-28', pinned: false, state: '게시 중' },
  { id: 'NTC-036', title: '[부산은행] 여신 규정 인덱스 개정 반영 완료', scope: '부산은행', author: '조디비', publishedAt: '2026-05-20', pinned: false, state: '게시 중' },
  { id: 'NTC-030', title: '5월 정기 보안 점검 완료 안내', scope: '그룹 전체', author: '임정보', publishedAt: '2026-05-05', pinned: false, state: '종료' },
];

export type BoardPostState = '정상' | '신고됨' | '숨김';

export interface BoardPost {
  id: string;
  board: '지식공유' | '커뮤니티';
  title: string;
  tenant: Tenant;
  author: string;
  createdAt: string;
  reportCount: number;
  state: BoardPostState;
  /** 본문 — 마켓플레이스 게시판에서 작성한 글이 담는다(선택). */
  body?: string;
}

export const BOARD_POSTS: BoardPost[] = [
  { id: 'POST-201', board: '지식공유', title: 'Graph RAG 리트리버 튜닝 노하우 공유', tenant: '그룹 공통', author: '조디비', createdAt: '2026-05-30', reportCount: 0, state: '정상' },
  { id: 'POST-198', board: '커뮤니티', title: '여신 디지털심사 과제 산출물 (PRJ-BS-042)', tenant: '부산은행', author: '박서연', createdAt: '2026-05-24', reportCount: 0, state: '정상' },
  { id: 'POST-190', board: '커뮤니티', title: '이거 그냥 광고 아닌가요?', tenant: '경남은행', author: '익명', createdAt: '2026-05-18', reportCount: 3, state: '신고됨' },
  { id: 'POST-185', board: '지식공유', title: '(삭제 처리됨) 내부 규정 원문 무단 전재', tenant: 'BNK캐피탈', author: '익명', createdAt: '2026-05-10', reportCount: 5, state: '숨김' },
];
