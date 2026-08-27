/**
 * MCP Tool 자동 등록 — 핸드오프 §2 화면 8.
 *
 * RFP: AGB-004 · EDA-004(레거시 금융 전문 자동 변환) · 2-1 포탈 공통(실행 통제)
 *
 * "스펙을 붙여넣으면 도구가 된다"를 보여주는 화면이다. 다만 **전부 자동은
 * 아니다**를 같은 화면에 적는다 — 쓰기 도구를 스펙만 보고 열어 주면 사고이고,
 * 화면에 그린 자동화 범위는 그대로 확약이 된다(RFP Ⅳ.4.1).
 *
 * 입력 소스는 둘이다 — OpenAPI(AGB-004)와 레거시 금융 전문 FEP(EDA-004).
 * 어느 쪽이든 같은 파이프라인(파싱→매핑→부작용 판정→결재 분류)을 탄다.
 *
 * 실행 시뮬레이션(2-1 "MCP·Tool 호출 시 사용자 권한 및 허용범위에 따른 실행 통제")
 * — 변환이 끝났다고 실행이 열리는 게 아니다. 호출 시점에 PDP 가 다시 판정한다.
 *
 * 여기서 등록되는 `authority.lookup` 이 화면 7 워크플로우의 MCP 노드가 쓰는
 * 바로 그 도구다. 두 화면이 같은 것을 가리켜야 흐름이 성립한다.
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Crumb from '@/components/ui/Crumb';
import { useWorkCrumb, useWorkContainer } from '@/lib/crumbs';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { useCurrentPersona } from '@/lib/persona';
import {
  OPENAPI_SAMPLE,
  PARSED_TOOLS,
  CONVERT_STEPS,
  MCP_SERVER,
  REGISTERED_SERVERS,
  NOT_AUTOMATED,
  LEGACY_SAMPLE,
  LEGACY_TOOLS,
  LEGACY_CONVERT_STEPS,
  LEGACY_MCP_SERVER,
  type McpTool,
} from '@/data/mockMcp';

type SpecKind = 'openapi' | 'fep';

/** 소스 종류별 파이프라인 구성 — 어느 쪽이든 같은 흐름을 탄다. */
const SPEC_CFG = {
  openapi: {
    label: 'OpenAPI Spec',
    hint: '붙여넣기 · 3.0 / 3.1 지원',
    placeholder: 'openapi: 3.0.3\ninfo:\n  title: ...\npaths:\n  /...:',
    sample: OPENAPI_SAMPLE,
    tools: PARSED_TOOLS,
    steps: CONVERT_STEPS,
    server: MCP_SERVER,
  },
  fep: {
    label: '금융 전문 (FEP)',
    hint: '고정길이 전문 정의서 · ISO8583 · EAI · TCP/Socket',
    placeholder: '# FEP 전문 정의서\n[공통부] ...\n[개별부] TR_CODE=...',
    sample: LEGACY_SAMPLE,
    tools: LEGACY_TOOLS,
    steps: LEGACY_CONVERT_STEPS,
    server: LEGACY_MCP_SERVER,
  },
} as const;

/** 셸 밖(프로젝트 경로)에서 단독으로 열릴 때의 컨테이너. */
const WORK_STANDALONE_CLS = 'max-w-[1600px] mx-auto px-8 pt-3.5 pb-10';
/** AI Studio · 지식 데이터 셸 안에서 열릴 때의 컨테이너. */
const WORK_SHELL_CLS = 'w-full pb-10';

