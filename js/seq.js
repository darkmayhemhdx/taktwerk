/* Taktwerk – Sequencer, Aufnahme, Pattern-Speicher, Export */
(function () {
  'use strict';
  const TW = window.TW, clamp = TW.clamp;
  TW.NPAT = 250;

  /* ---------- Speicher ---------- */
  const LS = (() => {
    try { localStorage.setItem('tw.t', '1'); localStorage.removeItem('tw.t'); return localStorage; }
    catch (e) { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } }; }
  })();
  const readJSON = (k, d) => { try { return JSON.parse(LS.getItem(k)) || d; } catch (e) { return d; } };
  const G = (TW.G = Object.assign({ auto: true, metro: 1, velPos: true, vol: 100, pset: Array.from({ length: 16 }, (_, i) => i), last: 0 }, readJSON('tw.global', {})));
  TW.saveG = () => LS.setItem('tw.global', JSON.stringify(G));

  const ser = (pat) => JSON.stringify(pat, (k, v) => (k === 'steps' && Array.isArray(v) ? Object.fromEntries(v.map((s, i) => [i, s]).filter((e) => e[1])) : v));
  function deser(str) {
    const raw = JSON.parse(str), pat = Object.assign(TW.initPattern(), raw);
    pat.parts = Array.from({ length: 16 }, (_, i) => {
      const src = (raw.parts && raw.parts[i]) || {}, p = Object.assign(TW.defPart(i), src), st = new Array(64).fill(null);
      for (const k in src.steps || {}) if (src.steps[k]) st[+k] = src.steps[k];
      p.steps = st;
      return p;
    });
    return pat;
  }
  TW.ser = ser; TW.deser = deser;
  const names = {};
  TW.hasPat = (i) => LS.getItem('tw.pat.' + i) != null;
  TW.loadPat = (i) => {
    const s = LS.getItem('tw.pat.' + i);
    if (s) { try { return deser(s); } catch (e) { console.warn('Pattern defekt', i, e); } }
    return TW.FACTORY[i] ? TW.FACTORY[i]() : TW.initPattern();
  };
  TW.savePat = (i, pat) => {
    try { LS.setItem('tw.pat.' + i, ser(pat)); names[i] = pat.name; return true; }
    catch (e) { if (TW.toast) TW.toast('Speicher voll – Pattern nicht gesichert'); return false; }
  };
  TW.patName = (i) => {
    if (i === S.pi && S.pat) return S.pat.name;
    if (names[i] != null) return names[i];
    const s = LS.getItem('tw.pat.' + i);
    let n = TW.FACTORY[i] ? TW.FACTORY[i]().name : 'Init';
    if (s) { const m = /^\{"name":("(?:[^"\\]|\\.)*")/.exec(s); if (m) { try { n = JSON.parse(m[1]); } catch (e) {} } }
    return (names[i] = n);
  };
  TW.pad3 = (n) => String(n + 1).padStart(3, '0');

  /* ---------- Zustand ---------- */
  const S = (TW.S = {
    pi: 0, pat: null, part: 0, playing: false, rec: false, tick: 0, nextT: 0, loops: 0, pend: null,
    mode: 'trigger', bar: 0, chase: true, oct: 0, jump: null, jumpBase: 0, erase: new Set(), held: new Map(),
    gateArp: false, arpGate: 1, arpNext: 0, arpPos: 0, padMode: 'mfx', dirty: false,
    q: [], fl: [], ticks: [], cur: null, ui: true, knobs: false, padsDirty: false, stepPos: 0,
    lastNotes: Array.from({ length: 16 }, () => [60]), motRec: new Map(), skip: new Set(), taps: [], lastRec: null, flag: false,
  });

  TW.applyPat = function () {
    const E = TW.E, pat = S.pat;
    E.setTempo(pat.bpm); E.alt = [pat.alt1314, pat.alt1516]; E.setPatLevel(pat.level); E.setVolume(G.vol);
    for (let i = 0; i < 16; i++) E.syncPart(i, pat.parts[i]);
    E.mx = pat.mfxX; E.my = pat.mfxY; E.mfxOn = !!pat.mfxHold; E.setMFX(pat.mfx);
  };
  let saveTimer = 0;
  TW.dirty = function () { S.dirty = true; if (G.auto) { clearTimeout(saveTimer); saveTimer = setTimeout(TW.write, 700); } };
  TW.write = function () { clearTimeout(saveTimer); if (TW.savePat(S.pi, S.pat)) S.dirty = false; S.lcd = true; };
  TW.switchPat = function (i) {
    if (S.dirty && G.auto) TW.write();
    clearTimeout(saveTimer);
    S.dirty = false; S.pi = i; S.pat = TW.loadPat(i); S.motRec.clear(); S.skip.clear(); S.bar = 0; S.stepPos = 0; S.lastRec = null;
    TW.applyPat(); G.last = i; TW.saveG(); S.ui = true;
  };
  TW.selectPat = function (i) { i = clamp(i, 0, TW.NPAT - 1); if (S.playing) { S.pend = i; S.ui = true; } else TW.switchPat(i); };

  /* ---------- Ein Sequencer-Schritt (live und beim Audio-Export) ---------- */
  TW.playTick = function (E, pat, tick, t, live) {
    const sp = TW.spb(pat), sd = TW.stepDur(pat), pos = tick % (pat.length * sp), spq = [4, 8, 3, 6][pat.beat];
    E.step(t, sd, pos, spq);
    for (let i = 0; i < 16; i++) {
      const p = pat.parts[i], pp = tick % TW.partLen(pat, p), si = Math.floor(pp / sp) * 16 + (pp % sp), st = p.steps[si];
      if (p.motionMode && p.motion) {
        let ch = false;
        for (const k in p.motion) {
          if (live && live.isRec(i, k)) continue;
          const mv = p.motion[k][si];
          if (mv != null && (p.motionMode === 1 || st) && p[k] !== mv) { p[k] = mv; ch = true; E.live(i, p, k, t); }
        }
        if (ch) { E.syncPart(i, p, t); if (live && i === S.part) live.knobs = true; }
      }
      if (live) live.recMotion(i, p, si);
      if (!st) continue;
      if (live && live.skip(i, si, tick)) continue;
      if (p.mute) continue;
      let tt = t, vel = st.v;
      if (pat.swing && pat.beat < 2 && pos % 2 === 1) tt += (pat.swing / 48) * 0.5 * sd;
      const gr = TW.GROOVES[p.grooveType];
      if (gr && (gr.v || gr.t)) { const d = p.grooveDepth / 127, k = pos % 16; if (gr.v) vel *= 1 + (gr.v[k] - 1) * d; if (gr.t) tt += gr.t[k] * d * sd; }
      const gate = st.g * sd + (st.g >= 1 ? 0.012 : 0);
      for (const n of st.n) E.noteOn(i, p, n, clamp(vel, 1, 127), tt, gate);
      if (live) live.trig(i, tt);
    }
  };

  const live = {
    knobs: false,
    isRec: (i, k) => S.motRec.has(i + ':' + k),
    recMotion(i, p, si) {
      if (!S.motRec.size) return;
      for (const [key, m] of S.motRec) {
        if (m.i !== i) continue;
        if (!p.motion) p.motion = {};
        if (!p.motion[m.k]) p.motion[m.k] = new Array(64).fill(null);
        p.motion[m.k][si] = p[m.k];
        if (--m.left <= 0) S.motRec.delete(key);
        S.flag = true;
      }
    },
    skip(i, si, tick) {
      if (S.erase.has(i)) { S.pat.parts[i].steps[si] = null; S.flag = true; S.padsDirty = true; return true; }
      const key = i + ':' + tick;
      if (S.skip.has(key)) { S.skip.delete(key); return true; }
      return false;
    },
    trig(i, tt) { S.fl.push({ i, t: tt }); },
  };

  function liveTick(t) {
    const E = TW.E;
    let pat = S.pat, sp = TW.spb(pat), total = pat.length * sp;
    if (S.jump != null) S.tick = S.jumpBase + Math.min(S.jump, sp - 1);
    else if (S.tick > 0 && S.tick % total === 0) {
      S.loops++;
      if (S.pend == null && pat.chainTo >= 0 && S.loops >= pat.chainRepeat) S.pend = pat.chainTo;
      if (S.pend != null) { TW.switchPat(S.pend); S.pend = null; S.tick = 0; S.loops = 0; pat = S.pat; sp = TW.spb(pat); total = pat.length * sp; }
    }
    const pos = S.tick % total, sd = TW.stepDur(pat), spq = [4, 8, 3, 6][pat.beat];
    if ((G.metro === 2 || (G.metro === 1 && S.rec)) && pos % spq === 0) E.click(t, pos % (spq * 4) === 0);
    TW.playTick(E, pat, S.tick, t, live);
    arpTick(t, sd, pos);
    S.q.push({ t, tick: S.tick });
    S.ticks.push({ t, tick: S.tick }); if (S.ticks.length > 6) S.ticks.shift();
    if (S.flag) { S.flag = false; TW.dirty(); }
    if (live.knobs) { live.knobs = false; S.knobs = true; }
    S.tick++;
    return sd;
  }
  function arpTick(t, sd, pos) {
    if (!S.gateArp || !S.held.size) return;
    const ga = TW.GATE_ARPS[S.pat.gateArp] || TW.GATE_ARPS[0], g = ga.g[pos % ga.g.length], div = ga.d || 1;
    if (!g) return;
    for (let d = 0; d < div; d++) {
      const tt = t + (d * sd) / div;
      for (const h of S.held.values()) {
        const p = S.pat.parts[h.i];
        if (p.mute) continue;
        for (const n of h.notes) TW.E.noteOn(h.i, p, n, h.vel, tt, Math.max(0.01, ((g * sd) / div) * S.arpGate));
        S.fl.push({ i: h.i, t: tt });
      }
    }
  }
  function loop() {
    const E = TW.E, now = E.ctx.currentTime;
    if (S.playing) { let guard = 0; while (S.nextT < now + 0.12 && guard++ < 64) S.nextT += liveTick(Math.max(S.nextT, now)); }
    else if (S.gateArp && S.held.size) {
      const sd = TW.stepDur(S.pat);
      if (S.arpNext < now - 0.2) { S.arpNext = now + 0.005; S.arpPos = 0; }
      while (S.arpNext < now + 0.12) { arpTick(S.arpNext, sd, S.arpPos++); S.arpNext += sd; }
    }
    E.sweep();
  }

  TW.boot = function () {
    const AC = window.AudioContext || window.webkitAudioContext;
    TW.E = new TW.Engine(new AC({ latencyHint: 'interactive' }));
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    S.pi = clamp(G.last | 0, 0, TW.NPAT - 1);
    S.pat = TW.loadPat(S.pi);
    TW.applyPat();
    setInterval(loop, 25);
  };
  TW.play = function () {
    const E = TW.E; E.resume();
    S.playing = true; S.tick = 0; S.loops = 0; S.nextT = E.ctx.currentTime + 0.06; S.q.length = 0; S.ticks.length = 0; S.ui = true;
  };
  TW.stop = function () {
    S.playing = false; S.jump = null; S.cur = null; S.q.length = 0; S.motRec.clear(); S.skip.clear();
    if (S.pend != null) { TW.switchPat(S.pend); S.pend = null; }
    S.ui = true;
  };
  TW.setBpm = (v) => { S.pat.bpm = clamp(Math.round(v * 10) / 10, 20, 300); TW.E.setTempo(S.pat.bpm); TW.dirty(); S.lcd = true; };
  TW.tap = function () {
    const now = performance.now();
    S.taps = S.taps.filter((t) => now - t < 2500); S.taps.push(now);
    if (S.taps.length >= 2) TW.setBpm(60000 / ((S.taps[S.taps.length - 1] - S.taps[0]) / (S.taps.length - 1)));
  };
  TW.setParam = function (name, v, i = S.part) {
    const p = S.pat.parts[i];
    p[name] = v;
    TW.E.live(i, p, name); TW.E.syncPart(i, p);
    if (S.rec && S.playing && p.motionMode && TW.MOTION_PARAMS.includes(name)) S.motRec.set(i + ':' + name, { i, k: name, left: TW.partLen(S.pat, p) });
    TW.dirty();
  };

  /* ---------- Spielen und Aufnehmen ---------- */
  const merge = (st, notes) => { for (const n of notes) if (!st.n.includes(n) && st.n.length < 4) st.n.push(n); };
  function recNote(i, notes, vel, now) {
    const pat = S.pat, p = pat.parts[i], sp = TW.spb(pat);
    let best = { t: S.nextT, tick: S.tick, fut: true }, bd = Math.abs(S.nextT - now);
    for (const k of S.ticks) { const d = Math.abs(k.t - now); if (d < bd) { bd = d; best = k; } }
    const pp = best.tick % TW.partLen(pat, p), si = Math.floor(pp / sp) * 16 + (pp % sp), lr = S.lastRec;
    if (lr && lr.i === i && lr.si === si && now - lr.at < 0.15 && p.steps[si]) merge(p.steps[si], notes);
    else p.steps[si] = { n: notes.slice(0, 4), v: Math.round(vel), g: 0.75 };
    S.lastRec = { i, si, at: now };
    if (best.fut) S.skip.add(i + ':' + best.tick);
    TW.dirty(); S.padsDirty = true;
    return { si, t: best.t };
  }
  function stepRec(i, notes, vel, now) {
    const pat = S.pat, p = pat.parts[i], sp = TW.spb(pat), total = pat.length * sp, lr = S.lastRec;
    if (lr && lr.i === i && now - lr.at < 0.12 && p.steps[lr.si]) { merge(p.steps[lr.si], notes); lr.at = now; }
    else {
      const pos = S.stepPos % total, si = Math.floor(pos / sp) * 16 + (pos % sp);
      p.steps[si] = { n: notes.slice(0, 4), v: Math.round(vel), g: 0.75 };
      S.lastRec = { i, si, at: now };
      TW.stepAdvance();
    }
    TW.dirty(); S.ui = true;
  }
  TW.stepAdvance = function () {
    const sp = TW.spb(S.pat), total = S.pat.length * sp;
    S.stepPos = (S.stepPos + 1) % total; S.bar = Math.floor(S.stepPos / sp); S.ui = true;
  };
  TW.padDown = function (key, i, notes, vel, noLast) {
    const E = TW.E; E.resume();
    TW.padUp(key);
    const p = S.pat.parts[i], now = E.ctx.currentTime, h = { i, notes, vel, voices: [] };
    S.held.set(key, h); if (!noLast) S.lastNotes[i] = notes.slice();
    if (S.gateArp) return;
    if (!p.mute) h.voices = notes.map((n) => E.noteOn(i, p, n, vel, now, null));
    S.fl.push({ i, t: now });
    if (S.rec) { if (S.playing) h.rec = recNote(i, notes, vel, now); else stepRec(i, notes, vel, now); }
  };
  TW.padUp = function (key) {
    const h = S.held.get(key);
    if (!h) return;
    S.held.delete(key);
    const E = TW.E, p = S.pat.parts[h.i], now = E.ctx.currentTime;
    for (const v of h.voices) E.noteOff(v, p, now);
    if (h.rec) { const st = p.steps[h.rec.si]; if (st) { st.g = clamp(Math.round(((now - h.rec.t) / TW.stepDur(S.pat)) * 4) / 4, 0.25, 64); TW.dirty(); } }
  };

  /* ---------- Bearbeiten ---------- */
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const done = () => { TW.applyPat(); TW.dirty(); S.ui = true; };
  TW.clearSteps = (i) => { S.pat.parts[i].steps.fill(null); done(); };
  TW.clearMotion = (i) => { S.pat.parts[i].motion = null; done(); };
  TW.copyPart = (a, b) => { if (a !== b) { S.pat.parts[b] = clone(S.pat.parts[a]); done(); } };
  TW.initPart = (i) => { const st = S.pat.parts[i].steps; S.pat.parts[i] = TW.defPart(i); S.pat.parts[i].steps = st; done(); };
  TW.clearPattern = () => { S.pat = TW.initPattern(); done(); };
  TW.copyPatTo = (dst) => TW.savePat(dst, S.pat);

  /* ---------- Audio-Export ---------- */
  TW.renderPattern = async function (loops) {
    const pat = clone(S.pat), sp = TW.spb(pat), sd = TW.stepDur(pat), total = pat.length * sp * loops, dur = total * sd + 2.5;
    const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext, oc = new OC(2, Math.ceil(dur * 44100), 44100), E = new TW.Engine(oc, true);
    E.setTempo(pat.bpm); E.alt = [pat.alt1314, pat.alt1516]; E.setPatLevel(pat.level); E.setVolume(100);
    for (let i = 0; i < 16; i++) E.syncPart(i, pat.parts[i]);
    E.mx = pat.mfxX; E.my = pat.mfxY; E.mfxOn = !!pat.mfxHold; E.setMFX(pat.mfx);
    let t = 0.05;
    for (let k = 0; k < total; k++) { TW.playTick(E, pat, k, t, null); t += sd; }
    E.finalize();
    return oc.startRendering();
  };
  TW.wavBlob = function (buf) {
    const n = buf.length, ch = buf.numberOfChannels, dv = new DataView(new ArrayBuffer(44 + n * ch * 2));
    const str = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); dv.setUint32(4, 36 + n * ch * 2, true); str(8, 'WAVEfmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, ch, true);
    dv.setUint32(24, buf.sampleRate, true); dv.setUint32(28, buf.sampleRate * ch * 2, true); dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true); str(36, 'data'); dv.setUint32(40, n * ch * 2, true);
    const data = []; for (let c = 0; c < ch; c++) data.push(buf.getChannelData(c));
    let o = 44;
    for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { dv.setInt16(o, clamp(data[c][i], -1, 1) * 32767, true); o += 2; }
    return new Blob([dv], { type: 'audio/wav' });
  };
  TW.saveFile = function (name, blob) {
    const mh = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.save;
    if (mh) { const r = new FileReader(); r.onload = () => mh.postMessage({ name, data: String(r.result).split(',')[1] }); r.readAsDataURL(blob); return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  TW.exportData = function () {
    if (S.dirty) TW.write();
    const pats = {};
    for (let i = 0; i < TW.NPAT; i++) { const s = LS.getItem('tw.pat.' + i); if (s) pats[i] = s; }
    return new Blob([JSON.stringify({ app: 'Taktwerk', v: 1, global: G, pats })], { type: 'application/json' });
  };
  TW.importData = function (text) {
    const d = JSON.parse(text);
    if (d.app !== 'Taktwerk' || !d.pats) throw new Error('Keine Taktwerk-Sicherung');
    for (const i in d.pats) { deser(d.pats[i]); LS.setItem('tw.pat.' + i, d.pats[i]); delete names[i]; }
    if (d.global) { Object.assign(G, d.global); TW.saveG(); }
    S.dirty = false; TW.switchPat(S.pi);
  };
  TW.factoryReset = function () {
    for (let i = 0; i < TW.NPAT; i++) { LS.removeItem('tw.pat.' + i); delete names[i]; }
    S.dirty = false; TW.switchPat(0);
  };
})();
