import { methodStyle } from "../../i18n";
import {
  Breathe, CTA, Dot, EmptyState, Equalizer, GhostLine, PanelHead, RailBlock, SkelRows, Spinner, Sq, Vacant,
  METHOD_COLOR, REDUCED, STATE_COLOR, deriveState, fmtTime, sx,
} from "./bits";

/* 대시보드 패널 모음 — 데이터는 Dashboard.jsx가 내려준다.
   empty 3계층: ① 구조 데이터 폴백 ② 연출형 EmptyState ③ 스켈레톤(booted 전) */

/* 행 클릭을 키보드로도 — tr/div onClick 접근성 보강 */
const rowA11y = (onClick) => ({
  onClick, role: "button", tabIndex: 0,
  onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } },
});

/* ── 툴 구성(구조 데이터) — 좌측 컬럼 레일 블록: 메서드 분포 · 소스 구성 · 안전성 도넛.
   각각 독립 컴포넌트라 Dashboard가 행 배치 순서대로 조립한다
   (자산 라이프사이클 리본은 NeuralCore가 동일 기능으로 대체) ── */
/* 구성 블록 공통 빈 상태 — 자산이 없을 때 온보딩 유도 */
const compEmpty = (c, go, booted) => booted
  ? <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Vacant label={c.emptyComp} /><CTA onClick={() => go("onboarding")}>{c.ctaOnb}</CTA></div>
  : <SkelRows n={2} />;

export function MethodMix({ c, byMethod, go, booted }) {
  const methods = Object.entries(byMethod).sort((a, b) => b[1] - a[1]);
  const mMax = Math.max(1, ...methods.map(([, v]) => v));
  return (
    <RailBlock title={c.byMethod} sub={c.subByMethod}>
      {methods.length === 0 && compEmpty(c, go, booted)}
      {methods.map(([m, v]) => (
        <div key={m} style={sx.compBar}>
          <span className="mono" style={{ ...sx.compTag, color: METHOD_COLOR[m] || "var(--muted)" }}>{m}</span>
          <span style={sx.tbarTrack}><u style={{ ...sx.tbarFill, width: `${Math.round((v / mMax) * 100)}%`, background: METHOD_COLOR[m] || "var(--blue)" }} /></span>
          <b className="mono" style={sx.compCt}>{v}</b>
        </div>
      ))}
    </RailBlock>
  );
}

export function SourceMix({ c, sources, go, booted }) {
  const srcMax = Math.max(1, ...sources.map((s) => s.count));
  return (
    <RailBlock title={c.bySource} sub={c.subBySource}>
      {sources.length === 0 && compEmpty(c, go, booted)}
      {sources.map((s, i) => (
        <div key={s.type} style={sx.compBar}>
          <span className="mono" style={{ ...sx.compTag, color: "var(--text)" }}>{s.type}</span>
          <span style={sx.tbarTrack}><u style={{ ...sx.tbarFill, width: `${Math.round((s.count / srcMax) * 100)}%`, background: `var(${["--blue", "--purple", "--amber", "--green", "--red"][i % 5]})` }} /></span>
          <b className="mono" style={sx.compCt}>{s.count}</b>
        </div>
      ))}
    </RailBlock>
  );
}

export function SafetyMix({ c, mutating, toolCount }) {
  const safe = Math.max(0, toolCount - mutating);
  const mutPct = toolCount ? Math.round((100 * mutating) / toolCount) : 0;
  return (
    <RailBlock title={c.safety} sub={c.subSafety}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {/* 도넛 게이지 — 초록 링(조회형) 위에 앰버 호(변경형 비율) */}
        {(() => {
          const R = 20, CIRC = 2 * Math.PI * R;
          return (
            <svg width="54" height="54" viewBox="0 0 54 54" style={{ flexShrink: 0 }}>
              <circle cx="27" cy="27" r={R} fill="none" strokeWidth="7"
                stroke={toolCount ? "var(--green)" : "var(--line2)"} opacity={toolCount ? .9 : 1} />
              {mutPct > 0 && (
                <circle cx="27" cy="27" r={R} fill="none" stroke="var(--amber)" strokeWidth="7"
                  strokeDasharray={`${(CIRC * mutPct) / 100} ${CIRC}`} strokeLinecap="round" transform="rotate(-90 27 27)" />
              )}
              <text x="27" y="31" textAnchor="middle" fill={mutating > 0 ? "var(--amber)" : "var(--green)"}
                style={{ font: "700 11px var(--disp)" }}>{mutPct}%</text>
            </svg>
          );
        })()}
        <div className="mono" style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 10.5 }}>
          <span style={{ color: "var(--amber)" }}><Sq color="var(--amber)" />{c.mutating} <b>{mutating}</b></span>
          <span style={{ color: "var(--green)" }}><Sq color="var(--green)" />{c.safe} <b>{safe}</b></span>
        </div>
      </div>
    </RailBlock>
  );
}

