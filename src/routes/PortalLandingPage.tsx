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
 *   위   : 무엇인가(히어로) + 누구로 들어와 있나(접속 컨텍스트)
 *   아래 : 어디로 갈 것인가 — **포털 카드 2×2 바둑판**
 *
 * 배치를 두 번 되돌렸다. ① 카드를 좌우 2단의 오른쪽에 넣었더니 옆 히어로에 눌려
 * 주인공이 제일 작아 보였고, ② 화면 폭을 전부 줬더니 한 칸이 2.9:1 이 되어
 * "선택지" 가 아니라 "배너" 로 읽혔다. 지금은 옆에 아무것도 두지 않은 채
 * 그리드 폭만 묶어 한 칸을 **약 1.25:1 의 정사각 타일**로 만든다.
 *
 * 타일이 세로로 서면서 생긴 자리에는 **그 포털에 무엇이 들어 있는지(포함 메뉴)**
 * 를 넣었다. 여백을 채우려는 장식이 아니라, "AI Studio 를 누르면 무엇이
 * 열리는가" 가 랜딩에서 답해져야 할 질문이라서다.
 *
 * 세로 리듬은 **1920×1080 에서 네 장이 한 화면에 들어오도록** 잡혀 있다.
 * 카드 수가 계정마다 다른 것이 이 화면의 시연 장면인데, 둘째 줄이 접히면
 * 그 장면이 죽는다. 히어로 크기·여백을 키울 때는 이 점을 같이 봐야 한다.
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
import { PORTAL_COUNT, type PortalDef } from '@/data/portals';
import { visibleNav, visiblePortals } from '@/lib/portalView';
import { PortalMark } from '@/components/layout/PortalSwitcher';

const AFFILIATE_COUNT = TENANTS.filter((t) => t.kind === 'affiliate').length;

