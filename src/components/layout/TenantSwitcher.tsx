import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { TENANT_LIST, TENANT_SHORT, TENANTS, type Tenant } from '@/data/tenants';
import { useTenant, setTenant } from '@/lib/tenantStore';

/**
 * Topbar 좌상단 테넌트 전환 컨트롤.
 * 클릭 시 드롭다운으로 **11개 Namespace(계열사 10 + 그룹 공통)** 전환.
 * 선택값은 메모리 스토어에만 보존한다 — 브라우저 스토리지 사용 금지.
 */
export default function TenantSwitcher() {
  const [open, setOpen] = useState(false);
  const current = useTenant();
  const rootRef = useRef<HTMLDivElement | null>(null);

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
    setTenant(t);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-md border transition-colors',
          open
            ? 'border-brand-dark bg-brand-bg'
            : 'border-transparent hover:border-line-soft hover:bg-surface-soft',
        )}
        title="Namespace 전환 (계열사 10 + 그룹 공통)"
      >
        <span className="px-1 font-black text-brand text-sm leading-none tracking-tight">
          BNK
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
              Namespace 전환
            </div>
            <div className="text-[10.5px] text-ink-light font-semibold mt-0.5">
              계열사 10 + 그룹 공통 = 11개 Namespace
            </div>
          </div>
          <ul className="py-1 max-h-[420px]">
            {TENANT_LIST.map((t) => {
              const selected = t === current;
              const meta = TENANTS.find((m) => m.name === t);
              const isGroup = meta?.kind === 'group';
              return (
                <li key={t} className={cn(isGroup && 'border-t border-line-soft mt-1 pt-1')}>
                  <button
                    type="button"
                    onClick={() => handleSelect(t)}
                    className={cn(
                      'w-full grid grid-cols-[16px_1fr_auto] items-center gap-2 px-3 py-2 text-[12px] text-left hover:bg-surface-soft',
                      selected && 'bg-brand-bg',
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
                    <span className="text-[10px] text-ink-mid font-semibold tabular-nums">
                      {meta?.namespace}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <Link
            to="/tenants"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 border-t border-line-soft text-[11px] font-extrabold text-ink-dark hover:bg-surface-soft hover:text-brand"
          >
            전체 계열사 보기 →
          </Link>
          <div className="px-3 py-2 border-t border-line-soft text-[10px] text-ink-mid">
            🔒 전환은 감사 원장에 기록됩니다
          </div>
        </div>
      )}
    </div>
  );
}
