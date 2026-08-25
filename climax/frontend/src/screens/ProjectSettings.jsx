import { useEffect, useState } from "react";
import { useProjects } from "../ProjectContext";
import AccessControl from "./AccessControl";
import ResourceSharing from "./ResourceSharing";

export default function ProjectSettings({ lang, go, nav }) {
  const { projects, activeId, active, switchTo, refresh } = useProjects();
  const [tab, setTab] = useState(nav?.tab === "access" ? "access" : "resources");

  useEffect(() => {
    if (nav?.tab === "access" || nav?.tab === "resources") setTab(nav.tab);
  }, [nav?.tab]);

  const tabBtn = (id, label) => (
    <button type="button" onClick={() => setTab(id)} aria-pressed={tab === id} style={{
      border: "none", cursor: "pointer", padding: "8px 16px", borderRadius: 10,
      fontSize: 13, fontWeight: 700, fontFamily: "var(--sans)",
      background: tab === id ? "var(--blue)" : "var(--card)",
      color: tab === id ? "#fff" : "var(--muted)",
      boxShadow: tab === id ? "0 8px 18px rgba(0,181,166,.25)" : "none",
    }}>{label}</button>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {tabBtn("resources", lang === "ko" ? "리소스 공유" : "Resources")}
        {tabBtn("access", lang === "ko" ? "접근 권한" : "Access Control")}
      </div>
      {tab === "resources" && (
        <ResourceSharing
          lang={lang}
          activeId={activeId}
          active={active}
          projects={projects}
          switchTo={switchTo}
          refresh={refresh}
          go={go}
          nav={nav}
        />
      )}
      {tab === "access" && <AccessControl />}
    </div>
  );
}
