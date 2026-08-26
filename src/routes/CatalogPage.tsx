/**
 * 공통 카탈로그 (마켓플레이스) — 핸드오프 §2 화면 6.
 *
 * RFP: 마켓플레이스 요건
 *
 * 원본 mockup 의 카탈로그를 두 군데 뒤집었다.
 *  ① **계열사 간 공유 금지 → 공유 범위 기반 허용.** BNK 는 그룹 공동 플랫폼이고,
 *     화면 1(랜딩)이 이미 "그룹 공통 카탈로그를 거쳐 공유한다"고 말했다.
 *     두 화면이 반대로 말하면 그 자체가 리스크다(RFP Ⅳ.4.1).
 *  ② **`window.alert` 제거.** 시연 중 모달이 뜨면 흐름이 끊기고 "(목업)" 문구가
 *     발주처 화면에 그대로 노출된다. 비차단 토스트로 바꿨다.
 *
 * 스펙이 요구한 축을 모두 세운다 — 에이전트·프롬프트·MCP 통합, 키워드/태그 검색,
 * 사용량·평가 랭킹, 공유 범위 5단계.
 */
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { useTenant } from '@/lib/tenantStore';
import {
  getCatalogItems,
  useVerdict,
  VERDICT_META,
  SCOPE_META,
  SCOPE_ORDER,
  KIND_META,
  type AssetKind,
  type CatalogItem,
  type ShareScope,
} from '@/data/mockCatalog';

type SortKey = 'usage' | 'rating' | 'installs' | 'recent';

const SORT_LABEL: Record<SortKey, string> = {
  usage: '사용량 순',
  rating: '평가 순',
  installs: '도입 순',
  recent: '최근 갱신 순',
};

