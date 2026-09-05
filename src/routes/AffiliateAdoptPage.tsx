/**
 * 계열사 적용 확인 — 외환 시나리오 화면 09 「같이 쓰되, 당행 기준으로 운영합니다」.
 *
 * RFP 근거
 *  · 「기타」 "그룹 공통 AI자산은 재사용하되 **계열사별 데이터·보안·권한 정책을
 *    독립적으로 적용**" · "계열사 간 데이터의 비인가 접근, 전송 및 교차 활용 방지"
 *  · SEC-001 테넌트 격리 · ONM-003 직무 분리(개발자와 승인자가 다른 사람)
 *  · 1.3.2 관리자 승인 절차 기반 배포 통제
 *
 * 이 화면이 왜 필요한가 — 마켓플레이스에서 「당행 적용 준비」를 눌렀을 때 바로
 * 켜지면, 그룹 자산이 계열사 검증 없이 그대로 흘러 들어가는 그림이 된다.
 * 공유되는 것은 **업무 흐름과 결과 형식**이고, 자료·사용자·테스트·승인은
 * 계열사가 다시 밟는다. 그 네 줄을 눈에 보이게 하는 것이 이 화면의 전부다.
 *
 * ⚠️ 상태는 메모리뿐이다(CLAUDE.md 절대 규칙). 새로고침하면 처음으로 돌아간다.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Crumb from '@/components/ui/Crumb';
import Button from '@/components/ui/Button';
import StatusPill from '@/components/ui/StatusPill';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { useCurrentPersona } from '@/lib/persona';
import { approvedImprovementOf, useApprovalRevision } from '@/data/mockApprovals';
import { GROUP_AGENTS } from '@/data/mockGroupAgents';
import { FX_ADOPT_NOTE, FX_ADOPT_STEPS, FX_SHARE_SCOPE } from '@/data/mockFxAssist';
import { TENANTS } from '@/data/tenants';

export default function AffiliateAdoptPage() {
  const { agentId } = useParams();
  const persona = useCurrentPersona();
  const navigate = useNavigate();
  useApprovalRevision();

  const agent = GROUP_AGENTS.find((a) => a.id === agentId);
  const imp = agentId ? approvedImprovementOf(agentId) : undefined;

  /** 계열사가 직접 확인해야 하는 항목 — 전부 체크해야 승인 버튼이 열린다. */
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [approved, setApproved] = useState(false);
  const ready = useMemo(
    () => FX_ADOPT_STEPS.filter((s) => s.id !== 'approve').every((s) => checked[s.id]),
    [checked],
  );

  const ns = TENANTS.find((t) => t.name === persona?.tenant)?.namespace ?? '-';

  /*
   * 열람 자격 — 마켓플레이스의 버튼 노출 조건과 **같은 규칙**을 쓴다.
   * 딥링크로 들어와도 같은 판정이 걸려야 화면이 권한 구조와 다른 말을 하지 않는다.
   */
  const allowed =
    !!agent && !!imp?.shared && persona?.group === '관리자' && persona.tenant !== agent.ownerTenant;

  if (!agent || !imp?.shared) {
    return (
      <div className="max-w-[1360px] mx-auto px-6 py-6">
        <Crumb items={[{ label: '마켓플레이스', to: '/catalog' }, { label: '적용 대상 없음' }]} />
        <div className="card px-6 py-10 text-center">
          <div className="text-[32px] mb-2">📭</div>
          <h1 className="text-lg font-extrabold text-ink mb-1.5">
            아직 공유된 개선 버전이 없습니다
          </h1>
          <p className="text-xs text-ink-mid font-semibold">
            소유 계열사의 승인과 그룹 공유 등록이 끝나야 다른 계열사가 적용할 수 있습니다.
          </p>
          <Link to="/catalog" className="inline-block mt-4 text-[12px] font-bold text-info hover:underline">
            마켓플레이스로 →
          </Link>
        </div>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="max-w-[1360px] mx-auto px-6 py-6">
        <Crumb items={[{ label: '마켓플레이스', to: '/catalog' }, { label: '권한 없음' }]} />
        <div className="card px-6 py-10 text-center">
          <div className="text-[32px] mb-2">🔒</div>
          <h1 className="text-lg font-extrabold text-ink mb-1.5">
            계열사 적용은 AI서비스 관리자가 결정합니다
          </h1>
          <p className="text-xs text-ink-mid font-semibold leading-relaxed">
            {persona?.role ?? '현재'} 권한으로는 당행 적용을 승인할 수 없습니다. 자산을 소유한{' '}
            {agent.ownerTenant} 는 이미 운영 중이므로 적용 대상이 아닙니다.
          </p>
          <Link to="/catalog" className="inline-block mt-4 text-[12px] font-bold text-info hover:underline">
            마켓플레이스로 →
          </Link>
        </div>
      </div>
    );
  }

  const approve = () => {
    setApproved(true);
    toast(
      '당행 운영 승인 완료',
      `${persona?.tenant} · ${agent.name} ${imp.version} 이(가) ${ns} 에서 운영 시작됩니다`,
      'ok',
    );
  };

  return (
    <div className="max-w-[1360px] mx-auto px-6 py-6">
      <Crumb
        items={[
          { label: '마켓플레이스', to: '/catalog' },
          { label: '계열사 적용 확인' },
          { label: agent.name },
        ]}
        trailing={agent.id}
      />

      {/* ── 헤더 ── */}
      <div className="card px-6 py-5 mb-3.5">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="pill bg-ok-bg text-ok border border-ok-border">개선 버전</span>
          <StatusPill tone={approved ? 'ok' : 'warn'}>
            {approved ? '당행 운영 중' : '적용 준비'}
          </StatusPill>
          <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip">
            SEC-001 테넌트 격리 · ONM-003 직무 분리
          </span>
        </div>
        <h1 className="text-[22px] font-extrabold text-ink tracking-[-0.3px] mb-1.5">
          같이 쓰되, 당행 기준으로 운영합니다
        </h1>
        <p className="text-xs text-ink-mid font-semibold">
          {agent.name} {imp.version} · 제작 주관 <b className="text-ink-dark">{agent.ownerTenant}</b>{' '}
          · 적용 계열사 <b className="text-ink-dark">{persona?.tenant}</b>{' '}
          <span className="font-mono text-ink-light">{ns}</span>
        </p>
      </div>

      <div className="grid grid-cols-[1fr_340px] gap-3.5">
        <div>
          {/* ── ① 무엇이 공유되고 무엇이 남는가 ── */}
          <section className="card px-5 py-4 mb-3.5">
            <div className="flex items-baseline gap-2 mb-2.5 flex-wrap">
              <h2 className="text-[15px] font-extrabold text-ink">공유 범위</h2>
              <span className="text-[11.5px] text-ink-mid font-semibold">
                업무 방식은 함께 쓰고, 고객 자료는 각 은행에 남습니다
              </span>
            </div>
            <div className="border border-line-soft rounded overflow-hidden">
              {FX_SHARE_SCOPE.map((r, i) => (
                <div
                  key={r.k}
                  className={cn(
                    'grid grid-cols-[128px_1fr_auto] gap-3 items-center px-3.5 py-2.5',
                    i > 0 && 'border-t border-line-soft',
                    r.shared ? 'bg-ok-bg/40' : 'bg-white',
                  )}
                >
                  <span className="text-[11.5px] font-extrabold text-ink">{r.k}</span>
                  <span className="text-[11.5px] text-ink-dark font-semibold leading-snug">{r.v}</span>
                  <span
                    className={cn(
                      'pill border',
                      r.shared
                        ? 'bg-white text-ok border-ok-border'
                        : 'bg-white text-ink-mid border-line',
                    )}
                  >
                    {r.shared ? '공유됨' : '계열사 고유'}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* ── ② 당행 적용 확인 4행 ── */}
          <section className="card px-5 py-4 mb-3.5">
            <div className="flex items-baseline gap-2 mb-2.5 flex-wrap">
              <h2 className="text-[15px] font-extrabold text-ink">{persona?.tenant} 적용 확인</h2>
              <span className="text-[11.5px] text-ink-mid font-semibold">
                자료와 사용자를 설정하고, 자체 테스트를 거친 뒤 승인합니다
              </span>
            </div>
            <div className="border border-line-soft rounded overflow-hidden">
              {FX_ADOPT_STEPS.map((s, i) => {
                const isApproveRow = s.id === 'approve';
                const on = isApproveRow ? approved : !!checked[s.id];
                return (
                  <div
                    key={s.id}
                    className={cn(
                      'grid grid-cols-[110px_1fr_auto] gap-3 items-center px-3.5 py-3',
                      i > 0 && 'border-t border-line-soft',
                      on && 'bg-ok-bg/40',
                    )}
                  >
                    <span className="text-[12px] font-extrabold text-ink">{s.k}</span>
                    <span className="text-[11.5px] text-ink-dark font-semibold leading-snug">
                      {s.v}
                    </span>
                    {isApproveRow ? (
                      <Button
                        variant="primary"
                        onClick={approve}
                        disabled={!ready || approved}
                        className={cn(!approved && ready && 'bg-ok border-ok hover:bg-ok')}
                      >
                        {approved ? '✓ 운영 승인됨' : '운영 승인'}
                      </Button>
                    ) : (
                      <label
                        className={cn(
                          'inline-flex items-center gap-1.5 px-3 h-8 rounded border text-[11.5px] font-bold',
                          approved ? 'cursor-default' : 'cursor-pointer',
                          on ? 'bg-white border-ok text-ok' : 'bg-white border-line text-ink-mid',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={approved}
                          onChange={() => setChecked((c) => ({ ...c, [s.id]: !c[s.id] }))}
                          className="accent-ok"
                        />
                        {on ? '확인함' : '확인'}
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-ink-mid font-semibold leading-snug">
              {FX_ADOPT_NOTE}
            </p>
          </section>

          {/* ── ③ 승인 후 ── */}
          {approved && (
            <section className="card px-5 py-4 border-ok">
              <h2 className="text-[13px] font-extrabold text-ok mb-2">
                ✓ {persona?.tenant} 운영 승인 완료
              </h2>
              <ul className="space-y-1">
                {[
                  `${persona?.tenant} 외환 담당 직원이 ${ns} 에서 개선 버전을 사용합니다.`,
                  `조회·생성되는 고객 자료는 ${ns} 를 벗어나지 않습니다 (SEC-001).`,
                  // 계열사명 뒤에 조사를 붙이면 받침에 따라 로/으로가 갈린다 — 조사를 피해 쓴다.
                  `사용량과 비용은 ${persona?.tenant} 미터링에 집계되고, 자산 소유는 제작 주관 계열사(${agent.ownerTenant})에 그대로 남습니다.`,
                  `적용 이력이 통합 감사 원장에 기록됩니다 (ONM-004).`,
                ].map((t) => (
                  <li key={t} className="flex items-start gap-1.5">
                    <span className="text-ok text-[11px] leading-[1.6] font-extrabold">·</span>
                    <span className="text-[11.5px] text-ink-dark font-semibold leading-snug">{t}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-center gap-2">
                <Button variant="primary" onClick={() => navigate('/chat?agent=' + agent.id)}>
                  개선판으로 대화 시작 →
                </Button>
                <Link to="/admin/metering" className="text-[12px] font-bold text-info hover:underline">
                  당행 활용 현황 보기 →
                </Link>
              </div>
            </section>
          )}
        </div>

        {/* ── 우측 ── */}
        <aside className="sticky top-[106px] self-start space-y-3">
          <section className="card px-4 py-3.5">
            <h3 className="text-[12px] font-extrabold text-ink mb-2">개선 내용</h3>
            <div className="space-y-1.5">
              {imp.elements.map((e) => (
                <div key={e.k} className="border-b border-line-soft last:border-0 pb-1.5 last:pb-0">
                  <div className="text-[11.5px] font-extrabold text-ok">{e.k}</div>
                  <div className="text-[10.5px] text-ink-mid font-semibold leading-snug">{e.v}</div>
                </div>
              ))}
            </div>
            <p className="mt-2 pt-2 border-t border-line-soft text-[10.5px] text-ink-mid font-semibold leading-snug">
              제안자 {imp.requestedBy} ({imp.requesterDept}) · 승인 {imp.ownerTenant} AI서비스 관리자
            </p>
          </section>

          <section className="card px-4 py-3.5">
            <h3 className="text-[12px] font-extrabold text-ink mb-1.5">직무 분리</h3>
            <p className="text-[11px] text-ink-mid font-semibold leading-relaxed">
              당행 적용도 개발자가 아니라 <b className="text-ink-dark">계열사 AI서비스 관리자</b>가
              승인합니다. 자체 테스트를 확인하지 않으면 승인 버튼이 열리지 않습니다 (ONM-003).
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
