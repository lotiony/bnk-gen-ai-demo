/**
 * 공통 포털 랜딩 — 로그인 직후 도착하는 화면. 핸드오프 §2 화면 1 을 대체한다.
 *
 * RFP 근거 —
 *  · 인프라 나-(3) "**공통 포털 웹**(각 계열사 접속 전 랜딩 웹페이지 개념)" 1개 +
 *                  "10개 계열사를 10개의 Namespace(tenant) 기준으로 분리"
 *  · 2-1          "역할별 **워크스페이스**(화면 구성) 제공" ·
 *                 "접근 가능한 워크스페이스·메뉴·기능만 노출"
 *  · SEC-001      테넌트 격리
 *
 * ── 화면의 뼈대 ────────────────────────────────────────────────────
 *   왼쪽  : 무엇인가(히어로) + 누구로 들어와 있나(접속 컨텍스트)
 *   오른쪽: 어디로 갈 것인가(포털 카드 2×2)
 *   아래  : 어디에서 도는가(시연 환경 밴드 — 11 Namespace 스트립)
 *
 * 좌우 2단으로 짠 이유는 **한 화면에 다 들어오게** 하기 위해서다. 시연 첫 장면에서
 * 스크롤을 내리면 심사위원 시선이 카드에서 떨어진다. 그래서 구조 설명(계열사별
 * 이용자 수·격리 원칙 서술)은 밴드 한 줄로 줄이고 관리 콘솔·마켓플레이스에 맡겼다.
 *
 * ⚠️ 카드 수는 계정마다 다르다. 권한 밖 포털은 회색으로도 그리지 않는다(2-1).
 *    일반 사용자 1장 / 관리자 4장이 뜨는 것이 이 화면의 시연 장면이다.
 *    잠긴 카드를 일부러 보여 주는 테넌트 쪽 규칙(SEC-001 격리 증명)과 다르다 —
 *    요건이 서로 다른 것을 요구하므로 화면 동작도 달라야 한다.
 */
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useCurrentPersona } from '@/lib/persona';
import { useTenant } from '@/lib/tenantStore';
import { TENANTS } from '@/data/tenants';
import { DEMO_TODAY_LABEL } from '@/data/demoClock';
import { PORTAL_COUNT, type PortalDef } from '@/data/portals';
import { visibleNav, visiblePortals } from '@/lib/portalView';
import { PortalMark } from '@/components/layout/PortalSwitcher';
import EnvironmentBand from '@/components/portal/EnvironmentBand';

const AFFILIATE_COUNT = TENANTS.filter((t) => t.kind === 'affiliate').length;