export default function CatalogPage() {
  const myTenant = useTenant();
  const all = useMemo(() => getCatalogItems(), []);

  const [q, setQ] = useState('');
  const [kind, setKind] = useState<AssetKind | 'all'>('all');
  const [scope, setScope] = useState<ShareScope | 'all'>('all');
  const [sort, setSort] = useState<SortKey>('usage');
  const [requested, setRequested] = useState<Set<string>>(new Set());

  /** 비노출 자산은 카탈로그에 아예 실리지 않는다 — 격리가 먼저다. */
  const visible = useMemo(
    () => all.filter((it) => useVerdict(it.tenant, it.meta.scope, myTenant) !== 'hidden'),
    [all, myTenant],
  );

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const out = visible.filter((it) => {
      if (kind !== 'all' && it.kind !== kind) return false;
      if (scope !== 'all' && it.meta.scope !== scope) return false;
      if (ql) {
        const hay = `${it.id} ${it.name} ${it.owner} ${it.description} ${it.extra} ${it.meta.tags.join(' ')}`.toLowerCase();
        if (!hay.includes(ql)) return false;
      }
      return true;
    });
    const by: Record<SortKey, (a: CatalogItem, b: CatalogItem) => number> = {
      usage: (a, b) => b.usage - a.usage,
      rating: (a, b) => b.meta.rating - a.meta.rating || b.meta.ratingCount - a.meta.ratingCount,
      installs: (a, b) => b.meta.installs - a.meta.installs,
      recent: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
    };
    return [...out].sort(by[sort]);
  }, [visible, q, kind, scope, sort]);

  const kindCount = (k: AssetKind) => visible.filter((i) => i.kind === k).length;
  const hiddenCount = all.length - visible.length;

  const request = (it: CatalogItem) => {
    setRequested((s) => new Set(s).add(it.id));
    toast(
      '그룹 공개 요청이 접수되었습니다',
      `${it.id} ${it.name}\n소유: ${it.tenant} · ${it.owner}\n거버넌스 결재선에 자동 등록되며, 승인 시 11개 Namespace 전체에 공개됩니다.`,
      'ok',
    );
  };

  return (
    <div className="max-w-[1500px] mx-auto px-6 py-6">
      {/* ── 헤더 ── */}
      <div className="card px-6 py-5 mb-3.5">
        <div className="flex items-baseline gap-2.5 flex-wrap mb-3">
          <span className="text-[22px] font-extrabold text-ink tracking-[-0.3px]">공통 카탈로그</span>
          <span className="text-sm text-ink-mid font-semibold">{visible.length}건</span>
          <span className="text-xs text-ink-mid font-medium ml-2.5">
            에이전트 · 프롬프트 · MCP Tool 통합 — <b className="text-ink-dark">그룹 범위</b>로 공개된
            자산은 계열사와 무관하게 바로 사용할 수 있습니다
          </span>
          <div className="ml-auto relative min-w-[300px] max-w-[460px] flex-1">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-mid text-sm">🔍</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="이름 · 설명 · 태그 · 소유자 검색"
              className="w-full py-2 pl-8 pr-3 border border-line rounded text-[12.5px] bg-white focus:outline-none focus:border-brand-dark"
            />
          </div>
        </div>

        <div className="flex items-center gap-x-4 gap-y-2 flex-wrap">
          <Group label="종류">
            <Chip on={kind === 'all'} onClick={() => setKind('all')}>
              전체
            </Chip>
            {(['agent', 'prompt', 'mcp'] as AssetKind[]).map((k) => (
              <Chip key={k} on={kind === k} onClick={() => setKind(k)}>
                {KIND_META[k].icon} {KIND_META[k].label}{' '}
                <span className="text-ink-mid">{kindCount(k)}</span>
              </Chip>
            ))}
          </Group>

          <Group label="공유 범위">
            <Chip on={scope === 'all'} onClick={() => setScope('all')}>
              전체
            </Chip>
            {SCOPE_ORDER.map((s) => (
              <Chip key={s} on={scope === s} onClick={() => setScope(s)}>
                {s}
              </Chip>
            ))}
          </Group>

          <Group label="정렬">
            {(Object.keys(SORT_LABEL) as SortKey[]).map((s) => (
              <Chip key={s} on={sort === s} onClick={() => setSort(s)}>
                {SORT_LABEL[s]}
              </Chip>
            ))}
          </Group>
        </div>
      </div>

      {/* ── 결과 요약 ── */}
      <div className="flex items-center gap-2 px-1 mb-2.5 flex-wrap">
        <span className="text-[11.5px] text-ink-mid font-semibold">
          {q.trim() && (
            <>
              <b className="text-ink-dark">"{q.trim()}"</b> 검색 ·{' '}
            </>
          )}
          <b className="text-ink-dark">{filtered.length}건</b> · {SORT_LABEL[sort]} · 현재 계열사{' '}
          <b className="text-ink-dark">{myTenant}</b>
        </span>
        {hiddenCount > 0 && (
          <span className="pill bg-surface text-ink-light border border-line-soft">
            타 계열사 본부 이하 자산 {hiddenCount}건은 비노출
          </span>
        )}
      </div>

      {/* ── 격자 ── */}
      {filtered.length === 0 ? (
        <div className="card px-5 py-10 text-center text-[12.5px] text-ink-light font-semibold">
          조건에 맞는 자산이 없습니다 · 필터를 조정해 보세요
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {filtered.map((it) => (
            <ItemCard
              key={`${it.kind}-${it.id}`}
              item={it}
              myTenant={myTenant}
              requested={requested.has(it.id)}
              onRequest={() => request(it)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════ 카드 ═══════════════════════ */

function ItemCard({
  item,
  myTenant,
  requested,
  onRequest,
}: {
  item: CatalogItem;
  myTenant: string;
  requested: boolean;
  onRequest: () => void;
}) {
  const km = KIND_META[item.kind];
  const verdict = useVerdict(item.tenant, item.meta.scope, myTenant as never);
  const vm = VERDICT_META[verdict];
  const sm = SCOPE_META[item.meta.scope];

  return (
    <div className="card flex flex-col overflow-hidden hover:border-brand-dark hover:shadow-sm transition-all">
      <div className="px-3.5 py-3 border-b border-line-soft">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className={cn('pill border', km.cls)}>
            {km.icon} {km.label}
          </span>
          <span className="text-[10px] font-mono font-bold text-ink-mid">{item.id}</span>
          <span className={cn('ml-auto pill border', sm.cls)} title={sm.desc}>
            {item.meta.scope}
          </span>
        </div>
        <div className="text-[13px] font-extrabold text-ink leading-tight mb-1 truncate" title={item.name}>
          {item.name}
        </div>
        <div className="text-[10.5px] text-ink-mid font-medium leading-snug line-clamp-2 min-h-[28px]">
          {item.description}
        </div>
      </div>

      {/* 랭킹 지표 */}
      <div className="px-3.5 py-2 flex items-center gap-3 bg-surface-soft border-b border-line-soft">
        <Metric k={item.usageLabel} v={item.usage.toLocaleString('ko-KR')} />
        <Metric
          k="평가"
          v={item.meta.rating > 0 ? `★ ${item.meta.rating.toFixed(1)} (${item.meta.ratingCount})` : '—'}
        />
        <Metric k="도입" v={item.meta.installs > 0 ? `${item.meta.installs}곳` : '—'} />
      </div>

      {/* 태그 */}
      <div className="px-3.5 py-2 flex items-center gap-1 flex-wrap">
        {item.meta.tags.map((t) => (
          <span key={t} className="pill bg-white text-ink-mid border border-line-soft">
            #{t}
          </span>
        ))}
      </div>

      <div className="px-3.5 py-1.5 text-[10.5px] text-ink-mid font-semibold border-b border-line-soft">
        <b className="text-ink-dark">{item.tenant}</b> · {item.owner}
        <div className="text-ink-light font-medium mt-0.5 truncate">{item.extra}</div>
      </div>

      <div className="px-3.5 py-2.5 mt-auto flex items-center gap-2">
        <span className={cn('pill border', vm.cls)}>{vm.label}</span>
        <span className="ml-auto">
          {verdict === 'request' ? (
            requested ? (
              <span className="pill bg-info-bg text-info border border-info-border">결재 진행 중</span>
            ) : (
              <button
                onClick={onRequest}
                className="py-1 px-2.5 bg-white border border-brand-dark rounded text-[11px] font-extrabold text-brand hover:bg-brand hover:text-white"
              >
                그룹 공개 요청
              </button>
            )
          ) : (
            <button className="py-1 px-2.5 bg-brand border border-brand-dark rounded text-[11px] font-extrabold text-white hover:bg-brand-dark">
              사용하기
            </button>
          )}
        </span>
      </div>
    </div>
  );
}

function Metric({ k, v }: { k: string; v: string }) {
  return (
    <span className="inline-flex flex-col min-w-0">
      <span className="text-[9px] font-extrabold text-ink-light uppercase tracking-[0.3px] truncate">{k}</span>
      <span className="text-[11.5px] font-extrabold text-ink-dark truncate">{v}</span>
    </span>
  );
}

/* ═══════════════════════ 필터 ═══════════════════════ */

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-1.5 flex-wrap">
      <span className="text-[10.5px] font-extrabold text-ink-mid uppercase tracking-[0.3px] mr-0.5">
        {label}
      </span>
      {children}
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 py-1 px-2.5 rounded-md border text-[11px] font-bold transition-colors',
        on
          ? 'bg-brand-tint border-brand-dark text-ink'
          : 'bg-white border-line-soft text-ink-mid hover:border-brand-dark hover:text-ink-dark',
      )}
    >
      {children}
    </button>
  );
}
