export default function ChunkLoadingSpinner({ overlay = false, label = "청크 불러오는 중" }) {
  return (
    <div
      className={`rag-chunk-loading${overlay ? " overlay" : ""}`}
      role="status"
      aria-label={label}
    >
      <span />
    </div>
  );
}
