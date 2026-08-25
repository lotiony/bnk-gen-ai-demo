import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  DEFAULT_PERSONA_ID,
  findPersona,
  type Persona,
  type PersonaGroup,
} from '@/data/mockPersonas';
import { PERSONAS, getStoredPersona, setStoredPersona, clearStoredPersona } from '@/lib/persona';

const GROUPS: PersonaGroup[] = ['관리자', '개발자', '사용자'];

/**
 * Topbar 우측 사용자 칩 — 클릭 시 페르소나 전환 드롭다운.
 * 9개 페르소나(관리자 4 / 개발자 3 / 사용자 2)를 그룹별로 나눠서 표시.
 * 선택값은 localStorage 에 보존되며 새로고침 후에도 유지된다.
 */
export default function PersonaSwitcher() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<Persona>(() => findPersona(DEFAULT_PERSONA_ID)!);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setCurrent(getStoredPersona() ?? findPersona(DEFAULT_PERSONA_ID)!);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const handleSelect = (p: Persona) => {
    setCurrent(p);
    setOpen(false);
    setStoredPersona(p.id);
    // 페이지 전역 mock 데이터가 hard-coded된 이름/이니셜을 참조하는 부분이 많아
    // 페르소나 전환 효과를 확실히 반영하기 위해 새로고침.
    window.location.reload();
  };

  const handleLogout = () => {
    setOpen(false);
    clearStoredPersona();
    window.location.href = '/login';
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-2 py-1 pl-1 pr-2.5 border rounded-full bg-white transition-colors',
          open
            ? 'border-kb-yellow-dark bg-kb-yellow-bg'
            : 'border-line hover:border-kb-yellow-dark',
        )}
        title="페르소나 전환"
      >
        <span className="w-[22px] h-[22px] rounded-full bg-kb-yellow text-ink inline-flex items-center justify-center text-[10px] font-extrabold">
          {current.initial}
        </span>
        <b className="text-ink-dark text-[12.5px] leading-none">{current.name}</b>
        <span className="text-ink-mid text-[11px] leading-none">· {current.dept}</span>
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
        <div className="absolute top-full right-0 mt-1.5 w-[300px] bg-white border border-line rounded-md shadow-lg z-40 overflow-hidden">
          <div className="px-3 py-2 border-b border-line-soft bg-surface-soft/60">
            <div className="text-[10.5px] text-ink-mid font-bold tracking-[0.3px] uppercase">
              페르소나 전환
            </div>
          </div>

          <div className="py-1">
            {GROUPS.map((g) => {
              const list = PERSONAS.filter((p) => p.group === g);
              return (
                <div key={g} className="pb-1">
                  <div className="px-3 pt-2 pb-1 text-[9.5px] font-extrabold tracking-[0.4px] uppercase text-ink-light">
                    {g}
                  </div>
                  <ul>
                    {list.map((p) => {
                      const selected = p.id === current.id;
                      return (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => handleSelect(p)}
                            className={cn(
                              'w-full grid grid-cols-[28px_1fr_16px] items-center gap-2 px-3 py-2 text-left hover:bg-surface-soft',
                              selected && 'bg-kb-yellow-bg',
                            )}
                          >
                            <span
                              className={cn(
                                'w-6 h-6 rounded-full inline-flex items-center justify-center text-[10.5px] font-extrabold border',
                                selected
                                  ? 'bg-kb-yellow-dark text-white border-kb-yellow-dark'
                                  : 'bg-kb-yellow text-ink border-kb-yellow-dark',
                              )}
                            >
                              {p.initial}
                            </span>
                            <div className="min-w-0 flex items-baseline gap-1.5">
                              <span
                                className={cn(
                                  'font-extrabold text-[12px] truncate',
                                  selected ? 'text-ink' : 'text-ink-dark',
                                )}
                              >
                                {p.role}
                              </span>
                              <span className="text-[10.5px] text-ink-mid font-semibold truncate">
                                · {p.name}
                              </span>
                            </div>
                            <span
                              className={cn(
                                'text-[12px] font-extrabold justify-self-end',
                                selected ? 'text-ink' : 'text-transparent',
                              )}
                            >
                              ✓
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>

          <div className="border-t border-line-soft">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full text-left px-3 py-2 text-[12px] font-extrabold text-bad hover:bg-bad-bg"
            >
              ↩ 로그아웃
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
