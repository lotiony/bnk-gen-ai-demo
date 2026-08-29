/**
 * 공통 포털 랜딩의 Namespace 구역 — 옛 `TenantLandingPage` 의 본문을 옮겨 왔다.
 *
 * RFP: Ⅱ.3.나(3) 11개 Namespace(계열사 10 + 공통 포털 웹 1) · SEC-001 테넌트 격리
 *
 * 이 구역의 목적은 고르게 하는 게 아니라 **구조를 각인시키는 것**이다.
 * 그래서 ① 클러스터 한 덩어리 안에 11칸이 나뉜 그림을 먼저 보여주고,
 * ② 카드마다 Namespace 식별자를 그대로 노출하고,
 * ③ 하단에 "그래서 서로 못 본다" 는 격리 원칙을 붙인다.
 *
 * ── 옛 화면과 달라진 점 ─────────────────────────────────────────────
 * 예전에는 계열사 카드를 누르면 **포털 홈으로 이동**했다. 포털 선택 층이
 * 생기면서 그 역할이 위쪽 포털 카드로 넘어갔으므로, 여기서는 **작업 컨텍스트만
 * 바꾸고 랜딩에 머문다**. 순서가 "① 어느 계열사 맥락에서 ② 어느 포털로" 가 되어
 * 그룹 운영 계정의 동선이 한 화면에서 끝난다.
 *
 * ⚠️ **아무 카드나 열리면 안 된다.** 소속 계열사는 SSO/AD 클레임으로 확정되며
 *    사용자가 바꿀 수 없다(RFP 2-1 · ONM-001). 상단 `TenantSwitcher` 가 이미 같은
 *    규칙으로 잠겨 있으므로, 이 구역이 다르게 동작하면 SEC-001 이 화면에서
 *    거짓말을 하게 된다. 그래서 판정을 스위처와 **똑같이** 맞춘다 —
 *    `canSwitchTenant` 가 아닌 계정은 자기 Namespace 하나만 열린다.
 *    잠긴 카드를 눌러 보게 두는 것은 의도된 시연 장면이다(SEC-001 증명).
 */
import { cn } from '@/lib/utils';
import { setTenant, useTenant } from '@/lib/tenantStore';
import { useCurrentPersona } from '@/lib/persona';
import { toast } from '@/lib/toast';
import { TENANTS, type Tenant } from '@/data/tenants';
import {
  GROUP_CARD,
  AFFILIATE_CARDS,
  TENANT_CARDS,
  TENANT_STATUS_META,
  ISOLATION_NOTES,
  CLUSTER_SUMMARY,
  type TenantCard,
} from '@/data/mockTenantLanding';

const fmt = (n: number) => n.toLocaleString('ko-KR');

