/**
 * 그룹 공통 랜딩 — 핸드오프 §2 화면 1 (1막 시작).
 *
 * RFP: Ⅱ.3.나(3) 11개 Namespace(계열사 10 + 그룹 공통) · SEC-001 테넌트 격리
 *
 * 이 화면의 목적은 고르게 하는 게 아니라 **구조를 각인시키는 것**이다.
 * 그래서 ① 클러스터 한 덩어리 안에 11칸이 나뉜 그림을 먼저 보여주고,
 * ② 카드마다 Namespace 식별자를 그대로 노출하고,
 * ③ 하단에 "그래서 서로 못 본다"는 격리 원칙을 붙인다.
 *
 * 로그인 직후 여기로 들어온다. 계열사를 고르면 메모리 테넌트 스토어가 바뀌고
 * 포털 홈으로 넘어간다 — 이후 전 화면의 상단 스위처가 같은 값을 본다.
 *
 * ⚠️ **아무 카드나 열리면 안 된다.** 소속 계열사는 SSO/AD 클레임으로 확정되며
 *    사용자가 바꿀 수 없다(RFP 2-1 · ONM-001). 상단 `TenantSwitcher` 가 이미 같은
 *    규칙으로 잠겨 있으므로, 이 화면이 다르게 동작하면 SEC-001 이 화면에서
 *    거짓말을 하게 된다. 그래서 판정을 스위처와 **똑같이** 맞춘다 —
 *    `canSwitchTenant` 가 아닌 계정은 자기 Namespace 하나만 열린다.
 *    잠긴 카드를 눌러 보게 두는 것은 의도된 시연 장면이다(SEC-001 증명).
 */
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { setTenant } from '@/lib/tenantStore';
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

