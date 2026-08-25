// 도구 UI mock — VSCode (Coder), Jenkins, ArgoCD + 공통 모달.
import { useEffect } from "react";
import { cn } from "@/lib/utils";

/** 도구 UI mock 풀스크린 팝업 모달 (재사용). */
function ToolModal({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-[1360px]" style={{ height: '92vh' }}>
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 w-8 h-8 rounded-full bg-white text-ink-dark border border-line shadow-md flex items-center justify-center font-extrabold hover:bg-surface-soft"
          aria-label="닫기"
        >
          ✕
        </button>
        <div className="h-full">{children}</div>
      </div>
    </div>
  );
}

/** VS Code Web (Coder) UI 흉내 — 타이틀바 + 액티비티바 + 사이드바 + 에디터 + 터미널. */
function VSCodeMock() {
  return (
    <div
      className="rounded-md overflow-hidden border border-[#1f2937] shadow-md"
      style={{ background: '#1e1e1e' }}
    >
      {/* 타이틀바 */}
      <div
        className="h-8 flex items-center px-3 gap-2 text-[11px] border-b"
        style={{ background: '#323233', color: '#cccccc', borderBottomColor: '#1f2937' }}
      >
        <span className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#ff5f57' }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#febc2e' }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#28c840' }} />
        </span>
        <span className="ml-auto mr-auto opacity-80 font-mono text-[10.5px]">
          workspace — pb-agent — Visual Studio Code (Coder Web)
        </span>
      </div>

      {/* 메뉴바 */}
      <div
        className="flex items-center px-2 text-[10.5px] gap-3 h-6 border-b"
        style={{ background: '#2c2c2c', color: '#cccccc', borderBottomColor: '#1f2937' }}
      >
        {['File', 'Edit', 'Selection', 'View', 'Go', 'Run', 'Terminal', 'Help'].map((m) => (
          <span key={m} className="opacity-80 hover:opacity-100">
            {m}
          </span>
        ))}
        <span className="ml-auto font-mono opacity-60">박서연@workspace</span>
      </div>

      <div className="flex" style={{ minHeight: 460 }}>
        {/* Activity bar */}
        <div
          className="w-12 flex flex-col items-center py-2 gap-3 text-[18px]"
          style={{ background: '#333333', color: '#cccccc' }}
        >
          <span title="Explorer" style={{ color: '#ffffff', borderLeft: '2px solid #007acc', paddingLeft: 8, marginLeft: -2 }}>📁</span>
          <span title="Search" className="opacity-70">🔍</span>
          <span title="Source Control" className="opacity-70">⎇</span>
          <span title="Run & Debug" className="opacity-70">▷</span>
          <span title="Extensions" className="opacity-70">⬛</span>
          <span className="mt-auto opacity-70" title="Coder">🟡</span>
          <span title="Account" className="opacity-70">👤</span>
          <span title="Settings" className="opacity-70">⚙</span>
        </div>

        {/* Side bar — file tree */}
        <div
          className="w-56 text-[11px] py-2 px-1"
          style={{ background: '#252526', color: '#cccccc' }}
        >
          <div className="px-2 mb-1 text-[10px] uppercase tracking-wider opacity-70 font-semibold">
            Explorer
          </div>
          <div className="px-2 py-1 text-[10.5px] font-bold opacity-80">▾ PB-AGENT</div>
          <FileTreeNode depth={1} icon="📁" name="agents/" />
          <FileTreeNode depth={2} icon="🐍" name="pb_advisor.py" />
          <FileTreeNode depth={2} icon="🐍" name="prompt_templates.py" />
          <FileTreeNode depth={2} icon="🐍" name="tools.py" />
          <FileTreeNode depth={1} icon="📁" name="eval/" />
          <FileTreeNode depth={2} icon="📓" name="golden_set.jsonl" />
          <FileTreeNode depth={2} icon="🐍" name="run_eval.py" />
          <FileTreeNode depth={1} icon="📁" name="tests/" />
          <FileTreeNode depth={2} icon="🐍" name="test_pb_eval.py" active />
          <FileTreeNode depth={1} icon="📄" name="pyproject.toml" />
          <FileTreeNode depth={1} icon="📄" name="README.md" />
          <FileTreeNode depth={1} icon="📄" name=".env.local" />
        </div>

        {/* Editor + tab + terminal */}
        <div className="flex-1 flex flex-col" style={{ background: '#1e1e1e' }}>
          {/* Tabs */}
          <div
            className="flex text-[11px] border-b"
            style={{ background: '#2d2d2d', color: '#cccccc', borderBottomColor: '#1f2937' }}
          >
            <span className="px-3 py-1.5 border-r" style={{ background: '#1e1e1e', color: '#ffffff', borderRightColor: '#1f2937' }}>
              <span className="mr-1">🐍</span>test_pb_eval.py
              <span className="ml-2 opacity-50">×</span>
            </span>
            <span className="px-3 py-1.5 border-r opacity-70" style={{ borderRightColor: '#1f2937' }}>
              <span className="mr-1">🐍</span>pb_advisor.py
              <span className="ml-2 opacity-50">×</span>
            </span>
            <span className="px-3 py-1.5 opacity-70">
              <span className="mr-1">📄</span>README.md
              <span className="ml-2 opacity-50">×</span>
            </span>
          </div>

          {/* Code editor */}
          <div
            className="flex-1 font-mono text-[11px] leading-[1.65] py-2 overflow-x-auto"
            style={{ background: '#1e1e1e', color: '#d4d4d4' }}
          >
            <CodeLine n={1} text={<><Kw>from</Kw> aip.testing <Kw>import</Kw> evaluate_golden_set</>} />
            <CodeLine n={2} text={<><Kw>from</Kw> pb_agent <Kw>import</Kw> PBAdvisor</>} />
            <CodeLine n={3} text="" />
            <CodeLine n={4} text={<><Kw>def</Kw> <Fn>test_pb_eval_golden_set</Fn>():</>} />
            <CodeLine n={5} text={<>{'    '}<Cm># 골든셋 42 케이스 평가 (PB 자산진단 v0.4.2)</Cm></>} />
            <CodeLine n={6} text={<>{'    '}advisor = <Fn>PBAdvisor</Fn>(model=<St>"onprem/qwen3-32b"</St>)</>} />
            <CodeLine n={7} text={<>{'    '}result = <Fn>evaluate_golden_set</Fn>(advisor, <St>"eval/golden_set.jsonl"</St>)</>} />
            <CodeLine n={8} text="" />
            <CodeLine n={9} text={<>{'    '}<Kw>assert</Kw> result.pass_rate &gt;= <Num>0.95</Num></>} />
            <CodeLine n={10} text={<>{'    '}<Kw>assert</Kw> result.avg_p95_ms &lt; <Num>3000</Num></>} />
            <CodeLine n={11} text={<>{'    '}<Kw>assert</Kw> result.pii_leakage == <Num>0</Num></>} />
            <CodeLine n={12} text="" />
            <CodeLine n={13} text={<><Kw>if</Kw> __name__ == <St>"__main__"</St>:</>} highlighted />
            <CodeLine n={14} text={<>{'    '}<Fn>test_pb_eval_golden_set</Fn>()</>} />
          </div>

          {/* Terminal */}
          <div
            className="border-t"
            style={{ background: '#1e1e1e', borderTopColor: '#1f2937' }}
          >
            <div
              className="flex text-[10.5px] px-2 border-b"
              style={{ background: '#2d2d2d', color: '#cccccc', borderBottomColor: '#1f2937' }}
            >
              {['PROBLEMS', 'OUTPUT', 'DEBUG CONSOLE', 'TERMINAL', 'PORTS'].map((t, i) => (
                <span
                  key={t}
                  className={cn('px-2 py-1.5', i === 3 ? 'text-white border-b-2 border-[#007acc]' : 'opacity-70')}
                >
                  {t}
                </span>
              ))}
            </div>
            <div
              className="font-mono text-[11px] px-3 py-2 leading-[1.55]"
              style={{ color: '#d4d4d4', minHeight: 130 }}
            >
              <div>
                <span style={{ color: '#86efac' }}>coder@workspace</span>
                <span style={{ color: '#9ca3af' }}>:</span>
                <span style={{ color: '#7dd3fc' }}>~/pb-agent</span>
                <span style={{ color: '#9ca3af' }}>$ </span>
                pytest tests/test_pb_eval.py -v
              </div>
              <div style={{ color: '#9ca3af' }}>
                ============================= test session starts ==============================
              </div>
              <div style={{ color: '#9ca3af' }}>platform linux -- Python 3.12.4, pytest-8.2.2, pluggy-1.5.0</div>
              <div style={{ color: '#9ca3af' }}>collected 42 items</div>
              <div>
                <span>tests/test_pb_eval.py::test_pb_eval_golden_set </span>
                <span style={{ color: '#86efac' }}>PASSED</span>
                <span style={{ color: '#9ca3af' }}> [100%]</span>
              </div>
              <div>
                <span style={{ color: '#86efac' }}>============================== 42 passed in 14.2s ==============================</span>
              </div>
              <div className="mt-1">
                <span style={{ color: '#86efac' }}>coder@workspace</span>
                <span style={{ color: '#9ca3af' }}>:</span>
                <span style={{ color: '#7dd3fc' }}>~/pb-agent</span>
                <span style={{ color: '#9ca3af' }}>$ </span>
                <span className="inline-block w-1.5 h-3 align-middle" style={{ background: '#d4d4d4' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div
        className="flex items-center px-3 text-[10.5px] h-6 gap-3"
        style={{ background: '#007acc', color: '#ffffff' }}
      >
        <span>⎇ feat/pb-eval-v2</span>
        <span>● 0 ⚠ 0</span>
        <span className="opacity-90">Python 3.12.4 (.venv)</span>
        <span className="ml-auto opacity-90">UTF-8</span>
        <span className="opacity-90">LF</span>
        <span className="opacity-90">Ln 14, Col 28</span>
        <span className="opacity-90">Spaces: 4</span>
        <span className="opacity-90">🟢 Coder · A100</span>
      </div>
    </div>
  );
}

function FileTreeNode({
  depth,
  icon,
  name,
  active,
}: {
  depth: number;
  icon: string;
  name: string;
  active?: boolean;
}) {
  return (
    <div
      className={cn('px-2 py-[3px] text-[11px] flex items-center gap-1.5 cursor-default')}
      style={{
        paddingLeft: 8 + depth * 12,
        background: active ? '#37373d' : 'transparent',
        color: active ? '#ffffff' : '#cccccc',
      }}
    >
      <span className="text-[12px]">{icon}</span>
      <span className={cn(active && 'font-bold')}>{name}</span>
    </div>
  );
}

// Syntax highlight tokens (Capitalized for JSX)
function Kw({ children }: { children: React.ReactNode }) {
  return <span style={{ color: '#569cd6' }}>{children}</span>;
}
function Fn({ children }: { children: React.ReactNode }) {
  return <span style={{ color: '#dcdcaa' }}>{children}</span>;
}
function St({ children }: { children: React.ReactNode }) {
  return <span style={{ color: '#ce9178' }}>{children}</span>;
}
function Num({ children }: { children: React.ReactNode }) {
  return <span style={{ color: '#b5cea8' }}>{children}</span>;
}
function Cm({ children }: { children: React.ReactNode }) {
  return <span style={{ color: '#6a9955' }}>{children}</span>;
}

function CodeLine({ n, text, highlighted }: { n: number; text: React.ReactNode; highlighted?: boolean }) {
  return (
    <div
      className="flex"
      style={{ background: highlighted ? '#2d2d30' : 'transparent' }}
    >
      <span
        className="text-right pr-3 select-none font-mono"
        style={{ color: '#858585', width: 40, minWidth: 40, fontSize: 10.5 }}
      >
        {n}
      </span>
      <span className="whitespace-pre">{text}</span>
    </div>
  );
}

function JenkinsMock() {
  const jobs = [
    { name: 'pb-agent-build', last: '#1842', dur: '2m 34s', status: 'success', branch: 'main' },
    { name: 'pb-agent-test', last: '#1842', dur: '4m 12s', status: 'success', branch: 'main' },
    { name: 'pb-agent-image', last: '#1842', dur: '3m 08s', status: 'success', branch: 'main' },
    { name: 'pb-agent-lint', last: '#62', dur: '0m 52s', status: 'failed', branch: 'feat/eval-v2' },
    { name: 'pb-rag-index-build', last: '#421', dur: '14m 02s', status: 'success', branch: 'main' },
    { name: 'pb-agent-nightly', last: '#88', dur: '38m 14s', status: 'building', branch: 'main' },
  ];
  return (
    <div className="rounded-md overflow-hidden border border-line shadow-md flex flex-col h-full bg-white">
      {/* Top bar */}
      <div className="h-10 flex items-center px-4 gap-3 border-b border-line" style={{ background: '#335061', color: '#ffffff' }}>
        <span className="text-[18px]" aria-hidden>🛠</span>
        <span className="font-extrabold text-[13.5px]">Jenkins</span>
        <span className="text-[10.5px] opacity-80">2.452.1 (LTS)</span>
        <input
          type="text"
          placeholder="search (CTRL+K)"
          className="ml-auto h-7 w-[260px] px-2.5 rounded bg-white/95 text-ink-dark text-[11.5px] outline-none"
          readOnly
        />
        <span className="text-[11.5px]">🔔</span>
        <span className="text-[11.5px]">🇰🇷 박서연 ▾</span>
      </div>

      {/* Breadcrumb bar */}
      <div className="h-8 flex items-center px-4 gap-1.5 border-b border-line text-[11.5px] text-ink-dark" style={{ background: '#f0f0f0' }}>
        <span className="font-bold">Dashboard</span>
        <span className="text-ink-light">›</span>
        <span className="font-bold">PB Agent</span>
        <span className="text-ink-light">›</span>
        <span>(all jobs)</span>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Side menu */}
        <aside className="w-56 border-r border-line text-[12px] py-3 px-2 flex-shrink-0" style={{ background: '#fafafa' }}>
          <ul className="space-y-1">
            {[
              { i: '➕', t: 'New Item', active: false },
              { i: '👥', t: 'People', active: false },
              { i: '🗂', t: 'Build History', active: true },
              { i: '🛠', t: 'Manage Jenkins', active: false },
              { i: '🌟', t: 'My Views', active: false },
              { i: '⏸', t: 'Build Queue', active: false },
            ].map((m) => (
              <li
                key={m.t}
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 rounded',
                  m.active ? 'bg-info-bg text-info font-extrabold' : 'text-ink-dark hover:bg-surface',
                )}
              >
                <span aria-hidden>{m.i}</span>
                {m.t}
              </li>
            ))}
          </ul>
          <div className="mt-4 text-[10.5px] text-ink-mid font-bold uppercase tracking-[0.3px] px-2 mb-1.5">
            Build Executor
          </div>
          <ul className="space-y-1 text-[11px] text-ink-dark px-2">
            <li>● linux-x64-01 <span className="text-ink-mid">— idle</span></li>
            <li>● linux-x64-02 <span className="text-warn">— pb-agent-nightly #88</span></li>
            <li>● mac-arm64-01 <span className="text-ink-mid">— idle</span></li>
          </ul>
        </aside>

        {/* Job list */}
        <div className="flex-1 overflow-auto p-4">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-[15px] font-extrabold text-ink-dark">All Jobs</h3>
            <span className="text-[11px] text-ink-mid">activity in last 24h</span>
          </div>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-[10.5px] uppercase tracking-[0.3px] text-ink-mid border-b border-line">
                <th className="w-[28px]"></th>
                <th className="text-left font-bold py-2">Name ↓</th>
                <th className="text-left font-bold py-2 w-[150px]">Branch</th>
                <th className="text-left font-bold py-2 w-[80px]">Last Build</th>
                <th className="text-left font-bold py-2 w-[100px]">Duration</th>
                <th className="text-center font-bold py-2 w-[100px]">Status</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.name} className="border-b border-line-soft last:border-0 hover:bg-surface-soft/50">
                  <td className="py-2 pl-1">
                    <JenkinsBall status={j.status as 'success' | 'failed' | 'building'} />
                  </td>
                  <td className="py-2 font-mono text-[11.5px] text-info font-bold">{j.name}</td>
                  <td className="py-2 font-mono text-[11px] text-ink-dark">{j.branch}</td>
                  <td className="py-2 font-mono text-[11px] text-ink-dark">{j.last}</td>
                  <td className="py-2 tabular-nums text-[11px] text-ink-dark">{j.dur}</td>
                  <td className="py-2 text-center">
                    <JenkinsStatusPill status={j.status as 'success' | 'failed' | 'building'} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Build Queue */}
          <div className="mt-6">
            <h3 className="text-[13px] font-extrabold text-ink-dark mb-2">Build Queue (1)</h3>
            <div className="border border-line rounded p-2.5 text-[11.5px] bg-surface-soft">
              <span className="font-mono text-info font-bold">pb-agent-image</span>
              <span className="text-ink-mid"> — pending agent · queued 18s ago</span>
            </div>
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center px-4 text-[10.5px] h-6 border-t border-line" style={{ background: '#f0f0f0' }}>
        <span className="text-ink-mid">Page generated: 2026-05-24 14:08 KST</span>
        <span className="ml-auto text-ink-mid">REST API · CLI · Jenkins 2.452.1</span>
      </div>
    </div>
  );
}

