import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useTenant } from '@/lib/tenantStore';
import { TENANTS } from '@/data/tenants';
import AreaGuard from './AreaGuard';

/**
 * AI 거버넌스 포탈 전용 셸.
 *
 * RFP 2-3 원문: "AI플랫폼 포탈 내 **별도 기능**으로 'AI거버넌스 포탈' 구축".
 * 인프라 나-(3): "결재프로세스를 위한 웹 서비스는 회사별 일부 절차가 상이하므로
 * 10개 Namespace 개별 웹 또는 통합 웹 서비스 내 그룹 공통 서비스형태로 구축가능".
 *
 * 그래서 관리 콘솔(AdminLayout)의 하위 탭이 아니라 **최상위 독립 포탈**로 뺀다.
 * 관리 콘솔과 시각적으로 구분되도록 사이드바 헤더를 다르게 잡았다.
 */

interface GovNavItem {
  label: string;
  to: string;
  hint: string;
}

const NAV: GovNavItem[] = [
  { label: '원장 · 라이프사이클', to: '/governance', hint: '등록·관문·위험·기일' },
  { label: '포탈 관리', to: '/governance/admin', hint: '담당자·알림·트리거·보고서' },
];

export default function GovernanceLayout() {
  const tenant = useTenant();
  const meta = TENANTS.find((t) => t.name === tenant);

  return (
    <AreaGuard area="governance">
    <div className="max-w-[1360px] mx-auto px-6 pt-[18px] pb-14">
      <div className="grid grid-cols-[200px_1fr] gap-5">
        <aside className="sticky top-[110px] self-start">
          <div className="card px-3 py-3">
            <div className="px-2 pb-2 mb-2 border-b border-line-soft">
              <div className="text-[10.5px] text-ink-mid font-bold tracking-[0.3px]">
                별도 포탈
              </div>
              <div className="text-[13.5px] font-extrabold text-ink mt-0.5 leading-tight">
                AI 거버넌스 포탈
              </div>
              <div className="text-[9.5px] text-ink-light font-semibold mt-1 leading-snug">
                AI기본법 대응 · 그룹 원장
              </div>
            </div>

            <ul className="space-y-0.5">
              {NAV.map((n) => (
                <li key={n.to}>
                  <NavLink
                    to={n.to}
                    end={n.to === '/governance'}
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
                    <div className="text-[10px] text-ink-mid font-semibold mt-0.5">{n.hint}</div>
                  </NavLink>
                </li>
              ))}
            </ul>

            <div className="mt-3 px-2 pt-2 border-t border-line-soft">
              <div className="text-[9.5px] text-ink-light font-extrabold uppercase tracking-[0.3px]">
                적용 절차
              </div>
              <div className="text-[11px] font-extrabold text-ink mt-0.5">{tenant}</div>
              <div className="text-[9.5px] text-ink-mid font-mono mt-0.5">{meta?.namespace}</div>
              <div className="text-[9.5px] text-ink-light font-semibold mt-1.5 leading-snug">
                계열사별로 결재 절차가 일부 다르다 — 상단 Namespace 전환 시 담당자·결재선이
                바뀐다.
              </div>
            </div>
          </div>
        </aside>

        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
    </AreaGuard>
  );
}
