import { useState } from 'react';
import { Link } from 'react-router-dom';
import { type FeaturedAgent } from '@/data/mockFeaturedAgents';
import { MY_AGENTS, RECENT_SERVICES } from '@/data/mockMyAgents';
import { CHAT_AGENTS, CHAT_MODELS } from '@/data/mockChat';
import KpiCard from '@/components/ui/KpiCard';
import StatusPill from '@/components/ui/StatusPill';
import { cn } from '@/lib/utils';
import { useCurrentPersona } from '@/lib/persona';
import { useFavorites, usePersonalization, setPersonalization, toggleFavorite } from '@/lib/personalization';
import { toast } from '@/lib/toast';
import {
  getHomeKpis,
  getHomeFeaturedAgents,
  getHomeApprovals,
  getHomeGreetingSummary,
  canAccessArea,
  canAccessGovernance,
} from '@/lib/personaView';

const APPR_CHIP: Record<string, { cls: string; label: string }> = {
  register: { cls: 'bg-brand-tint text-brand border-brand-tint', label: '프로젝트 생성' },
  train: { cls: 'bg-info-bg text-info border-info-border', label: '학습계' },
  serv: { cls: 'bg-ok-bg text-ok border-ok-border', label: '서빙계 배포' },
  discard: { cls: 'bg-accent-brown-bg text-accent-brown border-accent-brown-border', label: '폐기' },
  policy: { cls: 'bg-warn-bg text-warn border-warn-border', label: '정책' },
  table: { cls: 'bg-accent-purple-bg text-accent-purple border-accent-purple-border', label: '테이블 생성' },
  account: { cls: 'bg-bad-bg text-bad border-bad-border', label: '계정 생성' },
  redteam: { cls: 'bg-warn-bg text-bad border-bad-border', label: '레드팀 신청' },
};

