/**
 * AuthPicker — 업스트림 인증 선택 + 필드 입력 컴포넌트
 *
 * Props:
 *   value    {type, ...fields}  — 현재 auth 상태 (controlled)
 *   onChange (next) => void     — 새 auth 객체로 교체
 *   lab      style object       — label 스타일 (호출자 모듈에서 주입)
 *   inp      style object       — input/select 스타일 (호출자 모듈에서 주입)
 *
 * 지원 타입:
 *   none       — 인증 없음
 *   api_key    — { header, value }
 *   oauth2_cc  — { token_url, client_id, client_secret }
 *   session    — { login_url, user_field, pw_field, user, password }
 *   bearer     — { token }
 */
export default function AuthPicker({ value, onChange, lab, inp }) {
  return (
    <>
      {/* 업스트림 인증 */}
      <label className="mono" style={{ ...lab, marginTop: 16 }}>업스트림 인증</label>
      <select
        value={value.type}
        onChange={(e) => onChange({ type: e.target.value })}
        style={inp}
      >
        <option value="none">없음</option>
        <option value="api_key">API Key</option>
        <option value="oauth2_cc">OAuth2 client credentials</option>
        <option value="session">세션 로그인</option>
        <option value="bearer">Bearer 토큰</option>
      </select>

      {value.type === "api_key" && (
        <>
          <input
            value={value.header || ""}
            onChange={(e) => onChange({ ...value, header: e.target.value })}
            placeholder="헤더명 (예: X-API-KEY)"
            style={{ ...inp, marginTop: 8 }}
          />
          <input
            value={value.value || ""}
            onChange={(e) => onChange({ ...value, value: e.target.value })}
            placeholder="키 값 또는 ${env:PLCY_API_KEY}"
            style={{ ...inp, marginTop: 8 }}
          />
        </>
      )}

      {value.type === "oauth2_cc" && (
        <>
          <input
            value={value.token_url || ""}
            onChange={(e) => onChange({ ...value, token_url: e.target.value })}
            placeholder="Token URL (예: https://auth.example.com/token)"
            style={{ ...inp, marginTop: 8 }}
          />
          <input
            value={value.client_id || ""}
            onChange={(e) => onChange({ ...value, client_id: e.target.value })}
            placeholder="Client ID"
            style={{ ...inp, marginTop: 8 }}
          />
          <input
            value={value.client_secret || ""}
            onChange={(e) => onChange({ ...value, client_secret: e.target.value })}
            placeholder="Client Secret 또는 ${env:OAUTH2_CLIENT_SECRET}"
            style={{ ...inp, marginTop: 8 }}
          />
        </>
      )}

      {value.type === "session" && (
        <>
          <input
            value={value.login_url || ""}
            onChange={(e) => onChange({ ...value, login_url: e.target.value })}
            placeholder="로그인 URL (예: https://api.example.com/login)"
            style={{ ...inp, marginTop: 8 }}
          />
          <input
            value={value.user_field || ""}
            onChange={(e) => onChange({ ...value, user_field: e.target.value })}
            placeholder="사용자 필드명 (예: userId)"
            style={{ ...inp, marginTop: 8 }}
          />
          <input
            value={value.pw_field || ""}
            onChange={(e) => onChange({ ...value, pw_field: e.target.value })}
            placeholder="비밀번호 필드명 (예: userPw)"
            style={{ ...inp, marginTop: 8 }}
          />
          <input
            value={value.user || ""}
            onChange={(e) => onChange({ ...value, user: e.target.value })}
            placeholder="사용자 ID 또는 ${env:LOGIN_USER}"
            style={{ ...inp, marginTop: 8 }}
          />
          <input
            value={value.password || ""}
            onChange={(e) => onChange({ ...value, password: e.target.value })}
            placeholder="비밀번호 또는 ${env:LOGIN_PASSWORD}"
            style={{ ...inp, marginTop: 8 }}
          />
        </>
      )}

      {value.type === "bearer" && (
        <input
          value={value.token || ""}
          onChange={(e) => onChange({ ...value, token: e.target.value })}
          placeholder="토큰 또는 ${env:API_BEARER_TOKEN}"
          style={{ ...inp, marginTop: 8 }}
        />
      )}
    </>
  );
}
