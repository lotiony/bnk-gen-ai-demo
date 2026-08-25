import { useEffect, useState, useCallback } from "react";
import { api } from "../api";

// Member 관리 (admin 전용) — 허용 이메일 등록/삭제 + 역할(admin|member) 설정.
// 라우팅은 App 에서 auth.isAdmin 일 때만 노출. 서버도 X-Emberlink-Email 로 재확인(403).
export default function Members() {
  const [rows, setRows] = useState([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const me = (localStorage.getItem("ember_email") || "").toLowerCase();

  const load = useCallback(async () => {
    setErr("");
    try { setRows((await api.members()).members || []); }
    catch (e) { setErr(e.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const add = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true); setErr("");
    try { await api.addMember(email.trim(), role); setEmail(""); setRole("member"); await load(); }
    catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };
  const changeRole = async (m, next) => {
    setErr("");
    try { await api.setMemberRole(m.email, next); await load(); }
    catch (e) { setErr(e.message); await load(); }
  };
  const remove = async (m) => {
    if (!window.confirm(`${m.email} 을(를) 삭제할까요?`)) return;
    setErr("");
    try { await api.deleteMember(m.email); await load(); }
    catch (e) { setErr(e.message); }
  };

  const card = { background: "var(--card)", border: "1px solid var(--line2)", borderRadius: 18, padding: "22px 24px" };
  const th = { textAlign: "left", fontSize: 11.5, fontWeight: 700, color: "var(--muted)", padding: "8px 10px", borderBottom: "1px solid var(--line2)" };
  const td = { fontSize: 13, color: "var(--navy)", padding: "10px 10px", borderBottom: "1px solid var(--line)" };
  const input = { padding: "10px 12px", borderRadius: 11, border: "1px solid var(--line2)", background: "var(--card)", color: "var(--navy)", fontSize: 13, fontFamily: "var(--sans)" };

  return (
    <div style={{ maxWidth: 760 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--navy)", margin: "0 0 4px" }}>Member</h1>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--muted)" }}>허용 이메일 등록 · 역할(관리자/편집자) 설정. 관리자만 이 페이지에 접근할 수 있어요.</p>

      {/* 추가 */}
      <form onSubmit={add} style={{ ...card, display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@kt.com" type="email"
          style={{ ...input, flex: 1 }} />
        <select value={role} onChange={(e) => setRole(e.target.value)} style={{ ...input, cursor: "pointer" }}>
          <option value="member">편집자</option>
          <option value="admin">관리자</option>
        </select>
        <button type="submit" disabled={busy} style={{
          padding: "10px 18px", borderRadius: 11, border: "none", cursor: busy ? "wait" : "pointer",
          background: "var(--blue)", color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "var(--sans)" }}>
          {busy ? "추가 중…" : "추가"}
        </button>
      </form>

      {err && <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "#e0455e" }}>{err}</p>}

      {/* 목록 */}
      <div style={card}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr><th style={th}>이메일</th><th style={th}>역할 설정</th><th style={th}>등록일</th><th style={{ ...th, width: 40 }} /></tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const self = m.email === me;
              return (
                <tr key={m.email}>
                  <td style={td}>{m.email} {self && <span style={{ fontSize: 10.5, color: "var(--muted)" }}>(본인)</span>}</td>
                  <td style={td}>
                    <select value={m.role} disabled={self} onChange={(e) => changeRole(m, e.target.value)}
                      style={{ ...input, padding: "5px 9px", fontSize: 12, fontWeight: 700, cursor: self ? "default" : "pointer",
                        color: m.role === "admin" ? "#7a4fd6" : "var(--blue)" }}>
                      <option value="member">편집자</option>
                      <option value="admin">관리자</option>
                    </select>
                  </td>
                  <td style={{ ...td, color: "var(--muted)", fontSize: 12 }}>{m.created_at}</td>
                  <td style={td}>
                    {!self && <button onClick={() => remove(m)} title="삭제" style={{
                      border: "none", background: "transparent", color: "#e0455e", cursor: "pointer", fontWeight: 800, fontSize: 15 }}>✕</button>}
                  </td>
                </tr>
              );
            })}
            {!rows.length && <tr><td style={{ ...td, color: "var(--muted)" }} colSpan={4}>등록된 멤버가 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
