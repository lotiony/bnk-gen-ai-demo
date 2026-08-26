/**
 * 승인 기반 배포 + DB 동적 라우팅 — 핸드오프 §2 화면 9 (P0 ★).
 *
 * RFP: LSM-009 · EDA-005 · SEC-006 · SEC-007 · ONM-003
 *   (전부 발주처가 "상세제안 필요"로 표시한 16개에 포함 — 배점 집중 지점)
 *   ⚠️ 요건 원문 제목은 이 저장소에 없다. 화면 문구는 핸드오프 §2 화면 9 서술만
 *      근거로 삼았고, ID 표기는 제안서 조견표와 대조 확인이 필요하다.
 *
 * 이 화면이 증명해야 하는 명제 —
 *   "같은 에이전트가 같은 질의를 던져도, **승인 상태에 따라 접속 대상 DB가
 *    런타임에 갈린다.** 그리고 그 전환에는 관문이 하나가 아니라 둘이다."
 *
 * 그래서 게이트를 ①배포 승인 ②동의 권원 확인 으로 나누고, **하나만 통과한
 * 중간 상태를 실제로 밟아볼 수 있게** 만들었다. 하나만으로 열리면 "2중 통제"가
 * 화면에서 거짓이 된다.
 *
 * 컨테이너 폭 — 이 페이지만 1760px 를 쓴다(다른 화면은 1360). 운영 DB 쪽 원본 값
 * (생년월일·연락처·상담일시)이 한 글자도 잘리지 않아야 "복호화되어 보인다"가
 * 성립하기 때문이다. 1760 은 CLAUDE.md 가 정한 페이지 컨테이너 상한이다.
 */
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Crumb from '@/components/ui/Crumb';
import { useWorkCrumb, useWorkContainer, useWorkReturnPath, useWorkReturnLabel, useInWorkspace } from '@/lib/crumbs';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import {
  ROUTING_GATES,
  ROUTING_TARGETS,
  ROUTING_QUERY,
  ROUTING_COLUMNS,
  ROUTING_ROWS,
  CONSENT_EVIDENCE,
  LOCK_REASONS,
  AUDIT_SEED,
  AUDIT_VERDICT_META,
  deriveAuditRows,
  type GateId,
  type RoutingTarget,
} from '@/data/mockDataRouting';

type GateTone = 'done' | 'current' | 'upcoming';

/** 셸 밖(프로젝트 경로)에서 단독으로 열릴 때의 컨테이너. */
const WORK_STANDALONE_CLS = 'max-w-[1760px] mx-auto px-8 pt-3.5 pb-14';
/** AI Studio · 지식 데이터 셸 안에서 열릴 때의 컨테이너. */
const WORK_SHELL_CLS = 'w-full pb-14';

