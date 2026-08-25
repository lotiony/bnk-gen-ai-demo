import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useCurrentPersona } from '@/lib/persona';

interface AdminNavItem {
  label: string;
  to: string;
  group: '모니터링' | '운영 관리';
  /** 사이드바에 표시할 짧은 부제. */
  hint?: string;
}

const NAV: AdminNavItem[] = [
  { label: '대시보드', to: '/admin/dashboard', group: '모니터링', hint: '사용·자원·안전 현황' },
  { label: '멤버 관리', to: '/admin/members', group: '운영 관리', hint: '역할·초대' },
  { label: '대표 에이전트', to: '/admin/featured-agents', group: '운영 관리', hint: '홈 노출 순서' },
];

/**
 * 관리 콘솔 공통 레이아웃 — 좌측 사이드바 + 본문 Outlet.
 * 모니터링/운영 관리 두 그룹으로 항목을 묶어 추후 운영 항목 확장에 대비.
 */
export default function AdminLayout() {
  const groups: AdminNavItem['group'][] = ['모니터링', '운영 관리'];
  const persona = useCurrentPersona();
  const displayName = persona?.name ?? '김플랫';
  const displayRole = persona?.role ?? '관리자';

  return (
    <div className="max-w-[1440px] mx-auto px-6 pt-[18px] pb-14">
      <div className="grid grid-cols-[200px_1fr] gap-5">
        {/* 좌측 사이드바 */}
        <aside className="sticky top-[110px] self-start">
          <div className="card px-3 py-3">
            <div className="px-2 pb-2 mb-2 border-b border-line-soft">
              <div className="text-[10.5px] text-ink-mid font-bold tracking-[0.3px]">
                플랫폼 관리
              </div>
              <div className="text-[13.5px] font-extrabold text-ink mt-0.5 flex items-center gap-1.5">
                관리 콘솔
                <span className="pill bg-warn-bg text-warn border border-warn-border text-[9px]">
                  🔒 MFA
                </span>
              </div>
            </div>

            {groups.map((g) => (
              <div key={g} className="mb-2 last:mb-0">
                <div className="text-[9.5px] text-ink-light font-extrabold tracking-[0.4px] uppercase px-2 pt-1 pb-1">
                  {g}
                </div>
                <ul className="space-y-0.5">
                  {NAV.filter((n) => n.group === g).map((n) => (
                    <li key={n.to}>
                      <NavLink
                        to={n.to}
                        className={({ isActive }) =>
                          cn(
                            'block rounded px-2 py-1.5 text-[12px] border-l-2 -ml-px',
                            isActive
                              ? 'bg-brand-bg text-ink font-extrabold border-brand-dark'
                              : 'border-transparent text-ink-dark hover:bg-surface-soft hover:text-ink',
                          )
                        }
                      >
                        <div className="leading-tight">{n.label}</div>
                        {n.hint && (
                          <div className="text-[10px] text-ink-mid font-semibold mt-0.5">
                            {n.hint}
                          </div>
                        )}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            <div className="mt-3 px-2 pt-2 border-t border-line-soft text-[9.5px] text-ink-light">
              {displayRole} · {displayName}
              <br />
              모든 작업은 감사 원장 기록
            </div>
          </div>
        </aside>

        {/* 본문 */}
        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
