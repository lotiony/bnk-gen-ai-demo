/**
 * 관리 콘솔 — 계열사 자산 활용 현황 · 그룹 승격 판단. 시연 3막 파트 B (3B-2 ~ 3B-6).
 *
 * RFP: 1.3.2 「관리자 승인 절차 기반 배포·공유 범위 통제」 ·
 *      2-1 관리자 포털 40(공개·공유 범위 설정) · ONM-005
 *
 * **지주 관리자만의 화면이다.** 계열사 관리자는 자기 계열사 자산만 본다 —
 * 계열사를 가로지르는 재사용 현황은 여기서만 보이고, 그래서 "그룹 공동
 * 자산으로 올릴까" 라는 판단도 여기서만 나온다.
 *
 * 판단의 근거는 **반복된 개별 요청 이력**이다. 같은 자산에 여섯 번 같은
 * 절차가 돌았다면 절차를 반복시키는 것보다 범위를 넓히는 게 맞다.
 *
 * 승격은 기존 결재 기계를 그대로 쓴다(`createScopePromotion`). 결재선도
 * 마켓플레이스의 「그룹 공개 요청」과 같다 — 기안 → 소유 계열사 관리자 →
 * 그룹 거버넌스. 상신 주체만 지주 관리자로 바뀐다. 두 화면이 다른 결재선을
 * 말하면 그 자체가 리스크다.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import StatusPill from '@/components/ui/StatusPill';
import Button from '@/components/ui/Button';
import { toast } from '@/lib/toast';
import { TENANT_SHORT } from '@/data/tenants';
import { useCurrentPersona } from '@/lib/persona';
import {
  spreadRows,
  SPREAD_THRESHOLD,
  isSpreadCandidate,
  requestsOf,
  promotionEffects,
  type SpreadRow,
} from '@/data/mockAssetSpread';
import {
  createScopePromotion,
  previewPromotionApprovers,
  findPromotionByAsset,
  useApprovalRevision,
} from '@/data/mockApprovals';

export default function AdminAssetSpreadPage() {
  const rev = useApprovalRevision();
  const persona = useCurrentPersona();
  const [openId, setOpenId] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<SpreadRow | null>(null);
  // 승격이 최종 승인되면 범위가 바뀌므로 결재 리비전에 맞춰 다시 읽는다.
  const rows = useMemo(() => spreadRows(), [rev]);
  const open = rows.find((r) => r.assetId === openId) ?? null;
  const candidates = rows.filter(isSpreadCandidate);

  return (
    <div>
      <div className="flex items-start gap-3 mb-3.5">
        <div className="min-w-0 flex-1">
          <h1 className="text-[19px] font-extrabold text-ink tracking-[-0.4px]">계열사 자산 활용 현황</h1>
          <p className="text-[11.5px] text-ink-mid font-semibold mt-1">
            각 계열사가 만든 자산이 <b className="text-ink-dark">다른 계열사에서 얼마나 요청받는지</b>{' '}
            조망한다 · 계열사 관리자는 자기 자산만 본다
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 pt-1">
          {['1.3.2', 'ONM-005'].map((r) => (
            <span key={r} className="pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip">
              {r}
            </span>
          ))}
        </div>
      </div>

      {candidates.length > 0 && (
        <div className="card px-4 py-3 mb-3.5 border border-warn-border bg-warn-bg">
          <div className="text-[12.5px] font-extrabold text-ink">
            승격 검토 대상 {candidates.length}건
          </div>
          <p className="text-[11px] text-ink-dark font-semibold mt-0.5">
            요청 계열사 {SPREAD_THRESHOLD}곳 이상 · 같은 절차가 반복되고 있다는 뜻이다
          </p>
        </div>
      )}

      {/* ── 3B-2 자산 활용 현황 ── */}
      <section className="card px-5 py-4 mb-3.5">
        <div className="flex items-center gap-2 mb-2.5">
          <h2 className="text-[14px] font-extrabold text-ink">계열사 소유 자산</h2>
          <span className="text-[11px] text-ink-mid font-semibold">요청 계열사 많은 순 · 행을 누르면 상세</span>
        </div>
        <div className="border border-line-soft rounded overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface-soft">
                <th className="text-left text-[10.5px] font-extrabold text-ink-mid uppercase tracking-[0.3px] px-2.5 py-1.5 border-b border-line-soft">자산</th>
                <th className="text-left text-[10.5px] font-extrabold text-ink-mid uppercase tracking-[0.3px] px-2.5 py-1.5 border-b border-line-soft">소유</th>
                {['현재 범위', '주간 호출', '요청 계열사', '사용 중', '평가'].map((h) => (
                  <th key={h} className="text-right text-[10.5px] font-extrabold text-ink-mid uppercase tracking-[0.3px] px-2.5 py-1.5 border-b border-line-soft whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const cand = isSpreadCandidate(r);
                return (
                  <tr
                    key={r.assetId}
                    onClick={() => setOpenId(r.assetId)}
                    className={cn(
                      'border-b border-line-soft last:border-b-0 cursor-pointer',
                      openId === r.assetId ? 'bg-brand-bg' : cand ? 'bg-warn-bg/40 hover:bg-warn-bg' : 'hover:bg-surface-soft',
                    )}
                  >
                    <td className="px-2.5 py-[7px]">
                      <span className="text-[10px] font-mono font-bold text-ink-light">{r.assetId}</span>
                      <span className="ml-2 text-[12px] font-extrabold text-ink">{r.assetName}</span>
                      {cand && <span className="ml-2 pill bg-warn-bg text-warn border border-warn-border">승격 검토</span>}
                    </td>
                    <td className="px-2.5 py-[7px] text-[11px] font-semibold text-ink-dark whitespace-nowrap">
                      {TENANT_SHORT[r.ownerTenant]} · {r.ownerName}
                    </td>
                    <td className="px-2.5 py-[7px] text-right whitespace-nowrap">
                      <StatusPill tone={r.scope === '그룹' ? 'ok' : 'neutral'}>{r.scope}</StatusPill>
                    </td>
                    <td className="px-2.5 py-[7px] text-right text-[11px] font-bold text-ink-dark tabular-nums">{r.callsWeekly.toLocaleString('ko-KR')}</td>
                    <td className={cn('px-2.5 py-[7px] text-right text-[13px] font-extrabold tabular-nums', cand ? 'text-warn' : 'text-ink')}>{r.requestingTenants}곳</td>
                    <td className="px-2.5 py-[7px] text-right text-[11px] font-semibold text-ink-mid tabular-nums">{r.grantedTenants}곳</td>
                    <td className="px-2.5 py-[7px] text-right text-[11px] font-bold text-ink-dark tabular-nums whitespace-nowrap">★ {r.rating} ({r.ratingCount})</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── 3B-3 자산 상세 · 3B-4 요청 이력 ── */}
      {open && <AssetDetail row={open} onReview={() => setReviewing(open)} onClose={() => setOpenId(null)} />}

      {/* ── 3B-5 승격 검토 · 상신 ── */}
      {reviewing && (
        <PromotionReviewModal
          row={reviewing}
          drafter={persona?.name ?? '김플랫'}
          drafterRole={persona?.role ?? '플랫폼 관리자'}
          drafterTenant={persona?.tenant ?? '그룹 공통'}
          onClose={() => setReviewing(null)}
        />
      )}
    </div>
  );
}

/* ═══════════════ 3B-3 · 3B-4 자산 상세와 요청 이력 ═══════════════ */

function AssetDetail({ row, onReview, onClose }: { row: SpreadRow; onReview: () => void; onClose: () => void }) {
  const reqs = requestsOf(row.assetId);
  const pending = reqs.filter((r) => r.state === '검토 중').length;
  // 이미 승격 결재가 올라간 자산이면 중복 상신을 막는다.
  const existing = findPromotionByAsset(row.assetId);

  return (
    <section className="card px-5 py-4 mb-3.5">
      <div className="flex items-start gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-[14px] font-extrabold text-ink">{row.assetName}</h2>
            <span className="text-[10px] font-mono font-bold text-ink-light">{row.assetId}</span>
            <StatusPill tone="neutral">현재 범위 {row.scope}</StatusPill>
          </div>
          <p className="text-[11px] text-ink-mid font-semibold mt-1">
            소유 <b className="text-ink-dark">{row.ownerTenant}</b> · 제작 {row.ownerName} · 주간{' '}
            {row.callsWeekly.toLocaleString('ko-KR')}회 · ★ {row.rating} ({row.ratingCount}명 평가)
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-[11px] font-extrabold text-ink-mid hover:text-ink border border-line rounded px-2 py-1">
          닫기 ✕
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2.5 mb-3.5">
        <Stat label="요청 계열사" value={`${row.requestingTenants}곳`} warn />
        <Stat label="승인되어 사용 중" value={`${row.grantedTenants}곳`} />
        <Stat label="검토 중인 요청" value={`${pending}건`} warn={pending > 0} />
        <Stat label="누적 요청" value={`${reqs.length}건`} />
      </div>

      {/* 3B-4 개별 권한 요청 이력 */}
      <div className="mb-3.5">
        <div className="flex items-baseline gap-2 mb-1.5">
          <h3 className="text-[12.5px] font-extrabold text-ink">개별 권한 요청 이력</h3>
          <span className="text-[10.5px] text-ink-mid font-semibold">
            계열사마다 같은 절차가 반복됐다 — 승격 판단의 근거
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          {reqs.map((r) => (
            <div key={r.id} className="grid grid-cols-[92px_92px_1fr_auto_auto] gap-3 items-center px-3 py-2 border border-line-soft rounded bg-white">
              <span className="text-[10px] font-mono font-bold text-ink-light">{r.id}</span>
              <span className="text-[11.5px] font-extrabold text-ink-dark whitespace-nowrap">{TENANT_SHORT[r.tenant]}</span>
              <span className="text-[11px] font-semibold text-ink-dark truncate" title={r.reason}>
                {r.requestedBy} ({r.dept}) · {r.reason}
              </span>
              <span className="text-[10.5px] text-ink-mid font-semibold whitespace-nowrap">
                {r.requestedAt}
                {r.decidedAt && ` → ${r.decidedAt}`}
              </span>
              <StatusPill tone={r.state === '승인' ? 'ok' : r.state === '검토 중' ? 'warn' : 'bad'}>{r.state}</StatusPill>
            </div>
          ))}
        </div>
      </div>

      {existing ? (
        <div className="rounded border border-info-border bg-info-bg px-3.5 py-2.5 flex items-center gap-3">
          <span className="text-[11.5px] font-extrabold text-info">이미 승격 결재가 진행 중입니다</span>
          <Link to={`/approvals/${existing.approvalId}`} className="ml-auto text-[11.5px] font-extrabold text-info hover:underline">
            {existing.approvalId} 결재 보기 →
          </Link>
        </div>
      ) : row.scope === '그룹' ? (
        <div className="rounded border border-ok-border bg-ok-bg px-3.5 py-2.5 text-[11.5px] font-extrabold text-ok">
          이미 그룹 공동 자산입니다 — 개별 요청 없이 10개 계열사가 사용합니다
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <p className="text-[11px] text-ink-mid font-semibold">
            {row.requestingTenants}곳이 요청했고 {pending}건이 아직 절차 중이다 · 범위를 넓히면 이 절차가 사라진다
          </p>
          <Button variant="primary" onClick={onReview}>그룹 공동 자산 승격 검토 →</Button>
        </div>
      )}
    </section>
  );
}

/* ═══════════════ 3B-5 · 3B-6 승격 검토 팝업 ═══════════════ */

function PromotionReviewModal({
  row, drafter, drafterRole, drafterTenant, onClose,
}: {
  row: SpreadRow;
  drafter: string;
  drafterRole: string;
  drafterTenant: string;
  onClose: () => void;
}) {
  const reqs = requestsOf(row.assetId);
  const effects = useMemo(() => promotionEffects(row), [row]);
  const approvers = useMemo(() => previewPromotionApprovers(row.ownerTenant, drafter), [row, drafter]);
  const [reason, setReason] = useState(
    `${row.requestingTenants}개 계열사가 개별 권한 요청을 반복하고 있습니다(누적 ${reqs.length}건). ` +
      `자산은 ${row.ownerTenant} 소유로 유지하되 노출 범위만 그룹으로 넓혀 개별 요청 절차를 없애는 것이 효율적이라고 판단합니다.`,
  );
  const [notified, setNotified] = useState(false);
  const valid = reason.trim().length >= 10 && notified;

  const submit = () => {
    if (!valid) return;
    const item = createScopePromotion({
      assetKind: 'agent',
      assetId: row.assetId,
      assetName: row.assetName,
      ownerTenant: row.ownerTenant,
      ownerName: row.ownerName,
      updatedAt: '2026-06-03 09:40',
      fromScope: row.scope,
      usage: row.callsWeekly,
      usageLabel: `주간 ${row.callsWeekly.toLocaleString('ko-KR')} 호출`,
      rating: row.rating,
      ratingCount: row.ratingCount,
      installs: row.grantedTenants,
      requestedBy: drafter,
      requesterRole: drafterRole,
      requesterTenant: drafterTenant as never,
      purpose: `${row.requestingTenants}개 계열사 공동 활용`,
      deployUnit: '계열사 전체',
      reason,
    });
    toast(
      `${item.id} · 그룹 공동 자산 승격 결재를 상신했습니다`,
      `${row.assetId} ${row.assetName} · 소유 계열사(${row.ownerTenant})에 통보 · 다음 단계: ${approvers.affiliate.label} ${approvers.affiliate.name}`,
      'ok',
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-6">
      <div className="w-full max-w-[680px] max-h-[88vh] overflow-auto bg-white border border-line rounded-lg shadow-xl">
        <div className="px-5 py-4 border-b border-line-soft">
          <h2 className="text-[15px] font-extrabold text-ink">그룹 공동 자산 승격 검토</h2>
          <p className="text-[11.5px] text-ink-mid font-semibold mt-0.5">
            <b className="text-ink-dark">{row.assetId} {row.assetName}</b> · {row.ownerTenant} 소유 ·{' '}
            {row.scope} → 그룹
          </p>
        </div>

        <div className="px-5 py-4 space-y-3.5">
          {/* 3B-6 승격 예상 효과 */}
          <section>
            <div className="text-[10px] font-extrabold text-ink-light uppercase tracking-[0.3px] mb-1.5">
              승격 예상 효과
            </div>
            <div className="space-y-1.5">
              {effects.map((e) => (
                <div key={e.k} className="grid grid-cols-[92px_1fr_16px_1fr] gap-2 items-center px-3 py-2 border border-line-soft rounded">
                  <span className="text-[11px] font-extrabold text-ink-dark">{e.k}</span>
                  <span className="text-[10.5px] font-semibold text-ink-mid leading-snug">{e.before}</span>
                  <span className="text-[11px] text-ink-light text-center">→</span>
                  <span className="text-[10.5px] font-extrabold text-ok leading-snug">{e.after}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <label className="block text-[11.5px] font-extrabold text-ink mb-1">
              승격 사유 <span className="text-bad">*</span>
              <span className="ml-1.5 text-[10px] font-semibold text-ink-light">결재자가 읽을 판단 근거</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="w-full text-[12px] text-ink-dark leading-[1.6] border border-line rounded p-2.5 bg-white resize-y focus:outline-none focus:border-brand-dark"
            />
          </section>

          <label className="flex items-start gap-2.5 px-3 py-2.5 border border-line-soft rounded bg-surface-soft cursor-pointer">
            <input type="checkbox" checked={notified} onChange={(e) => setNotified(e.target.checked)} className="mt-0.5" />
            <span className="text-[11.5px] font-semibold text-ink-dark leading-relaxed">
              자산 소유 계열사(<b>{row.ownerTenant}</b>)에 승격 검토 사실을 통보하고, 소유 계열사
              관리자의 승인을 거쳐 진행함을 확인했습니다. 승격 후에도 자산 소유와 운영 책임은{' '}
              {row.ownerTenant}에 남습니다.
            </span>
          </label>

          {/* 결재선 — 마켓플레이스 그룹 공개 요청과 같다 */}
          <section>
            <div className="text-[10px] font-extrabold text-ink-light uppercase tracking-[0.3px] mb-1.5">결재선</div>
            <div className="space-y-1">
              <LineStep seq="✓" label={`기안 — ${drafter}`} sub={`${drafterRole} · ${drafterTenant}`} tone="done" />
              <LineStep seq="2" label={approvers.affiliate.label} sub={`${approvers.affiliate.name} · ${approvers.affiliate.tenant}`} tone="current" />
              <LineStep seq="3" label="그룹 거버넌스 승인" sub={`${approvers.governance.name} · ${approvers.governance.tenant}`} />
            </div>
            <p className="text-[10.5px] text-ink-mid font-semibold mt-1.5 leading-relaxed">
              마켓플레이스의 그룹 공개 요청과 같은 결재선이다 · 기안자는 승인 단계에 배정되지 않는다 · ONM-003
            </p>
          </section>
        </div>

        <div className="px-5 py-3 border-t border-line-soft flex items-center gap-2">
          <span className="text-[11px] text-ink-mid font-semibold">
            {valid ? <span className="text-ok font-extrabold">상신 준비 완료</span> : '사유 입력 · 소유 계열사 통보 확인 필요'}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>취소</Button>
            <Button variant="primary" onClick={submit} disabled={!valid}>승격 결재 상신</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={cn('rounded border px-3 py-2.5 bg-white', warn ? 'border-warn-border' : 'border-line-soft')}>
      <div className="text-[10px] font-extrabold text-ink-light uppercase tracking-[0.3px]">{label}</div>
      <div className={cn('text-[18px] font-extrabold tabular-nums mt-0.5', warn ? 'text-warn' : 'text-ink')}>{value}</div>
    </div>
  );
}

function LineStep({ seq, label, sub, tone = 'upcoming' }: { seq: string; label: string; sub: string; tone?: 'done' | 'current' | 'upcoming' }) {
  return (
    <div className={cn(
      'flex items-center gap-2.5 py-1.5 px-2.5 rounded border',
      tone === 'done' ? 'bg-surface-soft border-line-soft' : tone === 'current' ? 'bg-warn-bg border-warn-border' : 'bg-white border-line-soft',
    )}>
      <span className="w-5 h-5 rounded-full bg-white border border-line inline-flex items-center justify-center text-[10px] font-extrabold text-ink-dark flex-shrink-0">{seq}</span>
      <div className="min-w-0">
        <div className="text-[11.5px] font-extrabold text-ink leading-tight">{label}</div>
        <div className="text-[10.5px] text-ink-mid font-semibold truncate">{sub}</div>
      </div>
    </div>
  );
}