export default function TenantLandingPage() {
  const navigate = useNavigate();
  const persona = useCurrentPersona();

  /** 공동존을 운영·감독하는 그룹 역할만 Namespace 를 넘나든다. */
  const canSwitch = persona?.canSwitchTenant ?? false;
  /** SSO/AD 클레임으로 확정된 소속 계열사. */
  const homeTenant = persona?.tenant ?? null;
  const isLocked = (t: Tenant) => !canSwitch && t !== homeTenant;

  const enter = (t: Tenant) => {
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
    setTenant(t);
    navigate('/', { replace: true });
  };

  return (
    <div className="max-w-[1500px] mx-auto px-8 pt-6 pb-12">
      {/* ── 헤드 ── */}
      <div className="text-center mb-5">
        <div className="inline-flex items-center gap-2.5 mb-1.5">
          <span className="font-black text-brand text-[24px] leading-none tracking-tight">BNK</span>
          <span className="text-[19px] font-extrabold text-ink tracking-tight">
            공동 생성형 AI 플랫폼
          </span>
        </div>
        <p className="text-[12px] text-ink-mid font-semibold">
          {persona ? `${persona.name} 님, ` : ''}이용하실 영역을 선택하세요 · 그룹 공통 포털 1 + 계열사{' '}
          {CLUSTER_SUMMARY.affiliates} = <b className="text-ink-dark">{CLUSTER_SUMMARY.namespaces}개 Namespace</b>
        </p>
        {/* 어떤 카드가 왜 잠겨 있는지 먼저 말해 둔다 — SEC-001 시연 장면의 도입부 */}
        <p className="text-[11px] font-semibold mt-1.5">
          {canSwitch ? (
            <span className="text-ink-mid">
              🔑 그룹 운영 권한 — 11개 Namespace 를 모두 열 수 있습니다. 전환은 감사 원장에 기록됩니다.
            </span>
          ) : (
            <span className="text-warn">
              🔒 소속 계열사 <b>{homeTenant ?? '-'}</b> 만 열립니다 — 소속은 SSO/AD 클레임으로
              확정되며 사용자가 바꿀 수 없습니다 (SEC-001)
            </span>
          )}
        </p>
      </div>

      {/* ── 클러스터 그림 ── */}
      <section className="card px-5 py-4 mb-4">
        <div className="flex items-center gap-2 mb-2.5">
          <h2 className="text-[13px] font-extrabold text-ink">공동존 On-Premise BareMetal Kubernetes</h2>
          <span className="pill bg-info-bg text-info border border-info-border">단일 클러스터</span>
          <span className="pill bg-brand-tint text-brand border border-brand-tint">
            {CLUSTER_SUMMARY.namespaces} Namespace
          </span>
          <span className="ml-auto text-[11px] text-ink-mid font-semibold">
            계열사 내부망과 네트워크 격리 · 계열사 간 기본 차단
          </span>
        </div>
        <ClusterStrip />
      </section>

      {/* ── 그룹 공통 ── */}
      {(() => {
        const locked = isLocked(GROUP_CARD.name);
        return (
          <button
            onClick={() => enter(GROUP_CARD.name)}
            aria-disabled={locked}
            title={locked ? 'SSO/AD 클레임으로 소속이 확정되어 진입할 수 없습니다' : undefined}
            className={cn(
              'w-full text-left card border-2 px-5 py-4 mb-3 transition-colors group',
              locked
                ? 'border-line-soft bg-surface-soft/60 cursor-not-allowed'
                : 'border-brand-tint hover:border-brand',
            )}
          >
            <div className="flex items-center gap-4">
              <span
                className={cn(
                  'w-11 h-11 rounded inline-flex items-center justify-center text-[15px] font-black flex-shrink-0',
                  locked ? 'bg-surface text-ink-light border border-line' : 'bg-brand text-white',
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
                    그룹 공통 포털
                  </span>
                  <span className="pill bg-brand-tint text-brand border border-brand-tint font-mono tracking-normal rfp-chip">
                    {GROUP_CARD.namespace}
                  </span>
                  {locked && <LockBadge />}
                </div>
                <div className="text-[11.5px] text-ink-mid font-semibold mt-0.5">
                  {locked
                    ? '그룹 공용 자산은 소속 계열사 화면 안에서 이용합니다 — Namespace 진입은 그룹 운영 역할만 가능합니다'
                    : '마켓플레이스 · 그룹 공용 에이전트 · AI 거버넌스 원장 — 계열사 간 공유는 이 경로로만 이뤄진다'}
                </div>
              </div>
              <div className="ml-auto flex items-center gap-5 flex-shrink-0">
                <Stat k="이용자" v={fmt(GROUP_CARD.stat.users)} />
                <Stat k="공용 에이전트" v={String(GROUP_CARD.stat.agents)} />
                <span
                  className={cn(
                    'text-[12px] font-extrabold',
                    locked
                      ? 'text-ink-light'
                      : 'text-brand group-hover:translate-x-0.5 transition-transform',
                  )}
                >
                  {locked ? '진입 불가' : '입장 →'}
                </span>
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
            onEnter={() => enter(t.name)}
          />
        ))}
      </div>

      {/* ── 격리 원칙 ── */}
      <section className="card px-5 py-4 mt-4">
        <div className="flex items-center gap-2 mb-2.5">
          <h2 className="text-[13px] font-extrabold text-ink">테넌트 격리 원칙</h2>
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
      </section>
    </div>
  );
}

/* ═══════════════════════ 부품 ═══════════════════════ */

/**
 * 클러스터 한 덩어리 안에 11칸이 나뉘어 있는 그림.
 * 칸 폭은 균등하다 — 사용량이 아니라 **격리 구조**를 보여주는 그림이기 때문이다.
 */
function ClusterStrip() {
  return (
    <div className="border border-line rounded bg-surface-soft p-2">
      <div className="flex gap-[3px]">
        {TENANT_CARDS.map((t) => (
          <div
            key={t.name}
            className={cn(
              'flex-1 min-w-0 rounded-sm px-2 py-2 border text-center',
              t.kind === 'group'
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

function AffiliateCard({
  t,
  locked,
  isHome,
  onEnter,
}: {
  t: TenantCard;
  /** SSO/AD 클레임상 진입할 수 없는 Namespace 인가(SEC-001). */
  locked: boolean;
  /** 이 계정의 소속 계열사인가. */
  isHome: boolean;
  onEnter: () => void;
}) {
  const st = TENANT_STATUS_META[t.stat.status];
  return (
    <button
      onClick={onEnter}
      aria-disabled={locked}
      title={locked ? 'SSO/AD 클레임으로 소속이 확정되어 진입할 수 없습니다' : undefined}
      className={cn(
        'text-left card px-3.5 py-3 transition-all group',
        locked
          ? 'bg-surface-soft/60 border-line-soft cursor-not-allowed'
          : 'hover:border-brand-dark hover:shadow-sm',
        isHome && 'border-brand ring-1 ring-brand-tint',
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
            locked ? 'text-ink-light' : 'text-ink-light group-hover:text-brand',
          )}
        >
          {locked ? '🔒' : '→'}
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