export default function PortalLandingPage() {
  const persona = useCurrentPersona();
  const portals = visiblePortals(persona);

  return (
    <div className="max-w-[1400px] mx-auto px-8 pt-6 pb-8">
      {/* ═══════════ 위 — 무엇인가 · 누구인가 ═══════════ */}
      <div className="grid grid-cols-[1fr_minmax(0,340px)] gap-14 items-start mb-5">
        <div className="pt-1">
          <div className="text-[10px] font-extrabold text-brand uppercase tracking-[1.4px] mb-3">
            BNK Group Generative AI Platform
          </div>
          <h1 className="text-[33px] font-black text-ink leading-[1.14] tracking-[-1.2px]">
            하나의 공동 기반,
            <br />
            <span className="text-brand">{PORTAL_COUNT}개의 워크스페이스</span>
          </h1>
          <p className="text-[12.5px] text-ink-dark font-semibold leading-[1.65] mt-3 max-w-[520px]">
            {AFFILIATE_COUNT}개 계열사의 업무 활용 · 에이전트 제작 · 공동존 운영 · AI 거버넌스를
            하나의 접속 체계로 연결합니다.
          </p>
          {/*
            구조 설명 블록은 걷어냈지만 이 한 줄은 남긴다 — 화면 1 이 존재하는 이유가
            "공통 포털 웹 1 + 계열사 10" 구조를 각인시키는 것이기 때문이다(인프라 나-(3)).
          */}
          <span className="inline-flex mt-4 pill bg-white text-ink-mid border border-line font-mono tracking-normal">
            공통 포털 웹 1 + 계열사 {AFFILIATE_COUNT} = {AFFILIATE_COUNT + 1} Namespace · 공동존
            On-Premise
          </span>
        </div>

        <ContextPanel />
      </div>

      {/*
        ═══════════ 아래 — 어디로 갈 것인가 ═══════════

        바둑판 타일이 되도록 그리드 폭을 묶는다. 폭을 750px 로 묶으면 한 칸이
        367×300 (약 1.2:1) 이 되어 네 장이 같은 무게로 놓인다.
        (옆에 다른 블록을 두지 않는다는 원칙은 그대로다 — 가운데 정렬만 한다.)
      */}
      <div className="max-w-[750px] mx-auto">
        <div className="flex items-baseline gap-2.5 mb-1">
          <span className="text-[10px] font-extrabold text-ink-light uppercase tracking-[0.5px]">
            Select Workspace
          </span>
          <h2 className="text-[19px] font-extrabold text-ink tracking-[-0.4px]">
            접속할 포털을 선택하세요
          </h2>
          <span className="ml-auto text-[11px] text-ink-mid font-semibold">
            역할 클레임 <b className="text-ink-dark">{persona?.rfpRole ?? '-'}</b> · 접근 가능{' '}
            <b className="text-ink-dark">{portals.length}개</b>
          </span>
        </div>
        <p className="text-[11.5px] text-ink-mid font-semibold mb-3.5">
          각 포털은 독립된 메뉴 구성을 가지며, 상단의 계열사 컨텍스트를 공유합니다
        </p>

        <div
          className={cn(
            'grid gap-4',
            /* 한 장뿐이면(일반 사용자) 정사각 타일 하나를 가운데 둔다 — 두 칸으로
               펴면 다시 가로로 긴 판이 되어 다른 계정과 인상이 달라진다. */
            portals.length === 1 ? 'grid-cols-1 max-w-[367px] mx-auto' : 'grid-cols-2',
          )}
        >
          {portals.map((p, i) => (
            <PortalCard
              key={p.id}
              p={p}
              /* 3장이면 마지막 한 장을 두 칸으로 편다 — 반쪽 빈칸이 남지 않게. */
              wide={portals.length === 3 && i === 2}
            />
          ))}
        </div>

        <div className="flex items-center gap-2 mt-3.5 px-1">
          <span className="text-[12px] leading-none" aria-hidden>
            🔑
          </span>
          <p className="text-[10.5px] text-ink-mid font-semibold leading-relaxed">
            권한 밖 워크스페이스는 비활성 상태로도 노출하지 않습니다 — 계정을 바꾸면 카드 수가
            달라집니다.
          </p>
          <span className="ml-auto pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip flex-shrink-0">
            2-1
          </span>
        </div>
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
    <div className="card rounded-[10px] px-5 py-3.5">
      <div className="flex items-baseline gap-2 pb-2.5 mb-3 border-b border-line-soft">
        <h2 className="text-[12.5px] font-extrabold text-ink">접속 컨텍스트</h2>
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

      <dl className="space-y-1">
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

      {/* 설명 문장은 뺐다 — 같은 말을 계열사 행의 🔒 배지와 상단바 스위처가 이미 하고,
          패널이 길어지면 아래 카드 둘째 줄이 화면 밖으로 밀린다. */}
      <div className="mt-2.5 pt-2 border-t border-line-soft flex items-center gap-2">
        <span className="text-[10px] text-ink-mid font-semibold flex-1 truncate">
          {canSwitch ? '그룹 운영 권한 · Namespace 전환 가능' : 'IdP 클레임으로 확정 · 변경 불가'}
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
  const nav = visibleNav(persona, p);

  return (
    <button
      type="button"
      onClick={() => navigate(p.home)}
      className={cn(
        'text-left card px-6 py-5 flex flex-col min-h-[298px] group',
        /*
         * 전역 radius 스케일은 각지게 눌러 뒀다(tailwind.config — 레퍼런스 마감).
         * 랜딩은 업무 화면이 아니라 표지에 가까운 자리라 이 화면 안에서만 풀어 준다.
         * 전역 스케일을 건드리면 24장 캡처의 마감이 전부 바뀐다.
         */
        'rounded-[10px]',
        'border-line-soft hover:border-brand hover:shadow-[0_2px_16px_rgba(203,44,16,0.10)]',
        'transition-all duration-150',
        wide && 'col-span-2',
      )}
    >
      {/* 마크를 제 줄에 올려 타일 상단을 만든다 — 옆에 붙이면 다시 가로 배너로 읽힌다. */}
      <div className="flex items-start">
        <PortalMark p={p} size="xl" />
        <span className="ml-auto text-[12px] font-black text-ink-light tabular-nums leading-none mt-1">
          {p.seq}
        </span>
      </div>

      <div className="mt-3.5">
        <div className="flex items-baseline gap-2.5">
          <span className="text-[21px] font-extrabold text-ink tracking-[-0.5px] leading-tight truncate">
            {p.label}
          </span>
          <span className="text-[9px] font-extrabold text-ink-light tracking-[0.8px] whitespace-nowrap">
            {p.code}
          </span>
        </div>
        <div className="text-[12px] text-ink-mid font-semibold mt-1">{p.tagline}</div>
      </div>

      <p className="text-[12.5px] text-ink-dark font-semibold leading-[1.75] mt-3">{p.desc}</p>

      {/* 이 포털을 누르면 무엇이 열리는가 — 권한 필터를 통과한 메뉴만 나열한다(2-1). */}
      <div className="flex items-baseline gap-1.5 mt-3.5 flex-wrap">
        <span className="text-[9px] text-ink-light font-extrabold uppercase tracking-[0.4px] mr-0.5">
          포함 메뉴
        </span>
        {nav.map((n) => (
          <span
            key={n.to}
            className="pill bg-surface-soft text-ink-dark border border-line-soft whitespace-nowrap"
          >
            {n.label}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-1 mt-2 rfp-chip">
        {p.reqs.map((r) => (
          <span
            key={r}
            className="pill bg-white text-ink-mid border border-line font-mono tracking-normal"
          >
            {r}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2 mt-auto pt-3.5 border-t border-line-soft">
        <span className="text-[10.5px] text-ink-mid font-semibold truncate">
          {p.audience} · {p.nsScope === 'common' ? '공통 포털 웹' : '소속 계열사'} Namespace
        </span>
        <span className="ml-auto text-[13px] font-extrabold text-brand whitespace-nowrap group-hover:translate-x-0.5 transition-transform">
          입장 →
        </span>
      </div>
    </button>
  );
}