/* ── 첫 진입 유도 — 데이터가 아무것도 없을 때의 3단계 체크리스트 ── */
function StarterChecklist({ c, go }) {
  const steps = [
    { title: c.start1, sub: c.start1Sub, cta: true },
    { title: c.start2, sub: c.start2Sub },
    { title: c.start3, sub: c.start3Sub },
  ];
  return (
    <div style={{ padding: "10px 4px 2px" }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: "var(--navy)", marginBottom: 10 }}>{c.startTitle}</div>
      {steps.map((s, i) => {
        const cur = i === 0;
        return (
          <div key={s.title} style={{ display: "flex", alignItems: "center", gap: 11, padding: "8px 0", borderBottom: i < 2 ? "1px solid var(--line)" : "none" }}>
            <span style={{
              width: 22, height: 22, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700,
              color: cur ? "#fff" : "var(--faint)", background: cur ? "var(--blue)" : "var(--main)",
              border: cur ? "none" : "1px solid var(--line2)",
              animation: cur && !REDUCED ? "pulseRing 2.2s ease-out infinite" : "none",
            }}>{i + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: cur ? "var(--navy)" : "var(--faint)" }}>{s.title}</div>
              <div style={{ fontSize: 11, color: cur ? "var(--muted)" : "var(--faint)", marginTop: 1 }}>{s.sub}</div>
            </div>
            {s.cta && <CTA onClick={() => go("onboarding")}>{c.start1Cta}</CTA>}
          </div>
        );
      })}
    </div>
  );
}

