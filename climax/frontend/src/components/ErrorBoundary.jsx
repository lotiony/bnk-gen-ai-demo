import React from "react";

/* 앱 전역 안전망 — 렌더 중 예외가 나도 트리 전체가 언마운트(검정 freeze)되지 않도록
   복구 가능한 폴백 UI를 보여준다. React 표준 ErrorBoundary(클래스 컴포넌트만 지원). */
export default class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // 콘솔에 스택 남겨 원인 파악을 돕는다(운영에선 로깅 수집기로 대체 가능).
    console.error("[ErrorBoundary]", error, info?.componentStack);
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div style={styles.wrap}>
        <div style={styles.card}>
          <div style={styles.badge}>!</div>
          <h1 style={styles.title}>화면을 표시하지 못했습니다</h1>
          <p style={styles.desc}>일시적인 오류가 발생했습니다. 아래 버튼으로 다시 시도하거나 새로고침 해주세요.</p>
          <pre style={styles.err}>{String(error?.message || error)}</pre>
          <div style={styles.row}>
            <button style={styles.primary} onClick={() => window.location.reload()}>새로고침</button>
            <button style={styles.ghost} onClick={this.handleReset}>다시 시도</button>
          </div>
        </div>
      </div>
    );
  }
}

const styles = {
  wrap: { position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
    background: "var(--lav)", padding: 24, fontFamily: "var(--sans)", zIndex: 9999 },
  card: { maxWidth: 460, width: "100%", background: "var(--card)", border: "1px solid var(--line2)",
    borderRadius: 16, padding: "28px 26px", textAlign: "center", boxShadow: "0 20px 50px rgba(0,0,0,.3)" },
  badge: { width: 44, height: 44, borderRadius: 12, margin: "0 auto 14px", display: "flex", alignItems: "center",
    justifyContent: "center", background: "var(--red-bg)", color: "var(--red)", fontSize: 24, fontWeight: 800 },
  title: { margin: 0, fontSize: 18, fontWeight: 800, color: "var(--navy)", letterSpacing: "-.01em" },
  desc: { margin: "8px 0 14px", fontSize: 13, color: "var(--muted)", lineHeight: 1.6 },
  err: { fontFamily: "var(--mono)", fontSize: 11, color: "var(--code-text)", background: "var(--code)",
    borderRadius: 8, padding: "10px 12px", textAlign: "left", whiteSpace: "pre-wrap", wordBreak: "break-word",
    maxHeight: 120, overflow: "auto", margin: "0 0 16px" },
  row: { display: "flex", gap: 8, justifyContent: "center" },
  primary: { border: "none", borderRadius: 10, padding: "10px 18px", background: "var(--blue)", color: "#fff",
    fontWeight: 700, fontSize: 13, fontFamily: "var(--sans)", cursor: "pointer" },
  ghost: { border: "1px solid var(--line2)", borderRadius: 10, padding: "10px 18px", background: "var(--card)",
    color: "var(--navy)", fontWeight: 700, fontSize: 13, fontFamily: "var(--sans)", cursor: "pointer" },
};