export default function PortalLandingPage() {
  const persona = useCurrentPersona();
  const portals = visiblePortals(persona);

  return (
    <div className="max-w-[1440px] mx-auto px-8 pt-8 pb-10">
      <div className="grid grid-cols-[minmax(0,392px)_1fr] gap-12 items-start">
        {/* ═══════════ 왼쪽 — 무엇인가 · 누구인가 ═══════════ */}
        <div>
          <div className="text-[10px] font-extrabold text-brand uppercase tracking-[1.4px] mb-3.5">
            BNK Group Generative AI Platform
          </div>
          <h1 className="text-[40px] font-black text-ink leading-[1.13] tracking-[-1.4px]">
            하나의 공동 기반,
            <br />
            <span className="text-brand">{PORTAL_COUNT}개의 워크스페이스</span>
          </h1>
          <p className="text-[12.5px] text-ink-dark font-semibold leading-[1.75] mt-4">
            {AFFILIATE_COUNT}개 계열사의 업무 활용, 에이전트 제작, 공동존 운영, 책임 있는 AI
            거버넌스를 하나의 접속 체계로 연결합니다. 로그인 계정의 역할 클레임에 따라 열리는
            워크스페이스가 달라집니다.
          </p>

          <div className="mt-6">
            <ContextPanel />
          </div>
        </div>

        {/* ═══════════ 오른쪽 — 어디로 갈 것인가 ═══════════ */}
        <div>
          <div className="flex items-baseline gap-2.5 mb-1">
            <span className="text-[10px] font-extrabold text-ink-light uppercase tracking-[0.5px]">
              Select Workspace
            </span>
            <h2 className="text-[18px] font-extrabold text-ink tracking-[-0.3px]">
              접속할 포털을 선택하세요
            </h2>
          </div>
          <p className="text-[11.5px] text-ink-mid font-semibold mb-4">
            각 포털은 독립된 메뉴 구성을 가지며, 상단의 계열사 컨텍스트를 공유합니다. 포털
            안에서는 그 포털의 메뉴만 보이고, 이동은 상단 워크스페이스 칩으로 합니다.
          </p>

          <div className="grid grid-cols-2 gap-3.5">
            {portals.map((p, i) => (
              <PortalCard
                key={p.id}
                p={p}
                /* 홀수로 끝나면 마지막 장을 두 칸으로 편다 — 반쪽 빈칸이 남지 않게. */
                wide={portals.length % 2 === 1 && i === portals.length - 1}
              />
            ))}
          </div>

          <div className="flex items-center gap-2 mt-3.5 px-1">
            <span className="text-[12px] leading-none" aria-hidden>
              🔑
            </span>
            <p className="text-[10.5px] text-ink-mid font-semibold leading-relaxed">
              현재 역할 클레임 <b className="text-ink-dark">{persona?.rfpRole ?? '-'}</b> 로 접근
              가능한 워크스페이스 <b className="text-ink-dark">{portals.length}개</b>만 표시합니다 —
              권한 밖 워크스페이스는 비활성 상태로도 노출하지 않습니다.
            </p>
            <span className="ml-auto pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip flex-shrink-0">
              2-1
            </span>
          </div>
        </div>
      </div>

      {/* ═══════════ 아래 — 어디에서 도는가 ═══════════ */}
      <div className="mt-9">
        <EnvironmentBand />
      </div>

      <div className="text-center text-[10px] text-ink-light font-semibold mt-5">
        본 화면의 계열사 · 사용자 · 이용량 · 평가 결과는 모두 제안 시연용 가상 데이터입니다 ·
        기준일 {DEMO_TODAY_LABEL}
      </div>
    </div>
  );
}

/* ═══════════════════════ 부품 ═══════════════════════ */

/**
 * 접속 컨텍스트 패널 — 지금 어떤 클레임으로 들어와 있는지를 한 덩어리로 보여 준다.
 *
 * ONM-001 이 "자회사별 AD 시스템과의 표준 연동" 을 요구하므로 AD 도메인과 연동
 * 방식을 계열사 값 그대로 노출한다. 계열사마다 IdP 가 달라 어댑터가 필요하다는
 * 것이 이 패널의 논점이다.
 */
