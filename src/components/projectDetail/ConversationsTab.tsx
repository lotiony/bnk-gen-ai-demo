import { useMemo, useState } from 'react';
import KpiCard from '@/components/ui/KpiCard';
import { cn } from '@/lib/utils';
import {
  MOCK_CONVERSATIONS,
  getConversationKpis,
  getConversationFilterOptions,
  getSessionTokens,
  getFirstUserText,
  type ConversationSession,
  type ConversationTurn,
  type FeedbackKind,
} from '@/data/mockConversations';

/**
 * 대화 분석 탭 — 마스터·디테일 (Inbox 스타일).
 *
 * 노출 필드(요건):
 *  · 사용자 마스킹 ID + 부서
 *  · 에이전트 + 버전 (서빙계 고정 배지)
 *  · 사용자 피드백 (👍/👎/미평가 + 코멘트)
 *  · 대화 이력(Turn-by-turn) + 토큰
 *  · 사용자 메시지 PII 마스킹 시각화
 *  · Langfuse 트레이스 이동 (상세는 외부 위임)
 */
export default function ConversationsTab() {
  const sessions = MOCK_CONVERSATIONS;
  const filterOptions = useMemo(() => getConversationFilterOptions(sessions), [sessions]);

  const [versions, setVersions] = useState<string[]>([]);
  const [depts, setDepts] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<FeedbackKind | 'all'>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'recent' | 'turns' | 'tokens' | 'feedback'>('recent');
  const [selectedId, setSelectedId] = useState<string | null>(sessions[0]?.id ?? null);

  const filtered = useMemo(() => {
    let arr = sessions.filter((s) => {
      if (versions.length && !versions.includes(s.agentVersion)) return false;
      if (depts.length && !depts.includes(s.userDept)) return false;
      if (feedback !== 'all' && s.feedback !== feedback) return false;
      if (query.trim()) {
        const q = query.trim().toLowerCase();
        const hit = s.turns.some((t) => t.text.toLowerCase().includes(q));
        if (!hit) return false;
      }
      return true;
    });
    arr = [...arr].sort((a, b) => {
      if (sort === 'turns') return b.turns.length - a.turns.length;
      if (sort === 'tokens')
        return getSessionTokens(b).total - getSessionTokens(a).total;
      if (sort === 'feedback') {
        // 👎 먼저 → 미평가 → 👍
        const rank: Record<FeedbackKind, number> = { down: 0, none: 1, up: 2 };
        return rank[a.feedback] - rank[b.feedback];
      }
      return b.startedAt.localeCompare(a.startedAt);
    });
    return arr;
  }, [sessions, versions, depts, feedback, query, sort]);

  const selected =
    filtered.find((s) => s.id === selectedId) ?? filtered[0] ?? null;

  const kpis = useMemo(() => getConversationKpis(filtered), [filtered]);

  return (
    <section className="space-y-3.5">
      {/* 헤더 안내 줄 */}
      <div className="text-[11.5px] text-ink-mid">
        서빙계 운영 트래픽 한정 ·{' '}
        <span className="text-ink-dark font-bold">사용자 메시지는 PII 마스킹 표시</span>{' '}
        · 상세 트레이스는 Langfuse에서 확인
      </div>

      {/* KPI 4 */}
      <div className="grid grid-cols-4 gap-3">
        <KpiCard
          label="총 대화 수"
          value={kpis.total.toLocaleString()}
          unit="건"
          sub={`Turn 합계 ${filtered.reduce((a, s) => a + s.turns.length, 0).toLocaleString()}`}
          tone="ok"
        />
        <KpiCard
          label="평균 Turn"
          value={kpis.avgTurns.toFixed(1)}
          sub="세션당 사용 깊이"
          tone="ok"
        />
        <KpiCard
          label="👍 비율"
          value={kpis.upRate.toFixed(1)}
          unit="%"
          sub={`👍 ${kpis.up} · 👎 ${kpis.down} · 미평가 ${kpis.unrated} (${kpis.unratedPct.toFixed(
            0,
          )}%)`}
          tone={kpis.upRate >= 80 ? 'ok' : kpis.upRate >= 60 ? 'warn' : 'bad'}
        />
        <KpiCard
          label="평균 토큰 / 대화"
          value={fmtCompact(Math.round(kpis.avgTokens))}
          sub="입력+출력 합산"
          tone="ok"
        />
      </div>

      {/* 필터 바 */}
      <div className="card px-3.5 py-2.5 flex flex-wrap items-center gap-2">
        <MultiSelect
          label="버전"
          values={versions}
          onChange={setVersions}
          options={filterOptions.versions.map((v) => ({ value: v, label: v }))}
        />
        <MultiSelect
          label="부서"
          values={depts}
          onChange={setDepts}
          options={filterOptions.depts.map((d) => ({ value: d, label: d }))}
        />
        <FeedbackFilter value={feedback} onChange={setFeedback} />
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-[10.5px] text-ink-light font-semibold">🔍</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="본문 검색 (마스킹된 표시 기준)"
            className="h-7 w-[220px] px-2 border border-line rounded text-[11.5px] outline-none focus:border-brand-dark"
          />
        </div>
      </div>

      {/* 결과 메타 줄 */}
      <div className="flex items-center justify-between text-[11px] text-ink-mid">
        <span>
          <b className="text-ink-dark tabular-nums">{filtered.length.toLocaleString()}</b>건 매치
          {(versions.length || depts.length || feedback !== 'all' || query) ? (
            <>
              {' · '}
              <button
                onClick={() => {
                  setVersions([]);
                  setDepts([]);
                  setFeedback('all');
                  setQuery('');
                }}
                className="text-info hover:underline font-bold"
              >
                필터 초기화
              </button>
            </>
          ) : null}
        </span>
        <span className="flex items-center gap-1.5">
          정렬{' '}
          <select
            value={sort}
            onChange={(e) =>
              setSort(e.target.value as 'recent' | 'turns' | 'tokens' | 'feedback')
            }
            className="h-6 px-1.5 border border-line rounded text-[11px] outline-none bg-white"
          >
            <option value="recent">최신순</option>
            <option value="turns">Turn 많은 순</option>
            <option value="tokens">토큰 많은 순</option>
            <option value="feedback">피드백 (👎 먼저)</option>
          </select>
        </span>
      </div>

      {/* 마스터·디테일 split */}
      <div className="grid grid-cols-[minmax(340px,_36%)_1fr] gap-3 items-start">
        {/* 좌: 목록 */}
        <div className="card overflow-hidden">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-[12px] text-ink-light font-semibold">
              필터에 맞는 대화가 없습니다
            </div>
          ) : (
            <ul className="max-h-[720px] overflow-y-auto divide-y divide-line-soft">
              {filtered.map((s) => (
                <ConversationListCard
                  key={s.id}
                  session={s}
                  selected={selected?.id === s.id}
                  onClick={() => setSelectedId(s.id)}
                />
              ))}
            </ul>
          )}
        </div>

        {/* 우: 상세 */}
        <div>
          {selected ? (
            <ConversationDetailPanel session={selected} />
          ) : (
            <div className="card px-6 py-16 text-center text-[12.5px] text-ink-mid">
              <div className="mb-2 text-[20px]">◯</div>
              왼쪽 목록에서 대화를 선택하세요.
              <div className="text-[11px] text-ink-light mt-1">
                선택한 대화의 사용자 메시지·응답·토큰이 표시됩니다.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 권한·마스킹 안내 */}
      <div className="text-[10.5px] text-ink-mid bg-surface-soft border border-line-soft rounded px-3 py-2">
        🔒 사용자 메시지의 개인정보는 PII 마스킹 정책에 따라 표시됩니다. 원본 열람은 별도 권한이
        필요하며 모든 열람은 감사 원장에 기록됩니다.
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────────
 * 좌측 목록 카드
 * ────────────────────────────────────────────────────────────── */

function ConversationListCard({
  session,
  selected,
  onClick,
}: {
  session: ConversationSession;
  selected: boolean;
  onClick: () => void;
}) {
  const tokens = getSessionTokens(session);
  const preview = getFirstUserText(session);
  const time = session.startedAt.slice(11, 16); // HH:mm
  const dateShort = session.startedAt.slice(5, 10); // MM-DD

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'w-full text-left px-3.5 py-3 relative transition-colors block',
          selected ? 'bg-brand-tint' : 'hover:bg-surface',
        )}
      >
        {selected && (
          <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-brand-dark" />
        )}
        <div className="flex items-center justify-between gap-2 text-[11px] text-ink-mid">
          <span className="font-extrabold text-ink-dark font-mono">{session.userMaskedId}</span>
          <span className="text-ink-light">·</span>
          <span className="font-semibold">{session.userDept}</span>
          <span className="ml-auto text-ink-light tabular-nums text-[10.5px]">
            {dateShort} {time}
          </span>
        </div>
        <div className="mt-1.5 text-[12px] text-ink-dark leading-snug line-clamp-2">
          <MaskedText text={preview} compact />
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 text-[10.5px] text-ink-mid">
          <span className="font-mono font-bold text-ink-dark">
            {session.agentId}@{session.agentVersion}
          </span>
          <span className="text-ink-light">·</span>
          <span className="tabular-nums">{session.turns.length} turn</span>
          <span className="text-ink-light">·</span>
          <span className="tabular-nums">{fmtCompact(tokens.total)} tok</span>
          <span className="ml-auto">
            <FeedbackIcon kind={session.feedback} small />
          </span>
        </div>
      </button>
    </li>
  );
}

