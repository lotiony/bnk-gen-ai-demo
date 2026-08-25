import React from "react";

// 답변 마크다운 렌더러 — 의존성 없이 필요한 문법만 지원한다(LLM 답변이 쓰는 범위: 제목·목록·표·
// 인용·코드·강조·링크). dangerouslySetInnerHTML 을 쓰지 않고 React 엘리먼트로만 만들기 때문에
// 모델이 무엇을 뱉든 HTML 주입이 되지 않는다.

// ── 인라인 ── `code` > **bold** > *italic* > [text](url) 순으로 자른다(코드 안은 더 안 쪼갬)
const INLINE = /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(\*[^*\n]+\*|_[^_\n]+_)|(\[[^\]\n]+\]\([^)\s]+\))|(\[\d+\])/g;

function inline(text, key = "i", renderReference, renderText) {
  const out = [];
  let last = 0, m, n = 0;
  const plain = (value, offset, suffix = "text") => renderText?.({ text: value, source: text, offset, key: `${key}-${suffix}` }) ?? value;
  INLINE.lastIndex = 0;
  while ((m = INLINE.exec(text)) !== null) {
    if (m.index > last) out.push(plain(text.slice(last, m.index), last, `text-${n}`));
    const t = m[0];
    const k = `${key}-${n++}`;
    if (m[1]) {
      out.push(<code key={k} style={{ fontFamily: "var(--mono, monospace)", fontSize: "0.92em", background: "var(--md-code-bg)", borderRadius: 4, padding: "1px 5px" }}>{t.slice(1, -1)}</code>);
    } else if (m[2]) {
      out.push(<strong key={k} style={{ fontWeight: 800 }}>{plain(t.slice(2, -2), m.index + 2, `bold-${n}`)}</strong>);
    } else if (m[3]) {
      out.push(<em key={k}>{plain(t.slice(1, -1), m.index + 1, `italic-${n}`)}</em>);
    } else if (m[4]) {
      const cut = t.indexOf("](");
      const label = t.slice(1, cut), href = t.slice(cut + 2, -1);
      out.push(<a key={k} href={href} target="_blank" rel="noreferrer" style={{ color: "var(--ans-title)", textDecoration: "underline" }}>{label}</a>);
    } else {
      out.push(<React.Fragment key={k}>{renderReference?.({ number: t.slice(1, -1), source: text, offset: m.index }) ?? t}</React.Fragment>);
    }
    last = m.index + t.length;
  }
  if (last < text.length) out.push(plain(text.slice(last), last, `text-${n}`));
  return out;
}

const isTableSep = (s) => /^\s*\|?[\s:-]*-[\s|:-]*\|?\s*$/.test(s) && s.includes("-");
const cells = (row) => row.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());