/* ── 변환 현황(실행 중, SSE) — 좌측 컨텐츠 컬럼의 메인 카드. 이력은 RecentRuns(레일)로 분리 ── */
export function ConversionOps({ c, live, go, booted, hasProject, starter }) {
  return (
    <section className="hud-panel" style={sx.panelCol} id="dash-conv">
      <PanelHead title={`${c.convOps} · ${c.running}`} sub={c.subConvOps}
        right={live && <span style={{ ...sx.runBadge, marginLeft: "auto" }}>{live.kind === "smoke" ? "SMOKE" : "APPLY"} · {live.jobId?.slice(0, 6)}</span>} />
      <div className="hud-fill">
        {!live && !booted && <SkelRows n={3} />}
        {!live && booted && !hasProject && <div style={sx.empty}>{c.needProject}</div>}
        {!live && booted && hasProject && (starter
          ? <StarterChecklist c={c} go={go} />
          : <EmptyState visual={<Breathe />}
              title={<>{c.waitConvert}<span className="dash-tdots">{[".", ".", "."].map((d, i) => <i key={i} style={{ animationDelay: `${i * 0.2}s` }}>{d}</i>)}</span></>}
              hint={c.waitConvertHint} cta={c.ctaWizard} onCta={() => go("wizard")} />)}
        {live && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "12px 0" }}>
              <div className="mono" style={sx.convPct}>{live.pct}<em style={{ fontSize: 13, color: "var(--muted)", fontStyle: "normal" }}>%</em></div>
              <div style={sx.convBarWrap}><span style={{ ...sx.convBarFill, width: `${live.pct}%` }} /></div>
            </div>
            {(live.resources || []).map((r) => (
              <div key={r.name} style={sx.convRow}>
                <span style={sx.convName}>{r.name}</span>
                <span style={{ ...sx.chip, color: STATE_COLOR[r.state] || "var(--muted)" }}>
                  {r.state === "running" && <Spinner size={10} color="var(--blue)" />}
                  {String(r.state || "").toUpperCase()}
                </span>
                <span className="mono" style={sx.convCt}>{r.collected ? `${c.srcCollected} ${r.collected} · ` : ""}{r.count} {c.toolsUnit}</span>
              </div>
            ))}
            {live.log?.length > 0 && (
              <div className="mono" style={sx.logLine}>{"> "}{live.log[live.log.length - 1]?.msg}</div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

/* ── 최근 실행 — 티커 레일 블록 (ConversionOps에서 분리) ── */
export function RecentRuns({ c, history, booted, hasProject, className }) {
  return (
    <RailBlock title={c.recent} sub={c.subRecent} className={className}>
      {history.length === 0 && (booted
        ? <Vacant label={hasProject ? c.histHint : c.needProject} />
        : <SkelRows n={2} />)}
      {history.slice(0, 5).map((h, i) => {
        const tools = (h.resources || []).reduce((a, r) => a + (r.count || 0), 0);
        const ok = h.status === "done";
        return (
          <div key={h.job_id || i} style={sx.runRow}>
            <span className="mono" style={{ ...sx.runKind, color: h.kind === "smoke" ? "var(--purple)" : "var(--blue)" }}>{(h.kind || "").toUpperCase()}</span>
            <span className="mono" style={{ fontSize: 10.5, fontWeight: 700, color: ok ? "var(--green)" : "var(--red)" }}>{ok ? "DONE" : "FAILED"}</span>
            <span className="mono" style={{ fontSize: 11, color: "var(--text)", flex: 1 }}>{tools} {c.toolsUnit}</span>
            <span className="mono" style={{ fontSize: 10.5, color: "var(--faint)" }}>{fmtTime(h.ts)}</span>
          </div>
        );
      })}
    </RailBlock>
  );
}

/* ── ZONE 4 좌 — 헬스 이력 있으면 리소스 헬스, 없으면 서비스 인벤토리(구조) ── */
export function HealthMatrix({ c, rows, services, go, booted, hasProject }) {
  const useInventory = rows.length === 0 && services.length > 0;
  const svcMax = Math.max(1, ...services.map((s) => s.count));
  // 스캔라인 연출은 데이터가 채워지길 기다리는 모드(인벤토리/empty)에서만 — 실데이터 위 소음 제거
  const scan = !REDUCED && rows.length === 0;
  return (
    <section className="hud-panel" style={{ ...sx.panelCol, position: "relative", overflow: "hidden" }}>
      {scan && <span style={sx.scanline} />}
      <PanelHead title={useInventory ? c.inventory : c.matrix} sub={useInventory ? c.subInventory : c.subMatrix} />
      <div className="hud-fill">
      {rows.length === 0 && !useInventory && (booted
        ? (hasProject
          ? <EmptyState visual={<Breathe size={40} />} title={c.noData} hint={c.emptyMatrix} />
          : <div style={sx.empty}>{c.needProject}</div>)
        : <SkelRows n={4} />)}
      {useInventory && (
        <div style={{ overflowX: "auto" }}>
        <table className="mono" style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 11 }}>
          <thead><tr>{["SERVICE", "TOOLS", "SHARE"].map((h) => <th key={h} style={sx.mth}>{h}</th>)}</tr></thead>
          <tbody>
            {services.map((s) => (
              <tr key={s.name} {...rowA11y(() => go("explorer", { service: s.name }))} style={sx.mtr}>
                <td style={{ ...sx.mtd, color: "var(--navy)" }}>{s.name || c.noSvc}</td>
                <td style={sx.mtd}>{s.count}</td>
                <td style={{ ...sx.mtd, width: "45%" }}>
                  <span style={{ ...sx.tbarTrack, display: "inline-block", width: "100%", verticalAlign: "middle" }}>
                    <u style={{ ...sx.tbarFill, width: `${Math.round((s.count / svcMax) * 100)}%` }} />
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
      {rows.length > 0 && (
        <div style={{ overflowX: "auto" }}>
        <table className="mono" style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 11 }}>
          <thead><tr>{["RESOURCE", "CONVERT", "SMOKE", "STATE"].map((h) => <th key={h} style={sx.mth}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => {
              const st = deriveState(r), cl = r.classify || {}, sm = r.smoke || {};
              return (
                <tr key={r.name} {...rowA11y(() => go("health"))} style={sx.mtr}>
                  <td style={sx.mtd}>
                    <div style={{ color: "var(--navy)" }}>{r.name}</div>
                    <div style={{ fontSize: 10, color: "var(--faint)" }}>{[r.rtype, r.env].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td style={sx.mtd}>
                    {cl.success ? <><Sq color="var(--green)" />{cl.success} </> : null}
                    {cl.warning ? <><Sq color="var(--amber)" />{cl.warning} </> : null}
                    {cl.failed ? <><Sq color="var(--red)" />{cl.failed}</> : null}
                    {!cl.success && !cl.warning && !cl.failed ? <span style={sx.hatchCell} /> : null}
                  </td>
                  <td style={sx.mtd}>{sm.total ? `${sm.passed || 0}/${sm.total}` : <span style={sx.hatchCell} />}</td>
                  <td style={{ ...sx.mtd, color: STATE_COLOR[st], fontWeight: 700, animation: st === "broken" && !REDUCED ? "dashBlink 1.5s infinite" : "none" }}>{c[st]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}
      </div>
    </section>
  );
}

/* ── 실시간 호출 로그 — 운영 컬럼 스트림 ── */
export function LiveFeed({ c, entries, toolCount, go, booted }) {
  return (
    <RailBlock title={c.feed} sub={c.subFeed}
      right={<span style={sx.liveTag}><span style={{ ...sx.pulseDot, width: 8, height: 8, background: "var(--kt-red)", boxShadow: "0 0 8px var(--kt-red)" }} />LIVE</span>}>
      {entries.length === 0 && (booted
        ? <EmptyState visual={<Equalizer />}
            title={<><span className="mono" style={{ color: "var(--blue)", fontWeight: 700 }}>{toolCount}</span> {c.toolsReady} · {c.feedWait}</>}
            hint={c.feedHint} cta={c.ctaExplore} onCta={() => go("explorer")} />
        : <SkelRows n={4} />)}
      <div>
        {entries.slice(0, 12).map((e, i) => {
          const isErr = e.ok === false;
          const lat = e.latency_ms != null ? (isErr ? `ERR ${e.status || ""}` : `${e.latency_ms}ms`) : "";
          const latColor = isErr ? "var(--red)" : (e.latency_ms > 480 ? "var(--amber)" : "var(--muted)");
          const dotColor = e.ok === false ? "var(--red)" : (e.ok === true ? "var(--green)" : "var(--faint)");
          return (
            <div key={`${e.ts}-${i}`} className="mono" style={{ ...sx.feedRow, animation: i === 0 && !REDUCED ? "dashFeedIn .5s ease-out" : "none" }}>
              <Dot color={dotColor} />
              {e.method && <span style={{ ...methodStyle(e.method), transform: "scale(.9)", transformOrigin: "left" }}>{e.method}</span>}
              <span style={{ flex: 1, color: "var(--blue)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.tool_id}</span>
              <span style={{ color: "var(--faint)", fontSize: 10.5 }}>{e.actor}</span>
              {lat && <span style={{ color: latColor, fontSize: 10.5, minWidth: 48, textAlign: "right", fontWeight: isErr ? 700 : 400 }}>{lat}</span>}
            </div>
          );
        })}
      </div>
    </RailBlock>
  );
}

/* ── ZONE 5 좌 — 호출 버킷 있으면 추이, 없으면 메서드 분포(구조) ── */
export function TrendChart({ c, buckets, byMethod, booted }) {
  const W = 640, H = 120, PAD = 8;
  const has = buckets.length > 1;
  const max = Math.max(1, ...buckets.map((b) => b.calls));
  const pts = buckets.map((b, i) => {
    const x = PAD + (i / Math.max(1, buckets.length - 1)) * (W - 2 * PAD);
    const y = H - PAD - (b.calls / max) * (H - 2 * PAD - 6);
    return [x, y];
  });
  const line = pts.map((p) => p.join(",")).join(" ");
  const area = has ? `${PAD},${H - PAD} ${line} ${W - PAD},${H - PAD}` : "";
  const methods = Object.entries(byMethod).sort((a, b) => b[1] - a[1]);
  const mMax = Math.max(1, ...methods.map(([, v]) => v));
  return (
    <section className="hud-panel hud-row2" style={sx.panelCol}>
      <PanelHead title={has ? c.trend : c.byMethod} sub={has ? c.subTrend : c.subByMethod} />
      <div className="hud-fill">
      {!has && methods.length === 0 && (booted
        ? <EmptyState visual={<GhostLine tall />} title={c.noData} hint={c.emptyTrend} />
        : <SkelRows n={3} />)}
      {has && (
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 130, marginTop: 8 }}>
          {[30, 60, 90].map((y) => <line key={y} x1="0" x2={W} y1={y} y2={y} stroke="var(--line)" strokeDasharray="3 5" />)}
          <polygon points={area} fill="rgba(0,181,166,.14)" />
          <polyline points={line} fill="none" stroke="var(--blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ filter: "drop-shadow(0 0 6px rgba(0,181,166,.45))" }} />
          {pts.length > 0 && <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3.5" fill="var(--kt-red)" style={{ animation: REDUCED ? "none" : "dashBlink 1.6s infinite" }} />}
        </svg>
      )}
      {!has && methods.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {methods.map(([m, v]) => (
            <div key={m} style={sx.compBar}>
              <span className="mono" style={{ ...sx.compTag, color: METHOD_COLOR[m] || "var(--muted)" }}>{m}</span>
              <span style={sx.tbarTrack}><u style={{ ...sx.tbarFill, width: `${Math.round((v / mMax) * 100)}%`, background: METHOD_COLOR[m] || "var(--blue)" }} /></span>
              <b className="mono" style={sx.compCt}>{v}</b>
            </div>
          ))}
        </div>
      )}
      </div>
    </section>
  );
}

/* ── 툴별 호출 Top — 티커 레일 블록. 호출 없으면 서비스별 툴 수(구조) 폴백 ── */
export function TopTools({ c, tools, services, go, booted }) {
  const useSvc = tools.length === 0 && services.length > 0;
  const max = Math.max(1, ...tools.map((t) => t.calls));
  const svcMax = Math.max(1, ...services.map((s) => s.count));
  return (
    <RailBlock title={useSvc ? c.svcTools : c.topTools} sub={useSvc ? c.subSvcTools : c.subTop}>
      {tools.length === 0 && !useSvc && (booted
        ? <Vacant label={c.feedWait} />
        : <SkelRows n={2} />)}
      <div>
        {!useSvc && tools.map((t) => {
          const warn = t.ok_rate != null && t.ok_rate < 0.95;
          return (
            <div key={t.tool_id} {...rowA11y(() => go("explorer"))} style={sx.tbar}>
              <span style={sx.tbarName}>{t.tool_id}</span>
              <span style={sx.tbarTrack}><u style={{ ...sx.tbarFill, width: `${Math.round((t.calls / max) * 100)}%` }} /></span>
              <b className="mono" style={{ fontSize: 10.5, color: "var(--text)", minWidth: 34, textAlign: "right" }}>{t.calls}</b>
              <span className="mono" style={{ fontSize: 10, minWidth: 42, textAlign: "right", color: warn ? "var(--red)" : "var(--green)" }}>{t.ok_rate != null ? `${(t.ok_rate * 100).toFixed(0)}%` : ""}</span>
            </div>
          );
        })}
        {useSvc && services.slice(0, 6).map((s) => (
          <div key={s.name} {...rowA11y(() => go("explorer", { service: s.name }))} style={sx.tbar}>
            <span style={sx.tbarName}>{s.name || c.noSvc}</span>
            <span style={sx.tbarTrack}><u style={{ ...sx.tbarFill, width: `${Math.round((s.count / svcMax) * 100)}%` }} /></span>
            <b className="mono" style={{ fontSize: 10.5, color: "var(--text)", minWidth: 34, textAlign: "right" }}>{s.count}</b>
          </div>
        ))}
      </div>
    </RailBlock>
  );
}