/* ──────────────────────────────────────────────────────────────
 * 우측 상세 패널
 * ────────────────────────────────────────────────────────────── */

function ConversationDetailPanel({ session }: { session: ConversationSession }) {
  const tokens = getSessionTokens(session);
  const dur = formatDuration(session.durationSec);
  const langfuseUrl = `https://trace.aip.group.local/project/pb-agent/traces/${session.langfuseTraceId}`;

  return (
    <div className="card">
      {/* 헤더 */}
      <div className="px-5 py-4 border-b border-line-soft">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11.5px] text-ink-mid mb-1.5">
              <span className="font-mono font-extrabold text-ink-dark">
                {session.userMaskedId}
              </span>
              <span className="text-ink-light">·</span>
              <span className="font-semibold">{session.userDept}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-[15px] font-extrabold text-ink">{session.agentName}</span>
              <span className="font-mono text-[12px] text-ink-mid">
                {session.agentId} · {session.agentVersion}
              </span>
              <span className="pill bg-ok-bg text-ok border border-ok-border">서빙계</span>
            </div>
            <div className="text-[11.5px] text-ink-mid">
              시작 <b className="text-ink-dark tabular-nums">{session.startedAt}</b>
              <span className="mx-1.5 text-line">·</span>
              지속 <b className="text-ink-dark tabular-nums">{dur}</b>
              <span className="mx-1.5 text-line">·</span>
              <b className="text-ink-dark tabular-nums">{session.turns.length}</b> turn
              <span className="mx-1.5 text-line">·</span>
              토큰{' '}
              <b className="text-ink-dark tabular-nums">{tokens.total.toLocaleString()}</b>{' '}
              <span className="text-ink-light">
                (in {tokens.input.toLocaleString()} / out {tokens.output.toLocaleString()})
              </span>
            </div>
          </div>

          <a
            href={langfuseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded text-[12px] font-extrabold bg-ink text-white border border-ink hover:bg-ink-dark whitespace-nowrap"
            title="Langfuse에서 상세 트레이스 보기"
          >
            <span aria-hidden>🔎</span>
            Langfuse 트레이스
            <span aria-hidden className="text-[10px]">↗</span>
          </a>
        </div>

        {/* 피드백 줄 */}
        <div className="mt-3 pt-3 border-t border-line-soft">
          <FeedbackBanner
            kind={session.feedback}
            comment={session.feedbackComment}
          />
        </div>
      </div>

      {/* Turn-by-turn 본문 */}
      <div className="px-5 py-4 max-h-[640px] overflow-y-auto bg-surface-soft/40">
        <div className="space-y-3">
          {session.turns.map((t, i) => (
            <TurnBubble key={i} turn={t} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * Turn 말풍선
 * ────────────────────────────────────────────────────────────── */

function TurnBubble({ turn }: { turn: ConversationTurn }) {
  const isUser = turn.role === 'user';
  return (
    <div className={cn('flex', isUser ? 'justify-start' : 'justify-end')}>
      <div className={cn('max-w-[88%] min-w-0', isUser ? '' : 'text-right')}>
        <div className="flex items-center gap-1.5 mb-1 text-[10.5px] text-ink-light font-semibold tabular-nums">
          {isUser ? (
            <>
              <span className="font-extrabold text-ink-mid">사용자</span>
              <span>·</span>
              <span>{turn.time}</span>
            </>
          ) : (
            <>
              <span>{turn.time}</span>
              <span>·</span>
              <span className="font-extrabold text-ink-mid">에이전트</span>
            </>
          )}
        </div>
        <div
          className={cn(
            'inline-block text-left px-3.5 py-2.5 rounded-lg text-[12.5px] leading-relaxed border whitespace-pre-wrap',
            isUser
              ? 'bg-white border-line-soft text-ink-dark'
              : 'bg-brand-tint border-brand-dark text-ink',
          )}
        >
          {isUser ? <MaskedText text={turn.text} /> : turn.text}
        </div>
        <div
          className={cn(
            'mt-1 text-[10.5px] text-ink-light font-semibold tabular-nums flex gap-1.5',
            isUser ? 'justify-start' : 'justify-end',
          )}
        >
          {turn.tokens != null && (
            <span>
              {isUser ? 'in' : 'out'} <b className="text-ink-mid">{turn.tokens.toLocaleString()}</b>{' '}
              tok
            </span>
          )}
          {turn.latencyMs != null && (
            <>
              <span className="text-line">·</span>
              <span>
                <b className="text-ink-mid">{(turn.latencyMs / 1000).toFixed(1)}</b>s
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * 마스킹된 본문 — [라벨] 토큰을 칩으로 시각화
 * ────────────────────────────────────────────────────────────── */

const MASK_PATTERN = /\[([^\]]+)\]/g;

function MaskedText({ text, compact }: { text: string; compact?: boolean }) {
  const parts: { type: 'text' | 'mask'; value: string }[] = [];
  let last = 0;
  for (const m of text.matchAll(MASK_PATTERN)) {
    const start = m.index ?? 0;
    if (start > last) parts.push({ type: 'text', value: text.slice(last, start) });
    parts.push({ type: 'mask', value: m[1] });
    last = start + m[0].length;
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) });

  return (
    <>
      {parts.map((p, i) =>
        p.type === 'text' ? (
          <span key={i}>{p.value}</span>
        ) : (
          <span
            key={i}
            className={cn(
              'inline-block align-baseline rounded text-ink-mid font-bold tabular-nums',
              compact
                ? 'mx-0.5 px-1 py-0 text-[10.5px] bg-line-soft'
                : 'mx-0.5 px-1.5 py-0 text-[10.5px] bg-surface border border-line-soft',
            )}
            title="PII 마스킹"
          >
            🔒 {p.value}
          </span>
        ),
      )}
    </>
  );
}

/* ──────────────────────────────────────────────────────────────
 * 필터 컨트롤
 * ────────────────────────────────────────────────────────────── */

function MultiSelect({
  label,
  values,
  onChange,
  options,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  options: { value: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const summary =
    values.length === 0
      ? '전체'
      : values.length === 1
      ? values[0]
      : `${values.length}개 선택`;
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'h-7 px-2.5 rounded border text-[11px] font-extrabold inline-flex items-center gap-1.5',
          values.length === 0
            ? 'bg-white border-line text-ink-mid'
            : 'bg-brand-tint border-brand-dark text-ink',
        )}
      >
        <span className="text-ink-mid font-semibold">{label}</span>
        <span>{summary}</span>
        <span className="text-[9px] text-ink-light">▾</span>
      </button>
      {open && (
        <>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="close"
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="absolute z-20 mt-1 min-w-[180px] bg-white border border-line rounded shadow-md p-1.5">
            {options.length === 0 ? (
              <div className="px-2 py-1.5 text-[11px] text-ink-light">옵션 없음</div>
            ) : (
              options.map((o) => {
                const on = values.includes(o.value);
                return (
                  <button
                    type="button"
                    key={o.value}
                    onClick={() =>
                      onChange(on ? values.filter((v) => v !== o.value) : [...values, o.value])
                    }
                    className={cn(
                      'w-full text-left px-2 py-1.5 rounded text-[11.5px] flex items-center gap-2',
                      on
                        ? 'bg-brand-tint text-ink font-extrabold'
                        : 'text-ink-dark hover:bg-surface',
                    )}
                  >
                    <span
                      className={cn(
                        'inline-block w-3 h-3 rounded border',
                        on ? 'bg-brand-dark border-brand-dark' : 'border-line',
                      )}
                    >
                      {on && <span className="text-white text-[9px] leading-3 block">✓</span>}
                    </span>
                    {o.label}
                  </button>
                );
              })
            )}
            {values.length > 0 && (
              <div className="border-t border-line-soft mt-1 pt-1">
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="w-full text-left px-2 py-1 text-[10.5px] text-info hover:underline font-bold"
                >
                  초기화
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function FeedbackFilter({
  value,
  onChange,
}: {
  value: FeedbackKind | 'all';
  onChange: (v: FeedbackKind | 'all') => void;
}) {
  const opts: { v: FeedbackKind | 'all'; label: string }[] = [
    { v: 'all', label: '전체' },
    { v: 'up', label: '👍' },
    { v: 'down', label: '👎' },
    { v: 'none', label: '미평가' },
  ];
  return (
    <div className="inline-flex gap-1 items-center">
      <span className="text-[11px] text-ink-mid font-semibold mr-1">피드백</span>
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={cn(
            'h-7 px-2.5 rounded border text-[11px] font-extrabold',
            value === o.v
              ? 'bg-brand-tint border-brand-dark text-ink'
              : 'bg-white border-line text-ink-dark hover:border-brand-dark',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * 피드백 표시
 * ────────────────────────────────────────────────────────────── */

function FeedbackBanner({ kind, comment }: { kind: FeedbackKind; comment?: string }) {
  if (kind === 'none') {
    return (
      <div className="text-[11.5px] text-ink-mid">
        <span className="pill bg-surface text-ink-mid border border-line-soft">미평가</span>
        <span className="ml-2 text-ink-light">사용자가 피드백을 남기지 않았습니다.</span>
      </div>
    );
  }
  const tone =
    kind === 'up'
      ? 'bg-ok-bg text-ok border-ok-border'
      : 'bg-bad-bg text-bad border-bad-border';
  const icon = kind === 'up' ? '👍' : '👎';
  const label = kind === 'up' ? '좋아요' : '아쉬워요';
  return (
    <div className="flex items-start gap-2.5">
      <span className={cn('pill border', tone)}>
        <span className="mr-1">{icon}</span>
        {label}
      </span>
      {comment ? (
        <span className="text-[12px] text-ink-dark italic flex-1">"{comment}"</span>
      ) : (
        <span className="text-[11.5px] text-ink-mid">코멘트 없음</span>
      )}
    </div>
  );
}

function FeedbackIcon({ kind, small }: { kind: FeedbackKind; small?: boolean }) {
  const size = small ? 'text-[11px]' : 'text-[12px]';
  if (kind === 'up') return <span className={cn(size, 'text-ok font-extrabold')}>👍</span>;
  if (kind === 'down') return <span className={cn(size, 'text-bad font-extrabold')}>👎</span>;
  return <span className={cn(size, 'text-ink-light font-semibold')}>—</span>;
}

/* ──────────────────────────────────────────────────────────────
 * util
 * ────────────────────────────────────────────────────────────── */

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}초`;
  return `${m}분 ${s}초`;
}