export default function NamespaceSection() {
  const persona = useCurrentPersona();
  const active = useTenant();

  /** 공동존을 운영·감독하는 그룹 역할만 Namespace 를 넘나든다. */
  const canSwitch = persona?.canSwitchTenant ?? false;
  /** SSO/AD 클레임으로 확정된 소속 계열사. */
  const homeTenant = persona?.tenant ?? null;
  const isLocked = (t: Tenant) => !canSwitch && t !== homeTenant;

  const pick = (t: Tenant) => {
    if (isLocked(t)) {
      // 이동시키지 않는다. 왜 막혔는지를 클레임 값과 함께 알린다(SEC-001).
      const meta = TENANTS.find((m) => m.name === homeTenant);
      toast(
        `${t} Namespace 는 열 수 없습니다`,
        `소속 계열사는 SSO/AD 클레임으로 확정되며 사용자가 바꿀 수 없습니다.\n` +
          `현재 클레임 · affiliate=${meta?.namespace ?? '-'} (${homeTenant ?? '-'}) · 역할=${
            persona?.rfpRole ?? '-'
          }\n` +
          `타 계열사 자산은 조회·전송·교차 활용이 모두 차단되며, 이 시도는 감사 원장에 기록됩니다.`,
        'warn',
      );
      return;
    }
    if (t === active) return;
    setTenant(t);
    toast(
      `작업 Namespace 를 ${t} 로 전환했습니다`,
      '위쪽 포털 카드로 들어가면 이 계열사 맥락에서 열립니다. 전환은 감사 원장에 기록됩니다.',
    );
  };

  return (
    <section>
      <div className="flex items-baseline gap-2.5 mb-2.5">
        <span className="text-[10.5px] font-extrabold text-ink-light uppercase tracking-[0.4px]">
          Namespace
        </span>
        <h2 className="text-[15px] font-extrabold text-ink tracking-tight">
          공동존 On-Premise 단일 클러스터 · {CLUSTER_SUMMARY.namespaces}개 Namespace
        </h2>
        <span className="text-[11px] text-ink-mid font-semibold">
          {canSwitch
            ? '작업 맥락을 바꾼 뒤 위쪽 포털로 들어갑니다'
            : '소속 Namespace 는 SSO/AD 클레임으로 고정됩니다'}
        </span>
      </div>

      {/* ── 클러스터 그림 ── */}
      <div className="card px-5 py-4 mb-3">
        <div className="flex items-center gap-2 mb-2.5">
          <h3 className="text-[12.5px] font-extrabold text-ink">
            공동존 On-Premise BareMetal Kubernetes
          </h3>
          <span className="pill bg-info-bg text-info border border-info-border">단일 클러스터</span>
          <span className="pill bg-brand-tint text-brand border border-brand-tint">
            {CLUSTER_SUMMARY.namespaces} Namespace
          </span>
          <span className="ml-auto text-[11px] text-ink-mid font-semibold">
            계열사 내부망과 네트워크 격리 · 계열사 간 기본 차단
          </span>
        </div>
        <ClusterStrip active={active} />
      </div>

      {/* ── 그룹 공통 ── */}
      {(() => {
        const locked = isLocked(GROUP_CARD.name);
        const isActive = GROUP_CARD.name === active;
        return (
          <button
            onClick={() => pick(GROUP_CARD.name)}
            aria-disabled={locked}
            title={locked ? 'SSO/AD 클레임으로 소속이 확정되어 선택할 수 없습니다' : undefined}
            className={cn(
              'w-full text-left card border-2 px-5 py-4 mb-3 transition-colors group',
              locked
                ? 'border-line-soft bg-surface-soft/60 cursor-not-allowed'
                : isActive
                  ? 'border-brand'
                  : 'border-brand-tint hover:border-brand',
            )}
          >
            <div className="flex items-center gap-4">
              <span
                className={cn(
                  'w-11 h-11 rounded inline-flex items-center justify-center text-[15px] font-black flex-shrink-0',
                  locked ? 'bg-surface text-ink-light border border-line' : 'bg-ink text-white',
                )}
              >
                {locked ? '🔒' : '群'}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'text-[16px] font-extrabold tracking-tight',
                      locked ? 'text-ink-mid' : 'text-ink',
                    )}
                  >
                    그룹 공통 포털 웹
                  </span>
                  <span className="pill bg-brand-tint text-brand border border-brand-tint font-mono tracking-normal rfp-chip">
                    {GROUP_CARD.namespace}
                  </span>
                  {isActive && !locked && <ActiveBadge />}
                  {locked && <LockBadge />}
                </div>
                <div className="text-[11.5px] text-ink-mid font-semibold mt-0.5">
                  {locked
                    ? '그룹 공용 자산은 소속 계열사 화면 안에서 이용합니다 — 이 Namespace 는 그룹 운영 역할만 선택할 수 있습니다'
                    : '이 랜딩 · 통합인증 · 마켓플레이스 · 거버넌스 원장 · 운영 콘솔이 도는 곳 — 계열사 간 공유는 이 경로로만 이뤄진다'}
                </div>
              </div>
              <div className="ml-auto flex items-center gap-5 flex-shrink-0">
                <Stat k="이용자" v={fmt(GROUP_CARD.stat.users)} />
                <Stat k="공용 에이전트" v={String(GROUP_CARD.stat.agents)} />
              </div>
            </div>
          </button>
        );
      })()}

      {/* ── 계열사 ── */}
      <div className="flex items-center gap-2 mt-4 mb-2">
        <span className="text-[10.5px] font-extrabold text-ink-light uppercase tracking-[0.4px]">
          계열사 전용 영역
        </span>
        <span className="text-[11px] text-ink-mid font-semibold">
          각 계열사는 자기 Namespace 안에서만 데이터를 보관하고 조회한다
        </span>
      </div>
      <div className="grid grid-cols-5 gap-2.5">
        {AFFILIATE_CARDS.map((t) => (
          <AffiliateCard
            key={t.name}
            t={t}
            locked={isLocked(t.name)}
            isHome={t.name === homeTenant}
            isActive={t.name === active}
            onPick={() => pick(t.name)}
          />
        ))}
      </div>

      {/* ── 격리 원칙 ── */}
      <div className="card px-5 py-4 mt-4">
        <div className="flex items-center gap-2 mb-2.5">
          <h3 className="text-[12.5px] font-extrabold text-ink">테넌트 격리 원칙</h3>
          <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip">
            SEC-001
          </span>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {ISOLATION_NOTES.map((n) => (
            <div key={n.k} className="border-l-2 border-line pl-3">
              <div className="text-[11.5px] font-extrabold text-ink-dark mb-0.5">{n.k}</div>
              <div className="text-[11px] text-ink-mid font-semibold leading-relaxed">{n.v}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════ 부품 ═══════════════════════ */

/**
 * 클러스터 한 덩어리 안에 11칸이 나뉘어 있는 그림.
 * 칸 폭은 균등하다 — 사용량이 아니라 **격리 구조**를 보여주는 그림이기 때문이다.
 */
function ClusterStrip({ active }: { active: Tenant }) {
  return (
    <div className="border border-line rounded bg-surface-soft p-2">
      <div className="flex gap-[3px]">
        {TENANT_CARDS.map((t) => (
          <div
            key={t.name}
            className={cn(
              'flex-1 min-w-0 rounded-sm px-2 py-2 border text-center',
              t.kind === 'group'
                ? 'bg-ink/5 border-ink text-ink'
                : t.name === active
                  ? 'bg-brand-tint border-brand text-brand'
                  : 'bg-white border-line-soft text-ink-dark',
            )}
          >
            <div className="text-[11px] font-extrabold truncate">{t.short}</div>
            <div className="text-[9px] font-mono text-ink-light truncate mt-0.5">{t.namespace}</div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 mt-1.5 px-1">
        <span className="flex-1 h-px bg-line" />
        <span className="text-[9.5px] font-bold text-ink-light">
          NetworkPolicy 로 Namespace 간 통신 기본 차단
        </span>
        <span className="flex-1 h-px bg-line" />
      </div>
    </div>
  );
}

/** 잠금 배지 — 그룹·계열사 카드가 같은 표기를 쓴다. */
function LockBadge() {
  return (
    <span className="pill bg-warn-bg text-warn border border-warn-border whitespace-nowrap">
      🔒 SSO 클레임 잠금
    </span>
  );
}

/** 지금 작업 맥락으로 잡혀 있는 Namespace 표기. */
function ActiveBadge() {
  return (
    <span className="pill bg-brand-tint text-brand border border-brand-tint whitespace-nowrap">
      작업 Namespace
    </span>
  );
}

function AffiliateCard({
  t,
  locked,
  isHome,
  isActive,
  onPick,
}: {
  t: TenantCard;
  /** SSO/AD 클레임상 선택할 수 없는 Namespace 인가(SEC-001). */
  locked: boolean;
  /** 이 계정의 소속 계열사인가. */
  isHome: boolean;
  /** 지금 작업 맥락으로 잡혀 있는가. */
  isActive: boolean;
  onPick: () => void;
}) {
  const st = TENANT_STATUS_META[t.stat.status];
  return (
    <button
      onClick={onPick}
      aria-disabled={locked}
      title={locked ? 'SSO/AD 클레임으로 소속이 확정되어 선택할 수 없습니다' : undefined}
      className={cn(
        'text-left card px-3.5 py-3 transition-all group',
        locked
          ? 'bg-surface-soft/60 border-line-soft cursor-not-allowed'
          : 'hover:border-brand-dark hover:shadow-sm',
        isActive && 'border-brand ring-1 ring-brand-tint',
      )}
    >
      <div className="flex items-start gap-1.5 mb-1.5">
        <span
          className={cn(
            'text-[13.5px] font-extrabold tracking-tight leading-tight min-w-0 flex-1',
            locked ? 'text-ink-mid' : 'text-ink',
          )}
        >
          {t.name}
        </span>
        {locked ? (
          <span className="text-[11px] leading-none flex-shrink-0 mt-[2px]" aria-hidden>
            🔒
          </span>
        ) : (
          <span className={cn('pill border flex-shrink-0', st.cls)}>{st.label}</span>
        )}
      </div>
      <div className="text-[10px] font-mono text-ink-light mb-2 truncate">{t.namespace}</div>
      {isHome && (
        <div className="mb-2">
          <span className="pill bg-brand-tint text-brand border border-brand-tint whitespace-nowrap">
            내 소속 · AD 클레임
          </span>
        </div>
      )}
      <div className="flex items-end gap-3">
        <Stat k="이용자" v={fmt(t.stat.users)} small />
        <Stat k="에이전트" v={String(t.stat.agents)} small />
        <span
          className={cn(
            'ml-auto text-[11px] font-extrabold',
            locked ? 'text-ink-light' : isActive ? 'text-brand' : 'text-ink-light group-hover:text-brand',
          )}
        >
          {locked ? '🔒' : isActive ? '●' : '○'}
        </span>
      </div>
    </button>
  );
}

function Stat({ k, v, small }: { k: string; v: string; small?: boolean }) {
  return (
    <span className="inline-flex flex-col">
      <span
        className={cn(
          'font-extrabold text-ink-light uppercase tracking-[0.3px]',
          small ? 'text-[9px]' : 'text-[9.5px]',
        )}
      >
        {k}
      </span>
      <span className={cn('font-extrabold text-ink-dark', small ? 'text-[12px]' : 'text-[15px]')}>
        {v}
      </span>
    </span>
  );
}
