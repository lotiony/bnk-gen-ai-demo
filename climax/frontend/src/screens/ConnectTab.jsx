/** tool 상세의 [연결] 탭 — 이 tool 을 실제로 부르는 두 가지 경로.
 *
 * 자주 헷갈리는 지점을 화면이 직접 설명한다: 주소는 프로젝트당 하나이고,
 * 무엇을 부를지는 URL 이 아니라 요청 본문의 tool_id 가 정한다.
 */
import { useEffect, useState } from "react";
import { api } from "../api";

const Ink = {
  margin: 0, background: "var(--code)", color: "var(--code-text)", borderRadius: 14,
  padding: "16px 18px", fontFamily: "var(--mono)", fontSize: 11.5, lineHeight: 1.7,
  overflowX: "auto", whiteSpace: "pre",
};

const btn = (on) => ({
  border: on ? "1px solid var(--sel-border)" : "1px solid var(--line2)",
  background: on ? "var(--sel)" : "var(--main)",
  color: on ? "var(--blue-d)" : "var(--text)",
  fontSize: 11.5, fontWeight: 800, padding: "6px 12px", borderRadius: 10, cursor: "pointer",
});

export default function ConnectTab({ ko, toolId, projectId }) {
  const [tab, setTab] = useState("agent");
  const [tokens, setTokens] = useState([]);
  const [issued, setIssued] = useState("");     // 발급 직후 1회 노출되는 원문
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    api.listTokens(projectId).then((d) => setTokens(d.tokens || [])).catch(() => setTokens([]));
  }, [projectId]);

  const url = `${window.location.origin}/mcp/p/${projectId}`;
  // 원문은 발급 응답에만 실린다. 이미 발급된 토큰의 prefix 를 명령에 끼워 넣으면 붙여넣는
  // 순간 무조건 401 이 나므로, 원문이 없을 때는 자리표시자를 그대로 둔다.
  const sample = issued || "elk_live_…";

  const issue = async () => {
    setBusy(true);
    try {
      const r = await api.issueToken(projectId, ko ? "탐색 화면에서 발급" : "from explorer", "read");
      setIssued(r.token);
      setTokens(await api.listTokens(projectId).then((d) => d.tokens || []));
    } finally { setBusy(false); }
  };

  const agentCode = `# ${ko ? "프로젝트를 한 번 등록하면 이 tool도 같이 딸려옵니다" : "register once; this tool comes with it"}
claude mcp add --transport http emberlink \\
  ${url} \\
  --header "Authorization: Bearer ${sample}"

# ${ko ? "붙인 뒤에는 tool 이름을 몰라도 됩니다 — 그냥 말로" : "then just ask in natural language"}`;

  const httpCode = `# ${ko ? "주소는 프로젝트당 하나뿐 — tool은 본문에서 지정합니다" : "one URL per project; the body picks the tool"}
curl -sN ${url} \\
  -H "Authorization: Bearer ${sample}" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{
    "jsonrpc": "2.0", "id": 1,
    "method": "tools/call",
    "params": {
      "name": "invoke_api",
      "arguments": {
        "tool_id": "${toolId}",
        "arguments": {}
      }
    }
  }'`;

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        <button style={btn(tab === "agent")} onClick={() => setTab("agent")}>
          {ko ? "에이전트에 등록" : "Register in agent"}</button>
        <button style={btn(tab === "http")} onClick={() => setTab("http")}>
          {ko ? "HTTP로 직접 호출" : "Call over HTTP"}</button>
        <span style={{ flex: 1 }} />
        {/* 토큰이 이미 있어도 버튼을 숨기지 않는다 — 원문은 다시 볼 수 없으므로, 잃어버렸을 때
            재발급 말고는 복구 경로가 없다. */}
        <button style={{ ...btn(true), background: "var(--blue)", color: "#fff", borderColor: "var(--blue)" }}
          disabled={busy} onClick={issue}>
          {busy ? "…" : tokens.length === 0
            ? (ko ? "토큰 발급" : "Issue token")
            : (ko ? "토큰 재발급" : "Issue new token")}</button>
      </div>

      {tokens.length > 0 && !issued && (
        <p style={{ fontSize: 11.5, color: "var(--muted)", margin: "0 0 12px" }}>
          {ko
            ? `이미 발급된 토큰 ${tokens.length}개 (${tokens.map((t) => t.prefix).join(", ")}). 원문은 발급 시점에만 보이므로, 값을 모르면 재발급하세요.`
            : `${tokens.length} token(s) already issued (${tokens.map((t) => t.prefix).join(", ")}). The secret is shown only at issue time — reissue if you lost it.`}
        </p>
      )}

      {issued && (
        <div style={{ display: "flex", alignItems: "center", gap: 9, background: "var(--amber-bg)",
          borderRadius: 12, padding: "10px 13px", marginBottom: 12, fontSize: 12, color: "var(--text)" }}>
          <span>⚠</span>
          <span style={{ flex: 1 }}>{ko
            ? "이 토큰은 지금 한 번만 표시됩니다. 아래 명령에 이미 채워져 있습니다."
            : "Shown once only — already filled into the snippet below."}</span>
        </div>
      )}

      <pre style={Ink}>{tab === "agent" ? agentCode : httpCode}</pre>

      <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.65, margin: "10px 0 0" }}>
        {tab === "agent"
          ? (ko ? "어떤 tool을 부를지는 에이전트가 판단합니다. Claude Desktop · Cursor · VS Code는 같은 값을 mcp.json에 넣으면 됩니다."
            : "The agent decides which tool to call.")
          : (ko ? "URL은 프로젝트 엔드포인트 그대로이고, 무엇을 부를지는 tool_id가 정합니다 — tool마다 주소가 따로 생기지 않습니다."
            : "One project URL; tool_id selects the tool.")}
      </p>
    </div>
  );
}