export default function Markdown({ text, style, renderReference, renderText }) {
  const src = String(text ?? "");
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let i = 0, k = 0;

  const P = { margin: "0 0 8px", lineHeight: 1.7 };
  const LIST = { margin: "0 0 8px", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 3 };
  const renderInline = (value, key) => inline(value, key, renderReference, renderText);

  while (i < lines.length) {
    const ln = lines[i];

    if (!ln.trim()) { i++; continue; }

    if (/^```/.test(ln)) {                                   // 코드 블록
      const body = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++]);
      i++;
      blocks.push(
        <pre key={k++} style={{ margin: "0 0 10px", padding: "10px 12px", background: "var(--md-code-bg)", borderRadius: 8, overflowX: "auto", fontSize: "0.9em", lineHeight: 1.5 }}>
          <code style={{ fontFamily: "var(--mono, monospace)" }}>{body.join("\n")}</code>
        </pre>);
      continue;
    }

    const h = /^(#{1,6})\s+(.*)$/.exec(ln);                   // 제목
    if (h) {
      const lvl = h[1].length;
      const size = [17, 15.5, 14.5, 14, 13.5, 13][lvl - 1];
      blocks.push(<div key={k++} style={{ fontSize: size, fontWeight: 800, margin: blocks.length ? "10px 0 6px" : "0 0 6px" }}>{renderInline(h[2], `h${k}`)}</div>);
      i++;
      continue;
    }

    if (/^\s*([-*_])\s*\1\s*\1[-*_\s]*$/.test(ln)) {          // 구분선
      blocks.push(<hr key={k++} style={{ border: "none", borderTop: "1px solid var(--md-line)", margin: "10px 0" }} />);
      i++;
      continue;
    }

    if (/^\s*\|.*\|\s*$/.test(ln) && isTableSep(lines[i + 1] || "")) {   // 표(GFM)
      const head = cells(ln);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(cells(lines[i++]));
      const td = { padding: "6px 10px", borderBottom: "1px solid var(--md-line)", textAlign: "left", verticalAlign: "top" };
      blocks.push(
        <div key={k++} style={{ overflowX: "auto", margin: "0 0 10px" }}>
          <table style={{ borderCollapse: "collapse", fontSize: "0.95em", minWidth: "100%" }}>
            <thead><tr>{head.map((c, x) => <th key={x} style={{ ...td, fontWeight: 800, borderBottom: "1.5px solid var(--md-line-strong)", whiteSpace: "nowrap" }}>{renderInline(c, `th${k}-${x}`)}</th>)}</tr></thead>
            <tbody>{rows.map((r, y) => <tr key={y}>{head.map((_, x) => <td key={x} style={td}>{renderInline(r[x] || "", `td${k}-${y}-${x}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>);
      continue;
    }

    if (/^\s*>\s?/.test(ln)) {                               // 인용
      const body = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) body.push(lines[i++].replace(/^\s*>\s?/, ""));
      blocks.push(
        <div key={k++} style={{ borderLeft: "3px solid var(--md-line-strong)", padding: "2px 0 2px 12px", margin: "0 0 10px", opacity: 0.9 }}>
          {renderInline(body.join(" "), `q${k}`)}
        </div>);
      continue;
    }

    const bullet = /^\s*[-*+]\s+/, numbered = /^\s*\d+[.)]\s+/;
    if (bullet.test(ln) || numbered.test(ln)) {              // 목록(중첩은 들여쓰기 여백으로만)
      const ordered = numbered.test(ln) && !bullet.test(ln);
      const items = [];
      while (i < lines.length && (bullet.test(lines[i]) || numbered.test(lines[i]))) {
        const raw = lines[i];
        const indent = (raw.match(/^\s*/) || [""])[0].length;
        items.push({ text: raw.replace(bullet, "").replace(numbered, ""), pad: Math.min(3, Math.floor(indent / 2)) });
        i++;
      }
      const Tag = ordered ? "ol" : "ul";
      blocks.push(
        <Tag key={k++} style={LIST}>
          {items.map((it, x) => <li key={x} style={{ marginLeft: it.pad * 14, lineHeight: 1.65 }}>{renderInline(it.text, `li${k}-${x}`)}</li>)}
        </Tag>);
      continue;
    }

    const body = [];                                          // 문단 — 빈 줄까지 이어 붙인다
    while (i < lines.length && lines[i].trim()
           && !/^```/.test(lines[i]) && !/^(#{1,6})\s/.test(lines[i])
           && !bullet.test(lines[i]) && !numbered.test(lines[i]) && !/^\s*>\s?/.test(lines[i])
           && !(/^\s*\|.*\|\s*$/.test(lines[i]) && isTableSep(lines[i + 1] || ""))) {
      body.push(lines[i++]);
    }
    blocks.push(
      <p key={k++} style={P}>
        {body.map((b, x) => <React.Fragment key={x}>{x > 0 && <br />}{renderInline(b, `p${k}-${x}`)}</React.Fragment>)}
      </p>);
  }

  return <div style={{ ...style }}>{blocks}</div>;
}
