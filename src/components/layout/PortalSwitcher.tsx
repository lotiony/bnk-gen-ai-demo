import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useCurrentPersona } from '@/lib/persona';
import { usePortal, visiblePortals } from '@/lib/portalView';
import type { PortalDef } from '@/data/portals';

/**
 * GNB 좌측 포털 칩 — 지금 어느 워크스페이스에 있는지를 항상 띄워 두고,
 * 포털 간 이동을 여기 하나로 모은다.
 *
 * RFP 2-1 은 역할별 **워크스페이스** 제공과 "접근 가능한 워크스페이스만 노출" 을
 * 함께 요구한다. 그래서 —
 *   · 목록에는 **열리는 포털만** 담는다. 권한 밖 포털은 회색으로도 그리지 않는다.
 *   · 열리는 포털이 하나뿐이면(일반 사용자) 드롭다운 자체를 열지 않고
 *     칩만 표시한다. 고를 게 없는 목록을 여는 것은 통제가 아니라 잡음이다.
 *
 * 테넌트 스위처와 규칙이 다른 점에 주의 — 저쪽은 **잠긴 칩을 일부러 보여 준다**
 * (SEC-001 격리 증명). 이쪽은 아예 감춘다(2-1 권한 기반 화면 구성). 두 요건이
 * 서로 다른 것을 요구하므로 화면 동작도 달라야 한다.
 */
export default function PortalSwitcher() {
  const [open, setOpen] = useState(false);
  const persona = useCurrentPersona();
  const portal = usePortal();
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement | null>(null);

  const list = visiblePortals(persona);
  const multi = list.length > 1;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const go = (p: PortalDef) => {
    setOpen(false);
    navigate(p.home);
  };

  return (
    <div ref={rootRef} className="relative -ml-1.5">
      <button
        type="button"
        onClick={() => multi && setOpen((v) => !v)}
        aria-haspopup={multi}
        aria-expanded={open}
        title={
          multi
            ? `워크스페이스 전환 (접근 가능 ${list.length}개)`
            : '이 계정에 열려 있는 워크스페이스입니다'
        }
        className={cn(
          'inline-flex items-center gap-2 h-[30px] pl-1 pr-2.5 rounded-md border transition-colors',
          multi ? 'cursor-pointer' : 'cursor-default',
          open
            ? 'border-brand-dark bg-brand-bg'
            : 'border-transparent hover:border-line-soft hover:bg-surface-soft',
        )}
      >
        <PortalMark p={portal} />
        <span className="text-[12.5px] font-extrabold text-ink tracking-tight whitespace-nowrap">
          {portal.label}
        </span>
        {multi && (
          <svg
            className={cn('w-3 h-3 text-ink-mid transition-transform', open && 'rotate-180')}
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
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-[296px] bg-white border border-line rounded-md shadow-lg z-40 overflow-hidden">
          <div className="px-3 py-2 border-b border-line-soft bg-surface-soft/60">
            <div className="text-[10.5px] text-ink-mid font-bold tracking-[0.3px] uppercase">
              워크스페이스 전환
            </div>
            <div className="text-[10.5px] text-ink-light font-semibold mt-0.5">
              현재 역할 클레임으로 접근 가능한 {list.length}개
            </div>
          </div>
          <ul className="py-1">
            {list.map((p) => {
              const selected = p.id === portal.id;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => go(p)}
                    className={cn(
                      'w-full grid grid-cols-[24px_1fr] items-start gap-2 px-3 py-2 text-left hover:bg-surface-soft',
                      selected && 'bg-brand-bg',
                    )}
                  >
                    <PortalMark p={p} />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            'text-[12.5px] font-extrabold truncate',
                            selected ? 'text-ink' : 'text-ink-dark',
                          )}
                        >
                          {p.label}
                        </span>
                        {selected && (
                          <span className="text-[10px] font-extrabold text-brand">현재</span>
                        )}
                      </span>
                      <span className="block text-[10.5px] text-ink-mid font-semibold mt-0.5 leading-snug">
                        {p.tagline}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <Link
            to="/portal"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 border-t border-line-soft text-[11px] font-extrabold text-ink-dark hover:bg-surface-soft hover:text-brand"
          >
            공통 포털 랜딩 · Namespace 구조 →
          </Link>
          <div className="px-3 py-2 border-t border-line-soft text-[10px] text-ink-mid leading-snug">
            권한 밖 워크스페이스는 목록에 표시하지 않습니다 (RFP 2-1).
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 포털 1자 코드 배지 — 칩·목록·랜딩 카드가 같은 표기를 쓴다.
 *
 * 색이 `nsScope` 를 그대로 나른다 — 계열사 Namespace 에서 도는 포털은 브랜드
 * 레드, 공통 포털 웹에서 도는 포털은 먹색. 카드를 훑기만 해도 "이 둘은 계열사
 * 안, 저 둘은 계열사를 가로지른다" 가 읽힌다.
 */
const MARK_SIZE = {
  sm: 'w-6 h-6 text-[11px]',
  lg: 'w-9 h-9 text-[15px]',
  xl: 'w-11 h-11 text-[18px] rounded-md',
} as const;

export function PortalMark({
  p,
  size = 'sm',
}: {
  p: PortalDef;
  size?: keyof typeof MARK_SIZE;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded font-black flex-shrink-0',
        p.nsScope === 'common' ? 'bg-ink text-white' : 'bg-brand text-white',
        MARK_SIZE[size],
      )}
      aria-hidden
    >
      {p.initial}
    </span>
  );
}