export default function DataRoutingTaskPage() {
  const { projectId } = useParams();
  const pid = projectId ?? 'PRJ-2025-PB-001';
  const crumbItems = useWorkCrumb('데이터 라우팅', pid);
  const containerCls = useWorkContainer(WORK_STANDALONE_CLS, WORK_SHELL_CLS);
  const returnPath = useWorkReturnPath(pid);
  const returnLabel = useWorkReturnLabel();
  const inWorkspace = useInWorkspace();

  /** 게이트 ① 승인권자 결재. */
  const [deployApproved, setDeployApproved] = useState(false);
  /** 게이트 ② 정보보호 그룹 동의 권원 확인. */
  const [consentVerified, setConsentVerified] = useState(false);

  /** 두 관문이 **모두** 통과해야 운영 DB 복호화 경로가 열린다. */
  const unlocked = deployApproved && consentVerified;

  const audit = useMemo(
    () => [...deriveAuditRows(deployApproved, consentVerified), ...AUDIT_SEED],
    [deployApproved, consentVerified],
  );

  const gateTone = (id: GateId): GateTone => {
    switch (id) {
      case 'draft':
        return 'done';
      case 'deploy':
        return deployApproved ? 'done' : 'current';
      case 'consent':
        if (consentVerified) return 'done';
        return deployApproved ? 'current' : 'upcoming';
      case 'access':
        return unlocked ? 'done' : 'upcoming';
    }
  };

  const reset = () => {
    setDeployApproved(false);
    setConsentVerified(false);
  };

  return (
    <div className={containerCls}>
      <Crumb items={crumbItems} />

      {/* ── 헤더 ── */}
      <div className="flex items-start gap-3 mt-2 mb-3.5">
        <div className="min-w-0 flex-1">
          <h1 className="text-[20px] font-extrabold tracking-[-0.4px]">데이터 접근 라우팅</h1>
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            {!inWorkspace && (
              <span className="pill bg-surface text-ink-mid border border-line-soft">
                과제 <b className="text-ink-dark">PB 에이전트 프로젝트</b>
              </span>
            )}
            <span className="pill bg-surface text-ink-mid border border-line-soft">
              에이전트 <b className="text-ink-dark">AGT-204 PB 자산진단 어시스턴트</b>
            </span>
            <span className="pill bg-info-bg text-info border border-info-border">
              인프라 🏢 <b>공동존 On-Prem</b>
            </span>
            <span className="pill bg-brand-tint text-brand border border-brand-tint">DRT-101</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-extrabold text-ink-light uppercase tracking-[0.4px] mr-0.5">
              대응 요건
            </span>
            {['LSM-009', 'EDA-005', 'SEC-006', 'SEC-007', 'ONM-003'].map((r) => (
              <span
                key={r}
                className="pill bg-white text-ink-mid border border-line font-mono tracking-normal"
              >
                {r}
              </span>
            ))}
          </div>
        </div>
        <Button variant="ghost" onClick={reset} className="flex-shrink-0 mt-1">
          ↺ 시연 초기화
        </Button>
      </div>

      {/* ── 2중 승인 통제 스트립 ── */}
      <section className="card px-5 py-4 mb-3.5">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-[14px] font-extrabold text-ink">2중 승인 통제</h2>
          <span className="text-[11px] text-ink-mid font-semibold">
            배포 승인과 동의 권원 확인은 서로를 대체하지 않는다 — 둘 다 통과해야 운영 데이터가 열린다
          </span>
          <span
            className={cn(
              'ml-auto pill border',
              unlocked
                ? 'bg-ok-bg text-ok border-ok-border'
                : 'bg-surface text-ink-mid border-line-soft',
            )}
          >
            {unlocked ? '● 2 / 2 통과' : `● ${Number(deployApproved) + Number(consentVerified)} / 2 통과`}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2.5">
          {ROUTING_GATES.map((g) => {
            const tone = gateTone(g.id);
            const actionable =
              (g.id === 'deploy' && !deployApproved) ||
              (g.id === 'consent' && deployApproved && !consentVerified);
            return (
              <div
                key={g.id}
                className={cn(
                  'flex flex-col rounded border px-3 py-2.5 min-h-[104px]',
                  tone === 'done' && 'bg-ok-bg/40 border-ok-border',
                  tone === 'current' && 'bg-brand-tint border-brand-dark',
                  tone === 'upcoming' && 'bg-white border-line-soft',
                )}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className={cn(
                      'w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-extrabold flex-shrink-0',
                      tone === 'done' && 'bg-ok text-white',
                      tone === 'current' && 'bg-brand-dark text-white',
                      tone === 'upcoming' && 'bg-white text-ink-light border border-line',
                    )}
                  >
                    {tone === 'done' ? '✓' : g.seq}
                  </span>
                  <span
                    className={cn(
                      'text-[12.5px]',
                      tone === 'current' ? 'font-extrabold text-ink' : 'font-bold text-ink-dark',
                    )}
                  >
                    {g.label}
                  </span>
                  <span className="ml-auto pill bg-white/70 text-ink-mid border border-line-soft font-mono tracking-normal">
                    {g.reqId}
                  </span>
                </div>
                <div className="text-[10.5px] text-ink-mid font-semibold leading-snug">{g.actor}</div>
                <div className="text-[11px] text-ink-dark font-semibold leading-snug mt-1">{g.desc}</div>
                {actionable && (
                  <button
                    onClick={() =>
                      g.id === 'deploy' ? setDeployApproved(true) : setConsentVerified(true)
                    }
                    className="mt-auto self-start inline-flex items-center h-[26px] px-2.5 rounded bg-brand border border-brand-dark text-white text-[11px] font-extrabold hover:bg-brand-dark"
                  >
                    {g.id === 'deploy' ? '승인권자 결재 승인' : '동의 권원 확인'}
                  </button>
                )}
                {g.id === 'access' && (
                  <div
                    className={cn(
                      'mt-auto text-[11px] font-extrabold',
                      unlocked ? 'text-ok' : 'text-ink-light',
                    )}
                  >
                    {unlocked ? '🔓 복호화 경로 개방' : '🔒 잠김'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 라우팅 다이어그램 ── */}
      <section className="card px-5 py-4 mb-3.5">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-[14px] font-extrabold text-ink">런타임 라우팅</h2>
          <span className="text-[11px] text-ink-mid font-semibold">
            에이전트도 질의도 그대로다 — 접근 정책 판정만이 대상을 바꾼다
          </span>
          <span
            className={cn(
              'ml-auto pill border',
              unlocked ? 'bg-ok-bg text-ok border-ok-border' : 'bg-info-bg text-info border-info-border',
            )}
          >
            현재 경로 · {unlocked ? '운영 DB (복호화)' : '개발 DB (익명화)'}
          </span>
        </div>
        <RoutingDiagram unlocked={unlocked} />
      </section>

      {/* ── 동일 질의 ── */}
      <section className="card px-5 py-4 mb-3.5">
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-[14px] font-extrabold text-ink">실행 질의</h2>
          <span className="text-[11px] text-ink-mid font-semibold">
            좌우 패널이 <b className="text-ink-dark">완전히 동일한 질의</b>를 실행한다. 달라지는 것은 접속 대상뿐이다
          </span>
        </div>
        <pre className="bg-surface-soft border border-line-soft rounded px-3.5 py-2.5 text-[11.5px] leading-[1.65] font-mono text-ink-dark overflow-x-auto">
          {ROUTING_QUERY}
        </pre>
      </section>

      {/* ── 좌우 대비 ── */}
      <div className="grid grid-cols-2 gap-3.5 mb-3.5">
        <ResultPanel target={ROUTING_TARGETS.dev} active={!unlocked} locked={false} />
        <ResultPanel
          target={ROUTING_TARGETS.prod}
          active={unlocked}
          locked={!unlocked}
          lockReasons={LOCK_REASONS.filter((r) =>
            r.gate === 'deploy' ? !deployApproved : !consentVerified,
          ).map((r) => r.text)}
        />
      </div>

      {/* ── 동의 권원 · 감사 로그 ── */}
      <div className="grid grid-cols-[440px_1fr] gap-3.5">
        <section className="card px-5 py-4">
          <div className="flex items-center gap-2 mb-2.5">
            <h2 className="text-[14px] font-extrabold text-ink">동의 권원</h2>
            <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal">
              SEC-007
            </span>
            <span
              className={cn(
                'ml-auto pill border',
                consentVerified
                  ? 'bg-ok-bg text-ok border-ok-border'
                  : 'bg-warn-bg text-warn border-warn-border',
              )}
            >
              {consentVerified ? '● 확인 완료' : '● 미확인'}
            </span>
          </div>
          <p className="text-[11px] text-ink-mid font-semibold leading-snug mb-2.5">
            승인이 났다는 사실만으로 열지 않는다. <b className="text-ink-dark">이 처리 목적에 대한 권원이 있는지</b>를
            따로 확인하고 그 근거를 남긴다.
          </p>
          <ul className="divide-y divide-line-soft">
            {CONSENT_EVIDENCE.map((c) => (
              <li key={c.k} className="flex items-start gap-2.5 py-2">
                <span
                  className={cn(
                    'w-[18px] h-[18px] rounded-full inline-flex items-center justify-center text-[10px] font-extrabold flex-shrink-0 mt-[1px]',
                    consentVerified && c.ok
                      ? 'bg-ok text-white'
                      : 'bg-surface-soft text-ink-light border border-line',
                  )}
                >
                  {consentVerified && c.ok ? '✓' : ''}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11.5px] font-extrabold text-ink-dark">{c.k}</span>
                  <span className="block text-[11px] text-ink-mid font-semibold leading-snug">{c.v}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card px-5 py-4">
          <div className="flex items-center gap-2 mb-2.5">
            <h2 className="text-[14px] font-extrabold text-ink">접근 감사 로그</h2>
            <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal">
              ONM-003
            </span>
            <span className="text-[11px] text-ink-mid font-semibold">
              허용된 접근만이 아니라 <b className="text-ink-dark">차단된 시도</b>도 남는다
            </span>
            <span className="ml-auto text-[11px] text-ink-mid font-bold">{audit.length}건</span>
          </div>
          <div className="border border-line-soft rounded overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-surface-soft">
                  {['시각', '주체', '동작', '대상', '판정', '비고'].map((h) => (
                    <th
                      key={h}
                      className="text-left text-[10.5px] font-extrabold text-ink-mid uppercase tracking-[0.3px] px-2.5 py-1.5 border-b border-line-soft whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {audit.map((a, i) => {
                  const meta = AUDIT_VERDICT_META[a.verdict];
                  return (
                    <tr key={`${a.at}-${i}`} className="border-b border-line-soft last:border-b-0">
                      <td className="px-2.5 py-1.5 text-[11px] font-mono text-ink-mid whitespace-nowrap">
                        {a.at}
                      </td>
                      <td className="px-2.5 py-1.5 text-[11px] font-bold text-ink-dark whitespace-nowrap">
                        {a.actor}
                      </td>
                      <td className="px-2.5 py-1.5 text-[11px] text-ink-dark">{a.action}</td>
                      {/* 대상은 대개 식별자라 mono 가 맞지만, 한글 문구에 mono 를 씌우면
                          자간이 벌어져 읽기 나빠진다. 한글이 섞이면 본문 글꼴로 둔다. */}
                      <td
                        className={cn(
                          'px-2.5 py-1.5 text-[11px] text-ink-mid whitespace-nowrap',
                          !/[가-힣]/.test(a.target) && 'font-mono',
                        )}
                      >
                        {a.target}
                      </td>
                      <td className="px-2.5 py-1.5 whitespace-nowrap">
                        <span className={cn('pill border', meta.cls)}>{meta.label}</span>
                      </td>
                      <td className="px-2.5 py-1.5 text-[11px] text-ink-mid">{a.note}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="mt-4">
        <Link
          to={returnPath}
          className="inline-flex items-center h-8 px-3 border border-line rounded text-[12px] font-extrabold text-ink-dark hover:border-brand hover:text-brand"
        >
          {returnLabel}
        </Link>
      </div>
    </div>
  );
}

/* ═══════════════════════ 라우팅 다이어그램 ═══════════════════════ */

const C = {
  brand: '#CB2C10',
  brandDark: '#A82410',
  brandTint: '#FBE9E6',
  idle: '#C9C9C9',
  line: '#E0E0E1',
  inkMid: '#666666',
  inkLight: '#999999',
  ink: '#212121',
  info: '#1F5BB8',
  infoBg: '#E8F0FB',
  infoBorder: '#C5D6F6',
  ok: '#1B8A4D',
  okBg: '#E8F5EE',
  okBorder: '#B8DCC6',
  surface: '#F6F6F6',
};

/**
 * 경로 연출 — 활성 경로만 브랜드색 실선 + 흐름 점선(og-flowdash 재사용),
 * 비활성 경로는 얇은 회색. 화살촉은 선 색을 그대로 따른다(온톨로지에서 얻은 규칙).
 */
function RoutingDiagram({ unlocked }: { unlocked: boolean }) {
  const devOn = !unlocked;
  const prodOn = unlocked;

  return (
    <svg
      viewBox="0 0 1300 210"
      className="w-full h-auto"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`런타임 라우팅 — 현재 ${unlocked ? '운영 DB 복호화' : '개발 DB 익명화'} 경로`}
    >
      <defs>
        <marker id="drt-ar-on" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 1 L 9 5 L 0 9 z" fill={C.brand} />
        </marker>
        <marker id="drt-ar-off" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 1 L 9 5 L 0 9 z" fill={C.idle} />
        </marker>
      </defs>

      {/* 요청 본류 — 항상 흐른다 */}
      <line x1="192" y1="105" x2="246" y2="105" stroke={C.brand} strokeWidth="2" markerEnd="url(#drt-ar-on)" />
      <line x1="428" y1="105" x2="482" y2="105" stroke={C.brand} strokeWidth="2" markerEnd="url(#drt-ar-on)" />

      {/* 분기 — 개발 DB */}
      <path
        d="M 684 105 C 716 105, 724 46, 754 46"
        fill="none"
        stroke={devOn ? C.brand : C.idle}
        strokeWidth={devOn ? 2.4 : 1.4}
        markerEnd={devOn ? 'url(#drt-ar-on)' : 'url(#drt-ar-off)'}
      />
      {devOn && (
        <path
          d="M 684 105 C 716 105, 724 46, 754 46"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="1.6"
          strokeDasharray="7 9"
          strokeLinecap="round"
          className="og-flowdash"
          opacity="0.85"
        />
      )}

      {/* 분기 — 운영 DB */}
      <path
        d="M 684 105 C 716 105, 724 164, 754 164"
        fill="none"
        stroke={prodOn ? C.brand : C.idle}
        strokeWidth={prodOn ? 2.4 : 1.4}
        strokeDasharray={prodOn ? undefined : '5 5'}
        markerEnd={prodOn ? 'url(#drt-ar-on)' : 'url(#drt-ar-off)'}
      />
      {prodOn && (
        <path
          d="M 684 105 C 716 105, 724 164, 754 164"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="1.6"
          strokeDasharray="7 9"
          strokeLinecap="round"
          className="og-flowdash"
          opacity="0.85"
        />
      )}

      <DiagramNode
        x={16} y={76} w={176} h={58}
        title="에이전트" sub="AGT-204 PB 자산진단"
        fill="#FFFFFF" stroke={C.line} titleColor={C.ink}
      />
      <DiagramNode
        x={252} y={76} w={176} h={58}
        title="AX Gateway" sub="요청 라우팅 · 정책 주입"
        fill="#FFFFFF" stroke={C.line} titleColor={C.ink}
      />
      <DiagramNode
        x={488} y={76} w={196} h={58}
        title="접근 정책 판정 (PDP)" sub="배포상태 × 동의권원"
        fill={C.brandTint} stroke={C.brand} titleColor={C.brandDark}
      />
      <DiagramNode
        x={754} y={14} w={306} h={64}
        title="개발 DB (학습계)" sub="ns-bank-bs-dev"
        foot="익명화 복제본 · 재식별 불가"
        fill={devOn ? C.infoBg : '#FFFFFF'}
        stroke={devOn ? C.info : C.line}
        titleColor={devOn ? C.info : C.inkLight}
        dim={!devOn}
      />
      <DiagramNode
        x={754} y={132} w={306} h={64}
        title={prodOn ? '운영 DB (서빙계)' : '🔒 운영 DB (서빙계)'}
        sub="ns-bank-bs-prod"
        foot="데이터 가상화 경유(zero-copy) · 복호화"
        fill={prodOn ? C.okBg : C.surface}
        stroke={prodOn ? C.ok : C.idle}
        titleColor={prodOn ? C.ok : C.inkLight}
        dashed={!prodOn}
        dim={!prodOn}
      />

      {/* 분기 판정 캡션 */}
      <text x="1080" y="50" fontSize="11" fontWeight="700" fill={devOn ? C.info : C.inkLight}>
        {devOn ? '◀ 현재 라우팅' : ''}
      </text>
      <text x="1080" y="168" fontSize="11" fontWeight="700" fill={prodOn ? C.ok : C.inkLight}>
        {prodOn ? '◀ 현재 라우팅' : '차단'}
      </text>
    </svg>
  );
}

function DiagramNode({
  x, y, w, h, title, sub, foot, fill, stroke, titleColor, dashed, dim,
}: {
  x: number; y: number; w: number; h: number;
  title: string; sub: string; foot?: string;
  fill: string; stroke: string; titleColor: string;
  dashed?: boolean; dim?: boolean;
}) {
  return (
    <g opacity={dim ? 0.72 : 1}>
      <rect
        x={x} y={y} width={w} height={h} rx="3"
        fill={fill} stroke={stroke} strokeWidth="1.4"
        strokeDasharray={dashed ? '5 4' : undefined}
      />
      <text x={x + 14} y={y + (foot ? 21 : 25)} fontSize="13" fontWeight="800" fill={titleColor}>
        {title}
      </text>
      <text x={x + 14} y={y + (foot ? 38 : 42)} fontSize="11" fontWeight="600" fill={C.inkMid}>
        {sub}
      </text>
      {foot && (
        <text x={x + 14} y={y + 54} fontSize="10.5" fontWeight="600" fill={C.inkLight}>
          {foot}
        </text>
      )}
    </g>
  );
}

/* ═══════════════════════ 결과 패널 ═══════════════════════ */

/**
 * 폭이 고정되지 않은 유동 컬럼(상담 요약)은 좁은 화면에서 **접는다**.
 * 개인정보 컬럼을 좁혀 잘리게 두는 것보다 부가 컬럼을 통째로 빼는 편이 낫다 —
 * 이 화면이 증명하려는 건 익명화 ↔ 복호화 대비이지 상담 내용이 아니다.
 * 2xl = 1536px 기준. 시연 목표 해상도 1920 에서는 항상 보인다.
 */
const FLEX_COL_CLS = 'hidden 2xl:table-column';
const FLEX_CELL_CLS = 'hidden 2xl:table-cell';

function ResultPanel({
  target,
  active,
  locked,
  lockReasons = [],
}: {
  target: RoutingTarget;
  active: boolean;
  locked: boolean;
  lockReasons?: string[];
}) {
  const isProd = target.kind === 'prod';
  const tone = isProd
    ? { pill: 'bg-ok-bg text-ok border-ok-border', ring: 'border-ok' }
    : { pill: 'bg-info-bg text-info border-info-border', ring: 'border-info' };

  return (
    <section
      className={cn(
        'card overflow-hidden transition-colors duration-300',
        active ? cn('border-2', tone.ring) : 'border border-line-soft',
      )}
    >
      {/* 패널 헤더 */}
      <div className={cn('px-4 py-3 border-b', active ? 'bg-surface-soft border-line-soft' : 'border-line-soft')}>
        <div className="flex items-center gap-2">
          <span className={cn('pill border', tone.pill)}>{target.stateLabel}</span>
          <h3 className="text-[14px] font-extrabold text-ink">{target.title}</h3>
          {active && (
            <span className="pill bg-brand-tint text-brand border border-brand-tint">● 현재 접속 중</span>
          )}
          {locked && (
            <span className="pill bg-surface text-ink-light border border-line">🔒 접근 차단</span>
          )}
        </div>
        <dl className="grid grid-cols-[76px_1fr] gap-x-2.5 gap-y-1 mt-2.5">
          <Kv k="Namespace" v={target.namespace} mono />
          <Kv k="엔드포인트" v={target.endpoint} mono />
          <Kv k="접속 계정" v={target.account} mono />
          <Kv k="데이터 상태" v={target.dataState} />
          <Kv k="보호 조치" v={target.protection} />
          <Kv k="이동 성격" v={target.transfer} />
        </dl>
      </div>

      {/* 결과 표 */}
      <div className="relative">
        <div
          className={cn(
            'transition-[filter,opacity] duration-500',
            locked && 'blur-[5px] opacity-60 select-none pointer-events-none',
          )}
          aria-hidden={locked}
        >
          <table className="w-full border-collapse table-fixed">
            <colgroup>
              {ROUTING_COLUMNS.map((c) => (
                <col
                  key={c.key}
                  style={c.w ? { width: `${c.w}px` } : undefined}
                  className={c.w ? undefined : FLEX_COL_CLS}
                />
              ))}
            </colgroup>
            <thead>
              <tr className="bg-surface-soft">
                {ROUTING_COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    className={cn(
                      'text-left px-2.5 pt-2 pb-1 border-b border-line-soft align-top',
                      c.pii && 'bg-warn-bg/40',
                      !c.w && FLEX_CELL_CLS,
                    )}
                  >
                    <span className="block text-[11px] font-extrabold text-ink-dark whitespace-nowrap">
                      {c.label}
                      {c.pii && <span className="ml-1 text-warn text-[9px] align-top">●</span>}
                    </span>
                    <span
                      className={cn(
                        'block text-[9.5px] font-bold whitespace-nowrap mt-0.5',
                        c.pii ? (isProd ? 'text-ok' : 'text-info') : 'text-ink-light',
                      )}
                    >
                      {isProd
                        ? c.pii
                          ? c.storage === '컬럼 암호화'
                            ? '복호화'
                            : '원본'
                          : '원본'
                        : c.anonymize}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROUTING_ROWS.map((r, i) => {
                const cells = isProd ? r.prod : r.dev;
                return (
                  <tr key={i} className="border-b border-line-soft last:border-b-0">
                    {ROUTING_COLUMNS.map((c) => (
                      <td
                        key={c.key}
                        className={cn(
                          'px-2.5 py-[7px] text-[11.5px] truncate',
                          c.pii
                            ? isProd
                              ? 'font-bold text-ink bg-warn-bg/25'
                              : 'font-semibold text-ink-mid bg-warn-bg/25'
                            : 'text-ink-dark',
                          (c.key === 'customer_id' || c.key === 'phone' || c.key === 'consult_at') &&
                            'font-mono text-[11px]',
                          !c.w && FLEX_CELL_CLS,
                        )}
                        title={cells[c.key]}
                      >
                        {cells[c.key]}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-4 py-2 bg-surface-soft border-t border-line-soft flex items-center gap-2">
            <span className="text-[10.5px] text-ink-mid font-semibold">
              5행 반환 · <span className="text-warn font-extrabold">●</span> 표시는 개인정보 항목
            </span>
            <span className="ml-auto text-[10.5px] font-extrabold text-ink-mid">
              {isProd ? '복호화 컬럼 4 · 평문 3' : '가명 대체 2 · 일반화 2 · 삭제 1 · 원본 2'}
            </span>
          </div>
        </div>

        {/* 잠금 오버레이 — 무엇이 모자라서 막혔는지를 그 자리에서 말한다 */}
        {locked && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/55 backdrop-blur-[1px] px-6">
            <div className="card border border-line px-5 py-4 shadow-md max-w-[420px] w-full bg-white">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[16px]">🔒</span>
                <span className="text-[13px] font-extrabold text-ink">운영 데이터 접근이 차단되었습니다</span>
              </div>
              <ul className="space-y-1.5">
                {lockReasons.map((r) => (
                  <li key={r} className="flex items-start gap-2">
                    <span className="w-[15px] h-[15px] rounded-full bg-bad-bg border border-bad-border text-bad inline-flex items-center justify-center text-[9px] font-extrabold flex-shrink-0 mt-[1px]">
                      ✕
                    </span>
                    <span className="text-[11.5px] font-semibold text-ink-dark leading-snug">{r}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2.5 pt-2.5 border-t border-line-soft text-[10.5px] text-ink-mid font-semibold leading-snug">
                차단된 시도도 접근 감사 로그에 기록된다(ONM-003).
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Kv({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <>
      <dt className="text-[10.5px] font-bold text-ink-light uppercase tracking-[0.3px] pt-[1px]">{k}</dt>
      <dd className={cn('text-[11px] font-semibold text-ink-dark min-w-0 truncate', mono && 'font-mono')} title={v}>
        {v}
      </dd>
    </>
  );
}
