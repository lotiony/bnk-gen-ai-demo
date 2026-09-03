/**
 * 배포 결재 상신 완료 팝업 — AI Studio 「기안」 직후.
 *
 * RFP: LSM-009(승인 기반 에이전트 배포) · ONM-003(직무 분리 기반 RBAC)
 *
 * 여기서 말해야 하는 건 딱 하나다 — **개발이 끝났다고 배포된 게 아니다.**
 * 그래서 결재 번호·결재선·직무 분리 세 가지만 보여 주고 닫는다.
 *
 * 결재선은 `submitAgentDeploy` 가 만든 `stages` 를 그대로 그린다. 여기서 문구를
 * 따로 만들면 결재함을 열었을 때 다른 결재선이 나온다.
 */
import { Link } from 'react-router-dom';
import Button from '@/components/ui/Button';
import { deployLine, type AgentDeployApproval } from '@/data/mockApprovals';

export default function DeploySubmitModal({
  dep,
  onClose,
}: {
  dep: AgentDeployApproval;
  onClose: () => void;
}) {
  const line = deployLine(dep);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-6">
      <div className="w-full max-w-[560px] bg-white border border-line rounded-lg shadow-xl overflow-hidden">
        {/* 헤더 */}
        <div className="px-5 py-4 border-b border-line-soft">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-5 h-5 rounded-full bg-ok text-white inline-flex items-center justify-center text-[11px] font-extrabold">
              ✓
            </span>
            <h2 className="text-[15px] font-extrabold text-ink">
              {dep.deployStage} 배포 결재 상신 완료
            </h2>
            <span className="ml-auto text-[11px] font-mono font-bold text-ink-light">
              {dep.approvalId}
            </span>
          </div>
          <p className="text-[11.5px] text-ink-mid font-semibold">
            <b className="text-ink-dark">{dep.agentName}</b> · 사용 범위 {dep.useScope} ·{' '}
            {dep.ownerTenant}
          </p>
        </div>

        <div className="px-5 py-4 space-y-3.5">
          {/* 필수 항목 확인 */}
          <section>
            <div className="text-[10px] font-extrabold text-ink-light uppercase tracking-wide mb-1.5">
              필수 항목 확인
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {dep.checks.map((c) => (
                <div key={c.k} className="flex items-baseline gap-1.5 text-[11.5px]">
                  <span className={c.pass ? 'text-ok' : 'text-warn'}>{c.pass ? '✓' : '·'}</span>
                  <span className="text-ink-mid font-semibold">{c.k}</span>
                  <span className="ml-auto text-ink-dark font-bold truncate" title={c.v}>
                    {c.v}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* 결재선 */}
          <section>
            <div className="text-[10px] font-extrabold text-ink-light uppercase tracking-wide mb-1.5">
              결재선
            </div>
            <div className="space-y-1">
              {line.map((st) => (
                <div
                  key={`${st.seq}-${st.label}`}
                  className={
                    'flex items-center gap-2.5 py-1.5 px-2.5 rounded border ' +
                    (st.tone === 'done'
                      ? 'bg-surface-soft border-line-soft'
                      : st.tone === 'current'
                      ? 'bg-warn-bg border-warn-border'
                      : 'bg-white border-line-soft')
                  }
                >
                  <span className="w-5 h-5 rounded-full bg-white border border-line inline-flex items-center justify-center text-[10px] font-extrabold text-ink-dark flex-shrink-0">
                    {st.seq}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[11.5px] font-extrabold text-ink leading-tight">
                      {st.label}
                    </div>
                    <div className="text-[10.5px] text-ink-mid font-semibold truncate">{st.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 직무 분리 */}
          <div className="bg-warn-bg border border-warn-border rounded px-3.5 py-2.5">
            <div className="text-[11.5px] font-extrabold text-warn mb-0.5">
              직무 분리(SoD) · ONM-003
            </div>
            <p className="text-[11px] text-ink-dark font-semibold leading-relaxed">
              개발자는 본인이 만든 에이전트의 배포를 승인할 수 없습니다. 이 결재는{' '}
              <b>{dep.draftedBy}</b> 계정에서는 열람만 가능하며, 승인 버튼이 나오지 않습니다.
            </p>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-line-soft flex items-center gap-2">
          <Link
            to={`/approvals/${dep.approvalId}`}
            className="text-[11.5px] font-extrabold text-info hover:underline"
          >
            결재 상세 보기 →
          </Link>
          <div className="ml-auto">
            <Button variant="primary" onClick={onClose}>
              확인 — 과제 목록으로
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
