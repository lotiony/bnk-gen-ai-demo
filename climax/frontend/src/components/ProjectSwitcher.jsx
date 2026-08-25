import { useState, useEffect, useRef } from "react";
import { useProjects } from "../ProjectContext";

/** 상태 점 — 활성=초록, 비활성=회색 */
function Dot({ active }) {
  return (
    <span style={{
      width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
      background: active ? "var(--green)" : "var(--faint)",
      boxShadow: active ? "0 0 0 3px var(--green-bg)" : "none",
    }} />
  );
}

export default function ProjectSwitcher({ t, go }) {
  const { projects, active, switchTo } = useProjects();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // 열렸을 때만 전역 리스너 등록 — 바깥 클릭/Esc 로 닫기
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);
  const handleSwitch = (id) => { switchTo(id); close(); };
  const handleManage = () => { if (go) go("projects"); close(); };

  // 로딩 중 placeholder
  if (!active) {
    return (
      <div style={{ margin: "0 14px 8px" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 9, padding: "10px 12px",
          borderRadius: 13, background: "var(--main)", border: "1px solid var(--line2)",
          opacity: 0.5,
        }}>
          <Dot active={false} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>로딩 중…</span>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} style={{ margin: "0 14px 8px", position: "relative" }}>
      {/* 트리거 — 한 줄: 점 + 이름 + 셰브론 */}
      <div
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 9, padding: "10px 12px",
          borderRadius: 13, background: "var(--main)",
          // 사이드바(흰색)와 분리되게 회색 채움 + 가시 테두리 + 미세 그림자, 열렸을 땐 파란 강조
          border: "1px solid " + (open ? "var(--blue)" : "var(--faint)"),
          boxShadow: open ? "0 0 0 3px var(--blue-soft)" : "0 1px 3px rgba(54,64,120,.12)",
          cursor: "pointer", userSelect: "none", transition: "border-color .15s, box-shadow .15s",
        }}
      >
        <Dot active />
        <span style={{
          flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, color: "var(--navy)",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {active.name}
        </span>
        <svg
          width={16} height={16} viewBox="0 0 24 24" fill="none"
          stroke="var(--muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .15s" }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>

      {/* 드롭다운 */}
      {open && (
        <div style={{
          position: "absolute", top: 52, left: 0, right: 0,
          background: "var(--card)", border: "1px solid var(--line2)", borderRadius: 14,
          boxShadow: "0 16px 40px rgba(54,64,120,.18)", padding: 6, zIndex: 20,
        }}>
          {projects.map((p) => {
            const isActive = p.id === active.id;
            return (
              <div
                key={p.id}
                onClick={() => handleSwitch(p.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 9,
                  padding: "9px 10px", borderRadius: 10, cursor: "pointer",
                  fontSize: 13, fontWeight: isActive ? 700 : 600,
                  color: isActive ? "var(--navy)" : "var(--text)",
                  background: isActive ? "var(--blue-soft)" : "transparent",
                }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "var(--main)"; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
              >
                <Dot active={isActive} />
                <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {p.name}
                </span>
              </div>
            );
          })}

          <div style={{ height: 1, background: "var(--line)", margin: "6px 4px" }} />

          {/* 새 프로젝트 — 온보딩 모달로 연결해야 소스 등록 포함 전체 흐름 사용 가능 */}
          <div
            onClick={() => { go("onboarding"); close(); }}
            style={{
              display: "flex", alignItems: "center", gap: 9,
              padding: "9px 10px", borderRadius: 10, cursor: "pointer",
              fontSize: 13, fontWeight: 700, color: "var(--blue)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--main)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            ＋ {t.newProject}
          </div>

          {/* 전체 관리 — 프로젝트 허브(projects 화면)로 이동 */}
          <div
            onClick={handleManage}
            style={{
              display: "flex", alignItems: "center", gap: 9,
              padding: "9px 10px", borderRadius: 10, cursor: "pointer",
              fontSize: 13, fontWeight: 600, color: "var(--muted)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--main)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            {t.manageProjects}
          </div>
        </div>
      )}
    </div>
  );
}
