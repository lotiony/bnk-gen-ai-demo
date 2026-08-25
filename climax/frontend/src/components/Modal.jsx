import { useEffect, useRef, useState } from "react";

const btn = {
  border: "none", cursor: "pointer", fontFamily: "var(--sans)",
  fontWeight: 700, fontSize: 13.5, borderRadius: 11, padding: "10px 18px",
};
const inputStyle = {
  width: "100%", padding: "10px 12px", fontSize: 13.5, fontFamily: "var(--sans)",
  color: "var(--navy)", background: "var(--card)", colorScheme: "light",
  border: "1px solid var(--line2)", borderRadius: 11, outline: "none",
};
const labelStyle = { display: "block", fontSize: 12, fontWeight: 700, color: "var(--text)", margin: "0 0 6px" };

/**
 * 디자인 시스템 모달. window.prompt/confirm/alert 대체.
 * - fields: 배열이면 폼 모드. 각 field = {key,label,type,required,placeholder,options,default}
 *   type: "text" | "textarea" | "select" | "color"
 * - fields 없으면 확인 모드(삭제 등). onConfirm(values객체 | undefined).
 * - error: 빨강 인라인 표시(요청 실패).
 */
export default function Modal({
  open, title, message, fields, error,
  confirmLabel = "확인", cancelLabel = "취소", danger = false,
  onConfirm, onCancel,
}) {
  const [vals, setVals] = useState({});
  const firstRef = useRef(null);

  useEffect(() => {
    if (open) {
      const init = {};
      (fields || []).forEach((f) => { init[f.key] = f.default ?? (f.type === "color" ? "" : ""); });
      setVals(init);
      const id = setTimeout(() => firstRef.current?.focus(), 0);
      const onKey = (e) => { if (e.key === "Escape") onCancel(); };
      document.addEventListener("keydown", onKey);
      return () => { clearTimeout(id); document.removeEventListener("keydown", onKey); };
    }
  }, [open]);

  if (!open) return null;

  const set = (k, v) => setVals((s) => ({ ...s, [k]: v }));
  const missing = (fields || []).some((f) => f.required && !String(vals[f.key] ?? "").trim());
  const submit = () => { if (!missing) onConfirm(fields ? vals : undefined); };

  const PALETTE = ["#00b5a6", "#6b8cff", "#e8841e", "#AA50FF", "#1faf6b", "#ef5350"];

  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, background: "rgba(27,36,64,.38)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 420, maxWidth: "92vw", maxHeight: "86vh", overflowY: "auto",
          background: "var(--card)", borderRadius: 20, padding: "24px 24px 20px",
          boxShadow: "0 30px 80px rgba(27,36,64,.32)", animation: "popIn .16s ease",
        }}
      >
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--navy)", letterSpacing: "-.01em" }}>
          {title}
        </h3>
        {message && (
          <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "var(--text)", lineHeight: 1.5 }}>{message}</p>
        )}

        {(fields || []).map((f, i) => (
          <div key={f.key} style={{ marginTop: i === 0 ? 18 : 14 }}>
            <label style={labelStyle}>
              {f.label}{f.required && <span style={{ color: "var(--blue)" }}> *</span>}
            </label>

            {f.type === "textarea" && (
              <textarea
                ref={i === 0 ? firstRef : null}
                value={vals[f.key] ?? ""}
                onChange={(e) => set(f.key, e.target.value)}
                placeholder={f.placeholder || ""}
                rows={3}
                style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--blue)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "var(--line2)"; }}
              />
            )}

            {f.type === "select" && (
              <select
                value={vals[f.key] ?? ""}
                onChange={(e) => set(f.key, e.target.value)}
                style={{ ...inputStyle, cursor: "pointer", appearance: "auto" }}
              >
                {(f.options || []).map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            )}

            {f.type === "color" && (
              <div style={{ display: "flex", gap: 8 }}>
                {PALETTE.map((c) => {
                  const on = (vals[f.key] || PALETTE[0]) === c;
                  return (
                    <span
                      key={c}
                      onClick={() => set(f.key, c)}
                      title={c}
                      style={{
                        width: 26, height: 26, borderRadius: 8, background: c, cursor: "pointer",
                        boxShadow: on ? "0 0 0 3px #fff, 0 0 0 5px " + c : "none",
                        transition: "box-shadow .1s",
                      }}
                    />
                  );
                })}
              </div>
            )}

            {(!f.type || f.type === "text") && (
              <input
                ref={i === 0 ? firstRef : null}
                value={vals[f.key] ?? ""}
                onChange={(e) => set(f.key, e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") onCancel(); }}
                placeholder={f.placeholder || ""}
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--blue)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "var(--line2)"; }}
              />
            )}
          </div>
        ))}

        {error && (
          <p style={{ margin: "12px 0 0", fontSize: 12.5, color: "var(--red)" }}>{error}</p>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 22 }}>
          <button onClick={onCancel} style={{ ...btn, background: "var(--main)", color: "var(--text)" }}>
            {cancelLabel}
          </button>
          <button
            onClick={submit}
            disabled={missing}
            style={{
              ...btn, color: "#fff",
              background: danger ? "var(--red)" : "var(--blue)",
              boxShadow: danger ? "none" : "0 10px 22px rgba(0,181,166,.30)",
              opacity: missing ? 0.5 : 1, cursor: missing ? "not-allowed" : "pointer",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
