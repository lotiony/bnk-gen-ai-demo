/**
 * RFP 요건 칩 전역 토글 — 메모리 전용 스토어.
 *
 * 화면 곳곳의 요건 번호 칩(LSM-001, "2-1 개인화" 등)은 제안서 조견표와의
 * 상호 참조 검증용이지 시연의 본문이 아니다. 구버전 HTML 프로토타입의
 * `#rfpTgl` 규약을 그대로 잇는다 — **기본 OFF**로 화면을 깨끗하게 두고,
 * "어느 요건입니까?" 질문이 나오면 상단바 토글로 켠다.
 *
 * 숨김은 CSS 한 줄로 처리한다(`body.rfp-hide .rfp-chip`) — 칩이 44곳에
 * 흩어져 있어 조건부 렌더로 바꾸면 파일마다 스토어 구독이 번진다.
 * localStorage 금지(CLAUDE.md) — 새로고침하면 기본 OFF 로 돌아온다.
 */
import { useSyncExternalStore } from 'react';

let visible = false;

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
const get = () => visible;

export function useRfpChips(): boolean {
  return useSyncExternalStore(subscribe, get, get);
}

export function toggleRfpChips(): void {
  visible = !visible;
  emit();
}
