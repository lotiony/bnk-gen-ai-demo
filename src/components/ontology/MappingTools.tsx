/**
 * 데이터 매핑 하위 도구 — Auto-Map · Materialize · Diagnostics.
 *
 * 원본(kt Ontology Platform)의 Mapping 섹션을 옮겼다. 백엔드가 없으므로
 * 실행은 스크립트 재생이되, 결과 수치는 실제 매핑 데이터(ontologyMapping.ts)
 * 에서 계산해 화면과 어긋나지 않게 한다.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { MAPPING_ROWS, SOURCE_LABEL, SOURCE_TONE } from '@/data/ontologyMapping';
import { INSTANCES } from '@/data/ontologyInstances';
import { useOntology } from '@/lib/ontologyStore';

/* ═══════════════ Auto-Map ═══════════════ */

interface AutoRow {
  target: string;
  source: string;
  score: number;
  reason: string;
}

export function AutoMapPane() {
  const [phase, setPhase] = useState<'idle' | 'run' | 'done'>('idle');
  const [rows, setRows] = useState<AutoRow[]>([]);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  // 이미 자동 매핑된 행을 근거로 "방금 자동 매핑한 것처럼" 재생한다
  const candidates: AutoRow[] = MAPPING_ROWS.filter((r) => r.status === 'auto' && r.source)
    .slice(0, 14)
    .map((r) => ({
      target: r.target,
      source: r.source!,
      score: r.confidence ?? 1,
      reason:
        r.kind === '클래스'
          ? '테이블명 ↔ 클래스 라벨 임베딩 유사도'
          : r.kind === '관계'
            ? 'FK 제약 + 조인 카디널리티 분석'
            : '컬럼 코멘트 ↔ 속성 라벨 유사도',
    }));

  const run = useCallback(() => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    setRows([]);
    setPhase('run');
    candidates.forEach((c, i) => {
      const t = window.setTimeout(() => {
        setRows((r) => [...r, c]);
        if (i === candidates.length - 1) setPhase('done');
      }, 260 * (i + 1));
      timers.current.push(t);
    });
  }, [candidates]);

  return (
    <div className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1">
          <div className="text-[13px] font-extrabold text-ink">자동 매핑</div>
          <div className="text-[11px] text-ink-mid font-semibold mt-0.5">
            소스 스키마의 테이블·컬럼·FK 를 온톨로지 대상과 대조해 후보를 제안합니다. 신뢰도 0.9 미만은 수동 확인 대상입니다.
          </div>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={phase === 'run'}
          className="h-9 px-4 bg-brand text-white rounded text-[12px] font-extrabold hover:bg-brand-dark disabled:opacity-60"
        >
          {phase === 'run' ? '분석 중…' : '▶ 자동 매핑 실행'}
        </button>
      </div>

      {phase === 'idle' ? (
        <div className="border border-line-soft rounded py-16 text-center text-[11.5px] text-ink-mid font-semibold">
          실행하면 소스 스키마를 훑어 매핑 후보를 제안합니다
        </div>
      ) : (
        <div className="border border-line-soft rounded overflow-hidden">
          <table className="w-full text-[11.5px]">
            <thead className="bg-surface-soft">
              <tr className="text-ink-mid">
                <th className="text-left font-bold py-2 px-3">온톨로지 대상</th>
                <th className="text-left font-bold py-2 px-3 w-[280px]">제안 소스</th>
                <th className="text-left font-bold py-2 px-3 w-[240px]">근거</th>
                <th className="text-right font-bold py-2 px-3 w-[90px]">신뢰도</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-line-soft og-step">
                  <td className="py-1.5 px-3 font-extrabold text-ink">{r.target}</td>
                  <td className="py-1.5 px-3 font-mono text-[10.5px] text-ink-dark">{r.source}</td>
                  <td className="py-1.5 px-3 text-[10.5px] text-ink-mid font-semibold">{r.reason}</td>
                  <td className="py-1.5 px-3 text-right">
                    <span className={cn('pill border', r.score >= 0.95 ? 'bg-ok-bg text-ok border-ok-border' : 'bg-warn-bg text-warn border-warn-border')}>
                      {r.score.toFixed(2)}
                    </span>
                  </td>
                </tr>
              ))}
              {phase === 'run' && (
                <tr className="border-t border-line-soft">
                  <td colSpan={4} className="py-2 px-3">
                    <div className="og-skel h-[11px] w-1/2" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {phase === 'done' && (
            <div className="px-3 py-2 bg-surface-soft border-t border-line-soft text-[11px] font-bold text-ink-dark">
              {rows.length}건 제안 · 신뢰도 0.95 이상 {rows.filter((r) => r.score >= 0.95).length}건은 자동 확정, 나머지는 수동 확인 대상
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════ Materialize ═══════════════ */

export function MaterializePane() {
  const [phase, setPhase] = useState<'idle' | 'run' | 'done'>('idle');
  const [log, setLog] = useState<string[]>([]);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  const byClass = INSTANCES.reduce<Record<string, number>>((a, i) => ({ ...a, [i.cls]: (a[i.cls] ?? 0) + 1 }), {});
  const steps = [
    '소스 커넥션 확인 — DV 가상 뷰 8개 · 문서 인덱스 2개',
    '클래스 매핑 해석 — 22개 대상',
    ...Object.entries(byClass).map(([c, n]) => `실체화: ${c} → ${n}개 개체`),
    `관계 실체화 — 트리플 ${INSTANCES.length * 3}건 생성`,
    '무결성 검사 — 고아 트리플 0건',
    '완료 — A-Box 커밋',
  ];

  const run = useCallback(() => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    setLog([]);
    setPhase('run');
    steps.forEach((s, i) => {
      const t = window.setTimeout(() => {
        setLog((l) => [...l, s]);
        if (i === steps.length - 1) setPhase('done');
      }, 220 * (i + 1));
      timers.current.push(t);
    });
  }, [steps]);

  return (
    <div className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1">
          <div className="text-[13px] font-extrabold text-ink">실체화 (A-Box 생성)</div>
          <div className="text-[11px] text-ink-mid font-semibold mt-0.5">
            매핑된 소스에서 개체를 만들어 그래프에 적재합니다. 정형은 가상 뷰를 조회할 뿐 복제하지 않습니다(EDA-001).
          </div>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={phase === 'run'}
          className="h-9 px-4 bg-brand text-white rounded text-[12px] font-extrabold hover:bg-brand-dark disabled:opacity-60"
        >
          {phase === 'run' ? '실행 중…' : '▶ 실체화 실행'}
        </button>
      </div>

      <div className="border border-line-soft rounded bg-[#1E1E1E] p-3 h-[380px] overflow-y-auto font-mono text-[11px] leading-relaxed">
        {log.length === 0 && <div className="text-[#6A737D]">$ 실행 대기</div>}
        {log.map((l, i) => (
          <div key={i} className="og-step text-[#D4D4D4]">
            <span className="text-[#6A9955]">[{String(i + 1).padStart(2, '0')}]</span> {l}
          </div>
        ))}
        {phase === 'run' && <div className="text-[#DCDCAA]">▌</div>}
        {phase === 'done' && (
          <div className="mt-2 text-[#4EC9B0] font-bold">✓ 개체 {INSTANCES.length}건 · 트리플 {INSTANCES.length * 3}건 커밋 완료</div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════ Diagnostics ═══════════════ */

interface Finding {
  level: 'error' | 'warn' | 'info';
  title: string;
  detail: string;
  target: string;
}

export function DiagnosticsPane() {
  const { classes, relations } = useOntology();

  const findings: Finding[] = [];

  // 미매핑
  for (const r of MAPPING_ROWS.filter((x) => x.status === 'none')) {
    findings.push({ level: 'warn', title: '미매핑', detail: '소스가 지정되지 않아 실체화되지 않습니다', target: r.target });
  }
  // 고아 클래스 — 관계가 하나도 없는 클래스
  for (const c of classes) {
    if (!relations.some((r) => r.domain === c.name || r.range === c.name)) {
      findings.push({ level: 'error', title: '고아 클래스', detail: '연결된 관계가 없어 순회로 도달할 수 없습니다', target: c.name });
    }
  }
  // 속성 없는 클래스
  for (const c of classes) {
    if (!c.attrs.length) findings.push({ level: 'warn', title: '속성 없음', detail: '데이터 속성이 없어 값 조회가 불가합니다', target: c.name });
  }
  // 중복 관계 (같은 도메인·레인지·이름)
  const seen = new Set<string>();
  for (const r of relations) {
    const k = `${r.name}|${r.domain}|${r.range}`;
    if (seen.has(k)) findings.push({ level: 'error', title: '중복 관계', detail: '동일 이름·도메인·레인지 관계가 중복 정의되었습니다', target: `${r.domain} —${r.name}→ ${r.range}` });
    seen.add(k);
  }
  // 개체 없는 클래스
  for (const c of classes) {
    if (!INSTANCES.some((i) => i.cls === c.name)) {
      findings.push({ level: 'info', title: '개체 없음', detail: 'T-Box 만 있고 실체화된 개체가 없습니다', target: c.name });
    }
  }

  const tone = {
    error: 'bg-bad-bg text-bad border-bad-border',
    warn: 'bg-warn-bg text-warn border-warn-border',
    info: 'bg-info-bg text-info border-info-border',
  };
  const count = (l: Finding['level']) => findings.filter((f) => f.level === l).length;

  return (
    <div className="p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1">
          <div className="text-[13px] font-extrabold text-ink">진단</div>
          <div className="text-[11px] text-ink-mid font-semibold mt-0.5">
            매핑·구조 문제를 검출합니다. 오류는 순회가 끊기는 지점, 경고는 답변 품질이 떨어지는 지점입니다.
          </div>
        </div>
        {(['error', 'warn', 'info'] as const).map((l) => (
          <div key={l} className="text-center px-3">
            <div className={cn('text-[20px] font-extrabold tabular-nums', l === 'error' ? 'text-bad' : l === 'warn' ? 'text-warn' : 'text-info')}>{count(l)}</div>
            <div className="text-[10px] text-ink-mid font-bold">{l === 'error' ? '오류' : l === 'warn' ? '경고' : '정보'}</div>
          </div>
        ))}
      </div>

      <div className="border border-line-soft rounded overflow-hidden">
        <div className="max-h-[420px] overflow-y-auto">
          <table className="w-full text-[11.5px]">
            <thead className="bg-surface-soft sticky top-0">
              <tr className="text-ink-mid">
                <th className="text-left font-bold py-2 px-3 w-[80px]">수준</th>
                <th className="text-left font-bold py-2 px-3 w-[110px]">유형</th>
                <th className="text-left font-bold py-2 px-3">대상</th>
                <th className="text-left font-bold py-2 px-3 w-[320px]">설명</th>
              </tr>
            </thead>
            <tbody>
              {findings.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-[11.5px] text-ok font-bold">
                    ✓ 검출된 문제가 없습니다
                  </td>
                </tr>
              )}
              {findings.map((f, i) => (
                <tr key={i} className="border-t border-line-soft">
                  <td className="py-1.5 px-3">
                    <span className={cn('pill border', tone[f.level])}>{f.level === 'error' ? '오류' : f.level === 'warn' ? '경고' : '정보'}</span>
                  </td>
                  <td className="py-1.5 px-3 font-extrabold text-ink">{f.title}</td>
                  <td className="py-1.5 px-3 text-ink-dark font-semibold">{f.target}</td>
                  <td className="py-1.5 px-3 text-[10.5px] text-ink-mid font-semibold">{f.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-2 text-[10.5px] text-ink-mid font-semibold">
        매핑 상태 분포 —{' '}
        {(['auto', 'manual', 'document', 'none'] as const).map((s) => (
          <span key={s} className={cn('pill border mr-1', SOURCE_TONE[s])}>
            {SOURCE_LABEL[s]} {MAPPING_ROWS.filter((r) => r.status === s).length}
          </span>
        ))}
      </p>
    </div>
  );
}
