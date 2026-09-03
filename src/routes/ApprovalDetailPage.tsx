import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  approvals,
  useApprovalRevision,
  currentPromotionStage,
  findPromotion,
  promotionLine,
  decideApproval,
  getApprovalDecision,
  namespaceOf,
  promotionKindLabel,
  findAgentDeploy,
  currentDeployStage,
  deployLine,
  type ScopePromotion,
  type AgentDeployApproval,
  type ApprovalDecisionKind,
} from '@/data/mockApprovals';
import { SCOPE_ORDER, SCOPE_META } from '@/data/mockCatalog';
import type { ApprovalItem } from '@/types';
import { TENANTS } from '@/data/tenants';
import { toast } from '@/lib/toast';
import {
  useDeployApprovals,
  decideDeployApproval,
  cancelDeployApproval,
  type DeployApproval,
} from '@/lib/deployApprovalStore';
import { SearchSummary } from '@/components/knowledgeData/RagApiSection';
import Crumb from '@/components/ui/Crumb';
import Button from '@/components/ui/Button';
import SectionCard from '@/components/projectForm/SectionCard';
import { KvGrid, KvRow } from '@/components/projectForm/KvGrid';
import ChipReadonly from '@/components/projectForm/ChipReadonly';
import SidebarCard from '@/components/projectForm/SidebarCard';
import { cn } from '@/lib/utils';
import { useCurrentPersona } from '@/lib/persona';
import { canDecideApproval, canViewApproval, canViewPtuPool } from '@/lib/personaView';

/**
 * 결재 상세.
 *
 * RFP: 1.3.2(관리자 승인 절차 기반 공유 범위 통제) · LSM-009(승인 기반 배포)
 *      ONM-004(누가·언제·무엇을 승인했는가 감사 추적)
 *
 * 세 가지 상세를 한 라우트에서 분기한다.
 *   ① 운영계·개발계 **배포** 결재  → DeployApprovalDetail
 *   ② 공유범위 **승격** 결재       → ScopePromotionDetail (RFP 1.3.2)
 *   ③ 그 외 프로젝트 결재          → 아래 기본 아코디언 (PRJ-101_approval.html 포팅)
 *
 * ② 를 ③ 의 레이아웃(프로젝트 기본 정보·비즈니스 케이스·데이터 자산)에 태우면
 * 결재자가 판단할 것("이 자산을 11개 Namespace 에 열어도 되는가")이 화면에
 * 없다. 그래서 자산·범위 중심의 전용 화면을 따로 세운다.
 */
