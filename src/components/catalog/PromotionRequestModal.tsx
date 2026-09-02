/**
 * 그룹 공개 요청 기안 폼 — RFP 1.3.2 「관리자 승인 절차 기반 배포·공유 범위 통제」
 *
 * 버튼을 누르자마자 결재가 생기면 "승인 절차" 의 앞 절반(기안)이 화면에 없다.
 * 결재자가 읽을 사유·활용 업무·활용 범위를 요청자가 **직접 쓰고**, 그 입력이
 * 결재 상세의 「승격 근거」에 그대로 옮겨진다. 자동 생성 문장으로 채우지 않는다.
 *
 * 확인 사항 두 줄은 RFP 「기타」 항목을 그대로 가져온 것이다 —
 *   · "그룹 공통 AI자산은 재사용하되 계열사별 데이터·보안·권한 정책을 독립적으로 적용"
 *   · "계열사 간 데이터의 비인가 접근, 전송 및 교차 활용을 방지"
 * 요청자가 이걸 확인하지 않으면 상신 버튼이 열리지 않는다.
 *
 * 결재선 미리보기는 `previewPromotionApprovers()` 로 그린다. 실제 상신과 같은
 * 배정 규칙이라 "미리보기엔 A 인데 결재는 B 에게 갔다" 가 생기지 않는다.
 */
import { useEffect, useMemo, useState } from 'react';
import ModalShell from '@/components/knowledgeData/ModalShell';
import { Button } from '@/components/ui/Button';
import { Select, SelectOption } from '@/components/ui/Select';
import { cn } from '@/lib/utils';
import type { Tenant } from '@/data/tenants';
import type { CatalogItem } from '@/data/mockCatalog';
import { KIND_META, SCOPE_META } from '@/data/mockCatalog';
import {
  DEPLOY_UNIT_ORDER,
  previewPromotionApprovers,
  type DeployUnit,
} from '@/data/mockApprovals';

export interface PromotionForm {
  purpose: string;
  deployUnit: DeployUnit;
  reason: string;
}

interface Props {
  open: boolean;
  item: CatalogItem | null;
  requester: { name: string; role: string; tenant: Tenant };
  onClose: () => void;
  onSubmit: (form: PromotionForm) => void;
}

const REASON_MIN = 10;

