import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useTenant } from '@/lib/tenantStore';
import { TENANTS } from '@/data/tenants';

/**
 * 제작자 워크스페이스 공통 셸 — AI Studio · 지식 · 데이터가 공유한다.
 *
 * RFP 2-1 포탈 구축 공통:
 *   "포탈 사용자의 다양한 역할(일반 사용자, 에이전트 개발자, 모델러, 데이터 담당자,
 *    운영자, 관리자 등)별 **워크스페이스(화면 구성) 제공**"
 *
 * 프로젝트 계층을 GNB 에서 내리면서, 제작자가 매일 여는 도구를 여기에 모았다.
 * 사이드바 하단에 현재 Namespace 를 항상 띄워 둔다 — 어느 계열사 맥락에서
 * 만들고 있는지가 이 화면에서 가장 중요한 정보다(SEC-001 테넌트 격리).
 */

export interface WorkspaceNavItem {
  label: string;
  to: string;
  hint: string;
  /** 사이드바 그룹. */
  group: string;
  /** 정확 매치로만 active 처리할 항목(목록 루트). */
  end?: boolean;
}

interface Props {
  /** 사이드바 헤더 상단 라벨. */
  eyebrow: string;
  /** 사이드바 헤더 제목. */
  title: string;
  /** 헤더 부제. */
  subtitle: string;
  nav: WorkspaceNavItem[];
  /** 그룹 표시 순서. */
  groups: string[];
}

export default function WorkspaceLayout({ eyebrow, title, subtitle, nav, groups }: Props) {
  const tenant = useTenant();
  const meta = TENANTS.find((t) => t.name === tenant);

  return (
    <div className="max-w-[1360px] mx-auto px-6 pt-[18px] pb-14">
      <div className="grid grid-cols-[200px_1fr] gap-5">
        <aside className="sticky top-[110px] self-start">
          <div className="card px-3 py-3">
            <div className="px-2 pb-2 mb-2 border-b border-line-soft">
              <div className="text-[10.5px] text-ink-mid font-bold tracking-[0.3px]">{eyebrow}</div>
              <div className="text-[13.5px] font-extrabold text-ink mt-0.5 leading-tight">
                {title}
              </div>
              <div className="text-[9.5px] text-ink-light font-semibold mt-1 leading-snug">
                {subtitle}
              </div>
            </div>

            {groups.map((g) => (
              <div key={g} className="mb-2 last:mb-0">
                <div className="text-[9.5px] text-ink-light font-extrabold tracking-[0.4px] uppercase px-2 pt-1 pb-1">
                  {g}
                </div>
                <ul className="space-y-0.5">
                  {nav
                    .filter((n) => n.group === g)
                    .map((n) => (
                      <li key={n.to}>
                        <NavLink
                          to={n.to}
                          end={n.end}
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
                          <div className="text-[10px] text-ink-mid font-semibold mt-0.5">
                            {n.hint}
                          </div>
                        </NavLink>
                      </li>
                    ))}
                </ul>
              </div>
            ))}

            <div className="mt-3 px-2 pt-2 border-t border-line-soft">
              <div className="text-[9.5px] text-ink-light font-extrabold uppercase tracking-[0.3px]">
                작업 Namespace
              </div>
              <div className="text-[11px] font-extrabold text-ink mt-0.5">{tenant}</div>
              <div className="text-[9.5px] text-ink-mid font-mono mt-0.5">{meta?.namespace}</div>
            </div>
          </div>
        </aside>

        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