export default function ApprovalDetailPage() {
  const { approvalId } = useParams();
  const persona = useCurrentPersona();
  const navigate = useNavigate();
  // 승격 상신·승인·반려로 목록이 바뀌면 상세도 함께 갱신된다.
  useApprovalRevision();
  const [note, setNote] = useState('');

  // 운영계 배포 결재는 전용 상세로 렌더.
  const deployApprovals = useDeployApprovals();
  const dep = deployApprovals.find((d) => d.id === approvalId);
  if (dep) {
    if (persona && !canViewApproval(persona, dep.id)) {
      return (
        <div className="max-w-[1360px] mx-auto px-6 py-6">
          <Crumb items={[{ label: '결재함', to: '/approvals' }, { label: '열람 권한 없음' }]} />
          <div className="card px-6 py-10 text-center">
            <div className="text-[32px] mb-2">🔒</div>
            <h1 className="text-lg font-extrabold text-ink mb-1.5">열람 권한이 없는 결재입니다</h1>
            <Link to="/approvals" className="inline-block mt-4 text-[12px] font-bold text-info hover:underline">
              결재함으로 →
            </Link>
          </div>
        </div>
      );
    }
    return <DeployApprovalDetail dep={dep} all={deployApprovals} />;
  }

  // AI Studio 기안 배포 결재 — 에이전트 구성 중심 전용 상세 (LSM-009 · ONM-003).
  const agentDep = findAgentDeploy(approvalId);
  const agentItem = approvals.find((a) => a.id === approvalId);
  if (agentDep && agentItem) {
    if (persona && !canViewApproval(persona, agentDep.approvalId)) {
      return <NoAccess role={persona.role} />;
    }
    return <AgentDeployDetail dep={agentDep} item={agentItem} />;
  }

  // 공유범위 승격 결재 — 자산·범위 중심 전용 상세 (RFP 1.3.2).
  const promo = findPromotion(approvalId);
  const promoItem = approvals.find((a) => a.id === approvalId);
  if (promo && promoItem) {
    if (persona && !canViewApproval(persona, promo.approvalId)) {
      return <NoAccess role={persona.role} />;
    }
    return <ScopePromotionDetail promo={promo} item={promoItem} />;
  }

  const approval = approvals.find((a) => a.id === approvalId) ?? approvals[0];
  const pending = approval.state === 'pending';
  // 열람과 처리는 다른 권한이다 — 열람된다고 결재할 수 있는 게 아니다(ONM-003).
  const right = canDecideApproval(persona, approval);
  const decision = getApprovalDecision(approval.id);

  /** 승인·반려·보류 — 상태가 실제로 바뀌고, **누가** 처리했는지 남는다(ONM-004). */
  const decide = (kind: ApprovalDecisionKind) => {
    decideApproval(
      approval.id,
      kind,
      persona?.name ?? '현재 사용자',
      persona?.role ?? '결재자',
      note,
    );
    const label = kind === 'approve' ? '승인' : kind === 'reject' ? '반려' : '보류';
    toast(
      `${approval.id} · ${label} 처리했습니다`,
      `${persona?.name ?? '현재 사용자'} (${persona?.role ?? '결재자'}) · 통합 감사 원장에 기록되었습니다`,
      kind === 'reject' ? 'warn' : 'ok',
    );
    setNote('');
    if (kind !== 'hold') navigate('/approvals');
  };
  const showPtuPool = canViewPtuPool(persona);

  // 목록에서 걸러진 결재는 상세 URL로 직접 들어와도 열람 불가.
  if (persona && !canViewApproval(persona, approval.id)) {
    return (
      <div className="max-w-[1360px] mx-auto px-6 py-6">
        <Crumb items={[{ label: '결재함', to: '/approvals' }, { label: '열람 권한 없음' }]} />
        <div className="card px-6 py-10 text-center">
          <div className="text-[32px] mb-2">🔒</div>
          <h1 className="text-lg font-extrabold text-ink mb-1.5">열람 권한이 없는 결재입니다</h1>
          <p className="text-xs text-ink-mid font-semibold">
            {persona.role} 권한으로는 이 결재 건을 볼 수 없습니다. 결재함에서 담당 결재를
            확인해 주세요.
          </p>
          <Link
            to="/approvals"
            className="inline-block mt-4 text-[12px] font-bold text-info hover:underline"
          >
            결재함으로 →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1360px] mx-auto px-6 py-6 pb-[120px]">
      <Crumb
        items={[
          { label: '결재함', to: '/approvals' },
          { label: '진행 중 결재', to: '/approvals' },
          { label: approval.title },
        ]}
        trailing={approval.id}
      />

      <div className="grid grid-cols-[1fr_320px] gap-3.5">
        <main>
          {/* Approval header */}
          <div className="card px-6 py-5 mb-3.5">
            <h1 className="text-[22px] font-extrabold text-ink tracking-[-0.3px] mb-2">
              {approval.title}
            </h1>
            <div className="flex items-center gap-2.5 text-[11.5px] text-ink-mid font-semibold flex-wrap">
              <span>
                과제 코드 <b className="text-ink-dark">prj-vp-7k3m9d</b>
              </span>
              <span className="text-line">|</span>
              <span>
                기안자 <b className="text-ink-dark">{approval.draftedBy}</b> (프로젝트 오너 그룹)
              </span>
              <span className="text-line">|</span>
              <span>
                도착 <b className="text-ink-dark">{approval.draftedAt}</b>
              </span>
            </div>
          </div>

          {/* Sections A~J (아코디언) */}
          <SectionCard
            letter="A"
            name="프로젝트 기본 정보"
            defaultOpen
          >
            <KvGrid>
              <KvRow k="프로젝트명" v="리스크 관리 에이전트_AI디지털전략부" tone="strong" />
              <KvRow k="프로젝트 코드" v="prj-vp-7k3m9d" />
              <KvRow k="소속 부서·팀" v="AI디지털전략부" />
              <KvRow
                k="프로젝트 오너 그룹"
                v={
                  <>
                    <ChipReadonly primary role="책임자">
                      정오너
                    </ChipReadonly>
                    <ChipReadonly>이도현</ChipReadonly>
                    <ChipReadonly>박서연</ChipReadonly>
                  </>
                }
              />
              <KvRow k="시작 ~ 종료" v="2026.06.01 ~ 2026.12.31" />
            </KvGrid>
          </SectionCard>

          <SectionCard
            letter="B"
            name="서비스 구분 / 노출 채널"
          >
            <KvGrid>
              <KvRow k="서비스 대상" v="대직원" tone="strong" />
              <KvRow k="노출 채널" v={<ChipReadonly primary>통합웹앱</ChipReadonly>} />
            </KvGrid>
          </SectionCard>

          <SectionCard
            letter="C"
            name="비즈니스 케이스"
          >
            <KvGrid>
              <KvRow
                k="비즈니스 목표"
                v="여신·시장·운영 리스크 지표를 실시간 모니터링하고, 리스크 담당자에게 이상 징후 알림과 대응 가이드를 제공하여 리스크 인지·대응 시점을 앞당긴다."
              />
              <KvRow
                k="현재 페인포인트"
                v="리스크 지표가 여러 시스템에 분산돼 담당자가 수작업으로 취합, 이상 징후 인지가 평균 반나절 지연됨."
              />
              <KvRow
                k="기대 효과"
                v="이상 징후 탐지 시점 단축 · 리스크 리포트 작성 시간 60% 절감 · 대응 프로세스 표준화"
              />
            </KvGrid>
          </SectionCard>

          <SectionCard
            letter="D"
            name="기능 요건 초안"
          >
            <KvGrid>
              <KvRow
                k="주요 시나리오"
                v={
                  <ul className="list-disc pl-5 space-y-0.5">
                    <li>리스크 지표 실시간 모니터링 → 임계치 초과 시 담당자 알림 + 대응 가이드 제시</li>
                    <li>규정·내규 문서 조회 → 리스크 이벤트에 대한 근거·조치 초안 자동 생성</li>
                  </ul>
                }
              />
              <KvRow k="입출력 modality" v="텍스트 · 문서·파일" />
            </KvGrid>
          </SectionCard>

          <SectionCard
            letter="E"
            name="데이터 자산"
            defaultOpen
          >
            <KvGrid>
              <KvRow k="사용 데이터 종류" v="사내 문서 (RAG) · 정형 DB" />
              <KvRow k="개인정보 포함" v="포함" tone="red" />
              <KvRow k="신용정보 포함" v="포함" tone="red" />
            </KvGrid>
          </SectionCard>

          <SectionCard
            letter="F"
            name="사용 가능 모델"
          >
            <KvGrid>
              <KvRow
                k="모델 사용 (호스트)"
                v={
                  <>
                    <ChipReadonly primary>on-prem · onprem/gpt-oss-120b</ChipReadonly>
                    <ChipReadonly primary>공동존 · onprem/qwen3-32b</ChipReadonly>
                  </>
                }
              />
              <KvRow k="1콜 평균 토큰" v="입력 1,200 · 출력 450" />
              <KvRow k="피크 동시 호출 수" v="3 RPS" />
              <KvRow k="일평균 호출량" v="3,500 콜/일" />
              <KvRow
                k="예상 TPM"
                v="297,000 TPM (피크 3 RPS × 60초 × 콜당 1,650 토큰)"
                tone="strong"
              />
            </KvGrid>

            {/* PTU 풀 현황 — 플랫폼 관리자 전용 */}
            {showPtuPool && (
            <div className="mt-4 bg-surface-soft border border-line-soft rounded-md p-4">
              <div className="flex items-center gap-2 mb-3 text-[12.5px] font-extrabold text-ink-dark">
                🛠 공유 PTU 풀 현황
                <span className="ml-auto pill bg-accent-brown-bg text-accent-brown border border-accent-brown-border">
                  플랫폼 관리자 전용
                </span>
              </div>
              <PoolRow name="llm-pool-1" sub="onprem/qwen3-32b · 주력" cap="200 PTU" pct={78} add={12} tone="bad" />
              <PoolRow name="llm-pool-2" sub="onprem/llama-3.3-70b · Fallback" cap="50 PTU" pct={45} add={4} />
              <PoolRow name="onprem-pool-A" sub="onprem/gpt-oss-120b · 주력" cap="8 GPU" pct={62} add={9} />
              <PoolRow name="onprem-pool-B" sub="google/gemma-4-31B · Fallback" cap="8 GPU" pct={30} add={3} />

              <div className="flex items-center gap-3 mt-3 text-[10.5px] text-ink-mid">
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 bg-info rounded-sm" />
                  현재 점유
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block w-2.5 h-2.5 bg-brand rounded-sm" />
                  이 과제 추가 시
                </span>
                <span className="ml-auto">임계치 90% 도달 시 풀 증설 사전 합의 권장</span>
              </div>

              <div className="mt-3 bg-bad-bg border border-bad-border rounded p-2.5 text-[11.5px] text-bad font-bold">
                ⚠ llm-pool-1 (onprem/qwen3-32b) — 이 과제 추가 시 점유율 90% 도달, 풀 증설 검토 필요
              </div>
            </div>
            )}
          </SectionCard>

          <SectionCard
            letter="G"
            name="예산·자원"
          >
            <KvGrid>
              <KvRow
                k="사전 협의 담당자"
                v={<ChipReadonly primary>김지주</ChipReadonly>}
              />
              <KvRow
                k="예산 할당"
                v="총 1,000,000,000원"
              />
            </KvGrid>
          </SectionCard>

          <SectionCard letter="J" name="문서 첨부" defaultOpen>
            <div className="space-y-1.5">
              {[
                ['구축요건 정의서', 'build-spec-rm-2026.pdf'],
                ['AI 서비스 기획서', 'ai-service-plan-2026.pdf'],
                ['AI 서비스 위험 평가서', 'ai-risk-assessment-2026.pdf'],
                ['AI 서비스 위험관리 계획서', 'ai-risk-mgmt-plan-2026.pdf'],
                ['AI 서비스 위험점검 체크리스트', 'ai-risk-checklist-2026.pdf'],
                ['AI 업무 위수탁 체크리스트', 'ai-outsourcing-checklist-2026.pdf'],
                ['혁신금융서비스 지정 서류', 'innov-fin-2026q2.pdf'],
              ].map(([name, file]) => (
                <div
                  key={file}
                  className="flex items-center gap-2 py-2 px-3 bg-surface-soft border border-line-soft rounded"
                >
                  <span className="text-[12.5px] font-bold text-ink-dark flex-1">{name}</span>
                  <span className="pill bg-bad-bg text-bad border border-bad-border">필수</span>
                  <button
                    type="button"
                    onClick={() => openDoc(name, file)}
                    className="text-info text-[12px] font-semibold hover:underline"
                  >
                    ✓ {file}
                  </button>
                </div>
              ))}
            </div>
          </SectionCard>
        </main>

        {/* Right sidebar */}
        <aside>
          <SidebarCard title="결재선 진행" icon="📋">
            <ApprovalStep num="✓" who="기안 — 정오너" time="09:14" state="done" />
            <ApprovalStep num="1" who="거버넌스 관리 그룹" time="대기" state="current" />
            <ApprovalStep num="2" who="사업 관리 그룹" time="-" state="pending" />
            <ApprovalStep num="3" who="플랫폼 관리 그룹" time="-" state="pending" />
            <ApprovalStep num="4" who="부서장" time="-" state="pending" />
          </SidebarCard>

          <SidebarCard title="결재 이력" icon="🕒">
            <div className="border-b border-line-soft pb-2.5 last:border-0">
              <div className="flex items-center gap-2 text-[11.5px] mb-1">
                <span className="font-bold text-ink-dark">정오너</span>
                <span className="pill bg-info-bg text-info border border-info-border">기안</span>
                <span className="ml-auto text-ink-mid">05-14 09:14</span>
              </div>
              <p className="text-[11.5px] text-ink-dark leading-relaxed">
                대직원 리스크 관리 Agent 신규 구축 건입니다. 우선 검토 부탁드립니다.
              </p>
            </div>
            {/* 처리 결과 — 누가 언제 무엇을 결정했는지 남는다 (ONM-004). */}
            {decision && (
              <div className="pt-2.5">
                <div className="flex items-center gap-2 text-[11.5px] mb-1">
                  <span className="font-bold text-ink-dark">{decision.reviewer}</span>
                  <span
                    className={cn(
                      'pill border',
                      decision.kind === 'approve'
                        ? 'bg-ok-bg text-ok border-ok-border'
                        : decision.kind === 'reject'
                        ? 'bg-bad-bg text-bad border-bad-border'
                        : 'bg-warn-bg text-warn border-warn-border',
                    )}
                  >
                    {decision.kind === 'approve' ? '승인' : decision.kind === 'reject' ? '반려' : '보류'}
                  </span>
                  <span className="ml-auto text-ink-mid">{decision.decidedAt}</span>
                </div>
                <p className="text-[11.5px] text-ink-dark leading-relaxed">
                  {decision.note ?? `${decision.reviewerRole} 권한으로 처리했습니다.`}
                </p>
              </div>
            )}
          </SidebarCard>

          <SidebarCard title="첨부 빠른 보기" icon="📎">
            {[
              '구축요건 정의서',
              'AI 서비스 기획서',
              'AI 서비스 위험 평가서',
              'AI 서비스 위험관리 계획서',
              'AI 서비스 위험점검 체크리스트',
              'AI 업무 위수탁 체크리스트',
              '혁신금융서비스 지정 서류',
            ].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => openDoc(f)}
                className="w-full flex items-center justify-between py-1.5 px-2 text-[11.5px] text-ink-dark hover:bg-surface-soft rounded"
              >
                <span>{f}</span>
                <span className="text-ok font-bold">✓</span>
              </button>
            ))}
          </SidebarCard>
        </aside>
      </div>

      {/* Sticky action bar — 승인·반려·보류가 실제로 상태를 바꾼다.
          승인 자격이 없으면 버튼 자체를 내리고 어느 계정으로 전환해야 하는지만 남긴다. */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-line z-30 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
        <div className="max-w-[1360px] mx-auto px-6 py-3 flex items-center gap-3">
          {pending && !right.ok ? (
            <SodNotice hint={right.hint} />
          ) : pending ? (
            <>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="결재 의견을 입력하세요 (선택)"
                rows={2}
                className="flex-1 border border-line rounded px-3 py-2 text-[12.5px] resize-none focus:outline-none focus:border-brand-dark"
              />
              <Button variant="danger" onClick={() => decide('reject')}>반려</Button>
              <Button onClick={() => decide('hold')}>보류</Button>
              <Button variant="primary" onClick={() => decide('approve')}>✓ 승인</Button>
            </>
          ) : (
            <div className="flex items-center gap-2.5 text-[12px] font-semibold text-ink-mid">
              <span
                className={cn(
                  'pill border',
                  approval.state === 'done'
                    ? 'bg-ok-bg text-ok border-ok-border'
                    : 'bg-bad-bg text-bad border-bad-border',
                )}
              >
                {approval.state === 'done' ? '승인 완료' : '반려'}
              </span>
              {decision && (
                <span>
                  <b className="text-ink-dark">{decision.reviewer}</b> ({decision.reviewerRole}) ·{' '}
                  {decision.decidedAt}
                  {decision.note && <> · 의견 “{decision.note}”</>}
                </span>
              )}
              <Link to="/approvals" className="ml-3 text-info font-bold hover:underline">
                결재함으로 →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ 공용 조각 ═══════════════════════ */

/**
 * 승인 자격이 없을 때 액션 바에 들어가는 안내.
 *
 * 버튼을 비활성화만 하면 "왜 못 누르는지" 가 화면에 없다. 시연에서는 막힌 이유와
 * 다음 동작(어느 계정으로 전환할지)이 같이 보여야 직무 분리가 설명 없이 읽힌다.
 */
function SodNotice({ hint }: { hint: string }) {
  return (
    <div className="ml-auto flex items-center gap-2 text-[11.5px] font-semibold text-ink-mid">
      <span className="pill border bg-warn-bg text-warn border-warn-border">🔒 승인 권한 없음</span>
      <span>{hint}</span>
      <Link to="/approvals" className="ml-2 text-info font-bold hover:underline">
        결재함으로 →
      </Link>
    </div>
  );
}

/**
 * 첨부 문서 열람.
 *
 * 이전에는 `href="#"` 였는데, 이 앱은 HashRouter 라 해시가 비면 라우터가 `/` 로
 * 이동한다 — 결재 상세에서 첨부를 누르면 홈으로 튕겼다. 2막 승인 서사가 그
 * 자리에서 끊기므로 기본 동작을 막고 안내만 띄운다.
 */
function openDoc(name: string, file?: string) {
  toast('첨부 문서', file ? `「${name}」 · ${file}` : `「${name}」`, 'info');
}

/** 열람 권한 없음 — 목록 필터와 같은 규칙이라 상세 URL 로도 못 들어온다. */
function NoAccess({ role }: { role: string }) {
  return (
    <div className="max-w-[1360px] mx-auto px-6 py-6">
      <Crumb items={[{ label: '결재함', to: '/approvals' }, { label: '열람 권한 없음' }]} />
      <div className="card px-6 py-10 text-center">
        <div className="text-[32px] mb-2">🔒</div>
        <h1 className="text-lg font-extrabold text-ink mb-1.5">열람 권한이 없는 결재입니다</h1>
        <p className="text-xs text-ink-mid font-semibold">
          {role} 권한으로는 이 결재 건을 볼 수 없습니다. 결재함에서 담당 결재를 확인해 주세요.
        </p>
        <Link to="/approvals" className="inline-block mt-4 text-[12px] font-bold text-info hover:underline">
          결재함으로 →
        </Link>
      </div>
    </div>
  );
}

function ApprovalStep({
  num,
  who,
  time,
  state,
}: {
  num: string;
  who: string;
  time: string;
  state: 'done' | 'current' | 'pending';
}) {
  return (
    <div className="flex items-center gap-2.5 py-1.5 text-[11.5px]">
      <span
        className={cn(
          'w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-extrabold flex-shrink-0',
          state === 'done' && 'bg-ok text-white',
          state === 'current' && 'bg-brand text-white border border-brand-dark',
          state === 'pending' && 'bg-surface-soft text-ink-light border border-line-soft',
        )}
      >
        {num}
      </span>
      <span
        className={cn(
          'flex-1',
          state === 'current' && 'font-extrabold text-ink',
          state === 'done' && 'text-ink-dark',
          state === 'pending' && 'text-ink-light',
        )}
      >
        {who}
      </span>
      <span className="text-[10.5px] text-ink-mid">{time}</span>
    </div>
  );
}

function PoolRow({
  name,
  sub,
  cap,
  pct,
  add,
  tone = 'normal',
}: {
  name: string;
  sub: string;
  cap: string;
  pct: number;
  add: number;
  tone?: 'normal' | 'bad';
}) {
  const after = pct + add;
  return (
    <div className="grid grid-cols-[170px_70px_1fr_120px] gap-2.5 items-center py-2 border-b border-line-soft last:border-0">
      <div className="text-[12px]">
        <div className="font-extrabold text-ink-dark">{name}</div>
        <div className="text-[10.5px] text-ink-mid">{sub}</div>
      </div>
      <div className="text-[11px] text-ink-mid font-bold">{cap}</div>
      <div className="relative h-2 bg-white border border-line-soft rounded overflow-hidden">
        <div
          className={cn('absolute left-0 top-0 bottom-0', tone === 'bad' ? 'bg-bad' : 'bg-info')}
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute top-0 bottom-0 bg-brand"
          style={{ left: `${pct}%`, width: `${add}%` }}
        />
      </div>
      <div
        className={cn(
          'text-[11px] font-extrabold text-right',
          tone === 'bad' ? 'text-bad' : 'text-ink-dark',
        )}
      >
        {pct}% <span className="text-ink-mid mx-0.5">→</span>
        <span className={after >= 90 ? 'text-bad' : 'text-ink'}>
          {after}%{after >= 90 && ' ⚠'}
        </span>
      </div>
    </div>
  );
}

/* ---------------- 운영계 배포 결재 상세 ---------------- */

function DeployApprovalDetail({ dep, all }: { dep: DeployApproval; all: DeployApproval[] }) {
  const navigate = useNavigate();
  const persona = useCurrentPersona();
  const [note, setNote] = useState('');
  const pending = dep.state === 'pending';
  // 승인 자격 — 기안자 자기결재와 비(非)승인권자를 함께 막는다(ONM-003).
  const right = canDecideApproval(persona, dep);
  const isServ = dep.category === 'serv';
  const env = isServ ? '운영계' : '개발계';
  // 비교용 현재 = 같은 환경(train/serv)의 최신 승인(done) 배포 (이 건 제외).
  const current = all.find((d) => d.category === dep.category && d.state === 'done' && d.id !== dep.id);

  const decide = (decision: 'approve' | 'reject') => {
    // 결재자는 현재 로그인 페르소나다 — 감사 원장의 '누가' 가 여기서 정해진다(ONM-004).
    const reviewer = persona ? `${persona.name} (${persona.role})` : '현재 사용자';
    decideDeployApproval(dep.id, decision, note, reviewer);
    toast(
      `${dep.id} · ${decision === 'approve' ? '승인' : '반려'} 처리했습니다`,
      `${reviewer} · 통합 감사 원장에 기록되었습니다`,
      decision === 'approve' ? 'ok' : 'warn',
    );
    navigate('/approvals');
  };
  const cancel = () => {
    if (window.confirm('배포 신청을 취소(회수)할까요?')) {
      cancelDeployApproval(dep.id);
      navigate('/approvals');
    }
  };

  const statePill =
    dep.state === 'done'
      ? { cls: 'bg-ok-bg text-ok border-ok-border', label: '배포 완료' }
      : dep.state === 'rejected'
      ? { cls: 'bg-bad-bg text-bad border-bad-border', label: '반려' }
      : { cls: 'bg-warn-bg text-warn border-warn-border', label: '승인 대기' };

  const step2Tone = dep.state === 'done' ? 'done' : dep.state === 'rejected' ? 'rejected' : 'current';

  return (
    <div className="max-w-[1360px] mx-auto px-6 py-6 pb-[120px]">
      <Crumb
        items={[
          { label: '결재함', to: '/approvals' },
          { label: `${env} 배포 결재` },
          { label: dep.title },
        ]}
        trailing={dep.id}
      />

      {/* 헤더 */}
      <div className="card px-6 py-5 mb-3.5">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span
            className={cn(
              'inline-flex items-center py-[2px] px-2 rounded-full border text-[10px] font-bold',
              isServ ? 'bg-ok-bg text-ok border-ok-border' : 'bg-info-bg text-info border-info-border',
            )}
          >
            {env} 배포
          </span>
          <span className={cn('inline-flex items-center py-[2px] px-2 rounded-full border text-[10px] font-extrabold', statePill.cls)}>
            {statePill.label}
          </span>
        </div>
        <h1 className="text-[22px] font-extrabold text-ink tracking-[-0.3px] mb-1.5">{dep.title}</h1>
        <p className="text-xs text-ink-mid font-semibold">
          기안자 <b className="text-ink-dark">{dep.draftedBy}</b> · 신청 일시 <b className="text-ink-dark">{dep.draftedAt}</b> ·
          결재선 <b className="text-ink-dark">{dep.stage.label}</b>
        </p>
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-3.5">
        {/* 좌측 — 신청 정보 */}
        <div>
          <FormSection title="신청 정보">
            <FormRow k="지식 데이터" v={dep.datasetName} />
            <FormRow k="과제" v={dep.projectName ?? '-'} />
            <FormRow k="RAG API" v={`${dep.apiName}  ·  ${dep.apiId}`} />
            <FormRow k="배포 버전" v={`${dep.version} → ${env}`} />
            {isServ && <FormRow k="승격 원본" v={`개발계 빌드 · ${dep.sources.map((s) => `${s.name} ${s.version}`).join(', ')}`} />}
            <FormRow k="Endpoint" v={<code className="text-[11px] font-mono text-ink-dark break-all">{dep.endpoint}</code>} />
          </FormSection>

          <FormSection title="배포 구성">
            <FormRow
              k="소스 인덱스"
              v={
                <span className="flex flex-wrap gap-1">
                  {dep.sources.map((sc) => (
                    <span
                      key={sc.name}
                      className="inline-flex items-center gap-1 py-[2px] px-2 rounded-full border border-line-soft bg-white text-ink-dark font-bold text-[10.5px]"
                    >
                      📦 {sc.name}
                      <span className="text-ink-mid font-semibold">· {sc.version} · {sc.model}</span>
                    </span>
                  ))}
                </span>
              }
            />
            <FormRow
              k="검색 설정"
              v={<span className="flex items-center gap-1.5 flex-wrap text-[11px]"><SearchSummary s={dep.search} /></span>}
            />
          </FormSection>

          <FormSection title={`현재 ${env} 대비`}>
            {current ? (
              <>
                <FormRow
                  k={`현재 ${current.version}`}
                  v={<span className="flex items-center gap-1.5 flex-wrap text-[11px] text-ink-mid"><SearchSummary s={current.search} /></span>}
                />
                <FormRow
                  k={`신청 ${dep.version}`}
                  v={<span className="flex items-center gap-1.5 flex-wrap text-[11px]"><SearchSummary s={dep.search} /></span>}
                />
              </>
            ) : (
              <div className="text-[11.5px] text-ink-mid px-3 py-2">현재 {env}에 배포된 버전이 없습니다 (최초 배포).</div>
            )}
          </FormSection>

          {!pending && dep.reviewer && (
            <FormSection title="결재 결과">
              <FormRow k="결과" v={dep.state === 'rejected' ? '반려' : '승인'} />
              <FormRow k="결재자" v={dep.reviewer} />
              {dep.decidedAt && <FormRow k="처리 일시" v={dep.decidedAt} />}
              {dep.reviewNote && <FormRow k="의견" v={dep.reviewNote} />}
            </FormSection>
          )}
        </div>

        {/* 우측 — 결재 진행 사이드바 */}
        <aside className="sticky top-[106px] self-start">
          <SidebarCard title="결재 진행">
            <div className="space-y-1.5">
              <ApprStep seq="✓" label="기안" sub={`${dep.draftedBy} · ${dep.draftedAt}`} tone="done" />
              {isServ && (
                <ApprStep
                  seq="2"
                  label="프로젝트 오너 그룹 결재"
                  sub={dep.state === 'done' ? '승인 완료' : dep.state === 'rejected' ? '반려' : '결재 대기'}
                  tone={step2Tone}
                />
              )}
              <ApprStep
                seq={isServ ? '3' : '2'}
                label={dep.stage.label}
                sub={dep.reviewer ? `${dep.reviewer}${dep.decidedAt ? ` · ${dep.decidedAt}` : ''}` : isServ ? '대기' : '결재 대기'}
                tone={dep.state === 'done' ? 'done' : dep.state === 'rejected' ? 'rejected' : isServ ? 'upcoming' : 'current'}
              />
            </div>
          </SidebarCard>

          {pending && (
            <SidebarCard title="결재 의견">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="승인·반려 사유 (선택)"
                className="w-full text-[12px] text-ink-dark leading-[1.6] border border-line rounded p-2 bg-white resize-y focus:outline-none focus:border-brand-dark"
              />
            </SidebarCard>
          )}
        </aside>
      </div>

      {/* 하단 고정 액션 바 */}
      {pending && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-line z-30 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
          <div className="max-w-[1360px] mx-auto px-6 py-3 flex items-center gap-3">
            <div className="text-[11.5px] text-ink-mid font-semibold">
              <span className="text-warn font-extrabold">승인 대기</span>
              <span className="mx-2 text-line">·</span>
              {env} 배포 결재 · {dep.stage.label}
            </div>
            <div className="ml-auto flex items-center gap-2">
              {/* 회수는 기안자의 권한이라 자격 판정과 무관하게 남긴다. */}
              <Button variant="ghost" onClick={cancel}>신청 회수</Button>
              {right.ok ? (
                <>
                  <button
                    onClick={() => decide('reject')}
                    className="py-2 px-3.5 bg-white border border-bad-border rounded text-[12.5px] font-extrabold text-bad hover:bg-bad-bg"
                  >
                    반려
                  </button>
                  <Button variant="primary" onClick={() => decide('approve')}>
                    ✓ 승인
                  </Button>
                </>
              ) : (
                <SodNotice hint={right.hint} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ApprStep({
  seq,
  label,
  sub,
  tone,
}: {
  seq: string;
  label: string;
  sub: string;
  tone: 'done' | 'current' | 'rejected' | 'upcoming';
}) {
  const current = tone === 'current';
  return (
    <div
      className={cn(
        'flex items-start gap-2 py-1.5 px-2 rounded border',
        tone === 'done' && 'bg-ok-bg/40 border-ok-border',
        tone === 'rejected' && 'bg-bad-bg border-bad-border',
        tone === 'upcoming' && 'bg-white border-line-soft',
        current && 'bg-brand-tint border-brand-dark',
      )}
    >
      <span
        className={cn(
          'w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-extrabold flex-shrink-0',
          tone === 'done' && 'bg-ok text-white border border-ok',
          tone === 'rejected' && 'bg-bad text-white border border-bad',
          tone === 'upcoming' && 'bg-white text-ink-light border border-line',
          current && 'bg-brand-dark text-white border border-brand-dark',
        )}
      >
        {tone === 'rejected' ? '✕' : seq}
      </span>
      <span className="min-w-0">
        <span className={cn('block text-[11.5px]', current ? 'font-extrabold text-ink' : 'font-bold text-ink-dark')}>{label}</span>
        <span className="block text-[10.5px] text-ink-mid font-semibold truncate">{sub}</span>
      </span>
    </div>
  );
}

function DeployStepper({ dep }: { dep: DeployApproval }) {
  const isDone = dep.state === 'done';
  const isRejected = dep.state === 'rejected';
  const steps = [
    { label: '기안', sub: `${dep.draftedBy} · ${dep.draftedAt}`, status: 'done' as const },
    {
      label: dep.stage.label,
      sub: dep.reviewer ? `${dep.reviewer}${dep.decidedAt ? ` · ${dep.decidedAt}` : ''}` : '결재 대기',
      status: isDone ? ('done' as const) : isRejected ? ('rejected' as const) : ('current' as const),
    },
  ];

  const circle: Record<string, string> = {
    done: 'bg-ok text-white border-ok',
    current: 'bg-brand text-white border-brand-dark',
    rejected: 'bg-bad text-white border-bad',
    upcoming: 'bg-white text-ink-light border-line',
  };
  const mark: Record<string, string> = { done: '✓', rejected: '✕', current: '', upcoming: '' };

  return (
    <div className="card px-5 py-4 mb-3.5">
      <div className="text-[10px] uppercase tracking-[0.4px] text-ink-mid font-bold mb-3">결재 진행</div>
      <div className="flex items-start">
        {steps.map((s, i) => (
          <div key={i} className="flex items-start flex-1 last:flex-none">
            <div className="flex flex-col items-center text-center w-[92px] flex-shrink-0">
              <span
                className={cn(
                  'w-7 h-7 rounded-full border-2 inline-flex items-center justify-center text-[12px] font-extrabold',
                  circle[s.status],
                )}
              >
                {mark[s.status] || i + 1}
              </span>
              <span className="text-[11.5px] font-extrabold text-ink mt-1.5 leading-tight">{s.label}</span>
              <span className="text-[10px] text-ink-mid font-semibold mt-0.5 leading-tight break-keep">{s.sub}</span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  'flex-1 h-[2px] mt-[13px] mx-1 rounded-full',
                  steps[i].status === 'done' ? 'bg-ok' : 'bg-line',
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden mb-3.5">
      <div className="py-2 px-4 bg-surface-soft border-b border-line-soft text-[10px] uppercase tracking-[0.4px] text-ink-mid font-bold">
        {title}
      </div>
      <div className="divide-y divide-line-soft">{children}</div>
    </div>
  );
}

function FormRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5 px-4 text-[12.5px]">
      <span className="w-[110px] flex-shrink-0 text-ink-mid font-semibold text-[11.5px]">{k}</span>
      <span className="flex-1 min-w-0 text-ink-dark font-semibold">{v}</span>
    </div>
  );
}

/* ═══════════════════════ 공유범위 승격 결재 상세 ═══════════════════════ */

/**
 * RFP 구축범위 1.3.2 마켓플레이스:
 *   "… **관리자 승인 절차 기반** 배포·공유 범위(개인/부서/본부/해당계열사/그룹 전체) 통제"
 *
 * 결재자가 이 화면에서 판단할 것은 하나다 — **이 자산을 11개 Namespace 전체에
 * 열어도 되는가.** 그래서 화면을 자산과 범위 두 축으로만 세운다.
 *   ① 대상 자산이 무엇인가 (ID·종류·소유 계열사·버전)
 *   ② 현재 범위 → 요청 범위 (5단계 축 위에서 눈으로 확인)
 *   ③ 왜 올리는가 (사용량·평가·도입 부서)
 *   ④ 검증은 끝났는가 (레드팀·가드레일·PII·SLO 산출물)
 *   ⑤ 승인하면 무슨 일이 일어나는가 (Namespace 11개 노출)
 */
function ScopePromotionDetail({ promo, item }: { promo: ScopePromotion; item: ApprovalItem }) {
  const navigate = useNavigate();
  const persona = useCurrentPersona();
  const [note, setNote] = useState('');
  const pending = item.state === 'pending';
  // 단계마다 승인 주체가 다르다 — 지금 이 계정이 현재 단계의 당사자인가.
  const right = canDecideApproval(persona, item);
  const stage = currentPromotionStage(promo);
  // 마지막 단계에서만 공유 범위가 실제로 넓어진다. 그 전 단계는 '동의' 다.
  const isFinalStage = !!stage && !promo.stages.some((st) => st.state === 'upcoming');
  const decision = getApprovalDecision(item.id);

  const fromIdx = SCOPE_ORDER.indexOf(promo.fromScope);
  const toIdx = SCOPE_ORDER.indexOf(promo.toScope);
  const ownerNs = namespaceOf(promo.ownerTenant);

  const decide = (kind: ApprovalDecisionKind) => {
    // 다음 단계는 **처리 전에** 읽어 둔다 — decideApproval 이 상태를 옮기고 나면
    // 그 단계는 이미 'current' 라서 'upcoming' 검색에 걸리지 않는다.
    const next = promo.stages.find((st) => st.state === 'upcoming');
    decideApproval(item.id, kind, persona?.name ?? '현재 사용자', persona?.role ?? '결재자', note);
    const who = `${persona?.name ?? '현재 사용자'} (${persona?.role ?? '결재자'})`;
    const label =
      kind === 'approve' ? (isFinalStage ? '최종 승인' : '승인') : kind === 'reject' ? '반려' : '보류';
    // 중간 단계 승인은 완결이 아니다 — 다음 결재자가 누구인지까지 알려 준다.
    toast(
      `${item.id} · 공유범위 승격 ${label}`,
      kind !== 'approve'
        ? `처리 ${who} · 통합 감사 원장에 기록되었습니다`
        : isFinalStage
        ? `${promo.assetId} ${promo.assetName} 이(가) 그룹 범위로 공개됩니다 — 11개 Namespace 전체 노출\n처리 ${who}`
        : `처리 ${who}\n다음 단계: ${next?.label ?? '-'} · ${next?.approverName ?? '-'} (${next?.approverTenant ?? '-'})`,
      kind === 'reject' ? 'warn' : 'ok',
    );
    setNote('');
    if (kind !== 'hold') navigate('/approvals');
  };

  const statePill = pending
    ? { cls: 'bg-warn-bg text-warn border-warn-border', label: '승인 대기' }
    : item.state === 'done'
    ? { cls: 'bg-ok-bg text-ok border-ok-border', label: '승격 완료 · 그룹 공개' }
    : { cls: 'bg-bad-bg text-bad border-bad-border', label: '반려 · 범위 유지' };

  return (
    <div className="max-w-[1360px] mx-auto px-6 py-6 pb-[120px]">
      <Crumb
        items={[
          { label: '결재함', to: '/approvals' },
          { label: '공유범위 승격 결재' },
          { label: promo.assetName },
        ]}
        trailing={item.id}
      />

      {/* ── 헤더 ── */}
      <div className="card px-6 py-5 mb-3.5">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="pill bg-accent-purple-bg text-accent-purple border border-accent-purple-border">
            공유범위 승격
          </span>
          <span className={cn('pill border', statePill.cls)}>{statePill.label}</span>
          <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip">
            1.3.2 관리자 승인 절차 기반 공유 범위 통제
          </span>
        </div>
        <h1 className="text-[22px] font-extrabold text-ink tracking-[-0.3px] mb-1.5">
          {promo.assetName}
          <span className="ml-2 text-[13px] font-mono font-bold text-ink-light align-middle">
            {promo.assetId}
          </span>
        </h1>
        <p className="text-xs text-ink-mid font-semibold">
          요청 <b className="text-ink-dark">{promo.requestedBy}</b> ({promo.requesterTenant}) · 신청{' '}
          <b className="text-ink-dark">{item.draftedAt}</b> · 결재선{' '}
          <b className="text-ink-dark">{item.stage.label}</b> ({item.stage.current}/{item.stage.total} 단계)
        </p>
      </div>

      <div className="grid grid-cols-[1fr_340px] gap-3.5">
        <div>
          {/* ── ② 현재 범위 → 요청 범위 (이 화면의 핵심) ── */}
          <section className="card px-5 py-4 mb-3.5">
            <div className="flex items-baseline gap-2 mb-3 flex-wrap">
              <h2 className="text-[15px] font-extrabold text-ink">공유 범위 승격</h2>
              <span className="text-[11.5px] text-ink-mid font-semibold">
                개인 → 부서 → 본부 → 계열사 → 그룹 5단계 중{' '}
                <b className="text-ink-dark">{toIdx - fromIdx}단계</b> 승격 요청
              </span>
              <span className="ml-auto text-[12px] font-extrabold">
                <span className="text-warn">{promo.fromScope}</span>
                <span className="mx-1.5 text-ink-light">→</span>
                <span className="text-ok">{promo.toScope}</span>
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1.5">
              {SCOPE_ORDER.map((sc, i) => {
                const isFrom = i === fromIdx;
                const isTo = i === toIdx;
                const opened = i <= fromIdx;
                const delta = i > fromIdx && i <= toIdx;
                return (
                  <div key={sc} className="flex flex-col">
                    <div className="h-[16px] text-center text-[9.5px] font-extrabold tracking-[0.3px]">
                      {isFrom && <span className="text-warn">현재 범위</span>}
                      {isTo && <span className="text-ok">요청 범위</span>}
                    </div>
                    <div
                      className={cn(
                        'rounded px-2.5 py-2.5 border-2 text-center transition-colors',
                        isTo
                          ? 'border-ok bg-ok-bg'
                          : isFrom
                          ? 'border-warn bg-warn-bg'
                          : delta
                          ? 'border-dashed border-ok-border bg-ok-bg/30'
                          : opened
                          ? 'border-line-soft bg-surface-soft'
                          : 'border-line-soft bg-white',
                      )}
                    >
                      <div
                        className={cn(
                          'text-[13px] font-extrabold leading-tight',
                          isTo ? 'text-ok' : isFrom ? 'text-warn' : 'text-ink-mid',
                        )}
                      >
                        {sc}
                      </div>
                      <div className="text-[10px] text-ink-mid font-semibold mt-0.5 leading-snug">
                        {SCOPE_META[sc].desc}
                      </div>
                    </div>
                    <div className="h-[15px] mt-1 text-center text-[9.5px] font-bold">
                      {opened && <span className="text-ink-light">이미 열림</span>}
                      {delta && <span className="text-ok">승인 시 신규 개방</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="mt-2 text-[11px] text-ink-mid font-semibold leading-snug">
              승격은 <b className="text-ink-dark">소유권을 옮기지 않는다</b> — 자산은{' '}
              {promo.ownerTenant}({ownerNs}) 소유로 남고, 노출 범위만 넓어진다. 승인 후에도 소유
              계열사와 거버넌스가 언제든 범위를 회수할 수 있다.
            </p>
          </section>

          {/* ── ⑤ 승인 시 노출되는 Namespace ── */}
          <section className="card px-5 py-4 mb-3.5">
            <div className="flex items-baseline gap-2 mb-2.5 flex-wrap">
              <h2 className="text-[13px] font-extrabold text-ink">승인 시 노출 범위</h2>
              <span className="text-[11.5px] text-ink-mid font-semibold">
                노출 Namespace <b className="text-warn">1</b>
                <span className="mx-1 text-ink-light">→</span>
                <b className="text-ok">{TENANTS.length}</b> (계열사 10 + 그룹 공통 1)
              </span>
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {TENANTS.map((t) => {
                const already = t.name === promo.ownerTenant;
                return (
                  <div
                    key={t.name}
                    className={cn(
                      'rounded px-2 py-1.5 border text-center',
                      already ? 'border-warn bg-warn-bg' : 'border-dashed border-ok-border bg-ok-bg/30',
                    )}
                  >
                    <div
                      className={cn(
                        'text-[11px] font-extrabold leading-tight truncate',
                        already ? 'text-warn' : 'text-ok',
                      )}
                      title={t.name}
                    >
                      {t.short}
                    </div>
                    <div className="text-[9px] font-mono text-ink-light truncate" title={t.namespace}>
                      {t.namespace}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-3 mt-2 text-[10.5px] text-ink-mid font-semibold">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-warn-bg border border-warn" />
                현재 노출 (소유 계열사)
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 rounded-sm bg-ok-bg border border-dashed border-ok-border" />
                승인 시 신규 노출
              </span>
            </div>
          </section>

          {/* ── ① 대상 자산 ── */}
          <FormSection title="대상 자산">
            <FormRow k="자산 ID" v={<code className="text-[11.5px] font-mono font-bold text-ink-dark">{promo.assetId}</code>} />
            <FormRow k="자산 종류" v={promotionKindLabel(promo.assetKind)} />
            <FormRow k="자산명" v={promo.assetName} />
            <FormRow
              k="소유 계열사"
              v={
                <>
                  {promo.ownerTenant}
                  <span className="ml-1.5 text-[11px] font-mono text-ink-light">{ownerNs}</span>
                </>
              }
            />
            <FormRow k="소유자" v={promo.ownerName} />
            <FormRow k="버전" v={promo.version} />
            <FormRow k="최근 갱신" v={promo.updatedAt} />
          </FormSection>

          {/* ── ③ 승격 근거 ── */}
          <FormSection title="승격 근거">
            {promo.evidence.map((e) => (
              <FormRow
                key={e.k}
                k={e.k}
                v={
                  <span className="flex items-center gap-2">
                    <span className="flex-1 min-w-0">{e.v}</span>
                    <span
                      className={cn(
                        'pill border flex-shrink-0',
                        e.pass
                          ? 'bg-ok-bg text-ok border-ok-border'
                          : 'bg-warn-bg text-warn border-warn-border',
                      )}
                    >
                      {e.pass ? '기준 충족' : '확인 필요'}
                    </span>
                  </span>
                }
              />
            ))}
            {/* 기안 폼에서 요청자가 직접 쓴 입력 — 자동 문장이 아니다 */}
            <FormRow k="활용 업무" v={<span className="font-semibold">{promo.purpose}</span>} />
            <FormRow
              k="활용 예정 범위"
              v={
                <span className="font-semibold">
                  {promo.requesterTenant} 내 {promo.deployUnit}
                </span>
              }
            />
            <FormRow k="요청 사유" v={<span className="leading-relaxed font-medium">{promo.reason}</span>} />
          </FormSection>

          {/* ── ④ 검증 산출물 ── */}
          <FormSection title="검증 산출물">
            {promo.artifacts.map((a) => (
              <FormRow
                key={a.ref}
                k={a.ok ? '✓' : '⚠'}
                v={
                  <span className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => openDoc(a.name, a.ref)}
                      className="text-[12.5px] font-extrabold text-info hover:underline"
                    >
                      {a.name}
                    </button>
                    <span className="text-[10.5px] font-mono text-ink-light">{a.ref}</span>
                    <span
                      className={cn(
                        'ml-auto pill border',
                        a.ok ? 'bg-ok-bg text-ok border-ok-border' : 'bg-warn-bg text-warn border-warn-border',
                      )}
                    >
                      {a.result}
                    </span>
                  </span>
                }
              />
            ))}
          </FormSection>

          {/* ── 승인 시 적용 사항 ── */}
          <section className="card px-5 py-4">
            <h2 className="text-[13px] font-extrabold text-ink mb-2">승인하면 적용되는 것</h2>
            <ul className="space-y-1">
              {[
                `${promo.assetId} ${promo.assetName} 의 공유 범위가 ${promo.fromScope} → ${promo.toScope} 으로 변경된다.`,
                `11개 Namespace(계열사 10 + 그룹 공통) 전체의 마켓플레이스 카탈로그에 노출되고, 타 계열사 사용자가 별도 요청 없이 바로 사용한다.`,
                `자산 소유·과금 주체는 ${promo.ownerTenant} 로 유지되며, 호출량은 계열사별 미터링에 각각 집계된다.`,
                `공유 범위 변경 이력이 통합 감사 원장에 기록된다 — 누가·언제·어느 자산의 범위를 어떻게 바꿨는지(ONM-004).`,
                `소유 계열사 또는 그룹 거버넌스가 범위를 회수하면 즉시 ${promo.fromScope} 범위로 되돌아간다.`,
              ].map((t) => (
                <li key={t} className="flex items-start gap-1.5">
                  <span className="text-brand text-[11px] leading-[1.6] font-extrabold">·</span>
                  <span className="text-[11.5px] text-ink-dark font-semibold leading-snug">{t}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* ── 우측: 결재선 ── */}
        <aside className="sticky top-[106px] self-start">
          <SidebarCard title="결재선 진행" icon="📋">
            <div className="space-y-1.5">
              {promotionLine(promo).map((st) => (
                <ApprStep
                  key={st.seq + st.label}
                  seq={st.seq}
                  label={st.label}
                  sub={st.sub}
                  tone={
                    !pending && st.tone === 'current'
                      ? item.state === 'done'
                        ? 'done'
                        : 'rejected'
                      : st.tone
                  }
                />
              ))}
            </div>
          </SidebarCard>

          {decision && (
            <SidebarCard title="결재 결과" icon="🕒">
              <div className="space-y-1 text-[11.5px]">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-ink-dark">{decision.reviewer}</span>
                  <span className="text-ink-mid">({decision.reviewerRole})</span>
                  <span className="ml-auto text-ink-mid">{decision.decidedAt}</span>
                </div>
                <div className="text-ink-dark font-semibold">
                  {decision.kind === 'approve' ? '승인' : decision.kind === 'reject' ? '반려' : '보류'}
                  {decision.note && ` · ${decision.note}`}
                </div>
              </div>
            </SidebarCard>
          )}

          {pending && right.ok && (
            <SidebarCard title="결재 의견" icon="✎">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="승인·반려 사유 (선택)"
                className="w-full text-[12px] text-ink-dark leading-[1.6] border border-line rounded p-2 bg-white resize-y focus:outline-none focus:border-brand-dark"
              />
            </SidebarCard>
          )}
        </aside>
      </div>

      {/* ── 하단 고정 액션 바 ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-line z-30 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
        <div className="max-w-[1360px] mx-auto px-6 py-3 flex items-center gap-3">
          <div className="text-[11.5px] text-ink-mid font-semibold">
            <span className={cn('font-extrabold', pending ? 'text-warn' : 'text-ink-dark')}>
              {statePill.label}
            </span>
            <span className="mx-2 text-line">·</span>
            공유범위 승격 · {promo.fromScope} → {promo.toScope} · {item.stage.label}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {pending && !right.ok ? (
              <SodNotice hint={right.hint} />
            ) : pending ? (
              <>
                <Button variant="danger" onClick={() => decide('reject')}>반려</Button>
                <Button onClick={() => decide('hold')}>보류</Button>
                <Button variant="primary" onClick={() => decide('approve')}>
                  {isFinalStage ? '✓ 승인 · 그룹 공개' : '✓ 승인 — 다음 단계로'}
                </Button>
              </>
            ) : (
              <Link to="/approvals" className="text-[12px] font-bold text-info hover:underline">
                결재함으로 →
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


/* ═══════════════ 에이전트 배포 결재 상세 (AI Studio 기안) ═══════════════ */

/**
 * RFP: LSM-009(승인 기반 에이전트 배포) · ONM-003(직무 분리 기반 RBAC) ·
 *      ONM-004(감사 원장) · AGB-001(에이전트 빌더)
 *
 * 결재자가 판단할 것은 "이 에이전트를 이 환경에 올려도 되는가" 다. 그래서
 * 구성 요약·연결 지식·필수 항목 세 가지만 보여 준다. 결재선은 `stages` 에서
 * 파생하므로 상신 팝업과 항상 같은 말을 한다.
 */
function AgentDeployDetail({ dep, item }: { dep: AgentDeployApproval; item: ApprovalItem }) {
  const navigate = useNavigate();
  const persona = useCurrentPersona();
  const [note, setNote] = useState('');
  const pending = item.state === 'pending';
  const right = canDecideApproval(persona, item);
  const stage = currentDeployStage(dep);
  const isFinalStage = !!stage && !dep.stages.some((st) => st.state === 'upcoming');
  const decision = getApprovalDecision(item.id);

  const decide = (kind: ApprovalDecisionKind) => {
    // 다음 단계는 처리 **전에** 읽는다 — 처리 후엔 이미 current 라 검색에 안 걸린다.
    const next = dep.stages.find((st) => st.state === 'upcoming');
    decideApproval(item.id, kind, persona?.name ?? '현재 사용자', persona?.role ?? '결재자', note);
    const who = `${persona?.name ?? '현재 사용자'} (${persona?.role ?? '결재자'})`;
    const label =
      kind === 'approve' ? (isFinalStage ? '최종 승인' : '승인') : kind === 'reject' ? '반려' : '보류';
    toast(
      `${item.id} · ${dep.deployStage} 배포 ${label}`,
      kind !== 'approve'
        ? `처리 ${who} · 통합 감사 원장에 기록되었습니다`
        : isFinalStage
        ? `${dep.agentId} ${dep.agentName} 이(가) ${dep.deployStage}에 배포됩니다 · 사용 범위 ${dep.useScope}\n처리 ${who}`
        : `처리 ${who}\n다음 단계: ${next?.label ?? '-'} · ${next?.approverName ?? '-'} (${next?.approverTenant ?? '-'})`,
      kind === 'reject' ? 'warn' : 'ok',
    );
    setNote('');
    if (kind !== 'hold') navigate('/approvals');
  };

  const stateLabel = pending
    ? '승인 대기'
    : item.state === 'done'
    ? `배포 완료 · ${dep.deployStage}`
    : '반려 · 배포 보류';

  return (
    <div className="max-w-[1360px] mx-auto px-6 py-6 pb-[120px]">
      <Crumb
        items={[
          { label: '결재함', to: '/approvals' },
          { label: `${dep.deployStage} 배포 결재` },
          { label: dep.agentName },
        ]}
        trailing={item.id}
      />

      {/* ── 헤더 ── */}
      <div className="card px-6 py-5 mb-3.5">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="pill bg-info-bg text-info border border-info-border">
            {dep.deployStage} 배포
          </span>
          <span className="pill bg-surface-soft text-ink-mid border border-line-soft">
            사용 범위 {dep.useScope}
          </span>
          <span className="pill bg-surface-soft text-ink-mid border border-line-soft">
            {dep.ownerTenant} · {namespaceOf(dep.ownerTenant)}
          </span>
          {dep.templateFrom && (
            <span className="pill bg-ok-bg text-ok border border-ok-border">
              {dep.templateFrom.id} 「{dep.templateFrom.name}」에서 복제
            </span>
          )}
        </div>
        <h1 className="text-[22px] font-extrabold text-ink tracking-[-0.3px]">
          {dep.agentName}
          <span className="ml-2 text-[12px] font-mono font-bold text-ink-light align-middle">
            {dep.agentId}
          </span>
        </h1>
        <p className="text-xs text-ink-mid font-semibold mt-1.5">
          기안 <b className="text-ink-dark">{dep.draftedBy}</b> ({dep.draftedByRole}) ·{' '}
          <b className="text-ink-dark">{dep.draftedAt}</b> · 결재선{' '}
          <b className="text-ink-dark">{item.stage.label}</b>
        </p>
      </div>

      <div className="grid grid-cols-[1fr_320px] gap-3.5">
        <main>
          <FormSection title="배포 구성">
            <FormRow k="에이전트 ID" v={<code className="text-[11.5px] font-mono font-bold text-ink-dark">{dep.agentId}</code>} />
            <FormRow k="빌더" v={dep.builderLabel} />
            <FormRow k="주력 모델" v={<code className="text-[11.5px] font-mono font-bold text-ink-dark">{dep.mainModel}</code>} />
            <FormRow k="배포 환경" v={dep.deployStage} />
            <FormRow
              k="사용 범위"
              v={
                <span>
                  {dep.useScope}
                  <span className="text-ink-mid font-semibold ml-1.5">
                    · 계열사·그룹 공개는 별도 승격 결재 대상
                  </span>
                </span>
              }
            />
          </FormSection>

          <FormSection title="연결 지식 자산">
            {dep.linkedKnowledge.length === 0 ? (
              <div className="text-[11.5px] text-warn font-semibold py-2">
                연결된 지식 자산이 없습니다 — 근거 없는 응답이 나갈 수 있습니다.
              </div>
            ) : (
              <div className="space-y-1.5">
                {dep.linkedKnowledge.map((k) => (
                  <div
                    key={k.id}
                    className="flex items-center gap-3 px-3 py-2 rounded border border-line-soft bg-white"
                  >
                    <span className="text-[10px] font-mono font-bold text-ink-light flex-shrink-0">
                      {k.id}
                    </span>
                    <span className="text-[12.5px] font-extrabold text-ink truncate">{k.name}</span>
                    <span className="ml-auto text-[10.5px] text-ink-mid font-semibold whitespace-nowrap">
                      소유 {k.owner} · 최신 갱신 {k.updatedAt}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </FormSection>

          <FormSection title="필수 항목 확인">
            <div className="grid grid-cols-2 gap-x-5 gap-y-1">
              {dep.checks.map((c) => (
                <div key={c.k} className="flex items-baseline gap-2 text-[11.5px] py-1">
                  <span className={c.pass ? 'text-ok' : 'text-warn'}>{c.pass ? '✓' : '·'}</span>
                  <span className="text-ink-mid font-semibold">{c.k}</span>
                  <span className="ml-auto text-ink-dark font-bold truncate" title={c.v}>
                    {c.v}
                  </span>
                </div>
              ))}
            </div>
          </FormSection>
        </main>

        {/* ── 우측: 결재선 ── */}
        <aside className="sticky top-[106px] self-start">
          <SidebarCard title="결재선 진행" icon="📋">
            <div className="space-y-1.5">
              {deployLine(dep).map((st) => (
                <ApprStep
                  key={st.seq + st.label}
                  seq={st.seq}
                  label={st.label}
                  sub={st.sub}
                  tone={
                    !pending && st.tone === 'current'
                      ? item.state === 'done'
                        ? 'done'
                        : 'rejected'
                      : st.tone
                  }
                />
              ))}
            </div>
            <div className="mt-2 text-[10.5px] text-ink-mid font-semibold leading-relaxed">
              개발자와 승인권자는 분리된다 — 기안자는 어느 단계에도 배정되지 않는다 · ONM-003
            </div>
          </SidebarCard>

          {decision && (
            <SidebarCard title="결재 결과" icon="🕒">
              <div className="space-y-1 text-[11.5px]">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-ink-dark">{decision.reviewer}</span>
                  <span className="text-ink-mid">({decision.reviewerRole})</span>
                  <span className="ml-auto text-ink-mid">{decision.decidedAt}</span>
                </div>
                <div className="text-ink-dark font-semibold">
                  {decision.kind === 'approve' ? '승인' : decision.kind === 'reject' ? '반려' : '보류'}
                  {decision.note && ` · ${decision.note}`}
                </div>
              </div>
            </SidebarCard>
          )}

          {pending && right.ok && (
            <SidebarCard title="결재 의견" icon="✎">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="승인·반려 사유 (선택)"
                className="w-full text-[12px] text-ink-dark leading-[1.6] border border-line rounded p-2 bg-white resize-y focus:outline-none focus:border-brand-dark"
              />
            </SidebarCard>
          )}
        </aside>
      </div>

      {/* ── 하단 고정 액션 바 ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-line z-30 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
        <div className="max-w-[1360px] mx-auto px-6 py-3 flex items-center gap-3">
          <div className="text-[11.5px] text-ink-mid font-semibold">
            <span className={cn('font-extrabold', pending ? 'text-warn' : 'text-ink-dark')}>
              {stateLabel}
            </span>
            <span className="mx-2 text-line">·</span>
            {dep.agentId} · {dep.deployStage} 배포 · {item.stage.label}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {pending && !right.ok ? (
              <SodNotice hint={right.hint} />
            ) : pending ? (
              <>
                <Button variant="danger" onClick={() => decide('reject')}>반려</Button>
                <Button onClick={() => decide('hold')}>보류</Button>
                <Button variant="primary" onClick={() => decide('approve')}>
                  {isFinalStage ? `✓ 승인 · ${dep.deployStage} 배포` : '✓ 승인 — 다음 단계로'}
                </Button>
              </>
            ) : (
              <Link to="/approvals" className="text-[12px] font-bold text-info hover:underline">
                결재함으로 →
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
