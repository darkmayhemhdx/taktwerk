/* Taktwerk – Oberfläche */
(function () {
  'use strict';
  const TW = window.TW, S = TW.S, G = TW.G, clamp = TW.clamp;
  let E;
  const $ = (s, r = document) => r.querySelector(s);
  function h(tag, props, ...kids) {
    const e = document.createElement(tag);
    if (props) for (const k in props) {
      if (k === 'class') e.className = props[k];
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), props[k]);
      else e.setAttribute(k, props[k]);
    }
    for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
    return e;
  }
  const cur = () => S.pat.parts[S.part];
  const pad2 = (n) => String(n).padStart(2, '0');
  const short = (s) => s.replace('HiHat', 'HH').replace('Rauschen', 'Noise');
  const de = (v) => String(v).replace('.', ',');

  /* ---------- Anzeige ---------- */
  let roUntil = 0, toastT = 0;
  function say(text) { const el = $('#lcdPart'); el.textContent = text; el.className = 'ro'; roUntil = performance.now() + 1400; }
  function toast(text) { const t = $('#toast'); t.textContent = text; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2600); }
  TW.toast = toast;
  function lcd() {
    $('#patNo').textContent = TW.pad3(S.pi) + (S.pend != null ? '→' + TW.pad3(S.pend) : '');
    $('#patName').textContent = S.pat.name + (S.dirty && !G.auto ? ' *' : '');
    $('#bpm').textContent = de(S.pat.bpm.toFixed(1));
    if (!roUntil) { const el = $('#lcdPart'); el.className = ''; el.textContent = `P${pad2(S.part + 1)} · ${TW.OSCS[cur().osc].n}${cur().mute ? ' · stumm' : ''}`; }
    $('#writeBtn').classList.toggle('warn', S.dirty && !G.auto);
    lcdPos();
  }
  let pos = null;
  function lcdPos() {
    const el = $('#lcdPos'), sp = TW.spb(S.pat);
    if (S.playing && pos) el.textContent = `${S.rec ? 'REC ' : ''}${pos.bar + 1}.${pad2(pos.st + 1)}`;
    else if (S.rec) el.textContent = `STEP ${Math.floor(S.stepPos / sp) + 1}.${pad2((S.stepPos % sp) + 1)}`;
    else el.textContent = `${S.pat.length} T · ${TW.BEATS[S.pat.beat]}`;
  }

  /* ---------- Drehregler ---------- */
  const syncName = (v) => TW.SYNC_N[Math.round((v / 127) * (TW.SYNC_N.length - 1))];
  const K = {
    pitch: { l: 'Pitch', min: -24, max: 24, def: 0, bip: 1, f: (v) => (v > 0 ? '+' : '') + v },
    glide: { l: 'Glide', min: 0, max: 127, def: 0 },
    oscEdit: { l: 'Edit', min: 0, max: 127, def: 0, dyn: () => TW.OSCS[cur().osc].e || 'Edit' },
    cutoff: { l: 'Cutoff', min: 0, max: 127, def: 127 },
    reso: { l: 'Reso', min: 0, max: 127, def: 0 },
    egInt: { l: 'EG Int', min: -63, max: 63, def: 0, bip: 1, f: (v) => (v > 0 ? '+' : '') + v },
    modSpeed: { l: 'Speed', min: 0, max: 127, def: 60, f: (v) => ((TW.MODS[cur().modType] || {}).sync ? syncName(v) : String(v)) },
    modDepth: { l: 'Depth', min: 0, max: 127, def: 0 },
    level: { l: 'Level', min: 0, max: 127, def: 100 },
    pan: { l: 'Pan', min: -63, max: 63, def: 0, bip: 1, f: (v) => (v === 0 ? 'Mitte' : (v < 0 ? 'L' : 'R') + Math.abs(v)) },
    attack: { l: 'Attack', min: 0, max: 127, def: 0 },
    decay: { l: 'Decay/Rel', min: 0, max: 127, def: 127 },
    ifxEdit: { l: 'IFX Edit', min: 0, max: 127, def: 64, dyn: () => (TW.IFX[cur().ifx] || {}).e || 'IFX Edit' },
  };
  const knobs = {};
  function arc(a0, a1, r = 24) {
    const pt = (a) => { const rad = (a * Math.PI) / 180; return (32 + r * Math.sin(rad)).toFixed(2) + ' ' + (32 - r * Math.cos(rad)).toFixed(2); };
    return `M${pt(a0)}A${r} ${r} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} 1 ${pt(a1)}`;
  }
  function mkKnob(name) {
    const m = K[name], el = h('div', { class: 'knob', role: 'slider', tabindex: '0', 'aria-valuemin': m.min, 'aria-valuemax': m.max });
    el.innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true"><path class="k-track" d="${arc(-135, 135)}"/><path class="k-val"/><circle class="k-cap" cx="32" cy="32" r="15"/><line class="k-ptr" x1="32" y1="29" x2="32" y2="20"/></svg><span class="k-num"></span><span class="k-lab"></span>`;
    const val = $('.k-val', el), ptr = $('.k-ptr', el), num = $('.k-num', el), lab = $('.k-lab', el);
    const fmt = (v) => (m.f ? m.f(v) : String(v));
    const draw = () => {
      const v = cur()[name], a = -135 + (270 * (v - m.min)) / (m.max - m.min);
      val.setAttribute('d', m.bip ? (Math.abs(a) < 1.5 ? '' : arc(Math.min(0, a), Math.max(0, a))) : a <= -134 ? '' : arc(-135, a));
      ptr.setAttribute('transform', `rotate(${a.toFixed(1)} 32 32)`);
      num.textContent = fmt(v);
      const L = m.dyn ? m.dyn() : m.l;
      if (lab.textContent !== L) { lab.textContent = L; el.setAttribute('aria-label', L); }
      el.setAttribute('aria-valuenow', v);
    };
    const set = (v) => {
      v = clamp(Math.round(v), m.min, m.max);
      if (v === cur()[name]) return;
      TW.setParam(name, v); draw(); say(`${lab.textContent}  ${fmt(v)}`);
    };
    let y0 = 0, v0 = 0, id = null;
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); E.resume(); id = e.pointerId; el.setPointerCapture(id); y0 = e.clientY; v0 = cur()[name]; el.classList.add('act'); say(`${lab.textContent}  ${fmt(v0)}`); });
    el.addEventListener('pointermove', (e) => { if (e.pointerId === id) set(v0 + ((y0 - e.clientY) / (e.shiftKey ? 640 : 170)) * (m.max - m.min)); });
    const up = (e) => { if (e.pointerId === id) { id = null; el.classList.remove('act'); } };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('dblclick', () => set(m.def));
    el.addEventListener('wheel', (e) => { e.preventDefault(); set(cur()[name] + (e.deltaY < 0 ? 1 : -1) * (e.shiftKey ? 8 : 1)); }, { passive: false });
    el.addEventListener('keydown', (e) => { const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key]; if (d) { e.preventDefault(); set(cur()[name] + d); } });
    knobs[name] = { el, draw };
    return el;
  }
  const refreshKnobs = () => { for (const k in knobs) knobs[k].draw(); };

  /* ---------- Bausteine ---------- */
  function selr(id, label, onOpen, onStep) {
    if (!onStep) return h('div', { class: 'selr solo' }, h('button', { class: 'sel-main', id, type: 'button', onclick: onOpen }, h('small', null, label), h('b')));
    return h('div', { class: 'selr' },
      h('button', { class: 'sel-main', id, type: 'button', onclick: onOpen }, h('small', null, label), h('b')),
      h('button', { class: 'sel-step', type: 'button', 'aria-label': label + ' zurück', onclick: () => onStep(-1) }, '‹'),
      h('button', { class: 'sel-step', type: 'button', 'aria-label': label + ' weiter', onclick: () => onStep(1) }, '›'));
  }
  const tg = (id, label, fn) => h('button', { class: 'tg', id, type: 'button', onclick: fn }, label);
  function hold(btn, fn) {
    let t1 = 0, t2 = 0;
    const stop = () => { clearTimeout(t1); clearInterval(t2); };
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); fn(); stop(); t1 = setTimeout(() => { t2 = setInterval(fn, 55); }, 380); });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, stop);
    btn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } });
  }
  function preview() {
    if (S.playing) return;
    const p = cur();
    E.resume(); E.noteOn(S.part, p, S.lastNotes[S.part][0] || 60, 100, E.ctx.currentTime, 0.3);
  }
  function stepParam(name, list, d) {
    const v = clamp(cur()[name] + d, 0, list.length - 1);
    TW.setParam(name, v); refreshPanel(); say(list[v].n);
    if (name === 'osc') preview();
  }
  function setFilter(g) {
    let nx = 0;
    if (g !== 'off') { const list = TW.FILTERS.map((f, i) => (f.g === g ? i : -1)).filter((i) => i >= 0), k = list.indexOf(cur().filterType); nx = list[(k + 1) % list.length]; }
    TW.setParam('filterType', nx); refreshPanel(); say('Filter  ' + TW.FILTERS[nx].n);
  }
  function togPart(name) { TW.setParam(name, !cur()[name]); refreshPanel(); }
  function setMFX(v) { S.pat.mfx = clamp(v, 0, TW.MFX.length - 1); TW.applyPat(); TW.dirty(); refreshPanel(); say('MFX  ' + TW.MFX[S.pat.mfx].n); }
  function mfxHold() { S.pat.mfxHold = !S.pat.mfxHold; E.mfxTouch(S.pat.mfxHold, S.pat.mfxX, S.pat.mfxY); TW.dirty(); refreshPanel(); }

  /* ---------- Touchpad ---------- */
  let tpad, tpDot, tpId = null, tpNote = null;
  function tpMove(e, down) {
    const r = tpad.getBoundingClientRect(), x = clamp((e.clientX - r.left) / r.width, 0, 1), y = clamp(1 - (e.clientY - r.top) / r.height, 0, 1);
    tpDot.style.left = x * 100 + '%'; tpDot.style.top = (1 - y) * 100 + '%';
    if (S.padMode === 'mfx') {
      const d = TW.MFX[S.pat.mfx];
      S.pat.mfxX = x; S.pat.mfxY = y; E.mfxTouch(true, x, y);
      say(d.b ? `${d.x} ${Math.round(x * 100)} · ${d.y} ${Math.round(y * 100)}` : 'Kein Master-Effekt gewählt');
    } else {
      const note = TW.keyNote(S.pat, Math.floor(x * 15.99), S.oct);
      S.arpGate = 0.2 + y * 1.3;
      if (down || note !== tpNote) { tpNote = note; TW.padDown('tp', S.part, [note], S.gateArp ? 100 : Math.round(50 + 77 * y)); say('Touch Scale  ' + TW.noteName(note)); }
    }
  }
  function tpUp(e) {
    if (e.pointerId !== tpId) return;
    tpId = null; tpad.classList.remove('act');
    if (S.padMode === 'mfx') { if (!S.pat.mfxHold) E.mfxTouch(false); TW.dirty(); }
    else { TW.padUp('tp'); S.arpGate = 1; }
  }
  function mkTouchpad() {
    tpDot = h('i', { class: 'tp-dot' });
    tpad = h('div', { class: 'tpad', id: 'tpad', role: 'application', 'aria-label': 'Touchpad' }, tpDot, h('span', { class: 'tp-lab tp-x', id: 'tpX' }), h('span', { class: 'tp-lab tp-y', id: 'tpY' }));
    tpad.addEventListener('pointerdown', (e) => { e.preventDefault(); E.resume(); tpId = e.pointerId; tpad.setPointerCapture(tpId); tpad.classList.add('act'); tpMove(e, true); });
    tpad.addEventListener('pointermove', (e) => { if (e.pointerId === tpId) tpMove(e, false); });
    tpad.addEventListener('pointerup', tpUp); tpad.addEventListener('pointercancel', tpUp);
    return tpad;
  }

  /* ---------- Pads ---------- */
  const MODES = [['trigger', 'Trigger'], ['seq', 'Sequencer'], ['keys', 'Keyboard'], ['chord', 'Chord'], ['jump', 'Step Jump'], ['pset', 'Pattern Set'], ['mute', 'Part Mute'], ['erase', 'Part Erase']];
  const pads = [], lp = [], lpF = [], hitUntil = new Float64Array(16), hitShown = new Array(16).fill(false);
  let phShown = -1;
  const stepIdx = (k) => S.bar * 16 + k;
  function stepOk(k) {
    const sp = TW.spb(S.pat);
    if (k >= sp || S.bar >= S.pat.length) return false;
    return !(S.bar === S.pat.length - 1 && k >= Math.min(cur().lastStep, sp));
  }
  function vel(e, el, p) {
    if (!G.velPos || !p.trigVel) return 100;
    const r = el.getBoundingClientRect();
    return Math.round(clamp(127 - ((e.clientY - r.top) / r.height) * 80, 45, 127));
  }
  function releaseAll() {
    for (const key of [...S.held.keys()]) TW.padUp(key);
    S.erase.clear(); S.jump = null;
    for (let k = 0; k < 16; k++) { clearTimeout(lp[k]); lpF[k] = false; pads[k] && pads[k].classList.remove('down'); }
  }
  function setMode(m) { releaseAll(); S.mode = m; refreshModes(); refreshPads(); refreshAux(); }
  function selectPart(i) { S.part = clamp(i, 0, 15); refreshPanel(); refreshPads(); refreshAux(); lcd(); }
  function toggleStep(k) {
    if (!stepOk(k)) return;
    const p = cur(), si = stepIdx(k);
    if (p.steps[si]) p.steps[si] = null;
    else {
      p.steps[si] = { n: S.lastNotes[S.part].slice(0, 4), v: 100, g: 0.75 };
      if (!S.playing && !p.mute) for (const n of p.steps[si].n) E.noteOn(S.part, p, n, 100, E.ctx.currentTime, 0.2);
    }
    TW.dirty(); refreshPads();
  }
  function padPress(k, e) {
    E.resume();
    const el = pads[k];
    el.classList.add('down');
    switch (S.mode) {
      case 'trigger':
        if (S.part !== k) selectPart(k);
        el.classList.add('down');
        TW.padDown('p' + k, k, [60], vel(e, el, S.pat.parts[k]), true);
        break;
      case 'seq': lpF[k] = false; lp[k] = setTimeout(() => { lpF[k] = true; stepSheet(k); }, 430); break;
      case 'keys': TW.padDown('k' + k, S.part, [TW.keyNote(S.pat, k, S.oct)], vel(e, el, cur())); break;
      case 'chord': TW.padDown('k' + k, S.part, TW.chordNotes(S.pat, k, S.oct), vel(e, el, cur())); break;
      case 'jump':
        if (S.playing) { const sp = TW.spb(S.pat); S.jumpBase = S.tick - (S.tick % sp); S.jump = k; }
        else toast('Step Jump wirkt bei laufendem Sequencer');
        break;
      case 'pset': lpF[k] = false; lp[k] = setTimeout(() => { lpF[k] = true; G.pset[k] = S.pi; TW.saveG(); refreshPads(); toast(`Pattern ${TW.pad3(S.pi)} liegt jetzt auf Pad ${k + 1}`); }, 600); break;
      case 'mute': { const p = S.pat.parts[k]; p.mute = !p.mute; E.syncPart(k, p); TW.dirty(); refreshPads(); lcd(); break; }
      case 'erase':
        if (S.playing) S.erase.add(k);
        else toast('Part Erase löscht bei laufendem Sequencer. Alles leeren: Menü → Part → Sequenz leeren');
        break;
    }
  }
  function padRelease(k) {
    pads[k].classList.remove('down');
    clearTimeout(lp[k]);
    switch (S.mode) {
      case 'trigger': TW.padUp('p' + k); break;
      case 'keys': case 'chord': TW.padUp('k' + k); break;
      case 'seq': if (!lpF[k]) toggleStep(k); lpF[k] = false; break;
      case 'jump': if (S.jump === k) S.jump = null; break;
      case 'pset': if (!lpF[k]) TW.selectPat(G.pset[k]); lpF[k] = false; break;
      case 'erase': S.erase.delete(k); break;
    }
  }
  function mkPads() {
    const wrap = h('div', { class: 'pads', id: 'pads' });
    for (let k = 0; k < 16; k++) {
      const b = h('button', { class: 'pad', type: 'button' }, h('b'), h('small'));
      let pid = null;
      b.addEventListener('pointerdown', (e) => { if (pid != null) return; e.preventDefault(); pid = e.pointerId; try { b.setPointerCapture(pid); } catch (err) {} padPress(k, e); });
      const up = (e) => { if (e.pointerId !== pid) return; pid = null; padRelease(k); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
      b.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.repeat) { e.preventDefault(); const r = b.getBoundingClientRect(); padPress(k, { clientY: r.top + r.height / 3 }); } });
      b.addEventListener('keyup', (e) => { if (e.key === 'Enter') { e.preventDefault(); padRelease(k); } });
      pads.push(b); wrap.append(b);
    }
    return wrap;
  }
  function refreshPads() {
    const pat = S.pat, p = cur(), sp = TW.spb(pat);
    for (let k = 0; k < 16; k++) {
      const el = pads[k], pk = pat.parts[k];
      let lab = String(k + 1), sub = '', cls = 'pad';
      switch (S.mode) {
        case 'trigger': sub = short(TW.OSCS[pk.osc].n); if (k === S.part) cls += ' sel'; if (pk.mute) cls += ' dim'; break;
        case 'seq': {
          if (!stepOk(k)) cls += ' na';
          else { const st = p.steps[stepIdx(k)]; if (st) { cls += ' on'; sub = st.n.length > 1 ? st.n.length + ' Noten' : TW.OSCS[p.osc].k !== 'pcm' || st.n[0] !== 60 ? TW.noteName(st.n[0]) : ''; } }
          if (k % 4 === 0) cls += ' beat';
          break;
        }
        case 'keys': { const n = TW.keyNote(pat, k, S.oct); lab = TW.noteName(n); if ((((n - pat.key) % 12) + 12) % 12 === 0) cls += ' root'; break; }
        case 'chord': { const ns = TW.chordNotes(pat, k, S.oct); lab = TW.chordName(ns); if ((((ns[0] - pat.key) % 12) + 12) % 12 === 0) cls += ' root'; break; }
        case 'jump': if (k >= sp) cls += ' na'; if (k % 4 === 0) cls += ' beat'; break;
        case 'pset': { const pi = G.pset[k]; lab = TW.pad3(pi); sub = TW.patName(pi); if (pi === S.pi) cls += ' on'; if (pi === S.pend) cls += ' pend'; break; }
        case 'mute': sub = pk.mute ? 'stumm' : short(TW.OSCS[pk.osc].n); cls += pk.mute ? ' dim' : ' on'; break;
        case 'erase': sub = short(TW.OSCS[pk.osc].n); cls += ' warn'; break;
      }
      if (el._lab !== lab) { el._lab = lab; el.firstChild.textContent = lab; }
      if (el._sub !== sub) { el._sub = sub; el.lastChild.textContent = sub; }
      el.className = cls + (el.classList.contains('down') ? ' down' : '');
    }
    phShown = -1; hitShown.fill(false);
  }

  /* ---------- Auffrischen ---------- */
  function refreshPanel() {
    const p = cur(), pat = S.pat, fg = TW.FILTERS[p.filterType].g;
    refreshKnobs();
    $('#selOsc b').textContent = TW.OSCS[p.osc].n;
    $('#selMod b').textContent = TW.MODS[p.modType].n;
    $('#selIfx b').textContent = TW.IFX[p.ifx].n;
    $('#selMfx b').textContent = TW.MFX[pat.mfx].n;
    for (const g of ['lp', 'hp', 'bp', 'off']) { const b = $('#f-' + g); b.classList.toggle('on', fg === g); if (g !== 'off') b.textContent = fg === g ? TW.FILTERS[p.filterType].n.replace(' dB', '') : g.toUpperCase() + 'F'; }
    $('#tgEg').classList.toggle('on', !!p.ampEG);
    $('#tgIfx').classList.toggle('on', !!p.ifxOn);
    $('#tgSend').classList.toggle('on', !!p.mfxSend);
    $('#tgHold').classList.toggle('on', !!pat.mfxHold);
    $('#tgHold2').classList.toggle('on', !!pat.mfxHold);
    $('#tgArp').classList.toggle('on', S.gateArp);
    $('#tpMfx').classList.toggle('on', S.padMode === 'mfx');
    $('#tpScale').classList.toggle('on', S.padMode === 'scale');
    const d = TW.MFX[pat.mfx];
    $('#tpX').textContent = S.padMode === 'mfx' ? d.x + ' →' : 'Tonhöhe →';
    $('#tpY').textContent = S.padMode === 'mfx' ? '↑ ' + d.y : S.gateArp ? '↑ Gate' : '↑ Anschlag';
    tpad.classList.toggle('hold', S.padMode === 'mfx' && !!pat.mfxHold);
    if (S.padMode === 'mfx' && tpId == null) { tpDot.style.left = pat.mfxX * 100 + '%'; tpDot.style.top = (1 - pat.mfxY) * 100 + '%'; }
  }
  function refreshModes() { for (const b of $('#modes').children) b.classList.toggle('on', b.dataset.m === S.mode); }
  function refreshAux() {
    $('#partLab').textContent = 'P' + pad2(S.part + 1);
    $('#octLab').textContent = (S.oct > 0 ? '+' : '') + S.oct;
    const bars = $('#bars').children;
    for (let b = 0; b < 4; b++) { bars[b].classList.toggle('on', b === S.bar); bars[b].classList.toggle('na', b >= S.pat.length); bars[b].classList.toggle('now', S.playing && !!pos && pos.bar === b); }
    bars[4].classList.toggle('on', S.chase);
  }
  function refreshTransport() {
    const pb = $('#playBtn');
    pb.classList.toggle('on', S.playing); pb.textContent = S.playing ? '■ Stop' : '▶ Play';
    $('#recBtn').classList.toggle('on', S.rec);
    $('#tapBtn').textContent = S.rec && !S.playing ? 'Pause ›' : 'Tap';
  }
  function refreshAll() { if (S.bar >= S.pat.length) S.bar = 0; lcd(); refreshPanel(); refreshModes(); refreshAux(); refreshPads(); refreshTransport(); }

  /* ---------- Fenster ---------- */
  function closeSheet() { const w = $('#sheet'); if (w.hidden) return; w.hidden = true; w.innerHTML = ''; S.ui = true; }
  function sheet(title, build) {
    const w = $('#sheet'), body = h('div', { class: 'sh-body' });
    w.innerHTML = '';
    w.append(h('div', { class: 'sh-back', onclick: closeSheet }),
      h('div', { class: 'sheet', role: 'dialog', 'aria-label': title }, h('div', { class: 'sh-head' }, h('h2', null, title), h('button', { class: 'sh-x', type: 'button', onclick: closeSheet }, 'Fertig')), body));
    w.hidden = false;
    build(body);
  }
  function pick(title, items, get, set) {
    sheet(title, (body) => {
      const cats = [...new Set(items.map((x) => x.c).filter(Boolean))], chips = h('div', { class: 'chips' }), list = h('div', { class: 'picks' });
      let cat = cats.length ? items[get()].c : null;
      const render = () => {
        chips.innerHTML = '';
        for (const c of cats) chips.append(h('button', { type: 'button', class: c === cat ? 'on' : '', onclick: () => { cat = c; render(); } }, c));
        list.innerHTML = '';
        items.forEach((it, i) => { if (!cat || it.c === cat) list.append(h('button', { type: 'button', class: i === get() ? 'on' : '', onclick: () => { set(i); render(); } }, it.n)); });
      };
      if (cats.length) body.append(chips);
      body.append(list); render();
    });
  }
  const row = (l, ctl) => h('div', { class: 'row' }, h('span', null, l), ctl);
  function sel(opts, get, set) {
    const s = h('select');
    opts.forEach((o, i) => s.append(h('option', { value: i }, o)));
    s.value = get(); s.addEventListener('change', () => set(+s.value));
    return s;
  }
  function num(get, set, min, max, step = 1, fmt = String) {
    const v = h('b'), upd = () => { v.textContent = fmt(get()); };
    const mk = (d, txt) => { const b = h('button', { type: 'button', 'aria-label': d < 0 ? 'weniger' : 'mehr' }, txt); hold(b, () => { set(clamp(Math.round((get() + d * step) * 100) / 100, min, max)); upd(); }); return b; };
    const w = h('div', { class: 'num' }, mk(-1, '−'), v, mk(1, '+'));
    upd();
    return w;
  }
  function tog(get, set) {
    const b = h('button', { class: 'tog', type: 'button' }), upd = () => { b.classList.toggle('on', !!get()); b.textContent = get() ? 'An' : 'Aus'; };
    b.onclick = () => { set(!get()); upd(); };
    upd();
    return b;
  }
  const act = (label, fn) => h('button', { class: 'act', type: 'button', onclick: fn }, label);
  function danger(label, fn) {
    let armed = 0;
    const b = h('button', { class: 'act danger', type: 'button' }, label);
    b.onclick = () => { if (armed) { clearTimeout(armed); armed = 0; b.textContent = label; fn(); } else { b.textContent = 'Sicher? Nochmal tippen'; armed = setTimeout(() => { armed = 0; b.textContent = label; }, 3000); } };
    return b;
  }
  const pp = (k, v) => { S.pat[k] = v; TW.applyPat(); TW.dirty(); S.ui = true; };

  function menu(tab) {
    sheet('Menü', (body) => {
      const tabs = h('div', { class: 'tabs2' }), pane = h('div', { class: 'pane' });
      const T = { part: ['Part ' + (S.part + 1), partPane], pattern: ['Pattern', patPane], global: ['Global', globalPane] };
      const show = (k) => { for (const b of tabs.children) b.classList.toggle('on', b.dataset.k === k); pane.innerHTML = ''; T[k][1](pane); };
      for (const k in T) tabs.append(h('button', { type: 'button', 'data-k': k, onclick: () => show(k) }, T[k][0]));
      body.append(tabs, pane); show(tab || 'part');
    });
  }
  function partPane(el) {
    const i = S.part, p = cur(), sp = (k) => (v) => TW.setParam(k, v);
    let dst = (i + 1) % 16;
    el.append(
      row('Voice Assign', sel(TW.VOICES, () => p.voice, sp('voice'))),
      row('Part Priority', sel(['Normal', 'Hoch'], () => p.priority, sp('priority'))),
      row('Motion Sequence', sel(TW.MOTION, () => p.motionMode, sp('motionMode'))),
      row('Trigger-Velocity', tog(() => p.trigVel, sp('trigVel'))),
      row('Groove', sel(TW.GROOVES.map((g) => g.n), () => p.grooveType, sp('grooveType'))),
      row('Groove-Stärke', num(() => p.grooveDepth, sp('grooveDepth'), 0, 127)),
      row('Last Step', num(() => p.lastStep, (v) => { TW.setParam('lastStep', v); S.padsDirty = true; }, 1, 16)),
      row('Kopieren nach Part', h('div', { class: 'acts' }, sel(Array.from({ length: 16 }, (_, k) => 'Part ' + (k + 1)), () => dst, (v) => { dst = v; }), act('Kopieren', () => { TW.copyPart(i, dst); toast(`Part ${i + 1} nach Part ${dst + 1} kopiert`); }))),
      h('div', { class: 'acts' },
        danger('Sequenz leeren', () => { TW.clearSteps(i); toast('Sequenz geleert'); }),
        danger('Motion leeren', () => { TW.clearMotion(i); toast('Motion-Sequenz geleert'); }),
        danger('Sound zurücksetzen', () => { TW.initPart(i); menu('part'); toast('Sound zurückgesetzt'); })),
      h('p', { class: 'hint' }, 'Motion aufnehmen: Play und Rec an, dann einen Regler drehen. Die Bewegung wird einen Durchlauf lang mitgeschrieben.'));
  }
  function patPane(el) {
    const pat = S.pat, name = h('input', { type: 'text', maxlength: '24', value: pat.name, 'aria-label': 'Pattern-Name' });
    name.addEventListener('input', () => { pat.name = name.value || 'Ohne Namen'; TW.dirty(); S.lcd = true; });
    let dst = (S.pi + 1) % TW.NPAT;
    const chain = ['Aus'].concat(Array.from({ length: TW.NPAT }, (_, i) => `${TW.pad3(i)} ${TW.patName(i)}`));
    el.append(
      row('Name', name),
      row('Tempo', num(() => pat.bpm, (v) => TW.setBpm(v), 20, 300, 1, (v) => de(v.toFixed(1)))),
      row('Tempo fein', num(() => pat.bpm, (v) => TW.setBpm(v), 20, 300, 0.1, (v) => de(v.toFixed(1)))),
      row('Swing', num(() => pat.swing, (v) => pp('swing', v), -48, 48)),
      row('Länge (Takte)', num(() => pat.length, (v) => pp('length', v), 1, 4)),
      row('Beat', sel(TW.BEATS, () => pat.beat, (v) => pp('beat', v))),
      row('Tonart', sel(TW.NOTES, () => pat.key, (v) => pp('key', v))),
      row('Skala', sel(TW.SCALES.map((s) => s[0]), () => pat.scale, (v) => pp('scale', v))),
      row('Chord Set', sel(TW.CHORD_SETS.map((s) => s.n), () => pat.chordSet, (v) => pp('chordSet', v))),
      row('Gate Arp', sel(TW.GATE_ARPS.map((s) => s.n), () => pat.gateArp, (v) => pp('gateArp', v))),
      row('Pattern-Lautstärke', num(() => pat.level, (v) => pp('level', v), 0, 127)),
      row('Master-Effekt', sel(TW.MFX.map((s) => s.n), () => pat.mfx, (v) => pp('mfx', v))),
      row('Alternate 13–14', tog(() => pat.alt1314, (v) => pp('alt1314', v))),
      row('Alternate 15–16', tog(() => pat.alt1516, (v) => pp('alt1516', v))),
      row('Chain To', sel(chain, () => pat.chainTo + 1, (v) => pp('chainTo', v - 1))),
      row('Chain Repeat', num(() => pat.chainRepeat, (v) => pp('chainRepeat', v), 1, 64)),
      row('Kopieren nach Platz', h('div', { class: 'acts' }, num(() => dst + 1, (v) => { dst = v - 1; }, 1, TW.NPAT), act('Kopieren', () => { if (TW.copyPatTo(dst)) toast(`Pattern auf Platz ${TW.pad3(dst)} kopiert`); }))),
      h('div', { class: 'acts' }, danger('Pattern leeren', () => { TW.clearPattern(); menu('pattern'); toast('Pattern geleert'); })));
  }
  function globalPane(el) {
    let loops = 2;
    const file = h('input', { type: 'file', accept: '.json,application/json', hidden: '' });
    file.addEventListener('change', async () => {
      if (!file.files[0]) return;
      try { TW.importData(await file.files[0].text()); toast('Sicherung geladen'); closeSheet(); } catch (e) { toast('Datei ist keine Taktwerk-Sicherung'); }
    });
    const wav = act('Audio exportieren (WAV)', async () => {
      wav.textContent = 'Rechne …'; wav.disabled = true;
      try { const buf = await TW.renderPattern(loops); TW.saveFile(`Taktwerk ${TW.pad3(S.pi)} ${S.pat.name}.wav`, TW.wavBlob(buf)); toast('WAV-Export fertig'); }
      catch (e) { console.error(e); toast('Export fehlgeschlagen'); }
      wav.textContent = 'Audio exportieren (WAV)'; wav.disabled = false;
    });
    el.append(
      row('Auto-Write', tog(() => G.auto, (v) => { G.auto = v; TW.saveG(); if (v && S.dirty) TW.write(); S.lcd = true; })),
      h('p', { class: 'hint' }, 'An: Änderungen werden sofort gespeichert. Aus: wie am Gerät – erst „Write“ sichert, ein Pattern-Wechsel verwirft.'),
      row('Metronom', sel(['Aus', 'Bei Aufnahme', 'Immer'], () => G.metro, (v) => { G.metro = v; TW.saveG(); })),
      row('Anschlag über Tipp-Höhe', tog(() => G.velPos, (v) => { G.velPos = v; TW.saveG(); })),
      row('Gesamtlautstärke', num(() => G.vol, (v) => { G.vol = v; E.setVolume(v); TW.saveG(); }, 0, 127)),
      row('Export-Durchläufe', sel(['1', '2', '4', '8'], () => [1, 2, 4, 8].indexOf(loops), (v) => { loops = [1, 2, 4, 8][v]; })),
      h('div', { class: 'acts' }, wav, act('Sicherung speichern', () => { TW.saveFile('Taktwerk-Sicherung.json', TW.exportData()); toast('Sicherung exportiert'); }), act('Sicherung laden', () => file.click()), file),
      h('div', { class: 'acts' }, danger('Werkszustand herstellen', () => { TW.factoryReset(); closeSheet(); toast('Alle Pattern zurückgesetzt'); })),
      h('p', { class: 'hint' }, `Taktwerk ${TW.VERSION} · ${TW.OSCS.length} Oszillatoren · ${TW.IFX.length - 1} Insert-Effekte · ${TW.MFX.length - 1} Master-Effekte. Leertaste: Play/Stop. Regler: ziehen, Doppelklick setzt zurück, Shift = fein.`));
  }
  function stepSheet(k) {
    if (!stepOk(k)) return;
    pads[k].classList.remove('down');
    const p = cur(), si = stepIdx(k);
    if (!p.steps[si]) { p.steps[si] = { n: S.lastNotes[S.part].slice(0, 4), v: 100, g: 0.75 }; TW.dirty(); }
    sheet(`Step ${S.bar + 1}.${pad2(k + 1)} · Part ${S.part + 1}`, (body) => {
      const st = p.steps[si];
      const aud = () => { if (!p.mute) for (const n of st.n) E.noteOn(S.part, p, n, st.v, E.ctx.currentTime, 0.25); };
      const render = () => {
        body.innerHTML = '';
        const notes = h('div', { class: 'notes' });
        st.n.forEach((n, j) => {
          const ch = (d) => () => { st.n[j] = clamp(st.n[j] + d, 0, 127); S.lastNotes[S.part] = st.n.slice(); TW.dirty(); render(); aud(); };
          notes.append(h('div', { class: 'note' }, h('b', null, TW.noteName(n)),
            h('button', { type: 'button', onclick: ch(-12) }, '−Okt'), h('button', { type: 'button', onclick: ch(-1) }, '−1'), h('button', { type: 'button', onclick: ch(1) }, '+1'), h('button', { type: 'button', onclick: ch(12) }, '+Okt'),
            st.n.length > 1 ? h('button', { type: 'button', 'aria-label': 'Note entfernen', onclick: () => { st.n.splice(j, 1); TW.dirty(); render(); } }, '✕') : null));
        });
        body.append(notes,
          h('div', { class: 'acts' }, st.n.length < 4 ? act('+ Note', () => { st.n.push(clamp(st.n[st.n.length - 1] + 3, 0, 127)); TW.dirty(); render(); aud(); }) : null, act('Anhören', aud)),
          row('Gate (Steps)', num(() => st.g, (v) => { st.g = v; TW.dirty(); }, 0.25, 64, 0.25, (v) => de(v) + (v >= 1 ? ' · gebunden' : ''))),
          row('Velocity', num(() => st.v, (v) => { st.v = v; TW.dirty(); }, 1, 127)),
          h('p', { class: 'hint' }, 'Gate ab 1 bindet an den nächsten Step. Mit Voice Assign „Mono 2“ und Glide entsteht daraus ein Slide.'),
          h('div', { class: 'acts' }, danger('Step löschen', () => { p.steps[si] = null; TW.dirty(); closeSheet(); })));
      };
      render();
    });
  }
  function browser() {
    sheet('Pattern wählen', (body) => {
      const list = h('div', { class: 'plist' });
      for (let i = 0; i < TW.NPAT; i++)
        list.append(h('button', { type: 'button', class: 'pitem' + (i === S.pi ? ' on' : ''), onclick: () => { TW.selectPat(i); closeSheet(); } }, h('b', null, TW.pad3(i)), h('span', null, TW.patName(i)), TW.hasPat(i) ? h('i', null, 'gespeichert') : null));
      body.append(list);
      setTimeout(() => { if (list.children[S.pi]) list.children[S.pi].scrollIntoView({ block: 'center' }); }, 0);
    });
  }

  /* ---------- Aufbau ---------- */
  function build() {
    const app = $('#app');
    const tb = (id, cls, label, fn) => h('button', { class: 'tb ' + cls, id, type: 'button', onclick: fn }, label);
    const bm = h('button', { type: 'button', 'aria-label': 'Tempo langsamer' }, '−'), bp = h('button', { type: 'button', 'aria-label': 'Tempo schneller' }, '+');
    hold(bm, () => TW.setBpm(Math.round(S.pat.bpm) - 1)); hold(bp, () => TW.setBpm(Math.round(S.pat.bpm) + 1));
    const top = h('header', { class: 'top' },
      h('div', { class: 'lcd' },
        h('button', { class: 'lcd-pat', id: 'patBtn', type: 'button', 'aria-label': 'Pattern wählen', onclick: browser }, h('b', { id: 'patNo' }), h('span', { id: 'patName' })),
        h('div', { class: 'lcd-row' }, h('span', { id: 'lcdPart' }), h('span', { id: 'lcdPos' })),
        h('div', { class: 'meter' }, h('i', { id: 'meter' }))),
      h('div', { class: 'tempo' }, bm, h('div', null, h('b', { id: 'bpm' }), h('small', null, 'BPM')), bp),
      h('div', { class: 'transport' },
        tb('playBtn', 'play', '▶ Play', () => { S.playing ? TW.stop() : TW.play(); refreshTransport(); }),
        tb('recBtn', 'rec', '● Rec', () => { S.rec = !S.rec; S.stepPos = S.bar * TW.spb(S.pat); S.lastRec = null; if (!S.rec) S.motRec.clear(); refreshTransport(); lcd(); }),
        tb('tapBtn', '', 'Tap', () => { if (S.rec && !S.playing) { TW.stepAdvance(); S.lastRec = null; } else TW.tap(); }),
        tb('patPrev', '', '‹', () => TW.selectPat((S.pend != null ? S.pend : S.pi) - 1)),
        tb('patNext', '', '›', () => TW.selectPat((S.pend != null ? S.pend : S.pi) + 1)),
        tb('writeBtn', '', 'Write', () => { TW.write(); toast(`Pattern ${TW.pad3(S.pi)} gespeichert`); }),
        tb('menuBtn', '', 'Menü', () => menu())));
    $('#patPrev', top).setAttribute('aria-label', 'Voriges Pattern'); $('#patNext', top).setAttribute('aria-label', 'Nächstes Pattern');

    const TABS = [['osc', 'OSC'], ['filter', 'FILTER'], ['mod', 'MOD'], ['amp', 'AMP'], ['fx', 'FX'], ['tp', 'PAD']];
    const tabs = h('nav', { class: 'tabs' }), secs = h('div', { class: 'secs' });
    const showTab = (k) => { for (const b of tabs.children) b.classList.toggle('on', b.dataset.k === k); for (const s of secs.children) s.classList.toggle('on', s.dataset.s === k); };
    for (const [k, l] of TABS) tabs.append(h('button', { type: 'button', 'data-k': k, onclick: () => showTab(k) }, l));
    const knobRow = (...names) => h('div', { class: 'knobs' }, names.map(mkKnob));
    secs.append(
      h('div', { class: 'sec osc', 'data-s': 'osc' }, h('h3', null, 'OSZILLATOR'),
        h('div', { class: 'sec-head' }, selr('selOsc', 'Oszillator', () => pick('Oszillator', TW.OSCS, () => cur().osc, (i) => { TW.setParam('osc', i); refreshPanel(); S.padsDirty = true; S.lcd = true; preview(); }), (d) => { stepParam('osc', TW.OSCS, d); S.padsDirty = true; S.lcd = true; })),
        knobRow('pitch', 'glide', 'oscEdit')),
      h('div', { class: 'sec filter', 'data-s': 'filter' }, h('h3', null, 'FILTER'),
        h('div', { class: 'sec-head' }, h('div', { class: 'fbtns' }, tg('f-lp', 'LPF', () => setFilter('lp')), tg('f-hp', 'HPF', () => setFilter('hp')), tg('f-bp', 'BPF', () => setFilter('bp')), tg('f-off', 'Aus', () => setFilter('off')))),
        knobRow('cutoff', 'reso', 'egInt')),
      h('div', { class: 'sec mod', 'data-s': 'mod' }, h('h3', null, 'MODULATION'),
        h('div', { class: 'sec-head' }, selr('selMod', 'Modulation', () => pick('Modulation', TW.MODS, () => cur().modType, (i) => { TW.setParam('modType', i); refreshPanel(); }), (d) => stepParam('modType', TW.MODS, d))),
        knobRow('modSpeed', 'modDepth')),
      h('div', { class: 'sec amp', 'data-s': 'amp' }, h('h3', null, 'AMP / EG'),
        h('div', { class: 'sec-head right' }, tg('tgEg', 'Amp EG', () => togPart('ampEG'))),
        knobRow('level', 'pan', 'attack', 'decay')),
      h('div', { class: 'sec fx', 'data-s': 'fx' }, h('h3', null, 'EFFEKTE'), mkKnob('ifxEdit'),
        h('div', { class: 'sec-head' }, selr('selIfx', 'Insert-FX', () => pick('Insert-Effekt', TW.IFX, () => cur().ifx, (i) => { TW.setParam('ifx', i); if (i && !cur().ifxOn) TW.setParam('ifxOn', true); refreshPanel(); })), tg('tgIfx', 'IFX', () => togPart('ifxOn')), tg('tgSend', 'Send', () => togPart('mfxSend'))),
        h('div', { class: 'sec-head' }, selr('selMfx', 'Master-FX', () => pick('Master-Effekt', TW.MFX, () => S.pat.mfx, setMFX)), tg('tgHold', 'Hold', mfxHold))),
      h('div', { class: 'sec tp', 'data-s': 'tp' }, h('h3', null, 'TOUCHPAD'),
        h('div', { class: 'pad-row' }, mkTouchpad(),
          h('div', { class: 'pad-btns' },
            tg('tpMfx', 'MFX', () => { TW.padUp('tp'); S.padMode = 'mfx'; refreshPanel(); }),
            tg('tpScale', 'Scale', () => { S.padMode = 'scale'; refreshPanel(); }),
            tg('tgArp', 'Gate Arp', () => { S.gateArp = !S.gateArp; if (!S.gateArp) releaseAll(); refreshPanel(); }),
            tg('tgHold2', 'MFX Hold', mfxHold)))));
    const panel = h('section', { class: 'panel' }, tabs, secs);

    const modes = h('div', { class: 'modes', id: 'modes' });
    for (const [m, l] of MODES) modes.append(h('button', { type: 'button', 'data-m': m, onclick: () => setMode(m) }, l));
    const bars = h('div', { class: 'grp bars', id: 'bars' });
    for (let b = 0; b < 4; b++) bars.append(h('button', { type: 'button', 'aria-label': 'Takt ' + (b + 1), onclick: () => { if (b < S.pat.length) { S.bar = b; S.chase = false; S.stepPos = b * TW.spb(S.pat); refreshAux(); refreshPads(); lcd(); } } }, String(b + 1)));
    bars.append(h('button', { type: 'button', 'aria-label': 'Ansicht folgt dem Takt', onclick: () => { S.chase = !S.chase; refreshAux(); } }, '↻'));
    const aux = h('div', { class: 'aux' },
      h('div', { class: 'grp' }, h('button', { type: 'button', 'aria-label': 'Voriger Part', onclick: () => selectPart(S.part - 1) }, '‹'), h('b', { id: 'partLab' }), h('button', { type: 'button', 'aria-label': 'Nächster Part', onclick: () => selectPart(S.part + 1) }, '›')),
      bars, h('div', { class: 'sp' }),
      h('div', { class: 'grp' }, h('button', { type: 'button', 'aria-label': 'Oktave tiefer', onclick: () => { releaseAll(); S.oct = clamp(S.oct - 1, -3, 4); refreshAux(); refreshPads(); } }, '−'), h('b', { id: 'octLab' }), h('button', { type: 'button', 'aria-label': 'Oktave höher', onclick: () => { releaseAll(); S.oct = clamp(S.oct + 1, -3, 4); refreshAux(); refreshPads(); } }, '+')));
    app.append(top, panel, modes, aux, mkPads());
    showTab('osc');
  }

  /* ---------- Bildschleife ---------- */
  function frame() {
    requestAnimationFrame(frame);
    const now = E.ctx.currentTime;
    let moved = false;
    while (S.q.length && S.q[0].t <= now) { S.cur = S.q.shift(); moved = true; }
    for (let j = S.fl.length - 1; j >= 0; j--) if (S.fl[j].t <= now) { hitUntil[S.fl[j].i] = now + 0.09; S.fl.splice(j, 1); }
    if (S.fl.length > 300) S.fl.length = 0;
    if (!S.playing) pos = null;
    if (moved && S.playing && S.cur) {
      const sp = TW.spb(S.pat), ppos = S.cur.tick % TW.partLen(S.pat, cur()), bar = Math.floor(ppos / sp), was = pos ? pos.bar : -1;
      pos = { bar, st: ppos % sp };
      if (S.chase && S.mode === 'seq' && bar !== S.bar && !lp.some((_, k) => pads[k].classList.contains('down'))) { S.bar = bar; S.padsDirty = true; }
      if (bar !== was || S.padsDirty) refreshAux();
      lcdPos();
    }
    if (S.ui) { S.ui = false; S.knobs = S.padsDirty = S.lcd = false; refreshAll(); }
    else {
      if (S.knobs) { S.knobs = false; refreshKnobs(); }
      if (S.padsDirty) { S.padsDirty = false; refreshPads(); }
      if (S.lcd) { S.lcd = false; lcd(); }
    }
    let ph = -1;
    if (S.mode === 'seq' || S.mode === 'jump') {
      if (S.playing && pos && (S.mode === 'jump' || pos.bar === S.bar)) ph = pos.st;
      else if (!S.playing && S.rec && S.mode === 'seq') { const sp = TW.spb(S.pat); if (Math.floor(S.stepPos / sp) === S.bar) ph = S.stepPos % sp; }
    }
    if (ph !== phShown) { if (phShown >= 0) pads[phShown].classList.remove('ph'); if (ph >= 0) pads[ph].classList.add('ph'); phShown = ph; }
    const hm = S.mode === 'trigger' || S.mode === 'mute' || S.mode === 'erase';
    for (let k = 0; k < 16; k++) { const on = hm && hitUntil[k] > now; if (on !== hitShown[k]) { pads[k].classList.toggle('hit', on); hitShown[k] = on; } }
    $('#meter').style.transform = `scaleX(${Math.min(1, E.level()).toFixed(3)})`;
    if (roUntil && performance.now() > roUntil) { roUntil = 0; lcd(); }
  }

  function start() {
    TW.boot(); E = TW.E;
    build(); refreshAll();
    document.addEventListener('pointerdown', () => E.resume(), { capture: true });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeSheet();
      if (e.code === 'Space' && !/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) { e.preventDefault(); S.playing ? TW.stop() : TW.play(); refreshTransport(); }
    });
    window.addEventListener('blur', releaseAll);
    document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
    requestAnimationFrame(frame);
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  start();
})();
