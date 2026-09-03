import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useCurrentPersona } from '@/lib/persona';
import { isAffiliateConsoleAdmin } from '@/lib/personaView';
import { TENANTS } from '@/data/tenants';
import AreaGuard from './AreaGuard';

interface AdminNavItem {
  label: string;
  to: string;
  group: '모니터링' | '플랫폼 기반' | '운영 관리' | '보안 · 거버넌스' | '콘텐츠';
  /** 사이드바에 표시할 짧은 부제. */
  hint?: string;
}

const NAV: AdminNavItem[] = [
  { label: '대시보드', to: '/admin/dashboard', group: '모니터링', hint: '사용·자원·안전 현황' },
  { label: '미터링·정산', to: '/admin/metering', group: '모니터링', hint: '계열사·부서 Chargeback' },
  { label: '모델 관리', to: '/admin/models', group: '플랫폼 기반', hint: '등록·버전·외부 서빙 API' },
  { label: 'LLM Gateway', to: '/admin/gateway', group: '플랫폼 기반', hint: '단일 통로·라우팅·쿼터' },
  { label: 'Vector 저장소', to: '/admin/vector-store', group: '플랫폼 기반', hint: '제품 연동·계열사 격리' },
  { label: '플랫폼 모듈', to: '/admin/platform', group: '플랫폼 기반', hint: '모듈 구성·변경 영향도' },
  { label: '과제 관리', to: '/admin/tasks', group: '운영 관리', hint: '등록·검토·결재·이행' },
  { label: '서비스·배포 관리', to: '/admin/services', group: '운영 관리', hint: '게시·중지·공개범위' },
  {
    label: '반입 승인',
    to: '/admin/intake',
    group: '운영 관리',
    hint: '모델·데이터 반입 검사',
  },
  { label: '계열사 DRM', to: '/admin/drm', group: '운영 관리', hint: '문서보안 자동 복호화' },
  { label: '멤버 관리', to: '/admin/members', group: '운영 관리', hint: '역할·결재라인·이용권한' },
  { label: '대표 에이전트', to: '/admin/featured-agents', group: '운영 관리', hint: '홈 노출 순서' },
  { label: '가드레일 정책', to: '/admin/guardrails', group: '보안 · 거버넌스', hint: '정책·예외·위반 이력' },
  { label: '보안·감사', to: '/admin/security', group: '보안 · 거버넌스', hint: 'PII 예외·스코프·감사로그' },
  { label: '공지·게시판', to: '/admin/content', group: '콘텐츠', hint: '공지사항·게시판 모니터링' },
];

/**
 * 계열사 관리자에게 열리는 메뉴.
 *
 * 관리 콘솔의 나머지(대시보드·GPU·모델·게이트웨이·감사)는 **그룹 공동존 조망**이라
 * 계열사 관리자의 것이 아니다. 메뉴를 회색으로 두지 않고 아예 그리지 않는다 —
 * RFP 2-1 "접근 가능한 워크스페이스·메뉴·기능만 노출". 딥링크로 들어와도
 * 아래 리다이렉트가 첫 메뉴로 되돌린다.
 */
const AFFILIATE_MENU = ['/admin/metering', '/admin/services', '/admin/members'];

/**
 * 관리 콘솔 공통 레이아웃 — 좌측 사이드바 + 본문 Outlet.
 * 모니터링/운영 관리 두 그룹으로 항목을 묶어 추후 운영 항목 확장에 대비.
 */
export default function AdminLayout() {
  const persona = useCurrentPersona();
  const location = useLocation();
  const affiliate = isAffiliateConsoleAdmin(persona);
  const nav = affiliate ? NAV.filter((n) => AFFILIATE_MENU.includes(n.to)) : NAV;
  const ns = TENANTS.find((t) => t.name === persona?.tenant)?.namespace ?? '';

  if (affiliate && !AFFILIATE_MENU.some((m) => location.pathname.startsWith(m))) {
    return <Navigate to={AFFILIATE_MENU[0]} replace />;
  }

  const groups: AdminNavItem['group'][] = [
    '모니터링',
    '플랫폼 기반',
    '운영 관리',
    '보안 · 거버넌스',
    '콘텐츠',
  ];
  const displayName = persona?.name ?? '김플랫';
  const displayRole = persona?.role ?? '관리자';

  return (
    <AreaGuard area="admin">
    <div className="max-w-[1360px] mx-auto px-6 pt-[18px] pb-14">
      <div className="grid grid-cols-[200px_1fr] gap-5">
        {/* 좌측 사이드바 */}
        <aside className="sticky top-[110px] self-start">
          <div className="card px-3 py-3">
            <div className="px-2 pb-2 mb-2 border-b border-line-soft">
              <div className="text-[10.5px] text-ink-mid font-bold tracking-[0.3px]">
                {affiliate ? '계열사 관리' : '플랫폼 관리'}
              </div>
              <div className="text-[13.5px] font-extrabold text-ink mt-0.5 flex items-center gap-1.5">
                관리 콘솔
                <span className="pill bg-warn-bg text-warn border border-warn-border text-[9px]">
                  🔒 MFA
                </span>
              </div>
              {affiliate && (
                // 어디까지 보이는지를 사이드바에 박는다 — 화면마다 따로 설명하지 않아도 되게.
                <div className="mt-1.5 text-[10px] font-semibold text-ink-mid leading-snug">
                  <b className="text-ink-dark">{persona?.tenant}</b> 범위
                  <span className="font-mono text-ink-light"> · {ns}</span>
                  <br />
                  그룹 조망 메뉴는 지주 관리자 권한
                </div>
              )}
            </div>

            {groups.filter((g) => nav.some((n) => n.group === g)).map((g) => (
              <div key={g} className="mb-2 last:mb-0">
                <div className="text-[9.5px] text-ink-light font-extrabold tracking-[0.4px] uppercase px-2 pt-1 pb-1">
                  {g}
                </div>
                <ul className="space-y-0.5">
                  {nav.filter((n) => n.group === g).map((n) => (
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
    </AreaGuard>
  );
}
