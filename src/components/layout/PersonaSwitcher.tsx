import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  DEFAULT_PERSONA_ID,
  findPersona,
  PERSONA_TENANT_ORDER,
  personasByTenant,
  type Persona,
} from '@/data/mockPersonas';
import { TENANTS } from '@/data/tenants';
import { setStoredPersona, clearStoredPersona, useCurrentPersona } from '@/lib/persona';

/**
 * Topbar 우측 사용자 칩 — 클릭 시 페르소나 전환 드롭다운.
 *
 * 계정을 **계열사별로** 묶어 보여 준다. 계열사는 SSO/AD 클레임이므로 계정을
 * 바꾸면 소속 Namespace 도 함께 바뀐다(`setStoredPersona` 가 테넌트를 동기화).
 * 이것이 "계열사별 SSO 로 로그인하면 보이는 것이 달라진다" 를 시연하는 경로다.
 *
 * 선택값은 메모리 스토어에만 보존된다(새로고침 시 초기화).
 */
export default function PersonaSwitcher() {
  const [open, setOpen] = useState(false);
  /*
   * 스토어를 **구독**한다. 예전에는 로컬 state 로 복사해 두고 마운트 시 한 번만
   * 동기화했는데, 그러면 프리젠터 내비게이션처럼 코드가 페르소나를 바꿀 때
   * 상단 칩이 옛 이름을 계속 달고 있는다.
   */
  const current = useCurrentPersona() ?? findPersona(DEFAULT_PERSONA_ID)!;
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const handleSelect = (p: Persona) => {
    setOpen(false);
    setStoredPersona(p.id);
    /*
     * ⚠️ 예전 구현은 여기서 `window.location.reload()` 를 불렀다.
     *    페르소나 스토어가 메모리 전용(localStorage 금지)으로 바뀐 뒤로는
     *    새로고침이 곧 **로그아웃**이 된다 — 시연 중 페르소나를 바꾸면 로그인
     *    화면으로 튕겼다. 스토어가 구독형이라 새로고침 없이도 전 화면이 갱신된다.
     */
  };

  const handleLogout = () => {
    setOpen(false);
    /*
     * `window.location.href = '/login'` 은 HashRouter + file:// 에서 파일시스템
     * 경로로 나가 빈 화면이 된다. 스토어를 비우면 PersonaGate 가 알아서
     * 로그인 화면으로 보낸다.
     */
    clearStoredPersona();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-2 py-1 pl-1 pr-2.5 border rounded-full bg-white transition-colors',
          open
            ? 'border-brand-dark bg-brand-bg'
            : 'border-line hover:border-brand-dark',
        )}
        title="페르소나 전환"
      >
        <span className="w-[22px] h-[22px] rounded-full bg-brand-tint text-brand inline-flex items-center justify-center text-[10px] font-extrabold">
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
              계정 전환
            </div>
            <div className="text-[10px] text-ink-light font-semibold mt-0.5">
              계정을 바꾸면 소속 Namespace 도 함께 바뀝니다
            </div>
          </div>

          <div className="py-1 max-h-[440px] overflow-auto">
            {PERSONA_TENANT_ORDER.map((t) => {
              const list = personasByTenant(t);
              if (list.length === 0) return null;
              const meta = TENANTS.find((m) => m.name === t);
              return (
                <div key={t} className="pb-1">
                  <div className="px-3 pt-2 pb-1 flex items-baseline gap-1.5">
                    <span className="text-[10px] font-extrabold text-ink-dark">{t}</span>
                    <span className="text-[9px] font-mono font-semibold text-ink-light">
                      {meta?.namespace}
                    </span>
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
                              selected && 'bg-brand-bg',
                            )}
                          >
                            <span
                              className={cn(
                                'w-6 h-6 rounded-full inline-flex items-center justify-center text-[10.5px] font-extrabold border',
                                selected
                                  ? 'bg-brand-dark text-white border-brand-dark'
                                  : 'bg-brand text-white border-brand-dark',
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
                              {p.canSwitchTenant && (
                                <span className="ml-auto text-[9px] font-bold text-ink-light whitespace-nowrap">
                                  전환 가능
                                </span>
                              )}
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
