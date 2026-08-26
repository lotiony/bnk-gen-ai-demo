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
 */
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { setTenant } from '@/lib/tenantStore';
import { useCurrentPersona } from '@/lib/persona';
import type { Tenant } from '@/data/tenants';
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

  const enter = (t: Tenant) => {
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
      <button
        onClick={() => enter(GROUP_CARD.name)}
        className="w-full text-left card border-2 border-brand-tint hover:border-brand px-5 py-4 mb-3 transition-colors group"
      >
        <div className="flex items-center gap-4">
          <span className="w-11 h-11 rounded bg-brand text-white inline-flex items-center justify-center text-[15px] font-black flex-shrink-0">
            群
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[16px] font-extrabold text-ink tracking-tight">그룹 공통 포털</span>
              <span className="pill bg-brand-tint text-brand border border-brand-tint font-mono tracking-normal">
                {GROUP_CARD.namespace}
              </span>
            </div>
            <div className="text-[11.5px] text-ink-mid font-semibold mt-0.5">
              마켓플레이스 · 그룹 공용 에이전트 · AI 거버넌스 원장 — 계열사 간 공유는 이 경로로만 이뤄진다
            </div>
          </div>
          <div className="ml-auto flex items-center gap-5 flex-shrink-0">
            <Stat k="이용자" v={fmt(GROUP_CARD.stat.users)} />
            <Stat k="공용 에이전트" v={String(GROUP_CARD.stat.agents)} />
            <span className="text-[12px] font-extrabold text-brand group-hover:translate-x-0.5 transition-transform">
              입장 →
            </span>
          </div>
        </div>
      </button>

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
          <AffiliateCard key={t.name} t={t} onEnter={() => enter(t.name)} />
        ))}
      </div>

      {/* ── 격리 원칙 ── */}
      <section className="card px-5 py-4 mt-4">
        <div className="flex items-center gap-2 mb-2.5">
          <h2 className="text-[13px] font-extrabold text-ink">테넌트 격리 원칙</h2>
          <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal">
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

function AffiliateCard({ t, onEnter }: { t: TenantCard; onEnter: () => void }) {
  const st = TENANT_STATUS_META[t.stat.status];
  return (
    <button
      onClick={onEnter}
      className="text-left card px-3.5 py-3 hover:border-brand-dark hover:shadow-sm transition-all group"
    >
      <div className="flex items-start gap-1.5 mb-1.5">
        <span className="text-[13.5px] font-extrabold text-ink tracking-tight leading-tight min-w-0 flex-1">
          {t.name}
        </span>
        <span className={cn('pill border flex-shrink-0', st.cls)}>{st.label}</span>
      </div>
      <div className="text-[10px] font-mono text-ink-light mb-2 truncate">{t.namespace}</div>
      <div className="flex items-end gap-3">
        <Stat k="이용자" v={fmt(t.stat.users)} small />
        <Stat k="에이전트" v={String(t.stat.agents)} small />
        <span className="ml-auto text-[11px] font-extrabold text-ink-light group-hover:text-brand">
          →
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
