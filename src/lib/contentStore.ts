/**
 * 공지 · 게시판 — 메모리 전용 공유 스토어.
 *
 * 관리 콘솔의 「공지·게시판 관리」와 마켓플레이스의 「공지사항·커뮤니티·지식공유
 * 게시판」(RFP 2-1 [31]·[48])은 **같은 데이터**를 보는 서로 다른 화면이다.
 * 관리자가 게시글을 숨기면 마켓플레이스에서도 즉시 사라져야 하므로, 두 화면이
 * 각자 복사본을 들고 있으면 안 된다 — deployApprovalStore 와 같은 원칙.
 *
 * localStorage 를 쓰지 않는다(CLAUDE.md 절대 규칙).
 */
import { useSyncExternalStore } from 'react';
import { NOTICES, BOARD_POSTS, type Notice, type BoardPost } from '@/data/mockContent';
import { DEMO_TODAY } from '@/data/demoClock';

let notices: Notice[] = [...NOTICES];
let posts: BoardPost[] = [...BOARD_POSTS];

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function getNotices(): Notice[] {
  return notices;
}
export function useNotices(): Notice[] {
  return useSyncExternalStore(subscribe, getNotices, getNotices);
}
export function setNoticeState(id: string, state: Notice['state']): void {
  notices = notices.map((n) => (n.id === id ? { ...n, state } : n));
  emit();
}
export function addNotice(n: Notice): void {
  notices = [n, ...notices];
  emit();
}

export function getPosts(): BoardPost[] {
  return posts;
}
export function usePosts(): BoardPost[] {
  return useSyncExternalStore(subscribe, getPosts, getPosts);
}
export function setPostState(id: string, state: BoardPost['state']): void {
  posts = posts.map((p) => (p.id === id ? { ...p, state } : p));
  emit();
}
export function addPost(p: BoardPost): void {
  posts = [p, ...posts];
  emit();
}

/**
 * 새 게시글 ID · 작성일.
 *
 * 마켓플레이스의 「커뮤니티·지식공유」 글쓰기(RFP 2-1 [31])가 실제로 목록에
 * 반영되려면 ID 발번이 한 곳에 있어야 한다 — 관리 콘솔이 같은 스토어를 보므로
 * 화면마다 따로 세면 두 화면의 ID 가 어긋난다.
 */
let postSeq = 300;
export function nextPostId(): string {
  return `POST-${++postSeq}`;
}

/** 작성일 라벨 (YYYY-MM-DD) — 기존 mock 표기와 같은 형식. */
export function todayLabel(): string {
  // 세계관 기준일로 고정한다. `new Date()` 를 쓰면 시연 당일 작성한 게시글만
  // 2026-09-09 로 찍혀 나머지 목록(06-03 계열)과 어긋난다.
  return DEMO_TODAY;
}
