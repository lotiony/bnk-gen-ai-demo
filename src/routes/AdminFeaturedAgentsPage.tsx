import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { FEATURED_AGENTS, type FeaturedAgent } from '@/data/mockFeaturedAgents';
import { MOCK_CATALOG_AGENTS } from '@/data/mockCatalogAgents';

interface FeaturedRow extends FeaturedAgent {
  /** 홈에 실제 노출할지 여부. */
  visible: boolean;
}

/**
 * 홈 화면 "대표 에이전트" 노출 카드의 순서·표시 여부를 관리한다.
 * 카탈로그의 운영 중 에이전트 중에서 후보를 골라 추가할 수 있고,
 * 위·아래 버튼으로 순서를 바꾸고, 토글로 노출을 끄거나 켤 수 있다.
 */
export default function AdminFeaturedAgentsPage() {
  const [rows, setRows] = useState<FeaturedRow[]>(
    FEATURED_AGENTS.map((a) => ({ ...a, visible: true })),
  );
  const [dirty, setDirty] = useState(false);

  const featuredIds = useMemo(() => new Set(rows.map((r) => r.id)), [rows]);
  const candidates = useMemo(
    () =>
      MOCK_CATALOG_AGENTS.filter(
        (a) => a.state === '운영 중' && !featuredIds.has(a.id),
      ),
    [featuredIds],
  );

  const move = (idx: number, dir: -1 | 1) => {
    setRows((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
    setDirty(true);
  };

  const remove = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    setDirty(true);
  };

  const toggleVisible = (id: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, visible: !r.visible } : r)));
    setDirty(true);
  };

  const addCandidate = (id: string) => {
    const c = MOCK_CATALOG_AGENTS.find((a) => a.id === id);
    if (!c) return;
    const next: FeaturedRow = {
      id: c.id,
      name: c.name,
      icon: '🤖',
      description: c.description,
      projectName: c.projectName,
      projectHref: `/projects/${c.projectId}`,
      badge: '운영 중',
      visible: true,
    };
    setRows((prev) => [...prev, next]);
    setDirty(true);
  };

  const visibleCount = rows.filter((r) => r.visible).length;

  return (
    <>
      {/* Header */}
      <div className="card px-6 py-5 mb-3.5 flex items-start justify-between gap-6">
        <div>
          <div className="text-[11px] text-ink-mid font-bold tracking-[0.3px] mb-1">
            플랫폼 관리 · 운영 관리
          </div>
          <h1 className="text-[22px] font-extrabold text-ink tracking-[-0.3px]">
            홈 대표 에이전트 큐레이션
          </h1>
          <div className="text-[12px] text-ink-mid mt-1.5">
            모든 사용자의 홈 화면 상단에 노출되는 “대표 에이전트” 카드의 순서·표시 여부를 관리합니다.
            저장 즉시 적용되며 감사 원장에 기록됩니다.
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            disabled={!dirty}
            className={cn(
              'h-9 px-3 text-[12px] font-bold rounded border',
              dirty
                ? 'text-ink-dark border-line hover:bg-surface-soft'
                : 'text-ink-light border-line-soft cursor-not-allowed',
            )}
            onClick={() => {
              setRows(FEATURED_AGENTS.map((a) => ({ ...a, visible: true })));
              setDirty(false);
            }}
          >
            되돌리기
          </button>
          <button
            disabled={!dirty}
            className={cn(
              'h-9 px-4 text-[12.5px] font-extrabold rounded border',
              dirty
                ? 'bg-brand text-white border-brand-dark hover:bg-brand-dark'
                : 'bg-surface text-ink-light border-line-soft cursor-not-allowed',
            )}
            onClick={() => setDirty(false)}
          >
            변경 저장
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[1.4fr_1fr] gap-3.5">
        {/* 현재 노출 순서 */}
        <section className="card">
          <div className="px-5 py-3 border-b border-line-soft flex items-baseline justify-between">
            <div>
              <h2 className="text-[14px] font-extrabold text-ink">현재 홈 노출 카드</h2>
              <div className="text-[10.5px] text-ink-mid mt-0.5">
                위 → 아래 순서가 홈 좌 → 우 순서. 노출 OFF는 위치만 유지하고 화면엔 안 보입니다.
              </div>
            </div>
            <span className="text-[11px] text-ink-mid font-semibold">
              표시 {visibleCount} / 전체 {rows.length}
            </span>
          </div>

          {rows.length === 0 ? (
            <div className="text-center text-ink-light py-10 text-[12px]">
              노출 중인 대표 에이전트가 없습니다. 우측에서 후보를 추가하세요.
            </div>
          ) : (
            <ul>
              {rows.map((r, i) => (
                <li
                  key={r.id}
                  className={cn(
                    'grid grid-cols-[36px_44px_1fr_auto] gap-3 items-center px-4 py-3 border-b border-line-soft last:border-0',
                    !r.visible && 'opacity-60',
                  )}
                >
                  <div className="text-[15px] font-extrabold text-ink-mid tabular-nums text-center">
                    {i + 1}
                  </div>
                  <div className="w-9 h-9 rounded-md bg-brand-bg border border-brand-dark flex items-center justify-center text-[18px]">
                    {r.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-ink truncate">{r.name}</span>
                      <span
                        className={cn(
                          'pill border text-[9.5px]',
                          r.badge === '운영 중'
                            ? 'bg-ok-bg text-ok border-ok-border'
                            : 'bg-info-bg text-info border-info-border',
                        )}
                      >
                        {r.badge}
                      </span>
                    </div>
                    <div className="text-[10.5px] text-ink-mid font-semibold mt-0.5 truncate">
                      {r.id} · {r.projectName}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <IconBtn
                      title="위로"
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                    >
                      ▲
                    </IconBtn>
                    <IconBtn
                      title="아래로"
                      disabled={i === rows.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      ▼
                    </IconBtn>
                    <button
                      title={r.visible ? '홈에서 숨김' : '홈에 노출'}
                      onClick={() => toggleVisible(r.id)}
                      className={cn(
                        'h-7 px-2 text-[10.5px] font-extrabold rounded border',
                        r.visible
                          ? 'bg-ok-bg text-ok border-ok-border'
                          : 'bg-surface text-ink-mid border-line',
                      )}
                    >
                      {r.visible ? '노출 ON' : '노출 OFF'}
                    </button>
                    <button
                      title="목록에서 제거"
                      onClick={() => remove(r.id)}
                      className="h-7 px-2 text-[10.5px] font-extrabold rounded border border-line text-ink-mid hover:text-bad hover:border-bad-border"
                    >
                      제거
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 후보 풀 */}
        <section className="card">
          <div className="px-5 py-3 border-b border-line-soft">
            <h2 className="text-[14px] font-extrabold text-ink">후보 풀</h2>
            <div className="text-[10.5px] text-ink-mid mt-0.5">
              카탈로그 “운영 중” 에이전트 — 추가하면 위 목록 맨 아래로 들어갑니다.
            </div>
          </div>
          {candidates.length === 0 ? (
            <div className="text-center text-ink-light py-10 text-[12px]">
              추가 가능한 후보가 없습니다.
            </div>
          ) : (
            <ul>
              {candidates.map((c) => (
                <li
                  key={c.id}
                  className="grid grid-cols-[1fr_auto] gap-2 items-center px-4 py-2.5 border-b border-line-soft last:border-0 hover:bg-surface-soft/40"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-extrabold text-ink truncate">{c.name}</span>
                      <span className="pill bg-surface text-ink-mid border border-line-soft text-[9.5px]">
                        {c.tenant}
                      </span>
                    </div>
                    <div className="text-[10.5px] text-ink-mid font-semibold mt-0.5 truncate">
                      {c.id} · {c.projectName}
                    </div>
                  </div>
                  <button
                    onClick={() => addCandidate(c.id)}
                    className="h-7 px-2.5 text-[10.5px] font-extrabold rounded border border-brand-dark bg-brand-bg hover:bg-brand text-brand hover:text-white"
                  >
                    + 추가
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="px-5 py-2.5 border-t border-line-soft text-[10.5px] text-ink-mid">
            카탈로그 전체 보기 →{' '}
            <Link to="/catalog" className="text-info font-bold hover:underline">
              공통 카탈로그
            </Link>
          </div>
        </section>
      </div>

      <div className="text-[10.5px] text-ink-mid bg-surface-soft border border-line-soft rounded px-3 py-2 mt-3.5">
        💡 홈 노출은 그룹 표준 추천 큐레이션이므로 일반적으로 3~6개를 유지합니다. 변경 즉시 모든 사용자에게 반영됩니다.
      </div>
    </>
  );
}

function IconBtn({
  title,
  disabled,
  onClick,
  children,
}: {
  title: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'w-7 h-7 text-[11px] font-extrabold rounded border tabular-nums',
        disabled
          ? 'text-ink-light border-line-soft cursor-not-allowed'
          : 'text-ink-dark border-line hover:bg-surface-soft hover:border-brand-dark',
      )}
    >
      {children}
    </button>
  );
}
