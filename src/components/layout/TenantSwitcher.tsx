import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { TENANT_LIST, type Tenant } from '@/data/mockCatalogAgents';

const STORAGE_KEY = 'kbops:current-tenant';

/** 계열사별 짧은 표기 (KB 로고 옆 사각형 라벨). */
const TENANT_SHORT: Record<Tenant, string> = {
  KB국민은행: '국민은행',
  KB증권: '증권',
  KB손해보험: '손보',
  KB라이프: '라이프',
  KB국민카드: '카드',
  KB캐피탈: '캐피탈',
  KB자산운용: '자산운용',
};

function readStored(): Tenant {
  if (typeof window === 'undefined') return 'KB국민은행';
  const v = window.localStorage.getItem(STORAGE_KEY);
  if (v && (TENANT_LIST as readonly string[]).includes(v)) return v as Tenant;
  return 'KB국민은행';
}

/**
 * Topbar 좌상단 계열사 전환 컨트롤.
 * 클릭 시 드롭다운으로 KB 그룹 7개 계열사 전환.
 * 선택값은 localStorage에 보존.
 */
export default function TenantSwitcher() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<Tenant>('KB국민은행');
  const rootRef = useRef<HTMLDivElement | null>(null);

  // 첫 마운트 시 localStorage 로드 (SSR 안전)
  useEffect(() => {
    setCurrent(readStored());
  }, []);

  // 바깥 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const handleSelect = (t: Tenant) => {
    setCurrent(t);
    setOpen(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-md border transition-colors',
          open
            ? 'border-kb-yellow-dark bg-kb-yellow-bg'
            : 'border-transparent hover:border-line-soft hover:bg-surface-soft',
        )}
        title="계열사 전환"
      >
        <span className="bg-kb-yellow px-2.5 py-1 rounded-sm font-black text-ink text-sm leading-none">
          KB
        </span>
        <span className="text-[12.5px] font-extrabold text-ink tracking-tight">
          {TENANT_SHORT[current]}
        </span>
        <svg
          className={cn(
            'w-3 h-3 text-ink-mid transition-transform',
            open && 'rotate-180',
          )}
          viewBox="0 0 12 12"
          fill="none"
        >
          <path
            d="M3 5 L6 8 L9 5"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-[240px] bg-white border border-line rounded-md shadow-lg z-40 overflow-hidden">
          <div className="px-3 py-2 border-b border-line-soft bg-surface-soft/60">
            <div className="text-[10.5px] text-ink-mid font-bold tracking-[0.3px] uppercase">
              계열사 전환
            </div>
            <div className="text-[10.5px] text-ink-light font-semibold mt-0.5">
              선택한 계열사 범위로 데이터가 필터됩니다
            </div>
          </div>
          <ul className="py-1 max-h-[320px] overflow-y-auto">
            {TENANT_LIST.map((t) => {
              const selected = t === current;
              return (
                <li key={t}>
                  <button
                    type="button"
                    onClick={() => handleSelect(t)}
                    className={cn(
                      'w-full grid grid-cols-[16px_1fr_auto] items-center gap-2 px-3 py-2 text-[12px] text-left hover:bg-surface-soft',
                      selected && 'bg-kb-yellow-bg',
                    )}
                  >
                    <span
                      className={cn(
                        'text-[12px] font-extrabold tabular-nums',
                        selected ? 'text-ink' : 'text-transparent',
                      )}
                    >
                      ✓
                    </span>
                    <span
                      className={cn(
                        'font-extrabold truncate',
                        selected ? 'text-ink' : 'text-ink-dark',
                      )}
                    >
                      {t}
                    </span>
                    <span className="text-[10px] text-ink-mid font-semibold">
                      {TENANT_SHORT[t]}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="px-3 py-2 border-t border-line-soft text-[10px] text-ink-mid">
            🔒 전환은 감사 원장에 기록됩니다
          </div>
        </div>
      )}
    </div>
  );
}
