/**
 * 덱 안에서 도는 자동 시연.
 *
 * 발표 PC 가 내 것이 아닐 수 있다. Node·Playwright 를 깔 수 없는 자리에서도 시연은
 * 돌아야 한다. 덱과 앱은 같은 오리진이라(그래서 덱이 frontend/public 아래 있다)
 * 덱의 스크립트가 iframe 안 앱의 DOM 을 그대로 만질 수 있다 — 브라우저로 덱 주소만
 * 열면 설치 없이 자동 시연이 된다.
 *
 * 조작은 사람 손처럼 한다. 커서를 목표까지 옮기고, 뜸을 들이고, 한 글자씩 친다.
 * 청중이 눈으로 따라올 수 없으면 시연이 아니다.
 *
 * 무대 규칙
 *   · 발표자가 넘기면 진행 중이던 조작은 다음 동작에서 멈춘다
 *   · 같은 화면에 머물러도 두 번 돌지 않는다
 *   · 실패해도 조용히 멈춘다 — 덱 진행은 그대로다
 *   · 로그인을 대신하지 않는다(로컬 개방 모드의 이메일 한 줄만 넘겨준다)
 *
 * 끄고 켜기:  주소에 ?auto=0  ·  발표 중 D 키
 * 콘솔에서:   __autoDemo.run(3) / .stop() / .off()
 */
