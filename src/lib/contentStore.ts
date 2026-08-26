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
