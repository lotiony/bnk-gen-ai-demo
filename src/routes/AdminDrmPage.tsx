/**
 * 관리 콘솔 — 계열사 DRM 연동.
 *
 * RFP: SEC-005 계열사별 DRM 자동 암·복호화 연동 (필수)
 * 연계: SEC-004(민감정보 유입 차단) · RAG-003(파서) · 2-1 반입 승인
 *
 * 요건의 무게중심은 "복호화가 된다" 가 아니라 **"계열사마다 제품이 다른데도
 * 자동으로 알아본다"** 이다. 그래서 매핑표에 제품·연동방식·판별 근거를 나란히 두고,
 * 아래 로그에서 실제로 판별이 일어난 흔적을 보여 준다.
 */
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import KpiCard from '@/components/ui/KpiCard';
import StatusPill from '@/components/ui/StatusPill';
import {
  DRM_BINDINGS,
  DRM_FLOW_LOGS,
  DRM_STATUS_TONE,
  DRM_RESULT_TONE,
  DRM_COST_NOTE,
} from '@/data/mockDrm';

export default function AdminDrmPage() {
  const stats = useMemo(() => {
    const done = DRM_BINDINGS.filter((b) => b.status === '연동 완료').length;
    const progress = DRM_BINDINGS.filter((b) => b.status === '연동 진행').length;
    const none = DRM_BINDINGS.filter((b) => b.status === '미연동').length;
    const products = new Set(
      DRM_BINDINGS.filter((b) => b.product !== '미적용').map((b) => b.product),
    );
    const dec = DRM_BINDINGS.reduce((a, b) => a + b.decrypted30d, 0);
    const fail = DRM_BINDINGS.reduce((a, b) => a + b.failed30d, 0);
    return { done, progress, none, products: products.size, dec, fail };
  }, []);

  return (
    <div>
      <div className="flex items-start gap-3 mb-3.5">
        <div className="min-w-0 flex-1">
          <h1 className="text-[19px] font-extrabold text-ink tracking-[-0.4px]">계열사 DRM 연동</h1>
          <p className="text-[11.5px] text-ink-mid font-semibold mt-1">
            계열사마다 다른 문서보안 솔루션을 자동 인지해 실시간 복호화·재암호화한다
          </p>
        </div>
        <span className="pill bg-white text-ink-mid border border-line font-mono tracking-normal rfp-chip flex-shrink-0 mt-1">
          SEC-005
        </span>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-4 gap-2.5 mb-3.5">
        <KpiCard
          label="연동 완료 계열사"
          value={String(stats.done)}
          unit={`/ ${DRM_BINDINGS.length}`}
          sub={`진행 ${stats.progress} · 미도입 ${stats.none}`}
          tone="ok"
        />
        <KpiCard
          label="대응 DRM 제품"
          value={String(stats.products)}
          unit="종"
          sub="제품별 어댑터 모듈 분리"
          tone="ok"
        />
        <KpiCard
          label="30일 복호화"
          value={stats.dec.toLocaleString('ko-KR')}
          unit="건"
          sub="프롬프트 첨부 + 파이프라인 수집"
          tone="ok"
        />
        <KpiCard
          label="30일 복호화 실패"
          value={String(stats.fail)}
          unit="건"
          sub="실패 건은 유입 차단 + 사유 안내"
          tone={stats.fail > 0 ? 'warn' : 'ok'}
        />
      </div>

      {/* 매핑표 */}
      <section className="card p-4 mb-3.5">
        <div className="flex items-baseline gap-2 mb-1">
          <h2 className="text-[14px] font-extrabold text-ink">계열사 ↔ DRM 제품 매핑</h2>
          <span className="text-[11px] text-ink-mid font-semibold">
            제품이 같으면 어댑터 모듈을 재사용한다
          </span>
        </div>
        <p className="text-[10.5px] text-ink-mid font-semibold mb-2.5 leading-snug">
          제품명은 가상 표기다 — 실제 제품 확정은 요구사항 분석 단계에서 계열사별로 확인한다.
        </p>
        <table className="w-full text-[11.5px]">
          <thead>
            <tr className="text-left text-[9.5px] text-ink-light font-extrabold uppercase tracking-[0.3px] border-b border-line-soft">
              <th className="py-1.5 pr-3 font-extrabold">계열사</th>
              <th className="py-1.5 pr-3 font-extrabold">DRM 제품</th>
              <th className="py-1.5 pr-3 font-extrabold">연동</th>
              <th className="py-1.5 pr-3 font-extrabold">자동 판별 근거</th>
              <th className="py-1.5 pr-3 font-extrabold">지원 포맷</th>
              <th className="py-1.5 pr-3 font-extrabold text-right">30일 복호화</th>
              <th className="py-1.5 font-extrabold text-right">실패</th>
            </tr>
          </thead>
          <tbody>
            {DRM_BINDINGS.map((b) => (
              <tr key={b.tenant} className="border-b border-line-soft last:border-0 align-top">
                <td className="py-2 pr-3 font-extrabold text-ink whitespace-nowrap">{b.tenant}</td>
                <td className="py-2 pr-3">
                  <div className="font-bold text-ink-dark whitespace-nowrap">{b.product}</div>
                  {b.product !== '미적용' && (
                    <div className="text-[9.5px] text-ink-mid font-semibold mt-0.5">{b.iface}</div>
                  )}
                </td>
                <td className="py-2 pr-3">
                  <StatusPill tone={DRM_STATUS_TONE[b.status]}>{b.status}</StatusPill>
                  {b.note && (
                    <div className="text-[9.5px] text-ink-mid font-semibold mt-1 leading-snug max-w-[180px]">
                      {b.note}
                    </div>
                  )}
                </td>
                <td className="py-2 pr-3 text-[10.5px] text-ink-dark font-semibold leading-snug max-w-[220px]">
                  {b.detection}
                </td>
                <td className="py-2 pr-3 text-[10.5px] text-ink-mid font-semibold">{b.formats}</td>
                <td className="py-2 pr-3 text-right font-bold text-ink-dark tabular-nums">
                  {b.decrypted30d > 0 ? b.decrypted30d.toLocaleString('ko-KR') : '—'}
                </td>
                <td
                  className={cn(
                    'py-2 text-right font-extrabold tabular-nums',
                    b.failed30d > 0 ? 'text-warn' : 'text-ink-light',
                  )}
                >
                  {b.failed30d > 0 ? b.failed30d : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 자동 판별 로그 */}
      <section className="card p-4 mb-3.5">
        <div className="flex items-baseline gap-2 mb-1">
          <h2 className="text-[14px] font-extrabold text-ink">자동 판별 · 처리 로그</h2>
          <span className="text-[11px] text-ink-mid font-semibold">
            사용자는 어느 DRM 문서인지 알려 주지 않는다 — 헤더·서명에서 판별한다
          </span>
        </div>
        <div className="flex flex-col gap-1.5 mt-2.5">
          {DRM_FLOW_LOGS.map((l, i) => (
            <div
              key={i}
              className={cn(
                'grid grid-cols-[128px_88px_1fr_180px_auto] gap-3 items-start px-3 py-2 rounded border',
                l.result === '복호화 실패'
                  ? 'border-bad-border bg-bad-bg'
                  : 'border-line-soft bg-white',
              )}
            >
              <span className="text-[10px] font-mono font-semibold text-ink-mid tabular-nums">
                {l.at}
              </span>
              <span className="text-[10.5px] font-extrabold text-ink-dark">{l.tenant}</span>
              <div className="min-w-0">
                <div className="text-[11.5px] font-extrabold text-ink truncate">{l.fileName}</div>
                <div className="text-[10.5px] text-ink-mid font-semibold mt-0.5 leading-snug">
                  {l.detail}
                </div>
              </div>
              <span className="text-[10.5px] text-ink-dark font-semibold leading-snug">
                {l.detected}
                <br />
                <span className="text-ink-mid">{l.channel}</span>
              </span>
              <StatusPill tone={DRM_RESULT_TONE[l.result]}>{l.result}</StatusPill>
            </div>
          ))}
        </div>
      </section>

      {/* 처리 순서 */}
      <section className="card p-4">
        <h2 className="text-[14px] font-extrabold text-ink mb-2.5">처리 순서</h2>
        <div className="grid grid-cols-5 gap-2">
          {[
            { n: 1, t: '자동 판별', d: '헤더 매직넘버 · 확장자 · 벤더 서명으로 DRM 제품 인지' },
            { n: 2, t: '복호화', d: '해당 제품 어댑터(API/SDK)로 실시간 복호화' },
            { n: 3, t: '민감정보 스캔', d: '평문 상태에서 PII·기밀 탐지 및 마스킹(SEC-004)' },
            { n: 4, t: '파싱 · 인덱싱', d: 'HWP·PDF 파서 → 청킹 → 임베딩(RAG-003)' },
            { n: 5, t: '재암호화 저장', d: '원본은 플랫폼 키로 재암호화해 적재 — 평문 미보존' },
          ].map((s) => (
            <div key={s.n} className="border-l-2 border-line pl-3">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="w-[16px] h-[16px] rounded-full bg-surface border border-line text-ink-mid inline-flex items-center justify-center text-[9px] font-extrabold">
                  {s.n}
                </span>
                <span className="text-[11.5px] font-extrabold text-ink-dark">{s.t}</span>
              </div>
              <p className="text-[10.5px] text-ink-mid font-semibold leading-snug">{s.d}</p>
            </div>
          ))}
        </div>
        <p className="text-[10.5px] text-ink-mid font-semibold mt-3 pt-2.5 border-t border-line-soft leading-snug">
          💰 {DRM_COST_NOTE}
        </p>
      </section>
    </div>
  );
}