(() => {
  'use strict';

  // 시연 값. 발표 PC 에서 파일을 못 고치므로 주소로도 바꿀 수 있게 한다.
  //   ?project=…&scope=project-&db=legacy-&email=…
  const QS = new URLSearchParams(location.search);
  const CFG = {
    project: QS.get('project') || 'H사 A프로젝트',
    doc: QS.get('doc') || '개인용공동물건_자동차보험.pdf',   // 문서 폴더에서 담을 약관
    pipeline: QS.get('pipeline') || 'terms-graphrag',        // 그 문서의 활용 경로
    // 3~5단계를 관통하는 하나의 업무. 이 문장에서 스킬이 나오고, 그 스킬을 에이전트가 쓴다.
    intent: QS.get('intent')
      || '직업명을 넣으면 그 직업의 가입한도가 나오게 하려면?',
    skillName: QS.get('skill') || '자동차보험 갱신 안내 초안',
    skillSlug: QS.get('slug') || 'renewal-guide',
    ask: QS.get('ask') || '다음 달 만기 계약 갱신 안내 정리해줘',
    // 2단계에서 플레이그라운드에 던질 약관 질문
    ragAsk: QS.get('ragAsk') || '대인배상 I과 II는 뭐가 다른가요? 둘 다 필요한가요?',
    // 2단계는 미리 만들어 둔 베스트 프랙티스 프로젝트로 옮기고 끝낸다(설명은 발표자가)
    ragProject: QS.get('rag') || 'H사 E프로젝트',
    // 4단계에서 스킬로 엮을 도구 — 계약 조회 → 사고이력 조회 → 갱신 보험료 계산
    tools: (QS.get('tools') || 'db_ctrt_mst_list,db_acdnt_hist_list,calcPremium').split(','),
    // 탐색 범위를 좁히는 규칙 — 시연에 쓸 것만 남기고 나머지는 끈다
    scopePat: QS.get('scope') || 'project-',    // 클라우드 범위(구독·리소스그룹) 이름
    keepPat: QS.get('keep') || '-legacy-',      // 탐색 결과에서 이 이름만 담는다
    pdf: QS.get('pdf') || '/pdf/readycar-page137.pdf',
    email: QS.get('email') || 'demo@kt.com',
  };

  const frameEl = () => document.getElementById('demoFrame');
  const win = () => frameEl() && frameEl().contentWindow;
  const doc = () => { try { return frameEl().contentDocument; } catch (e) { return null; } };

  /* ── 취소 ─────────────────────────────────────────────────────────
     발표자가 다음으로 넘기면 진행 중이던 시나리오는 다음 동작에서 스스로 멈춘다. */
  class Stop extends Error {}
  let token = { dead: true };
  const kill = () => { token.dead = true; };

  /* ── 커서 ─────────────────────────────────────────────────────────
     iframe 안이 아니라 덱 위에 그린다. 앱이 화면을 갈아엎어도 커서는 살아있다.
     iframe 이 시연 영역을 1:1 로 채우므로 좌표는 iframe 기준 + 영역 위치. */
  let cur, curX = 60, curY = 60;
  function ensureCursor() {
    if (cur && cur.isConnected) return cur;
    const st = document.createElement('style');
    st.textContent = `
      .ad-cursor{position:fixed;left:0;top:0;z-index:60;pointer-events:none;
        transform:translate(-200px,-200px);filter:drop-shadow(0 3px 6px rgba(0,0,0,.4));}
      .ad-cursor .ring{position:absolute;left:0;top:0;width:14px;height:14px;margin:-7px 0 0 -7px;
        border-radius:50%;border:2px solid #00b5a6;opacity:0;}
      .ad-cursor.down .ring{animation:adRipple .45s ease-out;}
      .ad-cursor.down svg{transform:scale(.86);}
      @keyframes adRipple{0%{opacity:.85;transform:scale(.4)}100%{opacity:0;transform:scale(3.6)}}
      .ad-badge{position:fixed;left:18px;bottom:16px;z-index:61;font:600 11px/1 var(--sans,sans-serif);
        letter-spacing:.06em;color:#0d9488;background:rgba(13,148,136,.10);border:1px solid rgba(13,148,136,.35);
        padding:6px 10px;border-radius:999px;opacity:0;transition:opacity .25s;}
      .ad-badge.on{opacity:1;}`;
    document.head.appendChild(st);
    cur = document.createElement('div');
    cur.className = 'ad-cursor';
    cur.innerHTML = '<span class="ring"></span>'
      + '<svg width="26" height="30" viewBox="0 0 26 30">'
      + '<path d="M4 2 L4 23 L9.6 17.8 L13.2 26.4 L17 24.8 L13.4 16.4 L21 16.2 Z" '
      + 'fill="#141c3c" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/></svg>';
    document.body.appendChild(cur);
    return cur;
  }
  const putCursor = (x, y) => {
    curX = x; curY = y;
    ensureCursor().style.transform = `translate(${x}px,${y}px)`;
  };

  const badge = (() => {
    let el;
    return (text) => {
      if (!el) { el = document.createElement('div'); el.className = 'ad-badge'; document.body.appendChild(el); }
      if (!text) { el.classList.remove('on'); return; }
      el.textContent = text; el.classList.add('on');
    };
  })();

  /* ── 기본 동작 ───────────────────────────────────────────────── */
  const raf = () => new Promise((r) => requestAnimationFrame(r));

  function wait(ms) {
    const t = token;
    return new Promise((res, rej) => {
      const iv = setInterval(() => { if (t.dead) { clearInterval(iv); rej(new Stop()); } }, 60);
      setTimeout(() => { clearInterval(iv); t.dead ? rej(new Stop()) : res(); }, ms);
    });
  }
  const check = () => { if (token.dead) throw new Stop(); };

  /** 커서를 목표까지 부드럽게 옮긴다(거리에 따라 시간이 는다). */
  async function moveTo(x, y) {
    check();
    const x0 = curX, y0 = curY;
    const dist = Math.hypot(x - x0, y - y0);
    const dur = Math.min(420, Math.max(110, dist * 0.75));
    const t0 = performance.now();
    for (;;) {
      check();
      const p = Math.min(1, (performance.now() - t0) / dur);
      const e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;   // easeInOutQuad
      putCursor(x0 + (x - x0) * e, y0 + (y - y0) * e);
      if (p >= 1) break;
      await raf();
    }
  }

  /** iframe 안 요소의 화면 좌표(덱 기준). */
  function pointOf(el) {
    const f = frameEl().getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { x: f.left + r.left + r.width / 2, y: f.top + r.top + r.height / 2 };
  }

  async function toEl(el) {
    el.scrollIntoView({ block: 'center', inline: 'center' });
    await wait(150);
    const p = pointOf(el);
    await moveTo(p.x, p.y);
    return p;
  }

  const mouse = (el, type) => {
    const W = win();
    const p = el.getBoundingClientRect();
    const init = { bubbles: true, cancelable: true, view: W, clientX: p.left + p.width / 2, clientY: p.top + p.height / 2 };
    if (type.startsWith('pointer')) el.dispatchEvent(new W.PointerEvent(type, { ...init, pointerType: 'mouse', isPrimary: true }));
    else el.dispatchEvent(new W.MouseEvent(type, init));
  };

  /** 옮기고 → 뜸 들이고 → 누른다. */
  async function click(el, { before = 200, after = 360, note } = {}) {
    if (!el) throw new Error('클릭할 요소가 없습니다');
    await toEl(el);
    await wait(before);
    ensureCursor().classList.add('down');
    mouse(el, 'pointerdown'); mouse(el, 'mousedown');
    await wait(150);
    mouse(el, 'mouseup'); mouse(el, 'pointerup');
    el.click();
    ensureCursor().classList.remove('down');
    if (note) log(note);
    await wait(after);
  }

  /** React 제어 입력에 값을 넣는다 — value 를 직접 쓰면 리액트가 모른다. */
  function setValue(el, v) {
    const W = win();
    const proto = el.tagName === 'TEXTAREA' ? W.HTMLTextAreaElement.prototype : W.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new W.Event('input', { bubbles: true }));
  }

  /** 한 글자씩 친다. 청중이 질의문을 읽을 수 있어야 한다. */
  async function type(el, text, { delay = 28, after = 360, note, append = false } = {}) {
    await toEl(el);
    await wait(150);
    el.focus(); el.click();
    if (!append) setValue(el, '');            // append 면 이미 들어 있는 값 뒤에 이어 친다
    let acc = append ? el.value : '';
    for (const ch of text) {
      check();
      acc += ch;
      setValue(el, acc);
      await wait(delay);
    }
    if (note) log(note);
    await wait(after);
  }

  /** 드롭다운 — 값을 넣고 change 를 쏴야 리액트가 받는다. */
  async function pick(el, value, { note } = {}) {
    await toEl(el);
    await wait(150);
    const W = win();
    Object.getOwnPropertyDescriptor(W.HTMLSelectElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new W.Event('change', { bubbles: true }));
    if (note) log(note);
    await wait(230);
  }

  const press = (el, key) =>
    el.dispatchEvent(new (win().KeyboardEvent)('keydown', { key, bubbles: true, cancelable: true }));

  /** HTML5 드래그 — 마우스 이벤트만으로는 dragstart 가 안 뜬다. */
  async function drag(src, dst) {
    await toEl(src);
    await wait(150);
    const W = win();
    const dt = new W.DataTransfer();
    src.dispatchEvent(new W.DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
    const p = pointOf(dst);
    await moveTo(p.x, p.y);
    dst.dispatchEvent(new W.DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
    await wait(150);
    dst.dispatchEvent(new W.DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    src.dispatchEvent(new W.DragEvent('dragend', { bubbles: true, dataTransfer: dt }));
    await wait(390);
  }

  async function scroll(el, dy, chunks = 6) {
    await toEl(el);
    const box = el.closest('[style*="overflow"]') || el;
    for (let i = 0; i < chunks; i++) {
      check();
      box.scrollBy(0, dy / chunks);
      await wait(150);
    }
    await wait(150);
  }

  /* ── 찾기 ────────────────────────────────────────────────────── */
  const vis = (el) => !!(el && el.offsetParent !== null);
  const q = (sel) => doc() && doc().querySelector(sel);
  const qa = (sel) => (doc() ? [...doc().querySelectorAll(sel)] : []);

  /** 글자로 찾는다. 잎 노드(자식 없는 요소) 우선 — 컨테이너가 잡히면 클릭 위치가 엉뚱해진다. */
  function byText(text, { exact = false, sel = 'button,div,span,label,h1,h2,h3,p,em,b' } = {}) {
    const re = text instanceof RegExp ? text : null;
    const hit = (t) => (re ? re.test(t) : exact ? t === text : t.includes(text));
    const all = qa(sel).filter((el) => vis(el) && hit((el.textContent || '').trim()));
    return all.filter((el) => !all.some((o) => o !== el && el.contains(o))).pop() || null;
  }

  async function waitFor(fn, { timeout = 15000, note } = {}) {
    const t0 = Date.now();
    for (;;) {
      check();
      const v = typeof fn === 'string' ? (vis(q(fn)) ? q(fn) : null) : fn();
      if (v) return v;
      if (Date.now() - t0 > timeout) throw new Error('못 찾음: ' + (note || fn));
      await wait(150);
    }
  }
  /** 체크 상태를 원하는 값으로 맞춘다. 이미 맞으면 누르지 않는다(껐다 켜는 그림이 안 나오게). */
  async function setChecked(row, want, note) {
    const on = /✓/.test(row.textContent || '');
    if (on === want) return false;
    await click(row, { before: 140, after: 290, note });
    return true;
  }

  /** 있으면 누르고 없으면 넘어간다 — 상태에 따라 안 뜨는 버튼용. */
  async function clickIf(el, opts) { if (vis(el)) { await click(el, opts); return true; } return false; }

  const log = (m) => console.log('%c[자동시연]', 'color:#0d9488;font-weight:700', m);

  /* ── 로그인 ──────────────────────────────────────────────────── */
  async function ensureLogin() {
    const email = q('input[placeholder="user@kt.com"]');
    if (vis(email)) {
      log('로그인 화면 — 이메일 자동 입력');
      setValue(email, CFG.email);
      await wait(160);
      const submit = q('button[type=submit]');
      if (submit) submit.click();
      await wait(1100);
      return;
    }
    if (byText(/Azure로 로그인|Sign in with Azure/)) {
      badge('로그인이 필요합니다 — 직접 로그인해 주세요');
      log('Entra SSO 화면입니다 — 발표자가 직접 로그인해야 합니다(최대 3분 대기)');
      await waitFor(() => !byText(/Azure로 로그인|Sign in with Azure/), { timeout: 180000, note: '로그인' });
      badge('');
      await wait(830);
    }
  }

  /** 로고 아래 프로젝트 스위처를 연다. 프로젝트 메뉴가 사이드바에서 빠지면서
   *  새 프로젝트 · 전체 관리 · 프로젝트 전환이 모두 이 안으로 들어왔다. */
  async function openSwitcher() {
    const sw = await waitFor(() => qa('span').find((x) => x.parentElement
      && /pointer/.test(x.parentElement.style.cursor || '')
      && (x.textContent || '').trim().length > 3
      && x.parentElement.querySelector('svg')), { note: '프로젝트 스위처' });
    await click(sw.parentElement, { after: 600, note: '프로젝트 스위처 열기' });
  }

  /** 사이드바로 화면 이동 — 메뉴를 실제로 눌러야 어디에 있는 기능인지 전달된다. */
  async function goScreen(label) {
    // Skill 메뉴들은 'Skills' 안에 접혀 있다. 바로 안 보이면 한 번 열고 다시 찾는다.
    // 사이드바가 그려지기 전에 판단하면 둘 다 못 찾으므로, 먼저 하나가 뜰 때까지 기다린다.
    const find = () => byText(label, { exact: true, sel: 'span' });
    const drill = () => byText('Skills', { exact: true, sel: 'span' });
    await waitFor(() => find() || drill(), { note: '사이드바' });
    if (!find() && drill()) await click(drill(), { before: 160, after: 600, note: '메뉴 · Skills' });
    const item = await waitFor(find, { note: '메뉴 ' + label });
    await click(item, { before: 160, after: 600, note: '메뉴 · ' + label });
  }

  /* ── 시나리오 ─────────────────────────────────────────────────
     덱의 설명 화면이 주장하는 것을, 같은 순서로 앱에서 실제로 한다. */
  const SCENARIOS = {
    /* 1 · 프로젝트 생성 — 환경 유형만 고르면 수집 경로가 정해진다.
       위치는 '클라우드 + 온프레미스'. 리소스마다 있는 곳이 다른, 실제 고객 환경 모양이다.
       (프로바이더 SSO 는 건드리지 않는다 — 다음으로 넘어가는 데 필요하지 않다) */
    1: async () => {
      // 프로젝트 메뉴가 사이드바에서 빠져 스위처 안으로 들어갔다
      await openSwitcher();
      await click(await waitFor(() => byText(/새 프로젝트/, { sel: 'div' }), { note: '새 프로젝트' }),
        { after: 660, note: '＋ 새 프로젝트' });
      await type(await waitFor('input[placeholder^="예: 한화"]'), CFG.project, { note: '환경 이름' });
      await click(byText('다음', { sel: 'button' }), { after: 660, note: '다음' });

      await click(await waitFor(() => byText('클라우드 + 온프레미스', { exact: true })),
        { after: 440, note: '위치 · 클라우드 + 온프레미스' });

      // ── 여기서 손을 뗀다 ──────────────────────────────────────────
      // Azure 로그인은 사람이 한다. 발표자가 로그인하고 「소스 등록으로」 를 누르면
      // 소스 등록 화면이 뜨고, 그것을 신호로 나머지를 이어서 진행한다.
      badge('Azure 로그인 후 「소스 등록으로」 를 눌러 주세요');
      log('대기 — Azure 로그인은 발표자가. 「소스 등록으로」 를 누르면 이어서 진행합니다');
      await waitFor(() => q('input[placeholder^="예: apim.internal"]') || byText('문서 폴더에서 고르기', { exact: true }),
        { timeout: 900000, note: '소스 등록 화면' });
      badge('');
      await wait(660);

      // ── 클라우드 범위 — 시연에 쓸 그룹만 남긴다
      const scopeRows = qa('div').filter((d) => /(탐색 포함|제외)$/.test((d.textContent || '').trim()) && d.children.length <= 4);
      let kept = 0;
      for (const row of scopeRows) {
        const name = (row.textContent || '').replace(/탐색 포함|제외/g, '').replace(/✓/g, '').trim();
        const want = name.includes(CFG.scopePat);
        if (want) kept += 1;
        await setChecked(row, want, (want ? '범위 포함 · ' : '범위 제외 · ') + name);
      }
      if (scopeRows.length) log('클라우드 범위 ' + kept + '/' + scopeRows.length + " — '" + CFG.scopePat + "' 만 남김");

      // 온프렘 대상(호스트·포트)은 손대지 않는다 — 발표자가 맞춰 둔 값을 그대로 쓴다.

      // ── 비정형 문서는 탐색이 아니라 경로를 지정해 담는다
      await click(byText('문서 폴더에서 고르기', { exact: true }), { after: 660, note: '문서 폴더에서 고르기' });
      await click(await waitFor(() => byText(CFG.doc, { exact: true }), { note: '문서 ' + CFG.doc }),
        { after: 390, note: '문서 선택 · ' + CFG.doc });
      await click(byText('선택 파일만 담기', { exact: true, sel: 'button' }), { after: 500, note: '선택 파일만 담기' });
      await click(byText(/문서 담기/, { sel: 'button' }), { after: 660, note: '담은 문서 확정' });

      // 담은 문서를 어떻게 쓸지 — 용어·정의를 그래프로 세우는 경로
      await pick(await waitFor(() => q('select[aria-label$="활용 경로"]'), { note: '활용 경로' }),
        CFG.pipeline, { note: '활용 경로 · Terms → GraphRAG' });

      // ── 여기서 또 한 번 손을 뗀다 ────────────────────────────────
      // 무엇을 담았는지 설명할 자리다. 발표자가 「탐색 시작」 을 누르면 이어서 진행한다.
      const scanBtn = byText(/탐색 시작|업로드 시작/, { sel: 'button' });
      if (scanBtn) await toEl(scanBtn);                  // 커서를 그 버튼 위에 얹어 둔다
      badge('「탐색 시작」 을 눌러 주세요');
      log('대기 — 탐색 시작은 발표자가. 누르면 이어서 진행합니다');
      await waitFor(() => byText(/담기/, { sel: 'button' }) || byText(/발견된 리소스/),
        { timeout: 900000, note: '탐색 화면' });
      badge('');

      // ── 탐색 결과 — 관리형 DB 는 시연 대상만 담는다
      const basket = () => { const b = byText(/담기/, { sel: 'button' }); return b && !b.disabled ? b : null; };
      await waitFor(() => byText(/담기/, { sel: 'button' }), { timeout: 90000, note: '탐색 결과' });
      await wait(1380);                                  // 로그가 흐르는 구간 — 그 자체가 볼거리다

      // 찾은 리소스 중 시연 대상만 남긴다 — 이름에 '-legacy-' 가 있는 것 외에는 해제.
      // 하나도 안 걸리면 손대지 않는다(전부 꺼서 담을 게 없어지는 것보다 낫다).
      // 클라우드 조회는 구독을 돌며 시간이 걸린다. 행이 다 뜨기 전에 고르면 아무것도
      // 못 고른 채 지나가므로, 개수가 두 번 연속 같아질 때까지 기다린다.
      const resultRows = () => [...new Set(qa('span[title]').map((x) => x.parentElement))]
        .filter((r) => r && r.children.length >= 3 && !/탐색 포함|제외$/.test((r.textContent || '').trim())
          && r.firstElementChild && (r.firstElementChild.textContent || '').trim() !== 'VM');
      let seen = -1, still = 0;
      for (let i = 0; i < 45 && still < 2; i += 1) {
        const n = resultRows().length;
        if (n > 0 && n === seen) still += 1; else still = 0;
        seen = n;
        await wait(700);
      }
      const named = resultRows().map((r) => ({ row: r, name: (r.querySelector('span[title]').getAttribute('title') || '').trim() }));
      const keep = named.filter((x) => x.name.includes(CFG.keepPat));
      if (!keep.length) {
        if (named.length) log(`'${CFG.keepPat}' 이 이름에 있는 리소스가 없어 선택을 그대로 둡니다`);
      } else {
        for (const { row, name } of named) {
          const want = name.includes(CFG.keepPat);
          await setChecked(row, want, (want ? '담기 · ' : '해제 · ') + name);
        }
        log(`찾은 리소스 ${keep.length}/${named.length} — '${CFG.keepPat}' 만 담음`);
      }

      await click(await waitFor(basket, { timeout: 90000, note: '담기 버튼' }),
        { before: 500, after: 830, note: '찾은 리소스 담기' });
      if (basket()) await click(basket(), { after: 830, note: '담기 재시도' });
      await clickIf(byText(/변환 시작|변환하기/, { sel: 'button' }), { after: 830, note: '변환 시작' });

      // 변환이 끝나면 마지막 화면(플랫폼 입장)
      const enter = await waitFor(() => byText(/입장/, { sel: 'button' }), { timeout: 300000, note: '플랫폼 입장' });
      await click(enter, { before: 390, after: 1210, note: '플랫폼 입장' });
    },

    /* 2 · RAG 연결 확인 — 미리 만들어 둔 프로젝트의 청킹 결과를 보고, 그대로 물어본다.
       구성 화면 설명과 플레이그라운드로 넘어가는 것은 발표자가 한다. 넘어오면 질문만 던진다. */
    2: async () => {
      await openSwitcher();
      const target = await waitFor(() => byText(CFG.ragProject, { exact: true }), { timeout: 8000, note: CFG.ragProject })
        .catch(() => null);
      if (target) await click(target, { after: 660, note: '프로젝트 · ' + CFG.ragProject });
      else log('「' + CFG.ragProject + '」 가 목록에 없습니다 — 직접 골라 주세요');
      await goScreen('RAG Vector DB');

      // ── 손을 뗀다 — 구성 화면은 발표자가 짚는다. Playground 로 옮기면 이어받는다.
      badge('Playground 로 이동하시면 질문까지 넣어 드립니다');
      log('대기 — 구성 설명은 발표자가. Playground 로 이동하면 이어서 진행합니다');
      const askBox = () => qa('input,textarea').find((e) => /질문 입력|Ask/.test(e.placeholder || ''));
      await waitFor(askBox, { timeout: 900000, note: 'Playground 질의창' });
      badge('');
      await wait(600);

      // /graphrag 를 누르면 입력창에 커맨드가 채워진다 — 그 뒤에 질문을 이어 친다
      await clickIf(byText('/graphrag', { exact: true }), { after: 500, note: '/graphrag' });
      const input = askBox();
      await type(input, CFG.ragAsk, { append: true, delay: 26, note: '약관 질문' });
      press(input, 'Enter');
      await clickIf(q('.pg2-send'), { before: 200, after: 400, note: '전송' });
      log('실행 — 조·항 출처가 붙은 답변');
      await wait(9000);
    },

    /* 3 · MCP 탐색 · 스킬 만들기 — 하려는 일을 문장으로 넣어 도구 조합을 받고,
       같은 문장으로 스킬 초안까지 만든다. 두 화면 사이 이동은 발표자가 한다. */
    3: async () => {
      await goScreen('MCP 탐색');
      const ask = await waitFor(() => q('.exp-askbar input, .exp-askbar textarea')
        || qa('input').find((e) => /^예:/.test(e.placeholder || '')), { note: '질의창' });
      await type(ask, CFG.intent, { delay: 26, after: 180, note: '하려는 일을 문장으로' });
      press(ask, 'Enter');
      log('검색 실행');
      await waitFor(() => byText(/찾은 조합/) || q('span.mono'), { timeout: 45000, note: '추천 결과' });
      await wait(1200);

      // ── 손을 뗀다 — 결과를 짚고 Skill 생성으로 넘어가는 것은 발표자가 한다.
      badge('Skill 생성으로 이동하시면 이어서 진행합니다');
      log('대기 — Skill 생성 메뉴로 이동하면 같은 문장으로 초안을 만듭니다');
      const draftBox = () => (q('.skl-flow') || q('.skl-panel')) ? q('.exp-askbar input') : null;
      await waitFor(draftBox, { timeout: 900000, note: 'Skill 생성 입력창' });
      badge('');
      await wait(600);

      const ctx = draftBox();
      await type(ctx, CFG.intent, { delay: 26, after: 180, note: '하려는 일을 문장으로' });
      press(ctx, 'Enter');
      log('MCP 조합 초안 만들기');
      await waitFor(() => qa('.skl-node').some((n) => !n.classList.contains('term')),
        { timeout: 60000, note: '추천된 조합' }).catch(() => {});
      await wait(900);
    },
  };

  /* ── 진행 감시 ────────────────────────────────────────────────
     덱이 그 단계의 시연 화면으로 넘어가면 시작하고, 발표자가 넘기면 멈춘다. */
  let enabled = QS.get('auto') !== '0';
  let running = null;      // 지금 도는 단계
  let done = null;         // 이미 돌린 단계(그 화면에 머물러도 다시 돌지 않는다)

  async function run(n) {
    if (!SCENARIOS[n]) { log(n + '단계는 자동 시연 없음 — 직접 진행하세요'); return; }
    kill();
    token = { dead: false };
    const mine = token;
    running = n;
    log(`▶ ${n}단계 시작`);
    try {
      await ensureLogin();
      await SCENARIOS[n]();
      log(`■ ${n}단계 끝`);
      if (!mine.dead) done = n;
    } catch (e) {
      if (e instanceof Stop) log(`× ${n}단계 취소(발표자가 넘김)`);
      else { log(`! ${n}단계 멈춤: ${e.message}`); if (!mine.dead) done = n; }
    } finally {
      if (running === n) running = null;
      badge('');
    }
  }

  function onState({ stage, mode, slide }) {
    const live = enabled && slide === 'demoSlide' && mode === 'demo';
    if (!live || (running !== null && running !== stage + 1)) { kill(); running = null; }
    if (!live || (done !== null && done !== stage + 1)) done = null;
    if (live && running === null && done !== stage + 1) run(stage + 1);
  }

  addEventListener('deck:demo', (e) => onState(e.detail));

  // D 키로 자동 시연을 끄고 켠다 — 손으로 몰고 싶을 때.
  addEventListener('keydown', (e) => {
    if (e.key !== 'd' && e.key !== 'D') return;
    if (/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    enabled = !enabled;
    if (!enabled) { kill(); running = null; }
    badge(enabled ? '자동 시연 켜짐' : '자동 시연 꺼짐');
    setTimeout(() => badge(''), 1600);
  });

  window.__autoDemo = {
    run,
    stop: () => { kill(); running = null; },
    off: () => { enabled = false; kill(); running = null; },
    on: () => { enabled = true; },
    get enabled() { return enabled; },
    CFG,
  };
  log('준비됨 — 시연 화면으로 넘어가면 자동 실행 (D 키로 끄기)');
})();