export default function PromotionRequestModal({ open, item, requester, onClose, onSubmit }: Props) {
  const [purpose, setPurpose] = useState('');
  const [deployUnit, setDeployUnit] = useState<DeployUnit>('부서');
  const [reason, setReason] = useState('');
  const [ackPolicy, setAckPolicy] = useState(false);
  const [ackIsolation, setAckIsolation] = useState(false);
  const [touched, setTouched] = useState(false);

  // 열릴 때마다 초기화 — 직전 요청의 입력이 다음 자산에 묻어가지 않게.
  useEffect(() => {
    if (!open || !item) return;
    setPurpose('');
    setDeployUnit('부서');
    setReason(
      `${requester.tenant}에서 동일 업무를 별도로 구축하지 않고 ${item.tenant}의 검증된 자산을 재사용하기 위해 그룹 범위 공개를 요청합니다.`,
    );
    setAckPolicy(false);
    setAckIsolation(false);
    setTouched(false);
  }, [open, item, requester.tenant]);

  const approvers = useMemo(
    () => (item ? previewPromotionApprovers(item.tenant, requester.name) : null),
    [item, requester.name],
  );

  const purposeOk = purpose.trim().length >= 2;
  const reasonOk = reason.trim().length >= REASON_MIN;
  const valid = purposeOk && reasonOk && ackPolicy && ackIsolation;

  if (!item) return null;
  const kind = KIND_META[item.kind];

  const submit = () => {
    setTouched(true);
    if (!valid) return;
    onSubmit({ purpose: purpose.trim(), deployUnit, reason: reason.trim() });
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="그룹 공개 요청 · 공유범위 승격 기안"
      subtitle="관리자 승인 절차를 거쳐 공유 범위가 넓어집니다 — 입력한 사유는 결재 상세에 그대로 실립니다"
      size="lg"
      footer={
        <>
          <span className="text-[11px] text-ink-mid font-semibold">
            {valid ? (
              <span className="text-ok">✓ 상신 가능</span>
            ) : (
              '활용 업무·요청 사유를 쓰고 확인 사항 2건에 체크해야 상신됩니다'
            )}
          </span>
          <span className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>
              취소
            </Button>
            <Button variant="primary" onClick={submit} disabled={!valid}>
              요청 상신
            </Button>
          </span>
        </>
      }
    >
      <div className="grid grid-cols-[1fr_300px] gap-4">
        {/* ── 좌: 입력 ── */}
        <div className="space-y-4 min-w-0">
          {/* 대상 자산 */}
          <section className="rounded border border-line-soft bg-surface-soft px-3.5 py-3">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={cn('pill border', kind.cls)}>{kind.label}</span>
              <span className="font-mono text-[11px] text-ink-light">{item.id}</span>
              <span className="text-[13px] font-extrabold text-ink truncate">{item.name}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11.5px]">
              <Meta k="소유 계열사" v={`${item.tenant} · ${item.owner}`} />
              <Meta
                k="현재 범위 → 요청 범위"
                v={
                  <span className="flex items-center gap-1">
                    <span className={cn('pill border', SCOPE_META[item.meta.scope].cls)}>{item.meta.scope}</span>
                    <span className="text-ink-light">→</span>
                    <span className={cn('pill border', SCOPE_META['그룹'].cls)}>그룹</span>
                  </span>
                }
              />
              <Meta k="요청자" v={`${requester.name} (${requester.tenant} · ${requester.role})`} />
            </div>
          </section>

          {/* 활용 업무 */}
          <Field
            label="활용 업무"
            required
            hint="요청 계열사에서 이 자산을 붙일 업무를 한 줄로"
            error={touched && !purposeOk ? '활용 업무를 입력하세요' : undefined}
          >
            <input
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="예: PB 고객 오전 시황 브리핑 자동 생성"
              className={cn(
                'w-full h-9 px-3 rounded border bg-white text-[12.5px] text-ink-dark font-medium',
                'focus:outline-none focus:border-brand-dark',
                touched && !purposeOk ? 'border-bad' : 'border-line',
              )}
            />
          </Field>

          {/* 활용 예정 범위 */}
          <Field
            label="활용 예정 범위 (요청 계열사 내)"
            required
            hint="승인권자가 영향도를 가늠하는 입력입니다 — 공유 범위와는 다릅니다"
          >
            <Select value={deployUnit} onChange={(e) => setDeployUnit(e.target.value as DeployUnit)}>
              {DEPLOY_UNIT_ORDER.map((u) => (
                <SelectOption key={u} value={u}>
                  {u}
                </SelectOption>
              ))}
            </Select>
          </Field>

          {/* 요청 사유 */}
          <Field
            label="요청 사유"
            required
            hint={`${REASON_MIN}자 이상 · 결재자가 읽는 문장입니다`}
            error={touched && !reasonOk ? `요청 사유를 ${REASON_MIN}자 이상 입력하세요` : undefined}
          >
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className={cn(
                'w-full px-3 py-2 rounded border bg-white text-[12.5px] text-ink-dark leading-[1.6] font-medium resize-y',
                'focus:outline-none focus:border-brand-dark',
                touched && !reasonOk ? 'border-bad' : 'border-line',
              )}
            />
            <div className="text-right text-[10.5px] text-ink-light mt-0.5">{reason.trim().length}자</div>
          </Field>

          {/* 확인 사항 */}
          <Field label="확인 사항" required>
            <label className="flex items-start gap-2 text-[12px] text-ink-dark font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={ackPolicy}
                onChange={(e) => setAckPolicy(e.target.checked)}
                className="mt-0.5 accent-brand"
              />
              <span>
                자산은 재사용하되 <b>{requester.tenant}의 데이터·보안·권한 정책을 독립적으로 적용</b>합니다.
                가드레일·PII 마스킹은 요청 계열사 정책 기준으로 동작합니다.
              </span>
            </label>
            <label className="flex items-start gap-2 text-[12px] text-ink-dark font-medium cursor-pointer mt-2">
              <input
                type="checkbox"
                checked={ackIsolation}
                onChange={(e) => setAckIsolation(e.target.checked)}
                className="mt-0.5 accent-brand"
              />
              <span>
                <b>{item.tenant}의 데이터에는 접근하지 않습니다.</b> 자산 소유·과금 주체는 {item.tenant}로 유지되고,
                호출량은 {requester.tenant} 미터링에 집계됩니다.
              </span>
            </label>
          </Field>
        </div>

        {/* ── 우: 결재선 미리보기 ── */}
        <aside className="space-y-3">
          <section className="rounded border border-line-soft px-3.5 py-3">
            <div className="text-[11px] font-extrabold text-ink-mid mb-2">📋 결재선 (상신 시 자동 배정)</div>
            <ol className="space-y-2">
              <Step seq="1" label="기안 — 그룹 공개 요청" who={`${requester.name} (${requester.tenant})`} tone="me" />
              {approvers && (
                <>
                  <Step
                    seq="2"
                    label={approvers.affiliate.label}
                    who={`${approvers.affiliate.name} (${approvers.affiliate.tenant})`}
                    tone="next"
                  />
                  <Step
                    seq="3"
                    label="그룹 거버넌스 승인"
                    who={`${approvers.governance.name} (${approvers.governance.tenant})`}
                    tone="later"
                  />
                </>
              )}
            </ol>
            <p className="text-[10.5px] text-ink-light leading-snug mt-2.5">
              기안자는 자신의 결재를 승인할 수 없습니다(직무 분리 · ONM-003). 2·3단계 모두 관리자 그룹이 처리합니다.
            </p>
          </section>

          <section className="rounded border border-line-soft px-3.5 py-3">
            <div className="text-[11px] font-extrabold text-ink-mid mb-1.5">승인되면</div>
            <ul className="space-y-1 text-[11px] text-ink-dark font-medium leading-snug">
              <li>· 공유 범위 {item.meta.scope} → 그룹 (11개 Namespace 노출)</li>
              <li>· 타 계열사 사용자가 별도 요청 없이 바로 사용</li>
              <li>· 범위 변경 이력이 통합 감사 원장에 기록 (ONM-004)</li>
            </ul>
          </section>
        </aside>
      </div>
    </ModalShell>
  );
}

