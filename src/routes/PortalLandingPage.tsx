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
 * 이 한 화면이 두 가지를 동시에 말한다 —
 *   ① **어디로 갈 것인가** : 역할 클레임으로 열리는 포털만 카드로 뜬다.
 *      계정을 바꾸면 카드 수가 달라지는 것이 2-1 의 시연 장면이다.
 *   ② **어디에서 도는가**  : 아래 Namespace 구역이 공통 포털 웹 1 + 계열사 10 의
 *      격리 구조를 그림으로 보여 준다(SEC-001).
 *
 * 옛 `/tenants`(계열사 선택 랜딩)를 여기에 흡수했다. 계열사는 대부분의 계정에서
 * SSO 클레임으로 이미 확정돼 있어 고를 것이 없었고, 그 상태에서 랜딩을 두 번
 * 거치면 시연 동선만 길어졌다. 지금은 **컨텍스트(계열사)는 이 화면 안에서 바뀌고,
 * 이동(포털)만 화면을 넘긴다**.
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
import NamespaceSection from '@/components/portal/NamespaceSection';

/** 카드 수에 맞춰 그리드를 좁힌다 — 한 장이 4분할 폭으로 남으면 빈 화면처럼 보인다. */
const GRID_BY_COUNT: Record<number, string> = {
  1: 'grid-cols-2',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
};

export default function PortalLandingPage() {
  const persona = useCurrentPersona();
  const portals = visiblePortals(persona);
  const affiliates = TENANTS.filter((t) => t.kind === 'affiliate').length;

  return (
    <div className="max-w-[1500px] mx-auto px-8 pt-7 pb-14">
      {/* ═══════════ 히어로 + 접속 컨텍스트 ═══════════ */}
      <div className="grid grid-cols-[1fr_352px] gap-10 items-start mb-9">
        <div className="pt-2">
          <div className="text-[10.5px] font-extrabold text-brand uppercase tracking-[1.2px] mb-3">
            BNK Group Generative AI Platform
          </div>
          <h1 className="text-[38px] font-black text-ink leading-[1.15] tracking-[-1.2px]">
            하나의 공동 기반,
            <br />
            <span className="text-brand">{PORTAL_COUNT}개의 워크스페이스</span>
          </h1>
          <p className="text-[13px] text-ink-dark font-semibold leading-relaxed mt-4 max-w-[520px]">
            {affiliates}개 계열사의 업무 활용, 에이전트 제작, 공동존 운영, 책임 있는 AI 거버넌스를
            하나의 접속 체계로 연결합니다. 로그인 계정의 역할 클레임에 따라 열리는 워크스페이스가
            달라집니다.
          </p>
          <div className="flex items-center gap-2 mt-4">
            <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal">
              공통 포털 웹 1 + 계열사 {affiliates} = {affiliates + 1} Namespace
            </span>
            <span className="pill bg-white text-ink-mid border border-line">
              기술요건 62건 · 필수 46 / 권고 16
            </span>
          </div>
        </div>

        <ContextPanel />
      </div>

      {/* ═══════════ 포털 선택 ═══════════ */}
      <div className="flex items-baseline gap-2.5 mb-1">
        <span className="text-[10.5px] font-extrabold text-ink-light uppercase tracking-[0.4px]">
          Select Workspace
        </span>
        <h2 className="text-[17px] font-extrabold text-ink tracking-tight">
          접속할 포털을 선택하세요
        </h2>
      </div>
      <p className="text-[11.5px] text-ink-mid font-semibold mb-3">
        각 포털은 독립된 메뉴 구성을 가지며, 상단의 계열사 컨텍스트를 공유합니다. 포털 안에서는
        그 포털의 메뉴만 보이고, 이동은 상단 워크스페이스 칩으로 합니다.
      </p>

      <div className={cn('grid gap-3', GRID_BY_COUNT[portals.length] ?? 'grid-cols-4')}>
        {portals.map((p) => (
          <PortalCard key={p.id} p={p} />
        ))}
      </div>

      {/*
        카드 수가 계정마다 다르다는 것을 화면이 스스로 설명한다.
        권한 밖 포털을 회색으로도 그리지 않는 것이 RFP 2-1 의 요구다.
      */}
      <div className="card px-4 py-2.5 mt-3 mb-9 flex items-center gap-2.5">
        <span className="text-[13px] leading-none" aria-hidden>
          🔑
        </span>
        <div className="text-[11px] text-ink-mid font-semibold leading-relaxed">
          현재 역할 클레임 <b className="text-ink-dark">{persona?.rfpRole ?? '-'}</b> 로 접근 가능한
          워크스페이스 <b className="text-ink-dark">{portals.length}개</b>만 표시하고 있습니다 —
          권한 밖 워크스페이스는 비활성 상태로도 노출하지 않습니다.
        </div>
        <span className="ml-auto pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip flex-shrink-0">
          2-1 권한 기반 화면 구성
        </span>
      </div>

      {/* ═══════════ Namespace 구조 ═══════════ */}
      <NamespaceSection />

      <div className="text-center text-[10.5px] text-ink-light font-semibold mt-8">
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
        <h2 className="text-[13px] font-extrabold text-ink">접속 컨텍스트</h2>
        <span className="ml-auto pill bg-ok-bg text-ok border border-ok-border">SSO 인증됨</span>
      </div>

      <div className="flex items-center gap-2.5 mb-3">
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
            ? '그룹 운영 권한 — 아래에서 작업 Namespace 를 전환할 수 있습니다.'
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
function PortalCard({ p }: { p: PortalDef }) {
  const persona = useCurrentPersona();
  const navigate = useNavigate();
  const menuCount = visibleNav(persona, p).length;

  return (
    <button
      type="button"
      onClick={() => navigate(p.home)}
      className="text-left card px-5 py-4 flex flex-col hover:border-brand-dark hover:shadow-sm transition-all group"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[11px] font-black text-ink-light tabular-nums">{p.seq}</span>
        <span className="ml-auto text-[9.5px] font-extrabold text-ink-light tracking-[0.6px]">
          {p.code}
        </span>
      </div>

      <div className="flex items-center gap-2.5 mb-1.5">
        <PortalMark p={p} size="lg" />
        <div className="min-w-0">
          <div className="text-[15.5px] font-extrabold text-ink tracking-tight leading-tight truncate">
            {p.label}
          </div>
          <div className="text-[10.5px] text-ink-mid font-semibold truncate">{p.tagline}</div>
        </div>
      </div>

      <p className="text-[11.5px] text-ink-dark font-semibold leading-relaxed mt-2 min-h-[62px]">
        {p.desc}
      </p>

      <div className="mt-2.5 pt-2.5 border-t border-line-soft space-y-1.5">
        <MetaRow k="메뉴" v={`${menuCount}개 섹션`} />
        <MetaRow k="대상" v={p.audience} />
        <MetaRow
          k="Namespace"
          v={p.nsScope === 'common' ? '공통 포털 웹' : '소속 계열사'}
        />
      </div>

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

      <div className="mt-3 pt-2.5 border-t border-line-soft text-[11.5px] font-extrabold text-brand group-hover:translate-x-0.5 transition-transform">
        입장 →
      </div>
    </button>
  );
}

function MetaRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid grid-cols-[62px_1fr] gap-2 items-baseline">
      <span className="text-[9px] text-ink-light font-extrabold uppercase tracking-[0.3px]">
        {k}
      </span>
      <span className="text-[10.5px] text-ink-mid font-semibold leading-snug">{v}</span>
    </div>
  );
}