export default function McpRegisterPage() {
  const { projectId } = useParams();
  const pid = projectId ?? 'PRJ-2025-PB-001';
  const crumbItems = useWorkCrumb('Tool · MCP', pid);
  const containerCls = useWorkContainer(WORK_STANDALONE_CLS, WORK_SHELL_CLS);

  const [specKind, setSpecKind] = useState<SpecKind>('openapi');
  const cfg = SPEC_CFG[specKind];

  const [spec, setSpec] = useState('');
  const [stepIdx, setStepIdx] = useState(-1);
  const done = stepIdx >= cfg.steps.length;

  /** 실행 시뮬레이션 대상 도구 — 열려 있으면 실행 통제 모달 표시. */
  const [execTool, setExecTool] = useState<McpTool | null>(null);

  useEffect(() => {
    if (stepIdx < 0 || stepIdx >= cfg.steps.length) return;
    const t = setTimeout(() => setStepIdx((i) => i + 1), cfg.steps[stepIdx].ms);
    return () => clearTimeout(t);
  }, [stepIdx, cfg]);

  const convert = () => setStepIdx(0);
  const reset = () => {
    setSpec('');
    setStepIdx(-1);
  };
  const pickKind = (k: SpecKind) => {
    setSpecKind(k);
    setSpec('');
    setStepIdx(-1);
  };

  const readyCount = cfg.tools.filter((t) => t.status === 'ready').length;
  const approvalCount = cfg.tools.length - readyCount;

  return (
    <div className={containerCls}>
      <Crumb items={crumbItems} />

      <div className="flex items-start gap-3 mt-2 mb-3.5">
        <div className="min-w-0 flex-1">
          <h1 className="text-[20px] font-extrabold tracking-[-0.4px]">MCP Tool 자동 등록</h1>
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            <span className="pill bg-surface text-ink-mid border border-line-soft">
              OpenAPI · 레거시 전문 → MCP Tool 변환
            </span>
            <span className="pill bg-info-bg text-info border border-info-border">🏢 공동존 On-Prem</span>
            <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip">
              AGB-004 · EDA-004
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 pt-1">
          <button
            onClick={reset}
            className="inline-flex items-center h-8 px-3 rounded border border-line bg-white text-[12px] font-bold text-ink-dark hover:bg-surface"
          >
            ↺ 초기화
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-3.5">
        {/* ── 좌: 스펙 입력 ── */}
        <section className="card flex flex-col">
          <div className="px-4 py-2.5 border-b border-line-soft flex items-center gap-2">
            {/* 입력 소스 토글 — OpenAPI(AGB-004) / 레거시 전문(EDA-004) */}
            {(Object.keys(SPEC_CFG) as SpecKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => pickKind(k)}
                className={cn(
                  'px-2.5 py-1 rounded text-[11.5px] font-extrabold border',
                  specKind === k
                    ? 'bg-brand text-white border-brand-dark'
                    : 'bg-white text-ink-mid border-line hover:border-brand-dark',
                )}
              >{SPEC_CFG[k].label}</button>
            ))}
            <span className="text-[10.5px] text-ink-mid font-semibold">{cfg.hint}</span>
            <button
              onClick={() => setSpec(cfg.sample)}
              className="ml-auto pill bg-white text-ink-dark border border-line hover:border-brand hover:text-brand"
            >
              샘플 붙여넣기
            </button>
          </div>
          <textarea
            value={spec}
            onChange={(e) => setSpec(e.target.value)}
            spellCheck={false}
            placeholder={cfg.placeholder}
            className="flex-1 min-h-[420px] resize-none px-4 py-3 font-mono text-[11.5px] leading-[1.6] text-ink-dark bg-white outline-none placeholder:text-ink-light"
          />
          <div className="px-4 py-3 border-t border-line-soft flex items-center gap-2">
            <span className="text-[10.5px] text-ink-mid font-semibold">
              {spec ? `${spec.split('\n').length}줄 · ${(spec.length / 1024).toFixed(1)} KiB` : '스펙이 비어 있습니다'}
            </span>
            <button
              onClick={convert}
              disabled={!spec.trim() || (stepIdx >= 0 && !done)}
              className="ml-auto inline-flex items-center h-8 px-4 rounded bg-brand border border-brand-dark text-white text-[12px] font-extrabold hover:bg-brand-dark disabled:opacity-45"
            >
              {stepIdx >= 0 && !done ? '변환 중…' : '→ MCP Tool 로 변환'}
            </button>
          </div>
        </section>

        {/* ── 우: 변환 결과 ── */}
        <section className="card flex flex-col min-h-[520px]">
          <div className="px-4 py-2.5 border-b border-line-soft flex items-center gap-2">
            <h2 className="text-[13px] font-extrabold text-ink">변환 결과</h2>
            {done && (
              <>
                <span className="pill bg-ok-bg text-ok border border-ok-border">
                  즉시 사용 {readyCount}
                </span>
                <span className="pill bg-warn-bg text-warn border border-warn-border">
                  결재 대기 {approvalCount}
                </span>
              </>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3">
            {stepIdx < 0 ? (
              <div className="text-[11.5px] text-ink-mid font-semibold leading-relaxed">
                좌측에 OpenAPI 스펙을 붙여넣고 <b className="text-ink-dark">변환</b>을 누르면
                operation 이 MCP 도구로 바뀝니다. 입력 스키마·인증·감사 결합까지 자동으로 구성됩니다.
              </div>
            ) : (
              <>
                {/* 변환 단계 */}
                <ol className="space-y-1.5 mb-3">
                  {cfg.steps.slice(0, stepIdx + 1).map((s, i) => (
                    <li key={s.label} className="og-step flex items-start gap-2">
                      <span
                        className={cn(
                          'w-[17px] h-[17px] rounded-full inline-flex items-center justify-center text-[9.5px] font-extrabold flex-shrink-0 mt-[1px]',
                          i < stepIdx ? 'bg-ok text-white' : 'bg-brand-dark text-white',
                        )}
                      >
                        {i < stepIdx ? '✓' : i + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[11.5px] font-extrabold text-ink-dark">{s.label}</span>
                        <span className="block text-[10.5px] text-ink-mid font-semibold leading-snug">
                          {s.detail}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>

                {done && (
                  <div className="og-answer">
                    {/* MCP 서버 */}
                    <div className="border border-line-soft rounded px-3.5 py-2.5 bg-surface-soft mb-3">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-[12.5px] font-extrabold text-ink">{cfg.server.name}</span>
                        <span className="pill bg-ok-bg text-ok border border-ok-border">등록 완료</span>
                      </div>
                      <dl className="grid grid-cols-[70px_1fr] gap-x-2.5 gap-y-1">
                        <Kv k="Namespace" v={cfg.server.namespace} mono />
                        <Kv k="엔드포인트" v={cfg.server.endpoint} mono />
                        <Kv k="전송" v={cfg.server.transport} />
                        <Kv k="인증" v={cfg.server.auth} />
                      </dl>
                    </div>

                    {/* 도구 목록 */}
                    <div className="text-[10.5px] font-extrabold text-ink-dark uppercase tracking-[0.4px] mb-1.5">
                      변환된 도구 {cfg.tools.length}건
                    </div>
                    <div className="space-y-2">
                      {cfg.tools.map((t) => (
                        <ToolCard key={t.name} tool={t} onExec={() => setExecTool(t)} />
                      ))}
                    </div>

                    {/* 자동화하지 않는 것 */}
                    <div className="mt-3 border border-warn-border bg-warn-bg rounded px-3.5 py-2.5">
                      <div className="text-[10.5px] font-extrabold text-warn uppercase tracking-[0.4px] mb-1">
                        자동으로 처리하지 않는 것
                      </div>
                      <ul className="space-y-1">
                        {NOT_AUTOMATED.map((n) => (
                          <li key={n} className="flex items-start gap-1.5">
                            <span className="text-ink-mid text-[11px] leading-[1.5]">·</span>
                            <span className="text-[11px] font-semibold text-ink-dark leading-snug">{n}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <Link
                      to={`/projects/${pid}/tasks/workflow`}
                      className="mt-3 w-full inline-flex items-center justify-center h-8 rounded border border-line text-[11.5px] font-extrabold text-ink-dark hover:border-brand hover:text-brand"
                    >
                      워크플로우 빌더에서 사용하기 →
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>

      {/* ── 기존 MCP 서버 ── */}
      <section className="card px-5 py-4 mt-3.5">
        <div className="flex items-center gap-2 mb-2.5">
          <h2 className="text-[13px] font-extrabold text-ink">등록된 MCP 서버</h2>
          <span className="text-[11px] text-ink-mid font-semibold">
            Namespace 안에서만 노출된다 · 그룹 공통 서버는 카탈로그 등재를 거쳐 공유한다
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2.5">
          {REGISTERED_SERVERS.map((s) => (
            <div key={s.name} className="border border-line-soft rounded px-3 py-2.5">
              <div className="text-[12px] font-extrabold text-ink truncate">{s.name}</div>
              <div className="text-[10px] font-mono text-ink-light mt-0.5">{s.ns}</div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="pill bg-ok-bg text-ok border border-ok-border">{s.status}</span>
                <span className="text-[10.5px] text-ink-mid font-bold">도구 {s.tools}</span>
              </div>
            </div>
          ))}
          <div
            className={cn(
              'border rounded px-3 py-2.5',
              done ? 'border-brand bg-brand-bg' : 'border-dashed border-line',
            )}
          >
            <div className={cn('text-[12px] font-extrabold truncate', done ? 'text-brand' : 'text-ink-light')}>
              {done ? cfg.server.name : '변환 시 여기에 추가됩니다'}
            </div>
            {done && (
              <>
                <div className="text-[10px] font-mono text-ink-light mt-0.5">{cfg.server.namespace}</div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="pill bg-brand-tint text-brand border border-brand-tint">신규</span>
                  <span className="text-[10.5px] text-ink-mid font-bold">도구 {cfg.tools.length}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="mt-3.5">
        <Link
          to={`/projects/${pid}`}
          className="inline-flex items-center h-8 px-3 border border-line rounded text-[12px] font-extrabold text-ink-dark hover:border-brand hover:text-brand"
        >
          ← 과제 목록으로
        </Link>
      </div>

      {execTool && <ExecControlModal tool={execTool} onClose={() => setExecTool(null)} />}
    </div>
  );
}

/**
 * 실행 통제 모달 — RFP 2-1 포탈 공통:
 * "Agent의 시스템·MCP·각종 Tool 호출 시 사용자 권한 및 허용범위에 따른 실행 통제".
 *
 * 등록과 실행은 다른 관문이다 — 조회 도구는 권한 통과를, 쓰기 도구는 호출 시점
 * PDP 차단을 그대로 보여준다. 차단된 시도도 통합 감사 원장에 남는다(SEC-009).
 */
function ExecControlModal({ tool, onClose }: { tool: McpTool; onClose: () => void }) {
  const persona = useCurrentPersona();
  const roleLabel = persona ? `${persona.name} (${persona.role})` : '현재 사용자';
  const blocked = tool.mutating;

  const CHECKS: { k: string; ok: boolean; v: string }[] = blocked
    ? [
        { k: '도구 활성화 상태', ok: false, v: '쓰기 도구 — 승인권자 결재 미완료 (비활성)' },
        { k: '사용자 허용범위', ok: false, v: '쓰기 호출은 결재 완료 후 허용 대상자에게만 열린다' },
        { k: '감사 기록', ok: true, v: '차단된 시도로 통합 감사 원장에 적산 (SEC-009)' },
      ]
    : [
        { k: '도구 활성화 상태', ok: true, v: '조회 도구 — 즉시 사용 가능' },
        { k: '사용자 허용범위', ok: true, v: 'Namespace 내 조회 권한 보유' },
        { k: '감사 기록', ok: true, v: '호출 단위 감사 로그 적산' },
      ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6" onClick={onClose}>
      <div className="absolute inset-0 bg-ink/25" aria-hidden />
      <div
        className="relative w-full max-w-[460px] bg-white border border-line rounded-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-4 pb-3 border-b border-line-soft flex items-start gap-2">
          <span className="text-[16px]">{blocked ? '🔒' : '▶'}</span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[14px] font-extrabold text-ink">
              실행 시뮬레이션 · <span className="font-mono">{tool.name}</span>
            </h2>
            <div className="text-[10.5px] text-ink-mid font-semibold mt-0.5">
              호출 주체 {roleLabel} · 실행 시점에 PDP 가 다시 판정한다
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[15px] font-black text-ink-light hover:text-ink-dark leading-none"
          >✕</button>
        </div>
        <div className="px-5 py-4">
          <div
            className={cn(
              'rounded px-3.5 py-2.5 border mb-3',
              blocked ? 'bg-bad-bg border-bad-border' : 'bg-ok-bg border-ok-border',
            )}
          >
            <div className={cn('text-[12.5px] font-extrabold', blocked ? 'text-bad' : 'text-ok')}>
              {blocked ? '실행 차단 — 쓰기 도구는 결재 없이 호출할 수 없습니다' : '실행 허용 — 조회 3행 반환 (모의)'}
            </div>
          </div>
          <ul className="space-y-2">
            {CHECKS.map((c) => (
              <li key={c.k} className="flex items-start gap-2">
                <span
                  className={cn(
                    'w-[16px] h-[16px] rounded-full inline-flex items-center justify-center text-[9px] font-extrabold flex-shrink-0 mt-[1px]',
                    c.ok ? 'bg-ok text-white' : 'bg-bad text-white',
                  )}
                >{c.ok ? '✓' : '✕'}</span>
                <span className="min-w-0">
                  <span className="block text-[11.5px] font-extrabold text-ink-dark">{c.k}</span>
                  <span className="block text-[11px] text-ink-mid font-semibold leading-snug">{c.v}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="px-5 py-3 border-t border-line-soft flex items-center gap-2">
          {blocked && (
            <button
              type="button"
              onClick={() => { toast('승인권자 결재를 상신했습니다 — 승인 후 도구가 활성화됩니다'); onClose(); }}
              className="h-8 px-3 border border-line rounded text-[11.5px] font-extrabold text-ink-dark hover:border-brand hover:text-brand"
            >결재 상신</button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto h-8 px-3.5 bg-brand border border-brand-dark rounded text-[12px] font-extrabold text-white hover:bg-brand-dark"
          >확인</button>
        </div>
      </div>
    </div>
  );
}

function ToolCard({ tool, onExec }: { tool: McpTool; onExec: () => void }) {
  const ready = tool.status === 'ready';
  return (
    <div className={cn('border rounded px-3.5 py-2.5', ready ? 'border-line-soft bg-white' : 'border-warn-border bg-warn-bg')}>
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className={cn(
            'pill border font-mono tracking-normal rfp-chip',
            tool.method === 'GET'
              ? 'bg-info-bg text-info border-info-border'
              : 'bg-brand-tint text-brand border-brand-tint',
          )}
        >
          {tool.method}
        </span>
        <span className="text-[12px] font-extrabold text-ink font-mono">{tool.name}</span>
        <span className="ml-auto pill border" >
          {ready ? (
            <span className="text-ok font-extrabold">즉시 사용 가능</span>
          ) : (
            <span className="text-warn font-extrabold">승인권자 결재 대기</span>
          )}
        </span>
      </div>
      <div className="text-[11px] text-ink-mid font-semibold mb-1.5">
        {tool.summary} · <span className="font-mono">{tool.path}</span>
      </div>
      <div className="border border-line-soft rounded overflow-hidden bg-white">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-surface-soft">
              {['파라미터', '타입', '위치', '필수', '설명'].map((h) => (
                <th
                  key={h}
                  className="text-left text-[9.5px] font-extrabold text-ink-mid uppercase tracking-[0.3px] px-2 py-1 border-b border-line-soft whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tool.params.map((p) => (
              <tr key={p.name} className="border-b border-line-soft last:border-b-0">
                <td className="px-2 py-1 text-[10.5px] font-mono font-bold text-ink-dark whitespace-nowrap">
                  {p.name}
                </td>
                <td className="px-2 py-1 text-[10.5px] font-mono text-accent-purple whitespace-nowrap">{p.type}</td>
                <td className="px-2 py-1 text-[10.5px] text-ink-mid font-semibold whitespace-nowrap">{p.where}</td>
                <td className="px-2 py-1 text-[10.5px] font-bold whitespace-nowrap">
                  {p.required ? <span className="text-bad">필수</span> : <span className="text-ink-light">선택</span>}
                </td>
                <td className="px-2 py-1 text-[10.5px] text-ink-mid font-semibold">{p.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {tool.mutating && (
        <div className="mt-1.5 text-[10.5px] text-warn font-bold leading-snug">
          쓰기 동작이라 자동 활성화하지 않는다 — 스펙만 보고 열어 주면 통제가 무너진다.
        </div>
      )}
      {/* 실행 통제 — 등록됐다고 실행이 열리는 게 아니다. 호출 시점 PDP 판정을 시뮬레이션한다. */}
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={onExec}
          className="h-[26px] px-2.5 border border-line bg-white rounded text-[11px] font-extrabold text-ink-dark hover:border-brand hover:text-brand"
        >▶ 실행 시뮬레이션</button>
      </div>
    </div>
  );
}

function Kv({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <>
      <dt className="text-[10px] font-bold text-ink-light uppercase tracking-[0.3px] pt-[1px]">{k}</dt>
      <dd className={cn('text-[11px] font-semibold text-ink-dark min-w-0 break-all', mono && 'font-mono')}>{v}</dd>
    </>
  );
}