function JenkinsBall({ status }: { status: 'success' | 'failed' | 'building' }) {
  const color = status === 'success' ? '#1B8A4D' : status === 'failed' ? '#D8313D' : '#1F5BB8';
  if (status === 'building') {
    return (
      <span
        className="inline-block w-3.5 h-3.5 rounded-full animate-pulse"
        style={{ background: color }}
        title="building"
      />
    );
  }
  return (
    <span
      className="inline-block w-3.5 h-3.5 rounded-full"
      style={{ background: color }}
      title={status}
    />
  );
}

function JenkinsStatusPill({ status }: { status: 'success' | 'failed' | 'building' }) {
  if (status === 'success') return <span className="pill bg-ok-bg text-ok border border-ok-border">✓ Success</span>;
  if (status === 'failed') return <span className="pill bg-bad-bg text-bad border border-bad-border">✗ Failed</span>;
  return <span className="pill bg-info-bg text-info border border-info-border">● Building</span>;
}

/* ──────────────────────────────────────────────────────────────
 * ArgoCD UI mock (어두운 보라 톤)
 * ────────────────────────────────────────────────────────────── */

function ArgocdMock() {
  const apps = [
    { name: 'pb-agent-train', sync: 'Synced', health: 'Healthy', revision: 'a8f9c12', env: 'train' },
    { name: 'pb-agent-serv', sync: 'Synced', health: 'Healthy', revision: 'a8f9c12', env: 'serv' },
    { name: 'pb-rag-index-builder', sync: 'OutOfSync', health: 'Healthy', revision: '2c1d3e4', env: 'train' },
    { name: 'pb-eval-runner', sync: 'Synced', health: 'Healthy', revision: 'a8f9c12', env: 'train' },
  ];
  return (
    <div className="rounded-md overflow-hidden border flex flex-col h-full" style={{ background: '#0e1a2b', borderColor: '#1f2937' }}>
      {/* Top bar */}
      <div className="h-12 flex items-center px-4 gap-3 border-b" style={{ background: '#1a2740', borderBottomColor: '#1f2937', color: '#e5e7eb' }}>
        <span className="text-[20px]" aria-hidden>🚀</span>
        <span className="font-extrabold text-[13.5px]">Argo CD</span>
        <span className="text-[10.5px] opacity-70">v2.11.3</span>
        <div className="ml-auto flex items-center gap-3 text-[11.5px]">
          <span className="opacity-80">박서연 (admin)</span>
          <span>🔔</span>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Side nav */}
        <aside className="w-16 flex flex-col items-center py-3 gap-3 border-r flex-shrink-0" style={{ background: '#0b1426', borderRightColor: '#1f2937', color: '#9ca3af' }}>
          <span title="Applications" className="text-[20px]" style={{ color: '#fbbf24' }}>📦</span>
          <span title="Settings" className="text-[18px] opacity-70">⚙</span>
          <span title="User" className="text-[18px] opacity-70">👤</span>
          <span title="Docs" className="text-[18px] opacity-70">📚</span>
        </aside>

        {/* Main */}
        <div className="flex-1 overflow-auto p-4" style={{ color: '#e5e7eb' }}>
          <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
            <h3 className="text-[15px] font-extrabold">Applications</h3>
            <div className="flex items-center gap-2 text-[10.5px]">
              <span className="px-2 py-1 rounded" style={{ background: '#1a2740' }}>+ NEW APP</span>
              <span className="px-2 py-1 rounded" style={{ background: '#1a2740' }}>SYNC APPS</span>
              <span className="px-2 py-1 rounded" style={{ background: '#1a2740' }}>REFRESH</span>
            </div>
          </div>

          {/* Filter chips */}
          <div className="flex gap-1.5 mb-3 text-[10.5px]" style={{ color: '#9ca3af' }}>
            {['All (4)', 'Healthy (4)', 'Synced (3)', 'OutOfSync (1)'].map((c, i) => (
              <span
                key={c}
                className="px-2 py-1 rounded"
                style={{ background: i === 0 ? '#fbbf24' : '#1a2740', color: i === 0 ? '#0b1426' : '#e5e7eb' }}
              >
                {c}
              </span>
            ))}
          </div>

          {/* App cards grid */}
          <div className="grid grid-cols-2 gap-3">
            {apps.map((a) => (
              <ArgocdAppCard key={a.name} app={a} />
            ))}
          </div>

          {/* Recent events */}
          <h4 className="text-[12px] font-extrabold mt-5 mb-2">Recent Events</h4>
          <ul className="space-y-1 text-[11px]" style={{ color: '#d4d4d4' }}>
            <li>
              <span style={{ color: '#86efac' }}>● </span>
              13:47 <span style={{ color: '#fbbf24' }}>pb-agent-serv</span> — Auto-sync OK (a8f9c12)
            </li>
            <li>
              <span style={{ color: '#86efac' }}>● </span>
              13:47 <span style={{ color: '#fbbf24' }}>pb-agent-train</span> — Auto-sync OK (a8f9c12)
            </li>
            <li>
              <span style={{ color: '#fbbf24' }}>● </span>
              10:12 <span style={{ color: '#fbbf24' }}>pb-rag-index-builder</span> — OutOfSync 감지 (Helm values 변경)
            </li>
            <li>
              <span style={{ color: '#fca5a5' }}>● </span>
              02-23 18:04 <span style={{ color: '#fbbf24' }}>pb-agent-serv</span> — Rollback b7e2a1 → a8f9c12 (P95 SLA)
            </li>
          </ul>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center px-4 text-[10.5px] h-6 border-t" style={{ background: '#1a2740', borderTopColor: '#1f2937', color: '#9ca3af' }}>
        <span>Cluster: in-cluster · Namespace: argocd</span>
        <span className="ml-auto">cd.aip.group.local</span>
      </div>
    </div>
  );
}

