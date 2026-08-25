import { useEffect, useState, useCallback } from "react";
import { api } from "../api";

// 접근권한 매트릭스 — 역할별로 MCP·데이터소스·메뉴 허용 목록(allowlist)을 체크박스로 설정.
// admin(is_system) 역할은 전체 허용이라 편집 대상이 아니다.
const GROUPS = [
  { key: "mcp", label: "MCP 서버" },
  { key: "datasource", label: "데이터소스" },
  { key: "menu", label: "메뉴" },
];

export default function AccessControl() {
  const [roles, setRoles] = useState([]);
  const [sel, setSel] = useState("");                 // 선택 역할 id
  const [catalog, setCatalog] = useState({ mcp: [], datasource: [], menu: [] });
  const [perms, setPerms] = useState({ mcp: new Set(), datasource: new Set(), menu: new Set() });
  const [isAdmin, setIsAdmin] = useState(false);
  const [newRole, setNewRole] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);

  // 권한 대상 카탈로그(universe) — 한 번만
  useEffect(() => {
    Promise.all([api.allResources(), api.dataSources(), api.menus()]).then(([res, ds, mn]) => {
      setCatalog({
        mcp: (res.resources || []).map((r) => ({ id: r.resource_id, label: r.name })),
        datasource: (ds.data_sources || []).map((d) => ({ id: d.id, label: `${d.label} (${d.count})` })),
        menu: (mn.menus || []).map((m) => ({ id: m.key, label: m.label })),
      });
    }).catch((e) => setErr(e.message));
  }, []);

  const loadRoles = useCallback(async () => {
    const d = await api.roles();
    const rs = d.roles || [];
    setRoles(rs);
    if (rs.length && !rs.find((r) => r.id === sel)) setSel(rs[0].id);
  }, [sel]);

  useEffect(() => { loadRoles(); }, []);   // eslint-disable-line react-hooks/exhaustive-deps

  // 선택 역할 권한 로드
  useEffect(() => {
    if (!sel) return;
    setSaved(false);
    api.rolePermissions(sel).then((d) => {
      setIsAdmin(!!d.is_system);
      setPerms({
        mcp: new Set(d.permissions.mcp), datasource: new Set(d.permissions.datasource),
        menu: new Set(d.permissions.menu),
      });
    }).catch((e) => setErr(e.message));
  }, [sel]);

  const toggle = (group, id) => {
    setPerms((p) => {
      const next = new Set(p[group]);
      next.has(id) ? next.delete(id) : next.add(id);
      return { ...p, [group]: next };
    });
    setSaved(false);
  };

  const toggleAll = (group, on) => {
    setPerms((p) => ({ ...p, [group]: on ? new Set(catalog[group].map((c) => c.id)) : new Set() }));
    setSaved(false);
  };

  const save = async () => {
    setBusy(true); setErr(""); setSaved(false);
    try {
      await api.saveRolePermissions(sel, {
        mcp: [...perms.mcp], datasource: [...perms.datasource], menu: [...perms.menu],
      });
      setSaved(true);
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const addRole = async () => {
    if (!newRole.trim()) return;
    try {
      const r = await api.createRole({ name: newRole.trim() });
      setNewRole("");
      await loadRoles();
      setSel(r.id);
    } catch (e) { setErr(e.message); }
  };

  const removeRole = async (rid) => {
    try {
      await api.deleteRole(rid);
      await loadRoles();
    } catch (e) { setErr(e.message); }
  };

  const card = { background: "var(--card)", border: "1px solid var(--line2)", borderRadius: 18, padding: 18 };
  const cap = { fontSize: 11, fontWeight: 600, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--muted)", margin: "0 0 12px" };

  return (
    <div>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "-.02em" }}>접근 권한</h1>
      <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--text)" }}>
        역할별로 사용 가능한 MCP·데이터소스·메뉴를 설정합니다. 체크된 항목만 해당 역할에 노출됩니다.
        <span style={{ color: "var(--muted)" }}> (관리자 역할은 항상 전체 접근)</span>
      </p>

      {err && (
        <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 11, background: "var(--red-bg)", color: "var(--red)", fontSize: 12.5, fontWeight: 600 }}>
          <span>{err}</span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 18, alignItems: "start", marginTop: 22 }}>
        {/* 좌: 역할 목록 */}
        <div style={card}>
          <p className="mono" style={cap}>역할 · {roles.length}</p>
          {roles.map((r) => {
            const on = r.id === sel;
            return (
              <div key={r.id} onClick={() => setSel(r.id)} style={{
                display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", marginBottom: 6,
                borderRadius: 11, cursor: "pointer", background: on ? "var(--sel)" : "transparent",
                border: `1px solid ${on ? "var(--sel-border)" : "var(--line)"}`,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--navy)" }}>{r.name}</div>
                  {r.description && <div style={{ fontSize: 11, color: "var(--muted)" }}>{r.description}</div>}
                </div>
                {r.is_system
                  ? <span className="mono" style={{ fontSize: 9.5, fontWeight: 700, color: "var(--blue-d)", background: "var(--blue-bg)", padding: "2px 7px", borderRadius: 7 }}>SYSTEM</span>
                  : <span onClick={(e) => { e.stopPropagation(); removeRole(r.id); }} title="역할 삭제"
                      style={{ color: "var(--muted)", cursor: "pointer", fontSize: 15, lineHeight: 1 }}>×</span>}
              </div>
            );
          })}
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <input value={newRole} onChange={(e) => setNewRole(e.target.value)} placeholder="새 역할명"
              onKeyDown={(e) => e.key === "Enter" && addRole()}
              style={{ flex: 1, minWidth: 0, padding: "8px 10px", borderRadius: 9, border: "1px solid var(--line2)", background: "var(--card)", color: "var(--navy)", fontSize: 12.5, fontFamily: "var(--sans)" }} />
            <button onClick={addRole} style={{ border: "none", background: "var(--blue)", color: "#fff", fontWeight: 800, fontSize: 15, borderRadius: 9, padding: "0 12px", cursor: "pointer" }}>＋</button>
          </div>
        </div>

        {/* 우: 권한 매트릭스 */}
        <div style={card}>
          {isAdmin ? (
            <div style={{ color: "var(--muted)", fontSize: 13.5, padding: "20px 4px" }}>
              시스템 역할(관리자)은 모든 MCP·데이터소스·메뉴에 접근합니다. 편집 대상이 아닙니다.
            </div>
          ) : (
            <>
              {GROUPS.map((g) => {
                const items = catalog[g.key];
                const allOn = items.length > 0 && items.every((c) => perms[g.key].has(c.id));
                return (
                  <div key={g.key} style={{ marginBottom: 18 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <p className="mono" style={{ ...cap, margin: 0 }}>{g.label} · {items.length}</p>
                      <span onClick={() => toggleAll(g.key, !allOn)} style={{ fontSize: 11.5, fontWeight: 700, color: "var(--blue)", cursor: "pointer" }}>
                        {allOn ? "전체 해제" : "전체 선택"}
                      </span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 6 }}>
                      {items.map((c) => {
                        const on = perms[g.key].has(c.id);
                        return (
                          <label key={c.id} style={{
                            display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 9,
                            border: `1px solid ${on ? "var(--sel-border)" : "var(--line2)"}`,
                            background: on ? "var(--sel)" : "var(--card)", cursor: "pointer", fontSize: 12.5,
                          }}>
                            <input type="checkbox" checked={on} onChange={() => toggle(g.key, c.id)} style={{ accentColor: "var(--blue)" }} />
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--navy)", fontWeight: 600 }}>{c.label}</span>
                          </label>
                        );
                      })}
                      {items.length === 0 && <div style={{ color: "var(--muted)", fontSize: 12 }}>—</div>}
                    </div>
                  </div>
                );
              })}
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
                <button onClick={save} disabled={busy} style={{
                  border: "none", background: "var(--blue)", color: "#fff", fontWeight: 700, fontSize: 13.5,
                  borderRadius: 11, padding: "10px 22px", cursor: busy ? "wait" : "pointer",
                  boxShadow: "0 10px 22px rgba(0,181,166,.30)",
                }}>{busy ? "저장 중…" : "저장"}</button>
                {saved && <span style={{ fontSize: 12.5, color: "var(--green)", fontWeight: 700 }}>저장됨 ✓</span>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
