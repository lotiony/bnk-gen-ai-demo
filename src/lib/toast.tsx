/**
 * 비차단 토스트 — `window.alert` 대체.
 *
 * 왜 바꾸는가 — 원본 mockup 은 미구현 동작을 `alert('… (목업)')` 로 알렸다.
 * 시연 중 이게 뜨면 ① 브라우저 모달이 화면을 막고 ② **"(목업)" 이라는 문구가
 * 발주처 화면에 그대로 노출된다.** 둘 다 발표장에서 감당할 이유가 없다.
 *
 * 상태는 메모리 스토어만 쓴다(CLAUDE.md 절대 규칙). 패턴은
 * deployApprovalStore·persona 와 동일한 useSyncExternalStore 구독형이다.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { cn } from '@/lib/utils';

export type ToastTone = 'info' | 'ok' | 'warn';

export interface ToastItem {
  id: number;
  title: string;
  body?: string;
  tone: ToastTone;
}

let items: ToastItem[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(title: string, body?: string, tone: ToastTone = 'info') {
  const id = ++seq;
  items = [...items, { id, title, body, tone }];
  emit();
  return id;
}

export function dismissToast(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
const snapshot = () => items;

export function useToasts(): ToastItem[] {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

const TONE: Record<ToastTone, string> = {
  info: 'border-info-border bg-info-bg',
  ok: 'border-ok-border bg-ok-bg',
  warn: 'border-warn-border bg-warn-bg',
};
const ICON: Record<ToastTone, string> = { info: 'ℹ', ok: '✓', warn: '⚠' };
const ICON_CLS: Record<ToastTone, string> = {
  info: 'bg-info text-white',
  ok: 'bg-ok text-white',
  warn: 'bg-warn text-white',
};

/** 전역 1개만 둔다 — Layout 에 붙어 있다. */
export function Toaster() {
  const list = useToasts();
  // 화면 녹화 자막 DIM이 하단 전체를 덮으므로 알림은 헤더 아래 우상단에 쌓는다.
  return (
    <div className="fixed right-5 top-16 z-[60] flex flex-col gap-2 w-[360px] pointer-events-none">
      {list.map((t) => (
        <ToastCard key={t.id} item={t} />
      ))}
    </div>
  );
}

function ToastCard({ item }: { item: ToastItem }) {
  useEffect(() => {
    const h = setTimeout(() => dismissToast(item.id), 4200);
    return () => clearTimeout(h);
  }, [item.id]);

  return (
    <div
      className={cn(
        'og-step pointer-events-auto border rounded shadow-md px-3.5 py-2.5 flex items-start gap-2.5',
        TONE[item.tone],
      )}
    >
      <span
        className={cn(
          'w-[18px] h-[18px] rounded-full inline-flex items-center justify-center text-[10px] font-extrabold flex-shrink-0 mt-[1px]',
          ICON_CLS[item.tone],
        )}
      >
        {ICON[item.tone]}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-extrabold text-ink leading-snug whitespace-pre-line">{item.title}</span>
        {item.body && (
          <span className="block text-[11px] text-ink-dark font-semibold leading-snug mt-0.5 whitespace-pre-line">
            {item.body}
          </span>
        )}
      </span>
      <button
        onClick={() => dismissToast(item.id)}
        className="text-ink-light hover:text-ink-mid text-[12px] leading-none flex-shrink-0"
        aria-label="닫기"
      >
        ✕
      </button>
    </div>
  );
}
