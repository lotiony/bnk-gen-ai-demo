import { useEffect, useState } from "react";
import { api } from "../api";
import { azureConfigured, azureLogin } from "../lib/azureAuth";

// Azure Entra ID SSO 로그인 + 접근 허가(화이트리스트) 게이트.
// - 인증: Entra 가 '회사 계정인지'만 확인. (데모 모드에선 이메일 입력으로 대체)
// - 허가: 관리자가 등록한 allowed_members 에 있어야 진입. 없으면 접근 거부 화면.
// 운영: 기존 Azure PKCE/MSAL seam에서 id_token을 받아 서버 검증 후 HttpOnly session으로 전환.
// 데모(기본): 이메일을 login({email})로 보냄 — 백엔드가 화이트리스트만 검사.
export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState("");     // 접근 거부된 이메일
  const [ok, setOk] = useState(null);           // {email, admin} 로그인 성공 연출 중
  const [err, setErr] = useState("");
  const [authMode, setAuthMode] = useState(null);
  // 화이트라벨 브랜드/테마 — App 과 동일 localStorage 키 미러 (읽기만)
  const brand = localStorage.getItem("ember_brand") || "ember";
  const theme = localStorage.getItem("ember_theme") || "dark";

  useEffect(() => {
    let active = true;
    api.authConfig()
      .then((mode) => {
        if (!active) return;
        if (mode === "entra" && !azureConfigured()) {
          setErr("서버는 Entra 로그인을 요구하지만 Azure App Registration이 설정되지 않았습니다.");
          setAuthMode("error");
          return;
        }
        setAuthMode(mode);
      })
      .catch((error) => {
        if (active) {
          setErr(error.message);
          setAuthMode("error");
        }
      });
    return () => { active = false; };
  }, []);

  const finish = (res) => {
    localStorage.setItem("ember_email", res.email);
    localStorage.setItem("ember_user", res.email);
    localStorage.setItem("ember_role", res.role);
    localStorage.setItem("ember_role_admin", res.is_admin ? "1" : "");
    // 바로 진입하면 끊기는 느낌 → 성공 오버레이 잠깐 보여주고 진입 (연출).
    setOk({ email: res.email, admin: res.is_admin });
    setTimeout(onLogin, 1300);
  };

  const signIn = async (e) => {
    e?.preventDefault();
    setErr(""); setDenied(""); setBusy(true);
    try {
      let res;
      if (authMode === "entra") {
        const identity = await azureLogin();
        res = await api.login({ id_token: identity.idToken });
      } else if (authMode === "demo") {
        if (!email.trim()) { setErr("이메일을 입력하세요."); return; }
        res = await api.login({ email: email.trim() });
      } else {
        throw new Error("서버 인증 모드를 확인하는 중입니다.");
      }
      finish(res);
    } catch (e2) {
      if (String(e2.message).includes("접근 권한이 없습니다") || String(e2.message).includes("승인"))
        setDenied(email.trim() || "이 계정");
      else setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  const field = {
    width: "100%", boxSizing: "border-box", padding: "11px 13px", borderRadius: 11,
    border: "1px solid var(--line2)", background: "var(--card)", color: "var(--navy)",
    fontSize: 13.5, fontFamily: "var(--sans)",
  };

  // 중앙 로고 락업 — dev 의 공식 EmberLink SVG(테마별 CSS 토글) / KT 워드마크.
  const Brand = () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 11, marginBottom: 22 }}>
      {brand === "kt" ? (
        <>
          <img className="kt-wordmark" alt="KT"
               src={theme === "dark" ? "/kt-wordmark-white.png" : "/kt-wordmark-standard.png"}
               style={{ height: 28, width: "auto", display: "block" }} />
          <div style={{ width: 1.5, height: 30, background: "var(--line2)", borderRadius: 2 }} />
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-.02em", color: "var(--navy)" }}>Ontology Platform</div>
        </>
      ) : (
        <>
          <img className="ember-logo-light" src="/ember-logo-light.svg" alt="Ember Link" style={{ height: 42, width: "auto" }} />
          <img className="ember-logo-dark" src="/ember-logo-dark.svg" alt="Ember Link" style={{ height: 42, width: "auto" }} />
        </>
      )}
    </div>
  );

  const shell = {
    minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    background: "radial-gradient(1100px 560px at 50% -12%, rgba(254,46,54,.12), transparent 55%), var(--lav)",
  };
  const cardS = {
    width: 372, background: "var(--app)", borderRadius: 26, padding: "38px 34px 32px",
    boxShadow: "0 30px 80px rgba(20,24,54,.30)", border: "1px solid var(--line)",
    position: "relative", overflow: "hidden",
  };
  const topAccent = <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "#FE2E36" }} />;

  // ── 로그인 성공 연출 ──
  if (ok) {
    return (
      <div style={shell}>
        <style>{`
          @keyframes ember-pop{0%{transform:scale(.4);opacity:0}60%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}
          @keyframes ember-draw{to{stroke-dashoffset:0}}
          @keyframes ember-spin{to{transform:rotate(360deg)}}
          @keyframes ember-fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        `}</style>
        <div style={{ ...cardS, textAlign: "center", animation: "ember-fade .25s ease" }}>
          {topAccent}
          <div style={{ width: 66, height: 66, borderRadius: "50%", background: "#e6f6ee", margin: "0 auto 16px",
            display: "flex", alignItems: "center", justifyContent: "center", animation: "ember-pop .45s cubic-bezier(.2,.7,.3,1)" }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#1f9d6b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" style={{ strokeDasharray: 24, strokeDashoffset: 24, animation: "ember-draw .4s .2s ease forwards" }} />
            </svg>
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, color: "var(--navy)" }}>로그인 성공</div>
          <p style={{ margin: "8px 0 20px", fontSize: 12.5, color: "var(--muted)" }}>
            <b style={{ color: "var(--text)" }}>{ok.email}</b>
            <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 800, color: ok.admin ? "#7a4fd6" : "var(--blue)" }}>{ok.admin ? "관리자" : "편집자"}</span>
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, fontSize: 12.5, color: "var(--muted)" }}>
            <span style={{ width: 16, height: 16, border: "2.5px solid var(--line2)", borderTopColor: "var(--blue)", borderRadius: "50%", display: "inline-block", animation: "ember-spin .7s linear infinite" }} />
            플랫폼으로 이동 중…
          </div>
        </div>
      </div>
    );
  }

  // ── 접근 거부 화면 ──
  if (denied) {
    return (
      <div style={shell}>
        <div style={{ ...cardS, textAlign: "center" }}>
          {topAccent}
          <div style={{ width: 54, height: 54, borderRadius: "50%", background: "var(--red-bg,#fde9ec)", color: "#e0455e",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 27, fontWeight: 800, margin: "0 auto 14px" }}>!</div>
          <div style={{ fontSize: 16.5, fontWeight: 800, color: "var(--navy)" }}>접근 권한이 없습니다</div>
          <p style={{ margin: "10px 0 20px", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6 }}>
            <b style={{ color: "var(--text)" }}>{denied}</b> 계정은 아직 승인되지 않았습니다.<br />
            관리자(won-tae.kim@kt.com)에게 접근을 요청하세요.
          </p>
          <button onClick={() => { setDenied(""); setEmail(""); }} style={{
            width: "100%", padding: "12px", borderRadius: 12, border: "1px solid var(--line2)", cursor: "pointer",
            background: "var(--main)", color: "var(--text)", fontSize: 13.5, fontWeight: 700, fontFamily: "var(--sans)" }}>
            다른 계정으로 로그인
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={shell}>
      <form onSubmit={signIn} style={cardS}>
        {topAccent}
        <Brand />

        {authMode === "demo" && (
          <>
            <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>회사 이메일</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@kt.com" type="email"
              style={{ ...field, margin: "6px 0 16px" }} autoFocus />
          </>
        )}

        {err && <p style={{ margin: "0 0 12px", fontSize: 12, color: "#e0455e" }}>{err}</p>}

        <button type="submit" disabled={busy || !["demo", "entra"].includes(authMode)} style={{
          width: "100%", padding: "12px", borderRadius: 12, border: "1px solid var(--line2)", cursor: busy ? "wait" : "pointer",
          background: "var(--card)", color: "var(--navy)", fontSize: 14, fontWeight: 700, fontFamily: "var(--sans)",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <span style={{ width: 17, height: 17, display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 2 }}>
            <i style={{ background: "#f25022" }} /><i style={{ background: "#7fba00" }} />
            <i style={{ background: "#00a4ef" }} /><i style={{ background: "#ffb900" }} />
          </span>
          {busy ? "확인 중…" : authMode === "demo" ? "이메일로 로그인" : authMode === "entra" ? "Azure로 로그인" : "인증 설정 확인 중…"}
        </button>

        <p style={{ margin: "14px 2px 0", fontSize: 11, color: "var(--faint)", lineHeight: 1.55 }}>
          {authMode === "demo"
            ? "로컬 데모 로그인입니다. 접근 권한은 서버가 확인합니다."
            : "회사 Entra ID 계정으로 인증합니다. 접근 권한이 없는 계정은 관리자 승인 후 이용할 수 있어요."}
        </p>
      </form>
    </div>
  );
}