function ArgocdAppCard({
  app,
}: {
  app: { name: string; sync: string; health: string; revision: string; env: string };
}) {
  const synced = app.sync === 'Synced';
  return (
    <div
      className="rounded p-3 border"
      style={{ background: '#152337', borderColor: '#1f2937' }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-extrabold text-[12.5px]" style={{ color: '#fbbf24' }}>
          📦 {app.name}
        </span>
        <span
          className="text-[9.5px] px-1.5 py-0.5 rounded font-bold"
          style={{
            background: app.env === 'serv' ? '#064e3b' : '#1e3a8a',
            color: app.env === 'serv' ? '#86efac' : '#93c5fd',
          }}
        >
          {app.env}
        </span>
      </div>
      <div className="flex items-center gap-2 text-[10.5px] mb-1.5" style={{ color: '#d4d4d4' }}>
        <span
          className="px-1.5 py-0.5 rounded font-bold"
          style={{
            background: synced ? '#064e3b' : '#7c2d12',
            color: synced ? '#86efac' : '#fdba74',
          }}
        >
          {synced ? '✓ Synced' : '⚠ OutOfSync'}
        </span>
        <span
          className="px-1.5 py-0.5 rounded font-bold"
          style={{ background: '#064e3b', color: '#86efac' }}
        >
          ● Healthy
        </span>
      </div>
      <div className="text-[10px] font-mono" style={{ color: '#9ca3af' }}>
        revision <span style={{ color: '#d4d4d4' }}>{app.revision}</span>
      </div>
      <div className="text-[10px] font-mono mt-0.5" style={{ color: '#9ca3af' }}>
        repo <span style={{ color: '#d4d4d4' }}>git.aip.group.local/aip/pb-agent-deploy</span>
      </div>
    </div>
  );
}

export { ToolModal, VSCodeMock, JenkinsMock, ArgocdMock };
