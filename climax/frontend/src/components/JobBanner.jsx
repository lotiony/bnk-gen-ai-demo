// 백그라운드 잡 시작 안내 배너 — 구조 점검과 동일한 스타일(보라, ✕ 닫기).
// 진행 상세는 상단 '작업' 아이콘에서 확인하는 것이 전제라 여기선 안내만 한다.
export default function JobBanner({ msg, onClose }) {
  if (!msg) return null;
  const err = msg.err;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, padding: "11px 16px", background: err ? "#fde8e8" : "#efe8fb", border: `1px solid ${err ? "#d64545" : "#7a3fb0"}`, borderRadius: 12, fontSize: 13, color: err ? "#d64545" : "#5a2f85", fontWeight: 600 }}>
      {msg.text}
      <span style={{ flex: 1 }} />
      <button onClick={onClose} style={{ border: "none", background: "transparent", color: "inherit", cursor: "pointer", fontWeight: 700 }}>✕</button>
    </div>
  );
}