function ContextPanel() {
  const persona = useCurrentPersona();
  const tenant = useTenant();
  const meta = TENANTS.find((t) => t.name === tenant);
  const canSwitch = persona?.canSwitchTenant ?? false;

  return (
    <div className="card px-5 py-4">
      <div className="flex items-baseline gap-2 pb-2.5 mb-3 border-b border-line-soft">
        <h2 className="text-[12.5px] font-extrabold text-ink">접속 컨텍스트</h2>
        <span className="ml-auto pill bg-ok-bg text-ok border border-ok-border">SSO 인증됨</span>
      </div>

      <div className="flex items-center gap-2.5 mb-3.5">
        <span className="w-9 h-9 rounded-full bg-brand-tint text-brand border border-brand-tint inline-flex items-center justify-center text-[13px] font-extrabold flex-shrink-0">
          {persona?.initial ?? '-'}
        </span>
        <div className="min-w-0">
          <div className="text-[13.5px] font-extrabold text-ink truncate">
            {persona?.name ?? '-'}
          </div>
          <div className="text-[10.5px] text-ink-mid font-semibold truncate">
            {persona?.dept ?? '-'}
          </div>
        </div>
      </div>

      <dl className="space-y-1.5">
        <Row k="계열사">
          <span className="inline-flex items-center gap-1.5">
            <b className="text-ink-dark">{tenant}</b>
            {!canSwitch && (
              <span className="text-[9.5px] font-extrabold text-warn" title="SSO 클레임 고정">
                🔒 고정
              </span>
            )}
          </span>
        </Row>
        <Row k="Namespace">
          <span className="font-mono">{meta?.namespace ?? '-'}</span>
        </Row>
        <Row k="AD 도메인">
          <span className="font-mono">{meta?.adDomain ?? '-'}</span>
        </Row>
        <Row k="인증 연동">{meta?.idp ?? '-'}</Row>
        <Row k="역할 클레임">
          <b className="text-ink-dark">{persona?.rfpRole ?? '-'}</b>
        </Row>
      </dl>

      <div className="mt-3 pt-2.5 border-t border-line-soft flex items-center gap-2">
        <span className="text-[10px] text-ink-mid font-semibold leading-snug flex-1">
          {canSwitch
            ? '그룹 운영 권한 — 상단바에서 작업 Namespace 를 전환할 수 있습니다.'
            : '소속 계열사와 역할은 IdP 클레임으로 확정되며 사용자가 바꿀 수 없습니다.'}
        </span>
        <Link
          to="/login"
          className="text-[10.5px] font-extrabold text-ink-mid hover:text-brand whitespace-nowrap"
        >
          계정 전환 →
        </Link>
      </div>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[74px_1fr] gap-2 items-baseline">
      <dt className="text-[9.5px] text-ink-light font-extrabold uppercase tracking-[0.3px]">{k}</dt>
      <dd className="text-[11px] text-ink-dark font-semibold truncate">{children}</dd>
    </div>
  );
}

/** 포털 카드 — 랜딩의 주인공. 시연에서 여기부터 손이 간다. */
function PortalCard({ p, wide }: { p: PortalDef; wide: boolean }) {
  const persona = useCurrentPersona();
  const navigate = useNavigate();
  const menuCount = visibleNav(persona, p).length;

  return (
    <button
      type="button"
      onClick={() => navigate(p.home)}
      className={cn(
        'text-left card px-6 py-5 flex flex-col min-h-[206px] group',
        'border-line-soft hover:border-brand hover:shadow-[0_2px_14px_rgba(203,44,16,0.10)]',
        'transition-all duration-150',
        wide && 'col-span-2',
      )}
    >
      <div className="flex items-start gap-3.5">
        <PortalMark p={p} size="xl" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[19px] font-extrabold text-ink tracking-[-0.4px] leading-tight truncate">
              {p.label}
            </span>
            <span className="text-[9px] font-extrabold text-ink-light tracking-[0.7px] whitespace-nowrap">
              {p.code}
            </span>
          </div>
          <div className="text-[11.5px] text-ink-mid font-semibold mt-0.5 truncate">
            {p.tagline}
          </div>
        </div>
        <span className="text-[11px] font-black text-ink-light tabular-nums leading-none mt-1">
          {p.seq}
        </span>
      </div>

      <p className="text-[12px] text-ink-dark font-semibold leading-[1.7] mt-3.5 flex-1">
        {p.desc}
      </p>

      <div className="flex flex-wrap gap-1 mt-2.5 rfp-chip">
        {p.reqs.map((r) => (
          <span
            key={r}
            className="pill bg-white text-ink-mid border border-line font-mono tracking-normal"
          >
            {r}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2 mt-3.5 pt-3 border-t border-line-soft">
        <span className="text-[10.5px] text-ink-mid font-semibold truncate">
          메뉴 {menuCount}개 · {p.audience}
        </span>
        <span className="ml-auto text-[12.5px] font-extrabold text-brand whitespace-nowrap group-hover:translate-x-0.5 transition-transform">
          입장 →
        </span>
      </div>
    </button>
  );
}
