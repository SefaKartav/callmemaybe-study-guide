/* call me maybe — savunma rehberi: navigation, reading state, motion and the interactive figures. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
  };
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---------- byte-level BPE tables (GPT-2 bytes_to_unicode, as in grammar.py) ---------- */
  const PRINTABLE = [];
  for (let b = 33; b <= 126; b++) PRINTABLE.push(b);
  for (let b = 161; b <= 172; b++) PRINTABLE.push(b);
  for (let b = 174; b <= 255; b++) PRINTABLE.push(b);
  const BYTE_TO_CHAR = new Map();
  const CHAR_TO_BYTE = new Map();
  {
    const bs = PRINTABLE.slice();
    const cs = PRINTABLE.slice();
    let offset = 0;
    for (let b = 0; b < 256; b++) if (!bs.includes(b)) { bs.push(b); cs.push(256 + offset); offset++; }
    bs.forEach((b, i) => { BYTE_TO_CHAR.set(b, String.fromCodePoint(cs[i])); CHAR_TO_BYTE.set(String.fromCodePoint(cs[i]), b); });
  }
  const isPrintable = (b) => PRINTABLE.includes(b);
  const enc = new TextEncoder();
  const toVisible = (s) => [...enc.encode(s)].map((b) => BYTE_TO_CHAR.get(b)).join('');
  const fromVisible = (s) => new TextDecoder().decode(new Uint8Array([...s].map((c) => CHAR_TO_BYTE.get(c) ?? 63)));

  /* ---------- grammar.py, line for line ---------- */
  const isDigits = (s) => /^[0-9]+$/.test(s);
  function isValidNumberFragment(fragment, allowDecimal = true) {
    if (fragment === '') return true;
    let allowed = '0123456789-';
    if (allowDecimal) allowed += '.';
    for (let index = 0; index < fragment.length; index++) {
      const part = fragment[index];
      if (!allowed.includes(part)) return false;
      if (part === '-' && index !== 0) return false;
      if (part === '.' && (index === 0 || !isDigits(fragment[index - 1]))) return false;
    }
    if (fragment.split('.').length - 1 > 1) return false;
    return true;
  }
  function isCompleteNumber(fragment) {
    if (fragment.startsWith('-')) fragment = fragment.slice(1);
    if (!fragment.includes('.')) return isDigits(fragment);
    if (fragment.split('.').length - 1 > 1) return false;
    const [first, second] = fragment.split('.');
    return isDigits(first) && isDigits(second);
  }
  function isValidStringFragment(fragment) {
    const chars = [...fragment];
    for (let i = 0; i < chars.length; i++) if (chars[i] === '"') return i === chars.length - 1;
    return true;
  }
  const isCompleteString = (fragment) => fragment.length > 0 && fragment.at(-1) === '"';

  /* ---------- reveal on scroll ---------- */
  const revealAll = () => $$('.rv').forEach((el) => el.classList.add('is-in'));
  if (reduced || !('IntersectionObserver' in window)) revealAll();
  else {
    const io = new IntersectionObserver((entries) => {
      let n = 0;
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.style.setProperty('--d', `${Math.min(n++, 5) * 75}ms`);
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -8% 0px' });
    $$('.rv').forEach((el) => io.observe(el));
    // Never leave content hidden: anything still waiting after a jump is shown.
    addEventListener('hashchange', () => setTimeout(() => $$('.rv:not(.is-in)').forEach((el) => { if (el.getBoundingClientRect().top < innerHeight) el.classList.add('is-in'); }), 60));
  }

  /* ---------- hero: logits rise, then the mask lands ---------- */
  const bars = $('.hero-bars');
  if (bars && !reduced) {
    bars.classList.remove('masked');
    bars.classList.add('rise');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      bars.classList.remove('rise');
      setTimeout(() => bars.classList.add('masked'), 1500);
    }));
  }

  /* ---------- sidebar, scroll spy, reading progress ---------- */
  const progress = $('.progress i');
  const chapters = $$('.chapter');
  const headings = $$('.content .mdh').filter((h) => h.tagName === 'H2' || h.tagName === 'H3');
  const tocItems = new Map($$('.toc > li').map((li) => [li.dataset.ch, li]));
  const subLinks = new Map($$('.toc-subs a').map((a) => [decodeURIComponent(a.hash.slice(1)), a]));
  const mbarT = $('.mbar-t');
  const sideRead = $('.side-read');
  const read = store.get('cmm-read', {});
  let tops = [];
  const measure = () => {
    tops = headings.map((h) => h.getBoundingClientRect().top + scrollY);
    chapters.forEach((c) => { c._top = c.getBoundingClientRect().top + scrollY; c._h = c.offsetHeight; });
  };
  let activeCh = null;
  let activeSub = null;
  let lastSave = 0;
  function onScroll() {
    const y = scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
    let idx = -1;
    for (let i = 0; i < tops.length; i++) { if (tops[i] - 110 <= y) idx = i; else break; }
    const h = headings[idx];
    const ch = h ? h.closest('.chapter').dataset.chapter : null;
    if (ch !== activeCh) {
      tocItems.get(activeCh)?.classList.remove('is-active');
      tocItems.get(ch)?.classList.add('is-active');
      activeCh = ch;
      if (mbarT) mbarT.textContent = ch ? tocItems.get(ch)?.querySelector('.toc-t')?.textContent ?? '' : '';
    }
    const sub = h && h.tagName === 'H3' ? h.id : null;
    if (sub !== activeSub) {
      subLinks.get(activeSub)?.classList.remove('is-active');
      subLinks.get(sub)?.classList.add('is-active');
      activeSub = sub;
    }
    for (const c of chapters) {
      const p = Math.max(0, Math.min(1, (y + innerHeight * 0.6 - c._top) / c._h));
      const id = c.dataset.chapter;
      if (p > (read[id] ?? 0)) read[id] = p;
      tocItems.get(id)?.style.setProperty('--p', (read[id] ?? 0).toFixed(3));
    }
    const now = Date.now();
    if (now - lastSave > 800) {
      lastSave = now;
      store.set('cmm-read', read);
      if (h) store.set('cmm-pos', { id: h.id, label: h.textContent.trim().slice(0, 60) });
      const done = Object.entries(read).filter(([k, v]) => k !== 'icindekiler' && v > 0.97).length;
      if (sideRead) sideRead.textContent = `${done} / ${chapters.length - 1} okundu`;
    }
  }
  let ticking = false;
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { onScroll(); ticking = false; }); } }, { passive: true });
  addEventListener('resize', () => { measure(); onScroll(); });
  addEventListener('load', () => { measure(); onScroll(); });
  document.fonts?.ready.then(() => { measure(); onScroll(); });
  if ('ResizeObserver' in window) new ResizeObserver(() => measure()).observe($('.content'));
  measure();
  onScroll();

  // Resume where you left off
  const pos = store.get('cmm-pos', null);
  const resume = $('.resume');
  if (resume && pos && document.getElementById(pos.id) && !location.hash) {
    resume.href = `#${pos.id}`;
    resume.textContent = `Kaldığın yerden devam et: ${pos.label}`;
    resume.hidden = false;
  }

  // Drawer on narrow screens
  const side = $('#side');
  const mbtn = $('.mbar-btn');
  const scrim = $('.scrim');
  const setNav = (open) => {
    document.body.classList.toggle('nav-open', open);
    mbtn?.setAttribute('aria-expanded', String(open));
    if (scrim) scrim.hidden = !open;
    if (open) { tocItems.get(activeCh)?.scrollIntoView({ block: 'center' }); side.querySelector('a')?.focus({ preventScroll: true }); }
  };
  mbtn?.addEventListener('click', () => setNav(!document.body.classList.contains('nav-open')));
  scrim?.addEventListener('click', () => setNav(false));
  side?.addEventListener('click', (e) => { if (e.target.closest('a')) setNav(false); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && document.body.classList.contains('nav-open')) { setNav(false); mbtn.focus(); } });

  /* ---------- copy buttons ---------- */
  $$('.copy').forEach((b) => b.addEventListener('click', async () => {
    const text = b.closest('.code').querySelector('code').innerText;
    try { await navigator.clipboard.writeText(text); } catch {
      const t = document.createElement('textarea'); t.value = text; document.body.append(t); t.select(); document.execCommand('copy'); t.remove();
    }
    b.textContent = 'Kopyalandı'; b.classList.add('done');
    setTimeout(() => { b.textContent = 'Kopyala'; b.classList.remove('done'); }, 1600);
  }));

  /* ---------- figure helpers ---------- */
  const whenSeen = (el, fn) => {
    if (!('IntersectionObserver' in window)) return fn();
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); fn(); } }, { threshold: 0.35 });
    io.observe(el);
  };
  const radio = (group, onPick) => {
    const btns = $$('[role="radio"]', group);
    btns.forEach((b) => b.addEventListener('click', () => {
      btns.forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      onPick(b);
    }));
  };
  const W = {};

  /* 1.1 prompt → call */
  W.p2j = (root) => {
    const box = $('.p2j', root);
    const lines = $$('.p2j-line', box);
    if (reduced) return;
    box.classList.add('run');
    let token = 0;
    const play = async () => {
      const me = ++token;
      box.classList.remove('flow'); lines.forEach((l) => l.classList.remove('on'));
      await wait(300); if (me !== token) return;
      box.classList.add('flow');
      await wait(700);
      for (const l of lines) { if (me !== token) return; l.classList.add('on'); await wait(260); }
    };
    whenSeen(root, play);
    $('[data-act="replay"]', root).addEventListener('click', play);
  };

  /* 1.3 ten tries */
  W.tries = (root) => {
    const FREE = [
      ['{"name": "fn_add_numbers", "parameters": {"a": 2, "b": 3}}', 1, 'geçerli'],
      ['{"name": "fn_add_numbers", "parameters": {"a": 2, "b": 3}', 0, 'parantez kapanmadı'],
      ['{"name": "fn_add_numbers", "parameters": {"a": "iki", "b": 3}}', 0, 'sayı yerine "iki"'],
      ['{"name": "fn_sum", "parameters": {"a": 2, "b": 3}}', 0, 'olmayan fonksiyon'],
      ['Sure! Here is your answer: {"name": "fn_add_numbers", …}', 0, 'JSON\'un etrafında metin'],
      ['{"name": "fn_add_numbers", "parameters": {"a": 2.0, "b": 3.0}}', 1, 'geçerli'],
      ['{"name": "fn_add_numbers", "parameters": {"a": 2, "b": 3', 0, 'parantez kapanmadı'],
      ['{"name": "fn_add_numbers", "parameters": {"a": 2, "b": 3}}', 1, 'geçerli'],
      ['{"name": "add_numbers", "parameters": {"a": 2, "b": 3}}', 0, 'olmayan fonksiyon'],
      ['Sure! Here is your answer: {"name": "fn_add_numbers", …}', 0, 'JSON\'un etrafında metin'],
    ];
    const CD = Array.from({ length: 10 }, () => ['{"name": "fn_add_numbers", "parameters": {"a": 2.0, "b": 3.0}}', 1, 'geçerli']);
    const list = $('.tries', root); const n = $('.tries-n', root);
    const show = (rows) => {
      list.innerHTML = rows.map(([code, ok, why], i) => `<li class="${ok ? 'ok' : 'no'}${reduced ? '' : ' enter'}" style="transition-delay:${i * 45}ms"><code>${esc(code)}</code><span class="verdict">${esc(why)}</span></li>`).join('');
      n.textContent = `${rows.filter((r) => r[1]).length} / 10`;
      if (!reduced) requestAnimationFrame(() => requestAnimationFrame(() => $$('li', list).forEach((li) => li.classList.remove('enter'))));
    };
    show(FREE);
    radio($('.seg', root), (b) => show(b.dataset.mode === 'cd' ? CD : FREE));
  };

  /* 2.1 tokenizer (Qwen2 pre-tokenizer pattern; each piece shown as one token) */
  W.tok = (root) => {
    const RE = /'s|'t|'re|'ve|'m|'ll|'d|[^\r\n\p{L}\p{N}]?\p{L}+|\p{N}| ?[^\s\p{L}\p{N}]+[\r\n]*|\s*[\r\n]+|\s+(?!\S)|\s+/gu;
    const inp = $('.tok-in', root); const out = $('.tok-out', root); const raw = $('.tok-raw', root); const n = $('.tok-n', root);
    const draw = () => {
      const pieces = inp.value.match(RE) ?? [];
      out.innerHTML = pieces.map((p, i) => `<span class="chip" style="--i:${i}"><code class="t">${esc(raw.checked ? toVisible(p) : p.replace(/ /g, '␣').replace(/\n/g, '↵'))}</code></span>`).join('');
      n.textContent = `${pieces.length} token`;
    };
    inp.addEventListener('input', draw); raw.addEventListener('change', draw); draw();
  };

  /* 2.3 bytes → visible characters */
  W.bytes = (root) => {
    const inp = $('.bytes-in', root); const out = $('.bytes-out', root); const str = $('.bytes-str', root);
    const name = (c) => (c === ' ' ? '␣' : c === '\n' ? '↵' : c === '\t' ? '⇥' : c);
    const draw = () => {
      const chars = [...inp.value].slice(0, 80);
      out.innerHTML = chars.map((c, i) => {
        const bytes = [...enc.encode(c)];
        const re = bytes.some((b) => !isPrintable(b)) || bytes.length > 1;
        return `<span class="bcol${re ? ' re' : ''}" style="--i:${i}"><span class="bc">${esc(name(c))}</span><code class="bb">${bytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')}</code><code class="bv">${bytes.map((b) => `<b class="${isPrintable(b) ? '' : 're'}">${esc(BYTE_TO_CHAR.get(b))}</b>`).join('')}</code></span>`;
      }).join('');
      str.textContent = toVisible(inp.value);
    };
    inp.addEventListener('input', draw); draw();
  };

  /* 2.6 autoregressive loop */
  W.loop = (root) => {
    const START = ['…', 'What', 'Ġis', 'Ġthe', 'Ġsum', 'Ġof', 'Ġ', '2', 'Ġand', 'Ġ', '3', '?', 'Ċ', 'function', 'Ġname', ':', 'Ġ'];
    const STEPS = [
      [['"', 0.92], ['The', 0.55], ['{', 0.48], ['Sure', 0.4], ['fn', 0.3]],
      [['fn', 0.95], ['add', 0.5], ['f', 0.42], ['sum', 0.36], ['_', 0.2]],
      [['_add', 0.9], ['_g', 0.45], ['_sum', 0.4], ['_get', 0.3], ['_', 0.22]],
      [['_numbers', 0.94], ['_', 0.4], ['Numbers', 0.3], ['_num', 0.28], ['"', 0.2]],
      [['"', 0.9], [',', 0.35], ['(', 0.3], ['_', 0.22], ['Ċ', 0.18]],
    ];
    const row = $('.loop-row', root); const bars = $('.loop-bars', root); const say = $('.loop-say', root); const n = $('.loop-n', root); const box = $('.loop-box', root);
    const playBtn = $('[data-act="play"]', root);
    let k = 0; let timer = null;
    const drawRow = (fresh) => {
      const gen = STEPS.slice(0, k).map((s) => s[0][0]);
      row.innerHTML = START.map((t) => `<span class="chip"><code class="t">${esc(t)}</code></span>`).join('') + gen.map((t, i) => `<span class="chip ${fresh && i === gen.length - 1 ? 'new' : 'gen'}"><code class="t">${esc(t)}</code></span>`).join('');
    };
    const drawBars = (s, chosen) => {
      bars.innerHTML = (s ?? STEPS[0].map(([t]) => [t, 0.04])).map(([t, h], i) => `<div class="lb${chosen && i === 0 ? ' c' : ''}"><i style="--h:${h}"></i><code class="t">${esc(t)}</code></div>`).join('');
    };
    const reset = () => { k = 0; stop(); drawRow(false); drawBars(null, false); say.textContent = 'Başlangıç: prompt tokenleri hazır. "Bir adım"a bas.'; n.textContent = 'forward pass: 0'; };
    const step = () => {
      if (k >= STEPS.length) { stop(); say.textContent = 'Kapanış tırnağı geldi: "fn_add_numbers" tamamlandı. 5 adım, 5 forward pass.'; return false; }
      const s = STEPS[k];
      box.classList.remove('pulse'); void box.offsetWidth; box.classList.add('pulse');
      drawBars(s.map(([t]) => [t, 0.04]), false);
      requestAnimationFrame(() => requestAnimationFrame(() => drawBarsLive(s)));
      k++;
      drawRow(true);
      say.innerHTML = `Adım ${k}: en yüksek logit <code>${esc(s[0][0])}</code> → seçildi ve <code>input_ids</code>'e eklendi.`;
      n.textContent = `forward pass: ${k}`;
      return true;
    };
    const drawBarsLive = (s) => { $$('.lb', bars).forEach((lb, i) => { lb.querySelector('i').style.setProperty('--h', s[i][1]); lb.classList.toggle('c', i === 0); }); };
    const stop = () => { clearInterval(timer); timer = null; playBtn.textContent = 'Oynat'; playBtn.setAttribute('aria-pressed', 'false'); };
    $('[data-act="step"]', root).addEventListener('click', () => { stop(); if (k >= STEPS.length) reset(); step(); });
    playBtn.addEventListener('click', () => {
      if (timer) return stop();
      if (k >= STEPS.length) reset();
      playBtn.textContent = 'Durdur'; playBtn.setAttribute('aria-pressed', 'true');
      step(); timer = setInterval(() => { if (!step()) stop(); }, reduced ? 1400 : 1100);
    });
    $('[data-act="reset"]', root).addEventListener('click', reset);
    reset();
  };

  /* 2.8 masking */
  W.mask = (root) => {
    const SETS = [{ l: [5.1, 9.8, 2.3, 7.7], v: [0, 0, 1, 1] }, { l: [-1.2, -0.4, -3.1, -2.0], v: [0, 0, 1, 1] }];
    let set = 0; let mode = 'inf';
    let valid = SETS[0].v.slice();
    const chart = $('.mask-chart', root); const table = $('.mask-table', root); const say = $('.mask-say', root);
    chart.innerHTML = [0, 1, 2, 3].map(() => '<div class="mcol"><span class="pos"></span><span class="neg"></span><code class="ml"></code></div>').join('');
    const fmt = (x) => (x === -Infinity ? '-inf' : x.toFixed(1));
    const draw = () => {
      const logits = SETS[set].l;
      const masked = logits.map((x, i) => (valid[i] || mode === 'none' ? x : mode === 'zero' ? 0 : -Infinity));
      const finite = [...logits, ...masked.filter(Number.isFinite), 0];
      const hi = Math.max(...finite); const lo = Math.min(...finite);
      const span = hi - lo || 1;
      const zero = ((hi / span) * 0.78 + 0.08) * 100;
      chart.style.setProperty('--zero', `${zero}%`);
      let best = -Infinity; let win = -1;
      masked.forEach((x, i) => { if (x > best) { best = x; win = i; } });
      $$('.mcol', chart).forEach((col, i) => {
        const x = masked[i];
        const pos = col.querySelector('.pos'); const neg = col.querySelector('.neg'); const ml = col.querySelector('.ml');
        const upMax = hi > 0 ? hi : 1; const downMax = lo < 0 ? -lo : 1;
        pos.style.transform = `scaleY(${x > 0 ? x / upMax : 0})`;
        neg.style.transform = `scaleY(${x === -Infinity ? 1 : x < 0 ? -x / downMax : 0})`;
        col.classList.toggle('invalid', !valid[i]);
        col.classList.toggle('inf', x === -Infinity);
        col.classList.toggle('win', i === win && best !== -Infinity);
        const top = x === -Infinity ? 96 : x >= 0 ? zero - (x / upMax) * zero - 9 : zero + (-x / downMax) * (100 - zero) + 1;
        ml.style.top = `${Math.max(0, Math.min(92, top))}%`;
        ml.textContent = fmt(x);
      });
      table.innerHTML = `<table><thead><tr><th>index</th>${logits.map((_, i) => `<th>${i}</th>`).join('')}</tr></thead><tbody>
        <tr><th>logit</th>${logits.map((x) => `<td>${fmt(x)}</td>`).join('')}</tr>
        <tr><th>geçerli mi</th>${valid.map((v, i) => `<td><button type="button" class="${v ? 'ok' : ''}" data-i="${i}" aria-pressed="${!!v}" aria-label="Token ${i} ${v ? 'geçerli' : 'geçersiz'}">${v ? 'evet' : 'hayır'}</button></td>`).join('')}</tr>
        <tr><th>maskeli</th>${masked.map((x) => `<td>${fmt(x)}</td>`).join('')}</tr></tbody></table>`;
      if (best === -Infinity) say.innerHTML = 'Geçerli token kalmadı: <code>_select_next_token</code> burada <code>ValueError("No valid tokens left")</code> fırlatır.';
      else if (!valid[win]) say.innerHTML = `argmax = index ${win} (${fmt(best)}) · <span class="bad">geçersiz token seçildi</span>`;
      else say.innerHTML = `argmax = index ${win} (${fmt(best)}) · en iyi geçerli token seçildi`;
    };
    table.addEventListener('click', (e) => { const b = e.target.closest('button[data-i]'); if (!b) return; valid[+b.dataset.i] ^= 1; draw(); table.querySelector(`button[data-i="${b.dataset.i}"]`)?.focus(); });
    const [setSeg, modeSeg] = $$('.seg', root);
    radio(setSeg, (b) => { set = +b.dataset.set; valid = SETS[set].v.slice(); draw(); });
    radio(modeSeg, (b) => { mode = b.dataset.m; draw(); });
    draw();
  };

  /* verdict helper */
  const verdict = (dd, v) => { dd.textContent = v ? 'True' : 'False'; dd.className = dd.className.replace(/\s?\b[tf]\b/g, '') + (v ? ' t' : ' f'); };

  /* 5.20 number playground */
  W.num = (root) => {
    const PRE = ['', '2', '2.', '2.5', '-', '-5', '12.', '.5', '-.', '12a', '1.2.3', '007'];
    const VOCAB = ['0', '1', '2', '5', '9', '-', '.', 'Ċ', 'a', 'Ġ', '12', '.5', 'e', '00'];
    const inp = $('.num-in', root); const dec = $('.num-dec', root); const next = $('.num-next', root);
    $('.num-pre', root).innerHTML = PRE.map((p) => `<button type="button" class="chip" data-v="${esc(p)}"><code class="t">${p === '' ? '""' : esc(p)}</code></button>`).join('');
    $('.num-pre', root).addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) { inp.value = b.dataset.v; draw(); } });
    const draw = () => {
      const f = inp.value; const allow = dec.checked;
      verdict($('.v-valid', root), isValidNumberFragment(f, allow));
      verdict($('.v-complete', root), isCompleteNumber(f));
      const complete = isCompleteNumber(f);
      next.innerHTML = VOCAB.map((t) => {
        const ok = t === 'Ċ' ? complete : isValidNumberFragment(f + t, allow);
        return `<button type="button" class="chip ${ok ? 'ok' : 'no'}" data-t="${esc(t)}" ${ok ? '' : 'aria-disabled="true"'}><code class="t">${esc(t)}</code></button>`;
      }).join('') + `<span class="chip k">${complete ? `Ċ seçilirse: float("${esc(f)}") = ${parseFloat(f)}` : 'Ċ yok: sayı henüz bitemez'}</span>`;
    };
    next.addEventListener('click', (e) => {
      const b = e.target.closest('.chip.ok[data-t]'); if (!b) return;
      if (b.dataset.t === 'Ċ') { inp.value = ''; } else inp.value += b.dataset.t;
      draw();
    });
    inp.addEventListener('input', draw); dec.addEventListener('change', draw); draw();
  };

  /* 5.24 string playground */
  W.str = (root) => {
    const PRE = ['hello', 'hello"', 'hel"lo', 'hello",', '', 'sh', 'shrek"'];
    const VOCAB = ['sh', 'rek', '"', '",', 'Ġworld', 'rek"', '!'];
    const inp = $('.str-in', root); const next = $('.str-next', root);
    $('.str-pre', root).innerHTML = PRE.map((p) => `<button type="button" class="chip" data-v="${esc(p)}">${p === '' ? '(boş)' : `<code class="t">${esc(p)}</code>`}</button>`).join('');
    $('.str-pre', root).addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) { inp.value = b.dataset.v; draw(); } });
    const draw = () => {
      const f = inp.value;
      verdict($('.v-valid', root), isValidStringFragment(f));
      verdict($('.v-complete', root), isCompleteString(f));
      const closed = isCompleteString(f) && isValidStringFragment(f);
      next.innerHTML = closed
        ? `<span class="chip k">String kapandı → decode_bpe_string: "${esc(fromVisible(f.slice(0, -1)))}"</span>`
        : VOCAB.map((t) => { const ok = isValidStringFragment(f + t); return `<button type="button" class="chip ${ok ? 'ok' : 'no'}" data-t="${esc(t)}" ${ok ? '' : 'aria-disabled="true"'}><code class="t">${esc(t)}</code></button>`; }).join('');
    };
    next.addEventListener('click', (e) => { const b = e.target.closest('.chip.ok[data-t]'); if (!b) return; inp.value += b.dataset.t; draw(); });
    inp.addEventListener('input', draw); draw();
  };

  /* 5.25 the 256-byte grid */
  W.grid = (root) => {
    const NAMES = { 0: 'NUL', 9: 'tab \\t', 10: 'satır sonu \\n', 13: 'satır başı \\r', 32: 'boşluk', 127: 'DEL', 160: 'bölünmez boşluk', 173: 'yumuşak tire' };
    const grid = $('.bgrid', root); const say = $('.bgrid-say', root);
    grid.innerHTML = Array.from({ length: 256 }, (_, b) => `<button type="button" class="${isPrintable(b) ? '' : 're'}" data-b="${b}" style="--i:${b}" aria-label="Bayt ${b}"><code class="t">${esc(BYTE_TO_CHAR.get(b))}</code></button>`).join('');
    let sel = null;
    const pick = (btn) => {
      sel?.classList.remove('sel'); sel = btn; btn.classList.add('sel');
      const b = +btn.dataset.b; const c = BYTE_TO_CHAR.get(b); const cp = c.codePointAt(0);
      const hex = `0x${b.toString(16).toUpperCase().padStart(2, '0')}`;
      const nm = NAMES[b] ? `, ${NAMES[b]}` : '';
      say.innerHTML = isPrintable(b)
        ? `Bayt ${b} (${hex}${nm}) → <code>${esc(c)}</code>, kendisi. Yazdırılabilir.`
        : `Bayt ${b} (${hex}${nm}) → U+${cp.toString(16).toUpperCase().padStart(4, '0')} <code>${esc(c)}</code> · 256 + ${cp - 256}`;
    };
    grid.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) pick(b); });
    grid.addEventListener('focusin', (e) => { const b = e.target.closest('button'); if (b) pick(b); });
    if (!reduced) { grid.classList.add('run'); whenSeen(root, () => grid.classList.add('in')); }
    pick(grid.children[32]);
    sel.blur?.();
  };

  /* 6 end-to-end player */
  W.e2e = (root) => {
    const NAMES = ['"fn_add_numbers"', '"fn_greet"', '"fn_reverse_string"', '"fn_get_square_root"', '"fn_substitute_string_with_regex"'];
    const P_NAME = 'Available functions:\n- fn_add_numbers: Add two numbers together and return their sum.\n- fn_greet: Generate a greeting message for a person by name.\n- fn_reverse_string: Reverse a string and return the reversed result.\n- fn_get_square_root: Calculate the square root of a number.\n- fn_substitute_string_with_regex: Replace all occurrences matching a regex pattern in a string.\n\nWhat is the sum of 2 and 3?\nfunction name: ';
    const P_A = 'Function: fn_add_numbers\nDescription: Add two numbers together and return their sum.\nWhat is the sum of 2 and 3?\nfirst argument (a) value: ';
    const P_B = 'Function: fn_add_numbers\nDescription: Add two numbers together and return their sum.\nWhat is the sum of 2 and 3?\na: 2.0\nsecond argument (b) value: ';
    const P_G = 'Function: fn_greet\nDescription: Generate a greeting message for a person by name.\nGreet shrek\nfirst argument (name) value: ';
    const SC = {
      sum: {
        prompt: 'What is the sum of 2 and 3?',
        steps: [
          { ph: 'Aşama 1 · fonksiyon adı', p: P_NAME, so: '', valid: ['"', '"fn'], pick: '"', left: 5 },
          { ph: 'Aşama 1 · fonksiyon adı', p: P_NAME, so: '"', valid: ['fn', 'f', 'fn_'], pick: 'fn', left: 5 },
          { ph: 'Aşama 1 · fonksiyon adı', p: P_NAME, so: '"fn', valid: ['_', '_add', '_g', '…'], pick: '_add', left: 1 },
          { ph: 'Aşama 1 · fonksiyon adı', p: P_NAME, so: '"fn_add', valid: ['_numbers', '_', '…'], pick: '_numbers', left: 1 },
          { ph: 'Aşama 1 · fonksiyon adı', p: P_NAME, so: '"fn_add_numbers', valid: ['"'], pick: '"', left: 1, set: { name: 'fn_add_numbers' }, say: 'Tek aday kaldı ve tamamen üretildi → bitti.' },
          { ph: 'Aşama 2 · parametre a (number)', p: P_A, so: '', done: false, valid: ['0-9', '-'], pick: '2' },
          { ph: 'Aşama 2 · parametre a (number)', p: P_A, so: '2', done: true, valid: ['Ċ', '0-9', '.'], pick: 'Ċ', set: { a: '2.0' }, say: 'Ċ → dur. float("2") = 2.0, context = "\\na: 2.0"' },
          { ph: 'Aşama 2 · parametre b (number)', p: P_B, so: '', done: false, valid: ['0-9', '-'], pick: '3' },
          { ph: 'Aşama 2 · parametre b (number)', p: P_B, so: '3', done: true, valid: ['Ċ', '0-9', '.'], pick: 'Ċ', set: { b: '3.0' }, say: 'Ċ → dur. float("3") = 3.0. Toplam 9 forward pass.' },
        ],
        json: (s) => `{\n  "prompt": "What is the sum of 2 and 3?",\n  "name": ${s.name ? `<b>"${s.name}"</b>` : '…'},\n  "parameters": {${s.a ? `"a": <b>${s.a}</b>` : ''}${s.b ? `, "b": <b>${s.b}</b>` : ''}${s.a ? '' : '…'}}\n}`,
      },
      greet: {
        prompt: 'Greet shrek',
        steps: [
          { ph: 'Aşama 2 · parametre name (string)', p: P_G, so: '"', valid: ['sh', '…'], pick: 'sh', note: 'Açılış tırnağını kod koydu; model ilk tokeni seçiyor.' },
          { ph: 'Aşama 2 · parametre name (string)', p: P_G, so: '"sh', valid: ['rek', '…'], pick: 'rek' },
          { ph: 'Aşama 2 · parametre name (string)', p: P_G, so: '"shrek', valid: ['"', '…'], pick: '"', set: { name: 'shrek' }, say: 'İlk tırnak = kapanış. decode_bpe_string(\'"shrek"\') → strip(\'"\') → shrek' },
        ],
        json: (s) => `{\n  "prompt": "Greet shrek",\n  "name": "fn_greet",\n  "parameters": {${s.name ? `"name": <b>"${s.name}"</b>` : '…'}}\n}`,
      },
    };
    let sc = 'sum'; let k = 0; let timer = null;
    const pre = $('.e2e-pre', root); const phase = $('.e2e-phase', root); const so = $('.e2e-so', root); const valid = $('.e2e-valid', root);
    const candsW = $('.e2e-cands-w', root); const cands = $('.e2e-cands', root); const json = $('.e2e-json', root); const n = $('.e2e-n', root);
    const playBtn = $('[data-act="play"]', root);
    const draw = () => {
      const S = SC[sc]; const steps = S.steps;
      const state = {};
      steps.slice(0, k).forEach((s) => Object.assign(state, s.set ?? {}));
      const cur = k > 0 ? steps[k - 1] : null;
      const upcoming = steps[Math.min(k, steps.length - 1)];
      const p = (cur ?? upcoming).p;
      pre.innerHTML = esc(p) + '<mark>▍</mark>';
      if (!cur) {
        phase.textContent = sc === 'sum' ? 'Hazır: 5 fonksiyon adayı. "İleri"ye bas.' : 'fn_greet seçildi. String üretimi başlıyor.';
        so.textContent = steps[0].so; valid.innerHTML = '<span class="chip k">henüz adım yok</span>';
      } else {
        phase.textContent = `${cur.ph} · adım ${k}`;
        so.textContent = cur.so;
        valid.innerHTML = cur.valid.map((t) => `<span class="chip ${t === cur.pick ? 'pick' : ''}"><code class="t">${esc(t)}</code></span>`).join('') + `<span class="chip k">${esc(cur.say ?? cur.note ?? `model seçti: ${cur.pick}`)}</span>`;
      }
      const showCands = sc === 'sum' && (!cur || k <= 5);
      candsW.hidden = false;
      if (showCands) {
        candsW.querySelector('dt').textContent = 'Adaylar';
        const after = cur ? cur.so + cur.pick : '';
        const left = cur ? NAMES.filter((c) => c.startsWith(after)) : NAMES;
        cands.innerHTML = NAMES.map((c) => `<li class="${left.includes(c) ? (left.length === 1 ? 'in' : '') : 'out'}"><code class="t">${esc(c)}</code></li>`).join('');
      } else if (cur && 'done' in cur) {
        candsW.querySelector('dt').textContent = 'Tamam mı? (is_complete_number)';
        cands.innerHTML = `<li class="${cur.done ? 'in' : 'out'}">${cur.done ? 'evet, Ċ geçerli' : 'hayır, en az bir rakam gerekli'}</li>`;
      } else if (sc === 'greet') {
        candsW.querySelector('dt').textContent = 'Kural';
        cands.innerHTML = '<li>Ortada tırnak olamaz; tırnak sadece en sonda (kapanış).</li>';
      } else candsW.hidden = true;
      json.innerHTML = S.json(state);
      n.textContent = `forward pass: ${k}`;
    };
    const next = () => { if (k < SC[sc].steps.length) { k++; draw(); return true; } return false; };
    const stop = () => { clearInterval(timer); timer = null; playBtn.textContent = 'Oynat'; playBtn.setAttribute('aria-pressed', 'false'); };
    $('[data-act="next"]', root).addEventListener('click', () => { stop(); next(); });
    $('[data-act="prev"]', root).addEventListener('click', () => { stop(); if (k > 0) { k--; draw(); } });
    $('[data-act="reset"]', root).addEventListener('click', () => { stop(); k = 0; draw(); });
    playBtn.addEventListener('click', () => {
      if (timer) return stop();
      if (k >= SC[sc].steps.length) k = 0;
      playBtn.textContent = 'Durdur'; playBtn.setAttribute('aria-pressed', 'true');
      next(); timer = setInterval(() => { if (!next()) stop(); }, 1300);
    });
    radio($('.seg', root), (b) => { stop(); sc = b.dataset.s; k = 0; draw(); });
    draw();
  };

  $$('[data-w]').forEach((el) => { try { W[el.dataset.w]?.(el); } catch (err) { console.error(el.dataset.w, err); } });
  measure();
})();