/** 홈 대시보드 — 개인 워크스페이스. KPI / 결재 / AI Studio · 거버넌스 포탈 진입 */
export default function HomePage() {
  const persona = useCurrentPersona();
  const displayName = persona?.name ?? '김플랫';
  const kpis = getHomeKpis(persona);
  const featuredAgents = getHomeFeaturedAgents(persona);
  const homeApprovals = getHomeApprovals(persona);
  const greetingSummary = getHomeGreetingSummary(persona);
  // 권한 밖 진입 타일은 그리지 않는다(RFP 2-1 권한 기반 화면 구성).
  const showStudio = canAccessArea(persona, 'studio');
  const showGovernance = canAccessGovernance(persona);
  const favorites = useFavorites();
  const [showPersonalize, setShowPersonalize] = useState(false);

  return (
    <div className="max-w-[1360px] mx-auto px-6 py-6">
      {/* Greeting */}
      <div className="mb-3.5 flex items-baseline gap-3">
        <h1 className="text-[22px] font-extrabold text-ink tracking-[-0.3px]">
          안녕하세요, {displayName} 님 👋
        </h1>
        <span className="text-xs text-ink-mid font-semibold">{greetingSummary}</span>
      </div>

      {/* KPI band */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <KpiCard
          tone="ok"
          label="내 과제"
          value={`${kpis.myProjectCount}`}
          unit="건"
        />
        <KpiCard
          tone="bad"
          label="결재 대기"
          value={`${kpis.pendingApprovalCount}`}
          unit="건"
        />
      </div>

      {/* 대표 에이전트 — 그룹 표준 추천 큐레이션 */}
      <section className="mb-4">
        <div className="flex items-baseline justify-between mb-2.5">
          <h3 className="text-base font-extrabold text-ink">대표 에이전트</h3>
          <Link to="/catalog" className="text-[11.5px] font-bold text-info hover:underline">
            마켓플레이스 →
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {featuredAgents.map((a) => (
            <FeaturedAgentCard key={a.id} agent={a} />
          ))}
        </div>
      </section>

      {/* My Agent · 즐겨찾기 · 최근 이용서비스 (RFP 2-1 개인화 기능) */}
      <section className="grid grid-cols-3 gap-3 mb-4">
        <div className="card p-4">
          <div className="flex items-baseline justify-between mb-2">
            <h3 className="text-[13px] font-extrabold text-ink">My Agent</h3>
            <button
              type="button"
              onClick={() => setShowPersonalize(true)}
              className="text-[10.5px] font-bold text-info hover:underline"
            >개인화 설정</button>
          </div>
          <div className="flex flex-col gap-1.5">
            {MY_AGENTS.map((a) => (
              <Link
                key={a.id}
                to={a.href}
                className="block text-[11px] font-semibold text-ink-dark leading-snug border-b border-line-soft last:border-0 pb-1.5 last:pb-0 rounded px-1 -mx-1 hover:bg-surface-soft"
              >
                <b className="text-ink">{a.name}</b>
                <div className="text-[10px] text-ink-mid mt-0.5">{a.desc} · {a.lastUsedAt}</div>
              </Link>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <h3 className="text-[13px] font-extrabold text-ink mb-2">즐겨찾기</h3>
          {favorites.length === 0 ? (
            <p className="text-[11px] text-ink-mid font-semibold">
              마켓플레이스에서 ★ 를 눌러 자주 쓰는 자산을 등록하세요
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {favorites.map((f) => (
                <div key={f.id} className="flex items-center gap-2">
                  <span className="pill bg-surface-soft text-ink-mid border border-line-soft">{f.kind}</span>
                  <Link
                    to={f.href}
                    className="text-[11px] font-bold text-ink-dark truncate flex-1 hover:text-brand hover:underline"
                  >{f.name}</Link>
                  <button
                    type="button"
                    onClick={() => toggleFavorite(f)}
                    className="text-warn text-[13px]"
                    title="즐겨찾기 해제"
                  >★</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-4">
          <h3 className="text-[13px] font-extrabold text-ink mb-2">최근 이용서비스</h3>
          <div className="flex flex-col gap-1.5">
            {RECENT_SERVICES.slice(0, 4).map((r) => (
              <div key={r.id + r.usedAt} className="flex items-center gap-2 text-[11px]">
                <span className="pill bg-surface-soft text-ink-mid border border-line-soft">{r.kind}</span>
                <Link
                  to={r.href}
                  className="font-bold text-ink-dark truncate flex-1 hover:text-brand hover:underline"
                >{r.name}</Link>
                <span className="text-[10px] text-ink-mid font-semibold whitespace-nowrap">{r.usedAt}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-12 gap-3.5 items-stretch">
        {/* 결재 위젯 */}
        <div className="card col-span-8 p-5 min-h-[420px]">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-base font-extrabold text-ink">내 결재 · 기안</h3>
            <Link to="/approvals" className="text-[11.5px] font-bold text-info hover:underline">
              전역 결재함 →
            </Link>
          </div>
          <div className="flex flex-col gap-1.5">
            {homeApprovals.map((a) => {
              const chip = APPR_CHIP[a.category];
              return (
                <Link
                  key={a.id}
                  to={`/approvals/${a.id}`}
                  className="grid grid-cols-[auto_1fr_auto_auto] gap-2.5 items-center py-2.5 px-3 bg-surface-soft border border-line-soft rounded hover:border-brand-dark"
                >
                  <span
                    className={cn(
                      'pill border min-w-[88px] text-center whitespace-nowrap',
                      chip.cls,
                    )}
                  >
                    {chip.label}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-ink truncate">
                      {a.title}
                      {a.projectName && (
                        <span className="ml-1.5 text-2xs text-ink-mid font-semibold">
                          · {a.projectName}
                        </span>
                      )}
                    </div>
                    <div className="text-2xs text-ink-mid font-semibold mt-0.5">
                      기안 {a.draftedBy} · {a.draftedAt}
                    </div>
                  </div>
                  <span className="text-2xs text-ink-mid font-bold text-right leading-tight">
                    <b className="text-ink-dark">
                      {a.stage.current}/{a.stage.total} 단계
                    </b>
                    <br />
                    {a.stage.label}
                  </span>
                  <StatusPill
                    tone={a.state === 'pending' ? 'warn' : a.state === 'done' ? 'ok' : 'bad'}
                  >
                    {a.state === 'pending' ? '진행 중' : a.state === 'done' ? '완료' : '반려'}
                  </StatusPill>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="col-span-4 flex flex-col gap-3.5">
          {/* 내 과제 — 프로젝트 계층을 걷어내고 AI Studio 로 바로 보낸다 */}
          {showStudio && (
          <Link to="/studio" className="card p-5 block hover:border-brand-dark transition-colors">
            <div className="flex items-baseline justify-between mb-2">
              <h3 className="text-base font-extrabold text-ink">AI Studio</h3>
              <span className="pill bg-info-bg text-info border border-info-border">제작</span>
            </div>
            <p className="text-[11.5px] text-ink-dark font-semibold leading-relaxed">
              에이전트 · 워크플로우 · Tool 을 만들고, 플레이그라운드에서 시험한 뒤 승인 절차를
              거쳐 배포한다.
            </p>
            <div className="mt-2.5 pt-2.5 border-t border-line-soft text-[11px] font-extrabold text-info">
              내 과제 보기 →
            </div>
          </Link>
          )}

          {/*
            별도 포탈 진입 — RFP 2-3 이 AI거버넌스를 "포탈 내 별도 기능" 으로 규정하므로
            GNB 메뉴에서 빼고 홈의 진입 타일로만 노출한다.
          */}
          {showGovernance && (
          <Link
            to="/governance"
            className="card p-5 block hover:border-brand-dark transition-colors"
          >
            <div className="flex items-baseline justify-between mb-2">
              <h3 className="text-base font-extrabold text-ink">AI 거버넌스 포탈</h3>
              <span className="pill bg-accent-brown-bg text-accent-brown border border-accent-brown-border">
                별도 포탈
              </span>
            </div>
            <p className="text-[11.5px] text-ink-dark font-semibold leading-relaxed">
              AI기본법 대응 원장 · 라이프사이클 관문 · 연 1회 재평가 기일을 그룹 단위로
              관리한다.
            </p>
            <div className="mt-2.5 pt-2.5 border-t border-line-soft text-[11px] font-extrabold text-info">
              포탈 열기 →
            </div>
          </Link>
          )}
        </div>
      </div>

      {showPersonalize && <PersonalizationModal onClose={() => setShowPersonalize(false)} />}
    </div>
  );
}

function PersonalizationModal({ onClose }: { onClose: () => void }) {
  const settings = usePersonalization();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-ink/25" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-[440px] bg-white border border-line rounded-lg shadow-xl">
        <div className="px-5 pt-4 pb-3 border-b border-line-soft flex items-start gap-3">
          <h2 className="text-[14.5px] font-extrabold text-ink flex-1">개인화 설정</h2>
          <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip">2-1 개인화</span>
          <button type="button" onClick={onClose} className="text-[16px] font-black text-ink-light hover:text-ink-dark leading-none">✕</button>
        </div>
        <div className="px-5 py-4 space-y-3.5">
          <div>
            <label className="block text-[10px] text-ink-light font-extrabold uppercase tracking-[0.3px] mb-1">기본 모델</label>
            {/* 선택지는 Chat 모델 피커(CHAT_MODELS)에서 파생 — 손으로 나열하면 두 목록이 어긋난다. */}
            <select
              value={settings.defaultModel}
              onChange={(e) => setPersonalization({ defaultModel: e.target.value })}
              className="w-full py-1.5 px-2 border border-line rounded text-[12px] bg-white font-semibold"
            >
              {CHAT_MODELS.map((m) => (
                <option key={m.id} value={m.name}>{m.name} — {m.hint}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-ink-light font-extrabold uppercase tracking-[0.3px] mb-1">기본 에이전트</label>
            <select
              value={settings.defaultAgent}
              onChange={(e) => setPersonalization({ defaultAgent: e.target.value })}
              className="w-full py-1.5 px-2 border border-line rounded text-[12px] bg-white font-semibold"
            >
              {CHAT_AGENTS.map((a) => (
                <option key={a.id} value={a.name}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] text-ink-light font-extrabold uppercase tracking-[0.3px] mb-1.5">알림</label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-[11.5px] font-semibold text-ink-dark">
                <input type="checkbox" checked={settings.notifyEmail} onChange={(e) => setPersonalization({ notifyEmail: e.target.checked })} />
                이메일
              </label>
              <label className="flex items-center gap-1.5 text-[11.5px] font-semibold text-ink-dark">
                <input type="checkbox" checked={settings.notifyPush} onChange={(e) => setPersonalization({ notifyPush: e.target.checked })} />
                포탈 알림
              </label>
            </div>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-line-soft flex justify-end">
          <button
            type="button"
            onClick={() => { toast('개인화 설정을 저장했습니다'); onClose(); }}
            className="py-1.5 px-4 bg-brand border border-brand-dark rounded text-[12px] font-extrabold text-white hover:bg-brand-dark"
          >저장</button>
        </div>
      </div>
    </div>
  );
}

function FeaturedAgentCard({ agent }: { agent: FeaturedAgent }) {
  return (
    <Link
      to={agent.projectHref}
      className="card px-5 py-4 hover:border-brand-dark transition-colors block"
    >
      <div className="mb-2.5">
        <div className="text-[10.5px] font-extrabold text-ink-mid tracking-[0.3px] font-mono mb-0.5">
          {agent.id}
        </div>
        <h4 className="text-[13.5px] font-extrabold text-ink leading-snug truncate">
          {agent.name}
        </h4>
      </div>
      <p className="text-[12px] text-ink-dark leading-relaxed line-clamp-3 min-h-[54px]">
        {agent.description}
      </p>
      <div className="mt-2.5 pt-2.5 border-t border-line-soft text-[10.5px] text-ink-mid font-semibold">
        <b className="text-ink-dark">{agent.projectName}</b>
      </div>
    </Link>
  );
}
