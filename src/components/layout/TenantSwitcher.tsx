import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { TENANT_LIST, TENANT_SHORT, TENANTS, type Tenant } from '@/data/tenants';
import { useTenant, setTenant } from '@/lib/tenantStore';
import { useCurrentPersona } from '@/lib/persona';

/**
 * Topbar 좌상단 테넌트(Namespace) 컨트롤.
 *
 * ⚠️ 아무나 계열사를 바꿀 수 있으면 SEC-001(테넌트 격리)이 화면에서 무너진다.
 *    RFP 2-1 은 계열사를 **SSO/AD 클레임**으로 확정하도록 요구하고(ONM-001),
 *    2-1 기타는 "계열사 간 데이터의 비인가 접근, 전송 및 교차 활용을 방지" 를
 *    명시한다. 그래서 —
 *
 *      · 계열사 소속 계정  → 전환 불가. 잠긴 칩 + 클레임 근거만 보여 준다.
 *      · 그룹 운영 계정    → 전환 가능. 공동존을 운영·감독하는 역할이므로
 *                            테넌트 전환 자체가 정당한 관리 기능이다.
 *
 *    선택값은 메모리 스토어에만 보존한다(브라우저 스토리지 금지).
 */
export default function TenantSwitcher() {
  const [open, setOpen] = useState(false);
  const current = useTenant();
  const persona = useCurrentPersona();
  const rootRef = useRef<HTMLDivElement | null>(null);

  const canSwitch = persona?.canSwitchTenant ?? false;
  const meta = TENANTS.find((m) => m.name === current);

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
        title={
          canSwitch
            ? 'Namespace 전환 (계열사 10 + 그룹 공통)'
            : '소속 계열사는 SSO 클레임으로 확정됩니다 — 전환할 수 없습니다'
        }
      >
        <span className="px-1 font-black text-brand text-sm leading-none tracking-tight">BNK</span>
        <span className="text-[12.5px] font-extrabold text-ink tracking-tight">
          {TENANT_SHORT[current]}
        </span>
        {canSwitch ? (
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
        ) : (
          <span className="text-[9px] leading-none text-ink-light" aria-hidden>
            🔒
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-[268px] bg-white border border-line rounded-md shadow-lg z-40 overflow-hidden">
          {canSwitch ? (
            <>
              <div className="px-3 py-2 border-b border-line-soft bg-surface-soft/60">
                <div className="text-[10.5px] text-ink-mid font-bold tracking-[0.3px] uppercase">
                  Namespace 전환
                </div>
                <div className="text-[10.5px] text-ink-light font-semibold mt-0.5">
                  계열사 10 + 그룹 공통 = 11개 Namespace
                </div>
              </div>
              <ul className="py-1 max-h-[420px] overflow-auto">
                {TENANT_LIST.map((t) => {
                  const selected = t === current;
                  const m = TENANTS.find((x) => x.name === t);
                  const isGroup = m?.kind === 'group';
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
                          {m?.namespace}
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
                공통 포털 랜딩에서 전체 보기 →
              </Link>
              <div className="px-3 py-2 border-t border-line-soft text-[10px] text-ink-mid leading-snug">
                🔒 그룹 운영 권한으로 전환합니다 — 전환은 감사 원장에 기록됩니다.
              </div>
            </>
          ) : (
            /* 계열사 소속 계정 — 전환 불가. 왜 불가한지를 근거와 함께 보여 준다. */
            <>
              <div className="px-3 py-2 border-b border-line-soft bg-surface-soft/60">
                <div className="text-[10.5px] text-ink-mid font-bold tracking-[0.3px] uppercase">
                  소속 Namespace
                </div>
              </div>
              <div className="px-3 py-2.5">
                <div className="text-[13px] font-extrabold text-ink">{current}</div>
                <div className="text-[10.5px] text-ink-mid font-mono mt-0.5">{meta?.namespace}</div>
                <dl className="mt-2.5 space-y-1">
                  <ClaimRow k="AD 도메인" v={meta?.adDomain ?? '-'} />
                  <ClaimRow k="인증 연동" v={meta?.idp ?? '-'} />
                  <ClaimRow k="계열사 클레임" v={`affiliate=${meta?.namespace ?? '-'}`} />
                  <ClaimRow k="역할 클레임" v={persona?.rfpRole ?? '-'} />
                </dl>
              </div>
              <div className="px-3 py-2 border-t border-line-soft text-[10px] text-ink-mid leading-snug">
                🔒 소속 계열사는 SSO/AD 클레임으로 확정되며 사용자가 바꿀 수 없습니다. 타 계열사
                자산은 조회·전송·교차 활용이 모두 차단됩니다.
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ClaimRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[72px_1fr] gap-2 items-baseline">
      <dt className="text-[9.5px] text-ink-light font-extrabold uppercase tracking-[0.3px]">{k}</dt>
      <dd className="text-[10.5px] text-ink-dark font-semibold font-mono truncate">{v}</dd>
    </div>
  );
}