/* ───────────── 조각 ───────────── */

function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-[12px] font-extrabold text-ink">
          {label}
          {required && <span className="text-bad ml-0.5">*</span>}
        </span>
        {hint && <span className="text-[10.5px] text-ink-light">{hint}</span>}
      </div>
      {children}
      {error && <div className="text-[11px] text-bad font-semibold mt-1">{error}</div>}
    </div>
  );
}

function Meta({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] text-ink-light font-bold">{k}</div>
      <div className="text-ink-dark font-semibold truncate">{v}</div>
    </div>
  );
}

function Step({
  seq,
  label,
  who,
  tone,
}: {
  seq: string;
  label: string;
  who: string;
  tone: 'me' | 'next' | 'later';
}) {
  const cls =
    tone === 'me'
      ? 'bg-brand text-white border-brand-dark'
      : tone === 'next'
      ? 'bg-warn-bg text-warn border-warn-border'
      : 'bg-surface text-ink-light border-line';
  return (
    <li className="flex items-start gap-2">
      <span className={cn('w-5 h-5 rounded-full border text-[10px] font-extrabold inline-flex items-center justify-center shrink-0', cls)}>
        {seq}
      </span>
      <span className="min-w-0">
        <div className="text-[11.5px] font-bold text-ink-dark leading-tight">{label}</div>
        <div className="text-[10.5px] text-ink-mid">{who}</div>
      </span>
    </li>
  );
}
